import type { Request, Response } from 'express';
import PaymentOrder from '../models/payment-order.model';
import WebhookLog from '../models/webhook-log.model';
import { requestRefund, reconcileRefund } from '../services/billing/billing.service';

const paging = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || 12), 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
};

export const getAllTransactions = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const status = String(req.query.status || 'all');
  const filter: any = {};
  if (['pending', 'success', 'failed', 'refund_pending', 'refunded'].includes(status)) filter.status = status;
  if (req.query.search) filter.transactionId = String(req.query.search).slice(0, 80);
  const [orders, total] = await Promise.all([
    PaymentOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('userId', 'name email').populate('planId', 'name'),
    PaymentOrder.countDocuments(filter),
  ]);
  const transactions = orders.map((order: any) => ({
    _id: order._id, transactionId: order.transactionId, userId: order.userId,
    planId: order.planId, amount: order.amountMinor / 100, amountMinor: order.amountMinor,
    currency: order.currency, status: order.status, paymentMethod: 'PayU',
    createdAt: order.createdAt, refundRequestId: order.refundRequestId,
  }));
  res.json({ success: true, data: { transactions, total, page, pages: Math.ceil(total / limit) } });
};

export const refundTransaction = async (req: Request, res: Response) => {
  try {
    const order = await requestRefund(String(req.params.id));
    res.status(202).json({ success: true, message: 'Refund requested from PayU; awaiting confirmation.', order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const reconcileRefundTransaction = async (req: Request, res: Response) => {
  try {
    const order = await reconcileRefund(String(req.params.id));
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getPaymentStats = async (_req: Request, res: Response) => {
  const [success, refunded, failed] = await Promise.all([
    PaymentOrder.aggregate([{ $match: { status: { $in: ['success', 'refund_pending'] } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountMinor' } } }]),
    PaymentOrder.aggregate([{ $match: { status: 'refunded' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountMinor' } } }]),
    PaymentOrder.countDocuments({ status: 'failed' }),
  ]);
  res.json({ success: true, data: {
    currency: 'INR', totalRevenue: (success[0]?.amount || 0) / 100,
    successfulSales: success[0]?.count || 0, refundedSales: refunded[0]?.count || 0,
    totalRefunded: (refunded[0]?.amount || 0) / 100, failedSales: failed,
  } });
};

export const getWebhookLogs = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const [logs, total] = await Promise.all([
    WebhookLog.find({ provider: 'payu' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WebhookLog.countDocuments({ provider: 'payu' }),
  ]);
  res.json({ success: true, data: { logs, total, page, pages: Math.ceil(total / limit) } });
};
