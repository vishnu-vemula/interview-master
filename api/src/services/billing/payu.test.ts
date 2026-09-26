import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../../models/user.model';
import Plan from '../../models/plan.model';
import PaymentOrder from '../../models/payment-order.model';
import Subscription from '../../models/subscription.model';
import { checkoutHash, responseHash, verifyResponseHash } from './payu';
import { createCheckout, handlePaymentNotification, requestRefund, reconcileRefund } from './billing.service';
import { retireCandidateAccount } from '../account-deletion.service';

const sha = (value: string) => createHash('sha512').update(value).digest('hex');

test('PayU hashes use the documented field order and reject changed payloads', () => {
  const fields = { key: 'merchant', txnid: 'txn1', amount: '125.00', productinfo: 'Plan',
    firstname: 'Asha', email: 'asha@example.com', udf1: 'user', udf2: 'plan' };
  assert.equal(checkoutHash(fields, 'salt'), sha('merchant|txn1|125.00|Plan|Asha|asha@example.com|user|plan|||||||||salt'));
  const callback = { ...fields, status: 'success' };
  const hash = sha('salt|success|||||||||plan|user|asha@example.com|Asha|Plan|125.00|txn1|merchant');
  assert.equal(responseHash(callback, 'salt'), hash);
  assert.equal(verifyResponseHash({ ...callback, hash }, 'salt'), true);
  assert.equal(verifyResponseHash({ ...callback, amount: '1.00', hash }, 'salt'), false);
  const withCharges = { ...callback, additional_charges: '2.00' };
  assert.equal(responseHash(withCharges, 'salt'), sha('2.00|salt|success|||||||||plan|user|asha@example.com|Asha|Plan|125.00|txn1|merchant'));
});

