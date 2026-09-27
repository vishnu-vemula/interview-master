import prisma from '../config/prisma';
import AppError from '../utils/app-error';
import { processExternalCleanupJob, queueCloudinaryCleanup } from './postgres-external-cleanup';

/** Commit the row deletion and provider cleanup intent together. */
export async function deletePostgresResume(id: string, ownerUserId?: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new AppError('Resume not found.', 404);
  const jobId = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Resume" WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await tx.resume.findFirst({ where: { id, deletedAt: null,
      ...(ownerUserId ? { userId: ownerUserId } : {}) } });
    if (!row) throw new AppError('Resume not found.', 404);
    if (await tx.interview.count({ where: { resumeId: id } }))
      throw new AppError('This resume is used by an interview and cannot be deleted.', 409);
    const job = await queueCloudinaryCleanup(tx, row);
    await tx.resume.delete({ where: { id } });
    return job.id;
  });
  await processExternalCleanupJob(jobId);
}
