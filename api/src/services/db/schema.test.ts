import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
const isDisposableDatabase = (() => {
  if (!testUrl) return false;
  try { return new URL(testUrl).pathname === '/interviewmaster_test'; }
  catch { return false; }
})();

test('PostgreSQL migration enforces ownership relationships and one active default resume',
  { skip: !isDisposableDatabase && 'Set TEST_DATABASE_URL to a disposable interviewmaster_test database' },
  async () => {
    const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
    const marker = randomUUID();
    let userId: string | undefined;
    try {
      const user = await db.user.create({ data: {
        firebaseUid: `test-${marker}`,
        email: `test-${marker}@invalid.example`,
        displayName: 'Schema test',
      } });
      userId = user.id;
      const first = await db.resume.create({ data: {
        userId, storageKey: `test/${marker}/first`, originalName: 'first.pdf',
        contentType: 'application/pdf', sizeBytes: 100, isDefault: true,
      } });
      await assert.rejects(db.resume.create({ data: {
        userId, storageKey: `test/${marker}/second`, originalName: 'second.pdf',
        contentType: 'application/pdf', sizeBytes: 100, isDefault: true,
      } }));
      await db.resume.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      await db.resume.create({ data: {
        userId, storageKey: `test/${marker}/third`, originalName: 'third.pdf',
        contentType: 'application/pdf', sizeBytes: 100, isDefault: true,
      } });

      const interviewData = { userId, jobTitle: 'Engineer', jobDescription: 'Test job',
        experienceLevel: 'mid', questionCount: 1 };
      const interviewA = await db.interview.create({ data: interviewData });
      const interviewB = await db.interview.create({ data: interviewData });
      const questionB = await db.question.create({ data: {
        interviewId: interviewB.id, ordinal: 0, category: 'technical', difficulty: 'medium',
        prompt: 'Describe a transaction.', expectedKeywords: ['atomicity'], generationVersion: 'test',
      } });
      const sessionA = await db.session.create({ data: { userId, interviewId: interviewA.id } });
      await assert.rejects(db.answer.create({ data: {
        interviewId: interviewA.id, sessionId: sessionA.id, questionId: questionB.id, text: 'Answer',
      } }), (error: any) => error.code === 'P2003');
      assert.equal(await db.answer.count({ where: { sessionId: sessionA.id } }), 0);
    } finally {
      if (userId) await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
    }
  });
