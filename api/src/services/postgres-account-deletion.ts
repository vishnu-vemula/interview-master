import prisma from '../config/prisma';
import AppError from '../utils/app-error';
import { contactTag } from './postgres-billing';
import { CLEANUP_FIREBASE, processExternalCleanupJob, queueCloudinaryCleanup, queueFirebaseCleanup } from './postgres-external-cleanup';

/** Block the account and erase candidate content while retaining redacted financial rows. */
export async function retirePostgresCandidate(userId: string, firebaseUid: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.firebaseUid !== firebaseUid) throw new AppError('Account not found.', 404);
  if (user.role !== 'candidate') throw new AppError('Administrative accounts require a separate audited process.', 403);
  if (user.status === 'deleted') {
    const pending = await prisma.backgroundJob.findMany({ where: { ownerUserId: userId,
      kind: { in: [CLEANUP_FIREBASE, 'cleanup_cloudinary'] }, state: { not: 'succeeded' } }, select: { id: true } });
    for (const job of pending) await processExternalCleanupJob(job.id);
    return;
  }
  const jobs = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.status === 'deleted') return [];
    await tx.user.update({ where: { id: userId }, data: { status: 'deleting' } });
    const resumes = await tx.resume.findMany({ where: { userId }, select: {
      id: true, userId: true, storageKey: true, deliveryType: true } });
    const queued = [];
    for (const resume of resumes) queued.push((await queueCloudinaryCleanup(tx, resume)).id);
    queued.push((await queueFirebaseCleanup(tx, userId, firebaseUid)).id);
    const orders = await tx.paymentOrder.findMany({ where: { userId } });
    for (const order of orders) await tx.paymentOrder.update({ where: { id: order.id }, data: {
      callbackEmailTag: order.callbackEmailTag || (order.email ? contactTag(order.email) : null),
      callbackPhoneTag: order.callbackPhoneTag || (order.phone ? contactTag(order.phone) : null),
      email: `deleted-${userId}@invalid.example`, phone: '0000000000', firstName: 'Deleted',
    } });
    await tx.subscription.updateMany({ where: { userId, status: 'active' }, data: { status: 'canceled', canceledAt: new Date() } });
    await tx.usageLedgerEntry.deleteMany({ where: { userId } });
    await tx.usageCounter.deleteMany({ where: { userId } });
    await tx.answer.deleteMany({ where: { session: { userId } } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.question.deleteMany({ where: { interview: { userId } } });
    await tx.interview.deleteMany({ where: { userId } });
    await tx.resume.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: {
      status: 'deleted', deletedAt: new Date(), email: `deleted-${userId}@invalid.example`,
      displayName: 'Deleted candidate', avatar: null, credits: 0, isPremium: false,
    } });
    return queued;
  });
  for (const id of jobs) await processExternalCleanupJob(id);
}