test('PayU fulfillment and refund require verified provider state and stay idempotent',
  { skip: !process.env.TEST_MONGO_URI }, async () => {
    const uri = process.env.TEST_MONGO_URI!;
    if (!uri.endsWith('/interviewmaster_billing_test')) throw new Error('TEST_MONGO_URI must target interviewmaster_billing_test');
    process.env.PAYU_ENV = 'test';
    process.env.PAYU_MERCHANT_KEY = 'merchant';
    process.env.PAYU_MERCHANT_SALT = 'salt';
    process.env.API_PUBLIC_URL = 'http://localhost:5000';
    process.env.CLIENT_URL = 'http://localhost:5173';
    process.env.JWT_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
    const originalFetch = globalThis.fetch;
    await mongoose.connect(uri);
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Plan.init(), PaymentOrder.init(), Subscription.init()]);
      const user: any = await User.create({ name: 'Asha Test', email: 'asha@example.com', password: 'StrongPassword123!', role: 'candidate' });
      const plan: any = await Plan.create({ code: 'TEST', name: 'Test Pass', price: 125, amountMinor: 12500,
        currency: 'INR', durationDays: 30, credits: 3, postedBy: user._id });
      const first = await createCheckout(user, String(plan._id), 'idempotency-key-0001', '9876543210');
      const repeat = await createCheckout(user, String(plan._id), 'idempotency-key-0001', '9876543210');
      assert.equal(first.transactionId, repeat.transactionId);
      const { default: app } = await import('../../app.js') as any;
      const { generateAccessToken, generateRefreshToken } = await import('../../utils/jwt.utils.js');
      const server = app.listen(0);
      try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not bind');
        const base = `http://127.0.0.1:${address.port}`;
        const preflight = await originalFetch(`${base}/api/billing/checkout`, { method: 'OPTIONS', headers: {
          Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization,idempotency-key',
        } });
        assert.equal(preflight.status, 204);
        assert.match(preflight.headers.get('access-control-allow-headers') || '', /Idempotency-Key/i);
        const checkout = await originalFetch(`${base}/api/billing/checkout`, { method: 'POST', headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(user._id)}`,
          'Idempotency-Key': 'idempotency-key-0001', Origin: 'http://localhost:5173',
        }, body: JSON.stringify({ planId: String(plan._id), phone: '9876543210' }) });
        assert.equal(checkout.status, 201);
        assert.equal((await checkout.json()).transactionId, first.transactionId);
        const support: any = await User.create({ name: 'Support Tester', email: 'support@example.com',
          password: 'StrongPassword123!', role: 'support' });
        const supportHeaders = { Authorization: `Bearer ${generateAccessToken(support._id)}` };
        const permitted = await originalFetch(`${base}/api/admin/payments/transactions`, { headers: supportHeaders });
        assert.equal(permitted.status, 200);
        const forbidden = await originalFetch(`${base}/api/admin/analytics/stats`, { headers: supportHeaders });
        assert.equal(forbidden.status, 403);
        const forbiddenDelete = await originalFetch(`${base}/api/admin/users/bulk`, { method: 'POST',
          headers: { ...supportHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [String(user._id)], action: 'delete' }) });
        assert.equal(forbiddenDelete.status, 403);
        await User.updateOne({ _id: user._id }, { $set: { isBanned: true } });
        const blockedRefresh = await originalFetch(`${base}/api/auth/refresh`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: generateRefreshToken(user._id) }) });
        assert.equal(blockedRefresh.status, 401);
        await User.updateOne({ _id: user._id }, { $set: { isBanned: false } });
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      plan.credits = 99;
      plan.durationDays = 365;
      await plan.save();
      const payment = { ...first.fields, status: 'success', mihpayid: '403993715521937565', unmappedstatus: 'captured' };
      const callback = { ...payment, hash: responseHash(payment, 'salt') };
      await assert.rejects(handlePaymentNotification({ ...callback, amount: '1.00' }));
      assert.equal(await Subscription.countDocuments(), 0);

      let verifiedStatus = 'failure';
      globalThis.fetch = async (_url: any, init: any) => {
        const form = init.body as URLSearchParams;
        const command = form.get('command');
        let data: any;
        if (command === 'verify_payment') data = { status: 1, transaction_details: { [String(form.get('var1'))]: {
          txnid: String(form.get('var1')), transaction_amount: '125.00', amt: '125.00',
          productinfo: payment.productinfo, udf1: payment.udf1, udf2: payment.udf2,
          status: verifiedStatus,
          unmappedstatus: verifiedStatus === 'success' ? 'captured' : 'failed', mihpayid: payment.mihpayid,
        } } };
        else if (command === 'cancel_refund_transaction') {
          assert.equal(form.get('var5'), 'http://localhost:5000/api/billing/payu/webhook');
          data = { status: 1, request_id: '131278422' };
        }
        else if (command === 'check_action_status_txnid') data = { status: 1, transaction_details: {
          '131278422': { '131278422': { token: refundToken, mihpayid: payment.mihpayid,
            amt: '125.00', status: 'success' } },
        } };
        else throw new Error('Unexpected PayU command');
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      let refundToken = '';
      await handlePaymentNotification(callback);
      assert.equal(await Subscription.countDocuments(), 0);
      verifiedStatus = 'success';
      await handlePaymentNotification(callback);
      await handlePaymentNotification(callback);
      assert.equal(await Subscription.countDocuments(), 1);
      const pass: any = await Subscription.findOne();
      assert.equal(pass.creditLimit, 3);
      assert.ok(Math.abs((pass.currentPeriodEnd.getTime() - pass.currentPeriodStart.getTime()) / 86_400_000 - 30) < 0.001);
      await assert.rejects(createCheckout(user, String(plan._id), 'idempotency-key-0002', '9876543210'));
      const order: any = await PaymentOrder.findOne({ transactionId: first.transactionId });
      assert.equal(order.status, 'success');
      const refund: any = await requestRefund(String(order._id));
      refundToken = refund.refundToken;
      assert.equal(refund.status, 'refund_pending');
      assert.equal(await Subscription.countDocuments({ status: 'active' }), 1);
      await reconcileRefund(String(order._id));
      assert.equal(await Subscription.countDocuments({ status: 'active' }), 0);
      assert.equal((await PaymentOrder.findById(order._id))?.status, 'refunded');

      const second = await createCheckout(user, String(plan._id), 'idempotency-key-0003', '9876543210');
      const failedPayment = { ...second.fields, status: 'failure', mihpayid: 'another-payu-id' };
      verifiedStatus = 'failure';
      await handlePaymentNotification({ ...failedPayment, hash: responseHash(failedPayment, 'salt') });
      assert.equal((await PaymentOrder.findOne({ transactionId: second.transactionId }))?.status, 'failed');
      await retireCandidateAccount(String(user._id));
      const retired: any = await User.findById(user._id);
      assert.equal(retired.isActive, false);
      assert.ok(retired.deletedAt);
      const anonymized: any = await PaymentOrder.findOne({ transactionId: second.transactionId });
      assert.notEqual(anonymized.email, second.fields.email);
      const delayedSuccess = { ...second.fields, status: 'success', mihpayid: 'another-payu-id' };
      verifiedStatus = 'success';
      await handlePaymentNotification({ ...delayedSuccess, hash: responseHash(delayedSuccess, 'salt') });
      assert.equal((await PaymentOrder.findOne({ transactionId: second.transactionId }))?.status, 'success');
      assert.equal(await Subscription.countDocuments({ orderId: anonymized._id }), 0);
    } finally {
      globalThis.fetch = originalFetch;
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });
