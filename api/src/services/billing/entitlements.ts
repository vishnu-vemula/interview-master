import UsageCounter from '../../models/usage-counter.model';
import UsageLedger from '../../models/usage-ledger.model';
import { getActiveSubscription } from './billing.service';

export const allowanceFor = async (userId: string) => {
  const subscription: any = await getActiveSubscription(userId);
  const periodKey = subscription ? `paid:${subscription._id}` : `free:${new Date().toISOString().slice(0, 7)}`;
  const limit = subscription ? Number(subscription.creditLimit || 0) : 2;
  const counter = await UsageCounter.findOne({ userId, periodKey });
  return { periodKey, limit, used: counter?.units || 0, remaining: Math.max(0, limit - (counter?.units || 0)) };
};

export const reserveGeneration = async (userId: string, interviewId: string) => {
  const allowance = await allowanceFor(userId);
  const old: any = await UsageLedger.findOne({ interviewId, reason: 'question_generation' });
  if (old?.status === 'reserved' || old?.status === 'committed') return old;
  await UsageCounter.updateOne({ userId, periodKey: allowance.periodKey },
    { $setOnInsert: { units: 0 } }, { upsert: true });
  const counter = await UsageCounter.findOneAndUpdate({
    userId, periodKey: allowance.periodKey, units: { $lt: allowance.limit },
  }, { $inc: { units: 1 } }, { new: true });
  if (!counter) throw new Error('Interview allowance exhausted. Choose a plan to continue.');
  try {
    if (old) {
      const updated = await UsageLedger.findOneAndUpdate({ _id: old._id, status: 'released' },
        { $set: { status: 'reserved', periodKey: allowance.periodKey } }, { new: true });
      if (updated) return updated;
    } else {
      return await UsageLedger.create({ userId, interviewId, periodKey: allowance.periodKey,
        status: 'reserved', unitsDelta: -1, reason: 'question_generation' });
    }
  } catch (error: any) {
    await UsageCounter.updateOne({ userId, periodKey: allowance.periodKey, units: { $gt: 0 } }, { $inc: { units: -1 } });
    if (error?.code === 11000) return UsageLedger.findOne({ interviewId, reason: 'question_generation' });
    throw error;
  }
  await UsageCounter.updateOne({ userId, periodKey: allowance.periodKey, units: { $gt: 0 } }, { $inc: { units: -1 } });
  throw new Error('Interview generation is already reserved');
};

export const commitGeneration = (interviewId: string) =>
  UsageLedger.updateOne({ interviewId, reason: 'question_generation', status: 'reserved' }, { $set: { status: 'committed' } });

export const releaseGeneration = async (interviewId: string) => {
  const entry: any = await UsageLedger.findOneAndUpdate({ interviewId, reason: 'question_generation', status: 'reserved' },
    { $set: { status: 'released' } }, { new: true });
  if (entry) await UsageCounter.updateOne({ userId: entry.userId, periodKey: entry.periodKey, units: { $gt: 0 } },
    { $inc: { units: -1 } });
};
