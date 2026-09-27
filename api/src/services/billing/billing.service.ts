import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import PaymentOrder from '../../models/payment-order.model';
import Plan from '../../models/plan.model';
import Subscription from '../../models/subscription.model';
import WebhookLog from '../../models/webhook-log.model';
import User from '../../models/user.model';
import { checkoutHash, payuCommand, payuConfig, verifyResponseHash } from './payu';

const money = (minor: number) => (minor / 100).toFixed(2);
const minorOf = (value: unknown) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value ?? ''))) return NaN;
  return Math.round(Number(value) * 100);
};

export const callbackContactTag = (value: string) => createHmac('sha256', payuConfig().salt)
  .update(value, 'utf8').digest('hex');
const contactMatches = (actual: string, stored: string, tag: string | null | undefined) => {
  if (actual === stored) return true;
  if (!tag) return false;
  const received = Buffer.from(callbackContactTag(actual), 'hex');
  const expected = Buffer.from(tag, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
};

export async function createCheckout(user: any, planId: string, idempotencyKey: string, phone: string) {
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey)) throw new Error('Valid idempotency key required');
  if (!/^\d{10}$/.test(phone)) throw new Error('A 10-digit phone number is required for PayU checkout');
  // Reject broken provider configuration before a pending order is persisted.
  const config = payuConfig();
  const apiUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
  if (!apiUrl || !apiUrl.startsWith('https://') && !apiUrl.startsWith('http://localhost:')) {
    throw new Error('API_PUBLIC_URL must be an HTTPS URL or localhost');
  }
  const plan: any = await Plan.findOne({ _id: planId, isPublished: true, isArchived: false });
  if (!plan || plan.currency !== 'INR' || !Number.isSafeInteger(plan.amountMinor) || plan.amountMinor < 100 ||
    !Number.isSafeInteger(plan.credits) || plan.credits < 1 || !Number.isSafeInteger(plan.durationDays) || plan.durationDays < 1) {
    throw new Error('This plan is unavailable for checkout');
  }
  if (await getActiveSubscription(String(user._id))) {
    throw new Error('Your current pass is still active');
  }
  let order: any = await PaymentOrder.findOne({ idempotencyKey });
  if (order && (String(order.userId) !== String(user._id) || String(order.planId) !== planId)) {
    throw new Error('Idempotency key belongs to another checkout');
  }
  if (!order) {
    try {
      order = await PaymentOrder.create({
        userId: user._id, planId: plan._id,
        transactionId: `IM${randomBytes(11).toString('hex')}`,
        idempotencyKey, amountMinor: plan.amountMinor, creditLimit: plan.credits,
        durationDays: plan.durationDays, currency: 'INR',
        productInfo: `Rehearsly ${plan.name}`.slice(0, 100),
        firstName: String(user.name || 'Candidate').trim().split(/\s+/)[0].slice(0, 50),
        email: user.email, phone, status: 'pending',
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      order = await PaymentOrder.findOne({ idempotencyKey });
    }
  }
  if (!order || order.status !== 'pending') throw new Error('This checkout is no longer pending');
  if (order.phone !== phone) throw new Error('Idempotency key belongs to another checkout');
  const fields = {
    key: config.key, txnid: order.transactionId, amount: money(order.amountMinor),
    productinfo: order.productInfo, firstname: order.firstName, email: order.email, phone: order.phone,
    udf1: String(order.userId), udf2: String(order.planId),
    surl: `${apiUrl}/api/billing/payu/return`,
    furl: `${apiUrl}/api/billing/payu/return`,
  };
  return { transactionId: order.transactionId, action: config.checkoutUrl, fields: { ...fields, hash: checkoutHash(fields, config.salt) } };
}

export async function getActiveSubscription(userId: string) {
  return Subscription.findOne({ userId, status: 'active', currentPeriodEnd: { $gt: new Date() } })
    .sort({ currentPeriodEnd: -1 }).populate('planId');
}

export async function verifyPayment(transactionId: string) {
  const result = await payuCommand('verify_payment', transactionId);
  const detail = result?.transaction_details?.[transactionId];
  if (Number(result?.status) !== 1 || !detail || typeof detail !== 'object') {
    throw new Error('PayU has not confirmed this payment');
  }
  return detail;
}

async function grantSubscription(order: any) {
  if (order.status !== 'success') return;
  const user = await User.findById(order.userId).select('isActive isBanned deletedAt');
  if (!user || !user.isActive || user.isBanned || user.deletedAt) return;
  const start = new Date();
  const end = new Date(start.getTime() + order.durationDays * 86_400_000);
  await Subscription.updateOne({ orderId: order._id }, { $setOnInsert: {
    userId: order.userId, planId: order.planId, orderId: order._id,
    creditLimit: order.creditLimit, status: 'active',
    currentPeriodStart: start, currentPeriodEnd: end,
  } }, { upsert: true });
}

export async function reconcilePayment(transactionId: string) {
  const order: any = await PaymentOrder.findOne({ transactionId });
  if (!order) throw new Error('Unknown transaction');
  if (order.status === 'refunded' || order.status === 'refund_pending') return order;
  const detail = await verifyPayment(transactionId);
  const actualMinor = minorOf(detail.transaction_amount ?? detail.amt);
  if (actualMinor !== order.amountMinor || String(detail.txnid || transactionId) !== transactionId ||
    String(detail.productinfo || '') !== order.productInfo ||
    String(detail.udf1 || '') !== String(order.userId) ||
    String(detail.udf2 || '') !== String(order.planId)) {
    throw new Error('PayU payment details do not match the order');
  }
  const payuId = String(detail.mihpayid || '');
  if (detail.status === 'success' && detail.unmappedstatus === 'captured' && payuId) {
    await PaymentOrder.updateOne({ _id: order._id, status: { $in: ['pending', 'failed'] } },
      { $set: { status: 'success', payuId, failureCode: null } });
  } else if (['failure', 'failed'].includes(detail.status) && order.status === 'pending') {
    await PaymentOrder.updateOne({ _id: order._id, status: 'pending' },
      { $set: { status: 'failed', failureCode: String(detail.error || 'payment_failed').slice(0, 80) } });
  }
  const current: any = await PaymentOrder.findById(order._id);
  await grantSubscription(current);
  return current;
}

export async function handlePaymentNotification(payload: Record<string, unknown>) {
  const config = payuConfig();
  if (String(payload.key || '') !== config.key || !verifyResponseHash(payload, config.salt)) {
    throw new Error('Invalid PayU response hash');
  }
  const transactionId = String(payload.txnid || '');
  const order: any = await PaymentOrder.findOne({ transactionId }).select('+callbackEmailTag +callbackPhoneTag');
  if (!order || minorOf(payload.amount) !== order.amountMinor ||
    String(payload.productinfo || '') !== order.productInfo ||
    !contactMatches(String(payload.email || ''), order.email, order.callbackEmailTag) ||
    !contactMatches(String(payload.phone || ''), order.phone, order.callbackPhoneTag) ||
    String(payload.udf1 || '') !== String(order.userId) ||
    String(payload.udf2 || '') !== String(order.planId)) {
    throw new Error('PayU response does not match an order');
  }
  const eventId = `payment:${transactionId}:${String(payload.status)}:${String(payload.mihpayid || '')}`;
  const current = await reconcilePayment(transactionId);
  try {
    await WebhookLog.create({
      provider: 'payu', eventId, eventType: `payment.${String(payload.status)}`,
      payload: { transactionId, payuId: String(payload.mihpayid || ''), status: String(payload.status) },
      status: 'processed',
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }
  return current;
}

export async function requestRefund(orderId: string) {
  const order: any = await PaymentOrder.findById(orderId);
  if (!order || !order.payuId) throw new Error('Paid order not refundable');
  if (order.status === 'refund_pending') return order;
  if (order.status !== 'success') throw new Error('Paid order not refundable');
  const apiUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
  if (!apiUrl || !apiUrl.startsWith('https://') && !apiUrl.startsWith('http://localhost:')) {
    throw new Error('API_PUBLIC_URL must be an HTTPS URL or localhost');
  }
  const token = `IMR${randomBytes(10).toString('hex')}`;
  const claimed: any = await PaymentOrder.findOneAndUpdate({ _id: order._id, status: 'success' },
    { $set: { status: 'refund_pending', refundToken: token } }, { new: true });
  if (!claimed) return PaymentOrder.findById(order._id);
  const result = await payuCommand('cancel_refund_transaction', order.payuId,
    { var2: token, var3: money(order.amountMinor), var5: `${apiUrl}/api/billing/payu/webhook` });
  if (Number(result?.status) !== 1 && Number(result?.error_code) !== 102) {
    await PaymentOrder.updateOne({ _id: order._id, status: 'refund_pending', refundToken: token },
      { $set: { status: 'success', refundToken: null } });
    throw new Error('PayU did not accept the refund request');
  }
  await PaymentOrder.updateOne({ _id: order._id, status: 'refund_pending', refundToken: token },
    { $set: { refundRequestId: String(result.request_id || '') } });
  if (!result.request_id) throw new Error('PayU accepted the refund without a request ID; reconcile it manually');
  return PaymentOrder.findById(order._id);
}

export async function reconcileRefund(orderId: string) {
  const order: any = await PaymentOrder.findById(orderId);
  if (!order || order.status !== 'refund_pending' || !order.refundRequestId) throw new Error('No refund to reconcile');
  const result = await payuCommand('check_action_status_txnid', order.refundRequestId);
  if (Number(result?.status) !== 1) throw new Error('PayU refund status is unavailable');
  const outer = result?.transaction_details?.[order.refundRequestId];
  const detail = outer?.[order.refundRequestId] || outer;
  if (String(detail?.token || '') !== order.refundToken || String(detail?.mihpayid || '') !== order.payuId ||
    minorOf(detail?.amt) !== order.amountMinor) throw new Error('Refund status could not be verified');
  if (String(detail.status).toLowerCase() === 'success') {
    await PaymentOrder.updateOne({ _id: order._id, status: 'refund_pending' }, { $set: { status: 'refunded' } });
    await Subscription.updateOne({ orderId: order._id }, { $set: { status: 'refunded', canceledAt: new Date() } });
  } else if (String(detail.status).toLowerCase() === 'failure') {
    await PaymentOrder.updateOne({ _id: order._id, status: 'refund_pending' }, { $set: { status: 'success' } });
  }
  return PaymentOrder.findById(order._id);
}

export async function handleRefundNotification(payload: Record<string, unknown>) {
  const config = payuConfig();
  if (String(payload.key || '') !== config.key || String(payload.action || '').toLowerCase() !== 'refund') {
    throw new Error('Invalid refund notification');
  }
  const transactionId = String(payload.merchantTxnId || '');
  const order: any = await PaymentOrder.findOne({ transactionId, status: 'refund_pending' });
  if (!order || String(payload.token || '') !== order.refundToken ||
    String(payload.mihpayid || '').trim() !== order.payuId || minorOf(payload.amt) !== order.amountMinor) {
    throw new Error('Refund notification does not match an order');
  }
  if (!order.refundRequestId && payload.request_id) {
    order.refundRequestId = String(payload.request_id);
    await order.save();
  }
  // Refund callbacks lack the payment reverse hash. Recheck with PayU before revoking access.
  const current = await reconcileRefund(String(order._id));
  const eventId = `refund:${order.refundToken}:${String(current?.status || '')}`;
  try {
    await WebhookLog.create({ provider: 'payu', eventId, eventType: 'refund.status',
      payload: { transactionId, requestId: order.refundRequestId, status: String(current?.status || '') }, status: 'processed' });
  } catch (error: any) { if (error?.code !== 11000) throw error; }
  return current;
}
