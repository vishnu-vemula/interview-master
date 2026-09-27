import PaymentOrder from '../../models/payment-order.model';
import logger from '../../config/logger';
import { reconcilePayment, reconcileRefund } from './billing.service';

const LEASE_MS = 45_000;
const RETRY_MS = 5 * 60_000;
const MAX_PER_RUN = 20;

/** Poll PayU when callbacks are delayed or lost. Claims rotate across orders. */
export async function reconcileOutstandingOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETRY_MS);
  const recent = new Date(now.getTime() - 7 * 86_400_000);
  const result = { attempted: 0, settled: 0, failed: 0 };
  for (let i = 0; i < MAX_PER_RUN; i++) {
    const order: any = await PaymentOrder.findOneAndUpdate({
      createdAt: { $gt: recent },
      $and: [
        { $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lte: cutoff } }] },
        { $or: [{ reconcileLeaseUntil: null }, { reconcileLeaseUntil: { $lt: now } }] },
        { $or: [{ status: { $in: ['pending', 'failed'] } },
          { status: 'refund_pending', refundRequestId: { $nin: [null, ''] } }] },
      ],
    }, { $set: { reconcileLeaseUntil: new Date(now.getTime() + LEASE_MS), lastReconciledAt: now } },
    { sort: { lastReconciledAt: 1, createdAt: 1 }, new: true });
    if (!order) break;
    result.attempted++;
    try {
      const current = order.status === 'refund_pending'
        ? await reconcileRefund(String(order._id))
        : await reconcilePayment(order.transactionId);
      if (current?.status !== order.status) result.settled++;
    } catch {
      result.failed++;
    } finally {
      await PaymentOrder.updateOne({ _id: order._id, reconcileLeaseUntil: order.reconcileLeaseUntil },
        { $set: { reconcileLeaseUntil: null } });
    }
  }
  return result;
}

export function initBillingReconciler() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const result = await reconcileOutstandingOrders();
      if (result.attempted) logger.info(`PayU reconciliation: ${JSON.stringify(result)}`);
    } catch (error: any) {
      logger.error(`PayU reconciliation scan failed: ${error?.name || 'Error'}`);
    } finally { running = false; }
  }, RETRY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
