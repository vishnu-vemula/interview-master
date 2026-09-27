import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { requestRefund, reconcileRefund } from '../services/postgres-billing';

const paging = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || 12), 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
};
export const getAllTransactions = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const status = String(req.query.status || 'all');
  const where: Prisma.PaymentOrderWhereInput = {};
  if (['pending', 'success', 'failed', 'refund_pending', 'refunded'].includes(status)) where.status = status as any;
  if (req.query.search) where.transactionId = { contains: String(req.query.search).slice(0, 80), mode: 'insensitive' };
  const [orders, total] = await Promise.all([
    prisma.paymentOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit,
      include: { user: { select: { id: true, displayName: true, email: true } }, plan: { select: { id: true, name: true } } } }),
    prisma.paymentOrder.count({ where }),
  ]);
  const transactions = orders.map(order => ({
    _id: order.id, transactionId: order.transactionId,
    userId: { _id: order.user.id, name: order.user.displayName, email: order.user.email },
    planId: { _id: order.plan.id, name: order.plan.name }, amount: order.amountMinor / 100,
    amountMinor: order.amountMinor, currency: order.currency, status: order.status,
    paymentMethod: 'PayU', createdAt: order.createdAt, refundRequestId: order.refundRequestId,
  }));
  res.json({ success: true, data: { transactions, total, page, pages: Math.ceil(total / limit) } });
};
export const refundTransaction = async (req: Request, res: Response) => {
  try { const order = await requestRefund(String(req.params.id));
    res.status(202).json({ success: true, message: 'Refund requested from PayU; awaiting confirmation.', order });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
};
export const reconcileRefundTransaction = async (req: Request, res: Response) => {
  try { const order = await reconcileRefund(String(req.params.id)); res.json({ success: true, order }); }
  catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
};
export const getPaymentStats = async (_req: Request, res: Response) => {
  const [success, refunded, failed] = await Promise.all([
    prisma.paymentOrder.aggregate({ where: { status: { in: ['success', 'refund_pending'] } },
      _count: { _all: true }, _sum: { amountMinor: true } }),
    prisma.paymentOrder.aggregate({ where: { status: 'refunded' },
      _count: { _all: true }, _sum: { amountMinor: true } }),
    prisma.paymentOrder.count({ where: { status: 'failed' } }),
  ]);
  res.json({ success: true, data: { currency: 'INR', totalRevenue: (success._sum.amountMinor || 0) / 100,
    successfulSales: success._count._all, refundedSales: refunded._count._all,
    totalRefunded: (refunded._sum.amountMinor || 0) / 100, failedSales: failed } });
};
export const getWebhookLogs = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const [rows, total] = await Promise.all([
    prisma.paymentEvent.findMany({ where: { provider: 'payu' }, orderBy: { receivedAt: 'desc' }, skip, take: limit }),
    prisma.paymentEvent.count({ where: { provider: 'payu' } }),
  ]);
  const logs = rows.map(row => ({ ...row, _id: row.id, createdAt: row.receivedAt }));
  res.json({ success: true, data: { logs, total, page, pages: Math.ceil(total / limit) } });
};
