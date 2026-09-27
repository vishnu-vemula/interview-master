import type { Request, Response } from 'express';
import Plan from '../models/plan.model';
import PaymentOrder from '../models/payment-order.model';
import { createCheckout, getActiveSubscription, handlePaymentNotification, handleRefundNotification, reconcilePayment, reconcileRefund } from '../services/billing/billing.service';
import { allowanceFor } from '../services/billing/entitlements';
import logger from '../config/logger';

const checkoutMessages = new Set([
  'Valid idempotency key required',
  'A 10-digit phone number is required for PayU checkout',
  'This plan is unavailable for checkout',
  'Your current pass is still active',
  'Idempotency key belongs to another checkout',
  'This checkout is no longer pending',
]);

export const listPlans = async (_req: Request, res: Response) => {
  const plans = await Plan.find({ isPublished: true, isArchived: false, currency: 'INR', amountMinor: { $gte: 100 } })
    .select('code name description amountMinor currency durationDays credits features').sort({ amountMinor: 1 });
  res.json({ success: true, plans });
};

export const checkout = async (req: Request, res: Response) => {
  try {
    const idempotencyKey = String(req.headers['idempotency-key'] || '');
    const planId = String(req.body?.planId || '');
    if (!/^[0-9a-f]{24}$/i.test(planId)) return res.status(400).json({ success: false, message: 'This plan is unavailable for checkout' });
    const result = await createCheckout(req.user, planId, idempotencyKey, String(req.body?.phone || ''));
    res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    if (checkoutMessages.has(error?.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error(`PayU checkout failed: ${error?.name || 'Error'}`);
    res.status(503).json({ success: false, message: 'Checkout is temporarily unavailable. Please retry.' });
  }
};

export const me = async (req: Request, res: Response) => {
  const subscription = await getActiveSubscription(String(req.user._id));
  const orders = await PaymentOrder.find({ userId: req.user._id })
    .select('transactionId status amountMinor currency createdAt').sort({ createdAt: -1 }).limit(20);
  const allowance = await allowanceFor(String(req.user._id));
  res.json({ success: true, subscription, orders, allowance });
};

export const orderStatus = async (req: Request, res: Response) => {
  const order: any = await PaymentOrder.findOne({ transactionId: req.params.transactionId, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (['pending', 'failed', 'success'].includes(order.status)) {
    try { await reconcilePayment(order.transactionId); } catch { /* PayU may not have settled yet. */ }
  }
  if (order.status === 'refund_pending' && order.refundRequestId) {
    try { await reconcileRefund(String(order._id)); } catch { /* Keep pending for retry. */ }
  }
  const current = await PaymentOrder.findById(order._id).select('transactionId status amountMinor currency createdAt');
  res.json({ success: true, order: current });
};

export const payuNotification = async (req: Request, res: Response) => {
  try {
    if (String(req.body?.action || '').toLowerCase() === 'refund') await handleRefundNotification(req.body);
    else await handlePaymentNotification(req.body || {});
    res.status(200).json({ success: true });
  } catch {
    res.status(400).json({ success: false, message: 'Invalid or unverified payment notification' });
  }
};

export const payuReturn = async (req: Request, res: Response) => {
  const transactionId = String(req.body?.txnid || '');
  try { await handlePaymentNotification(req.body || {}); } catch { /* Display verified server state to the customer. */ }
  const url = new URL('/billing/result', process.env.CLIENT_URL || 'http://localhost:5173');
  if (transactionId) url.searchParams.set('txnid', transactionId);
  res.redirect(303, url.toString());
};
