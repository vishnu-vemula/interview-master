import { randomBytes } from 'node:crypto';
import User from '../models/user.model';
import Resume from '../models/resume.model';
import Interview from '../models/interview.model';
import Session from '../models/session.model';
import PaymentOrder from '../models/payment-order.model';
import Subscription from '../models/subscription.model';
import UsageCounter from '../models/usage-counter.model';
import UsageLedger from '../models/usage-ledger.model';
import Transaction from '../models/transaction.model';
import AuditLog from '../models/audit-log.model';
import AuthToken from '../models/auth-token.model';
import Job from '../models/job.model';
import cloudinary from '../config/cloudinary';
import AppError from '../utils/app-error';
import { callbackContactTag } from './billing/billing.service';

/**
 * Retire a legacy candidate account. Keep the minimal order and subscription
 * history required for reconciliation; scrub contact fields and remove resume
 * objects before removing their database references. Repeated calls can resume
 * after a storage outage because deletion is idempotent.
 */
export async function retireCandidateAccount(userId: string) {
  const user: any = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found.', 404);
  if (user.role !== 'candidate') throw new AppError('Staff accounts require a separate offboarding process.', 403);
  if (user.deletedAt) return;

  const unsettled = await PaymentOrder.exists({ userId, status: { $in: ['pending', 'refund_pending'] } });
  if (unsettled) throw new AppError('A payment is still pending reconciliation. Contact support before deleting this account.', 409);

  // Stop new authenticated work before removing data. A retry may continue.
  user.isActive = false;
  user.isBanned = true;
  user.passwordChangedAt = new Date();
  await user.save({ validateBeforeSave: false });

  const resumes: any[] = await Resume.find({ userId }).select('publicId deliveryType');
  for (const resume of resumes) {
    try {
      const result = await cloudinary.uploader.destroy(resume.publicId, {
        resource_type: 'raw', type: resume.deliveryType || 'upload',
      });
      if (!['ok', 'not found'].includes(result.result)) throw new Error('Storage deletion failed');
    } catch {
      throw new AppError('Stored resume cleanup failed. Retry account deletion.', 503);
    }
  }

  await Session.deleteMany({ userId });
  await Interview.deleteMany({ userId });
  await Resume.deleteMany({ userId });
  await UsageLedger.deleteMany({ userId });
  await UsageCounter.deleteMany({ userId });
  await Transaction.deleteMany({ userId });
  await AuditLog.deleteMany({ userId });
  await AuthToken.deleteMany({ userId });
  await Job.updateMany({ postedBy: userId }, { $unset: { postedBy: 1 } });

  const anonymizedEmail = `deleted-${user._id}@invalid.example`;
  const orders: any[] = await PaymentOrder.find({ userId }).select('+callbackEmailTag +callbackPhoneTag');
  for (const order of orders) {
    await PaymentOrder.updateOne({ _id: order._id }, { $set: {
      firstName: 'Deleted candidate', email: anonymizedEmail, phone: '0000000000',
      callbackEmailTag: order.callbackEmailTag || callbackContactTag(order.email),
      callbackPhoneTag: order.callbackPhoneTag || callbackContactTag(order.phone),
    } });
  }
  await Subscription.updateMany({ userId, status: 'active' }, { $set: {
    status: 'canceled', canceledAt: new Date(), cancelAtPeriodEnd: false,
  } });

  user.name = 'Deleted candidate';
  user.email = anonymizedEmail;
  user.password = randomBytes(48).toString('base64url');
  user.avatar = null;
  user.credits = 0;
  user.isPremium = false;
  user.refreshToken = undefined;
  user.deletedAt = new Date();
  await user.save();
}
