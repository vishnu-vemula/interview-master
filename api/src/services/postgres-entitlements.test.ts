import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const url = process.env.TEST_DATABASE_URL;
test('PostgreSQL generation reservations are bounded, idempotent, and released atomically',
  { skip: !url?.endsWith('/interviewmaster_test') }, async () => {
    process.env.DATABASE_URL = url;
    const db = new PrismaClient();
    const marker = randomUUID();
    const user = await db.user.create({ data: { firebaseUid: marker, email: `${marker}@example.com`, displayName: 'Quota Tester' } });
    const interviews = await Promise.all(Array.from({ length: 3 }, (_, i) => db.interview.create({ data: {
      userId: user.id, jobTitle: `Role ${i}`, jobDescription: 'Build reliable APIs', experienceLevel: 'mid', questionCount: 3,
    } })));
    try {
      const { reserveGeneration, commitGeneration, releaseGeneration, allowanceFor } = await import('./postgres-entitlements.js');
      const results = await Promise.allSettled(interviews.map(item => reserveGeneration(user.id, item.id)));
      assert.equal(results.filter(item => item.status === 'fulfilled').length, 2);
      assert.equal((await allowanceFor(user.id)).remaining, 0);
      const reserved = results.find(item => item.status === 'fulfilled') as PromiseFulfilledResult<any>;
      assert.equal((await reserveGeneration(user.id, reserved.value.interviewId)).id, reserved.value.id);
      await commitGeneration(reserved.value.interviewId);
      await releaseGeneration(reserved.value.interviewId);
      assert.equal((await allowanceFor(user.id)).remaining, 0);
      const other = interviews.find((item, i) => item.id !== reserved.value.interviewId &&
        results[i].status === 'fulfilled')!;
      await releaseGeneration(other.id);
      assert.equal((await allowanceFor(user.id)).remaining, 1);
      const failed = interviews.find(item => results[interviews.indexOf(item)].status === 'rejected')!;
      await reserveGeneration(user.id, failed.id);
      assert.equal((await allowanceFor(user.id)).remaining, 0);
    } finally {
      await db.user.delete({ where: { id: user.id } });
      await db.$disconnect();
    }
  });
