import prisma from '../config/prisma';

export async function activeSubscription(userId: string) {
  return prisma.subscription.findFirst({ where: {
    userId, status: 'active', currentPeriodEnd: { gt: new Date() },
  }, include: { plan: true }, orderBy: { currentPeriodEnd: 'desc' } });
}

export async function allowanceFor(userId: string) {
  const subscription = await activeSubscription(userId);
  const periodKey = subscription ? `paid:${subscription.id}` : `free:${new Date().toISOString().slice(0, 7)}`;
  const limit = subscription ? subscription.creditLimit : 2;
  const counter = await prisma.usageCounter.findUnique({ where: { userId_periodKey: { userId, periodKey } } });
  const used = counter?.units || 0;
  return { periodKey, limit, used, remaining: Math.max(0, limit - used) };
}

export async function reserveGeneration(userId: string, interviewId: string) {
  return prisma.$transaction(async tx => {
    // A single user lock serializes concurrent reservations across interviews.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    const previous = await tx.usageLedgerEntry.findUnique({ where: { idempotencyKey: `generation:${interviewId}` } });
    if (previous && previous.status !== 'released') return previous;
    const subscription = await tx.subscription.findFirst({ where: {
      userId, status: 'active', currentPeriodEnd: { gt: new Date() },
    }, orderBy: { currentPeriodEnd: 'desc' } });
    const periodKey = subscription ? `paid:${subscription.id}` : `free:${new Date().toISOString().slice(0, 7)}`;
    const limit = subscription ? subscription.creditLimit : 2;
    const counter = await tx.usageCounter.upsert({ where: { userId_periodKey: { userId, periodKey } },
      update: {}, create: { userId, periodKey, units: 0 } });
    if (counter.units >= limit) throw new Error('Interview allowance exhausted. Choose a plan to continue.');
    await tx.usageCounter.update({ where: { id: counter.id }, data: { units: { increment: 1 } } });
    return previous
      ? tx.usageLedgerEntry.update({ where: { id: previous.id }, data: { status: 'reserved', periodKey } })
      : tx.usageLedgerEntry.create({ data: { userId, interviewId, periodKey, feature: 'question_generation',
        unitsDelta: -1, reason: 'question_generation', status: 'reserved', idempotencyKey: `generation:${interviewId}` } });
  });
}

export async function commitGeneration(interviewId: string) {
  await prisma.usageLedgerEntry.updateMany({ where: { idempotencyKey: `generation:${interviewId}`, status: 'reserved' },
    data: { status: 'committed' } });
}

export async function releaseGeneration(interviewId: string) {
  await prisma.$transaction(async tx => {
    const entry = await tx.usageLedgerEntry.findUnique({ where: { idempotencyKey: `generation:${interviewId}` } });
    if (!entry) return;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${entry.userId}::uuid FOR UPDATE`;
    const changed = await tx.usageLedgerEntry.updateMany({ where: { id: entry.id, status: 'reserved' },
      data: { status: 'released' } });
    if (!changed.count) return;
    await tx.usageCounter.updateMany({ where: { userId: entry.userId, periodKey: entry.periodKey, units: { gt: 0 } },
      data: { units: { decrement: 1 } } });
  });
}
