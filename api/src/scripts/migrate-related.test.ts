import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { Client as PgClient } from 'pg';
import User from '../models/user.model';
import Resume from '../models/resume.model';
import Interview from '../models/interview.model';
import Session from '../models/session.model';
import Plan from '../models/plan.model';
import PaymentOrder from '../models/payment-order.model';
import Subscription from '../models/subscription.model';
import UsageLedger from '../models/usage-ledger.model';
import WebhookLog from '../models/webhook-log.model';
import Job from '../models/job.model';
import AuditLog from '../models/audit-log.model';
import Transaction from '../models/transaction.model';
import UsageCounter from '../models/usage-counter.model';
import InterviewTemplate from '../models/interview-template.model';
import SystemPrompt from '../models/system-prompt.model';
import SystemSetting from '../models/system-setting.model';
import ScraperConfig from '../models/scraper-config.model';
import ScraperLog from '../models/scraper-log.model';
import { stableUuid } from './migrate-users';
import { migrateRelated } from './migrate-related';

const uri = process.env.TEST_RELATED_MONGO_URI;
const databaseUrl = process.env.TEST_DATABASE_URL;
test('related MongoDB data imports once with PostgreSQL ownership and payment relationships',
  { skip: !uri?.endsWith('/interviewmaster_related_test') || !databaseUrl?.endsWith('/interviewmaster_test') }, async () => {
    process.env.MONGO_URI = uri;
    process.env.DATABASE_URL = databaseUrl;
    process.env.LEGACY_JOBS_DATABASE_URL = databaseUrl;
    const pg = new PrismaClient();
    // The live development API may have initialized this singleton in the
    // disposable test database; import rehearsal requires an empty target.
    await pg.scraperConfig.deleteMany();
    const legacyPg = new PgClient({ connectionString: databaseUrl });
    await legacyPg.connect();
    // This test is restricted to the disposable interviewmaster_test database.
    await legacyPg.query('DROP TABLE IF EXISTS jobs');
    await legacyPg.query('CREATE TABLE jobs (id TEXT PRIMARY KEY, title TEXT, company TEXT, description TEXT, redirect_url TEXT, source TEXT, salary_min DOUBLE PRECISION)');
    await legacyPg.query('INSERT INTO jobs (id, title, company, description, redirect_url, source, salary_min) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['legacy-pg-fixture', 'Platform Engineer', 'Fixture Co', 'Legacy row', 'https://example.com/legacy-apply', 'legacy_pg_fixture', 50000]);
    const sourceIds: Record<string, string> = {};
    const id = (kind: string) => stableUuid(kind, sourceIds[kind]);
    await mongoose.connect(uri!);
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Resume.init(), Interview.init(), Session.init(), Plan.init(),
        PaymentOrder.init(), Subscription.init(), UsageLedger.init(), WebhookLog.init(), Job.init(), AuditLog.init()]);
      const stamp = Date.now();
      const user: any = await User.create({ name: 'Migration Candidate', email: `related-${stamp}@example.com`,
        password: 'StrongPassword123!' });
      sourceIds.user = String(user._id);
      await pg.user.create({ data: { id: id('user'), firebaseUid: `im_${sourceIds.user}`,
        email: user.email, displayName: user.name } });
      const resume: any = await Resume.create({ userId: user._id, fileName: 'resume', originalName: 'resume.pdf',
        publicId: `private/${user._id}`, fileSize: 1234, mimeType: 'application/pdf',
        deliveryType: 'authenticated', isDefault: true, parseStatus: 'parsed', extractedText: 'API engineer' });
      sourceIds.resume = String(resume._id);
      const interview: any = await Interview.create({ userId: user._id, resumeId: resume._id,
        jobTitle: 'Engineer', jobDescription: 'Build safe APIs', numberOfQuestions: 3,
        questions: [{ questionText: 'How do you prevent duplicate writes?' }],
        generationStatus: 'generated', status: 'completed' });
      sourceIds.interview = String(interview._id);
      sourceIds.question = String(interview.questions[0]._id);
      const session: any = await Session.create({ userId: user._id, interviewId: interview._id,
        status: 'completed', overallScore: 80, answers: [{ questionId: interview.questions[0]._id,
          questionText: 'How do you prevent duplicate writes?', answerText: 'Use an idempotency key.', aiScore: 8 }] });
      sourceIds.session = String(session._id);
      sourceIds.answer = String(session.answers[0]._id);
      const plan: any = await Plan.create({ code: `RELATED_${stamp}`, name: 'Test Pass', price: 125,
        amountMinor: 12500, durationDays: 30, credits: 3, postedBy: user._id });
      sourceIds.plan = String(plan._id);
      const order: any = await PaymentOrder.create({ userId: user._id, planId: plan._id,
        transactionId: `related-${stamp}`, idempotencyKey: `related-key-${stamp}`,
        amountMinor: 12500, creditLimit: 3, durationDays: 30, currency: 'INR', productInfo: 'Test Pass',
        firstName: 'Migration', email: user.email, phone: '9876543210', status: 'success', payuId: `payu-${stamp}` });
      sourceIds.paymentOrder = String(order._id);
      const subscription: any = await Subscription.create({ userId: user._id, planId: plan._id,
        orderId: order._id, creditLimit: 3, status: 'active', currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000) });
      sourceIds.subscription = String(subscription._id);
      const ledger: any = await UsageLedger.create({ userId: user._id, interviewId: interview._id,
        periodKey: `paid:${subscription._id}`, status: 'committed', unitsDelta: -1, reason: 'question_generation' });
      sourceIds.usageLedger = String(ledger._id);
      const counter: any = await UsageCounter.create({ userId: user._id, periodKey: `paid:${subscription._id}`, units: 1 });
      sourceIds.usageCounter = String(counter._id);
      const event: any = await WebhookLog.create({ provider: 'payu', eventType: 'payment.success',
        eventId: `event-${stamp}`, payload: { transactionId: order.transactionId }, status: 'processed' });
      sourceIds.paymentEvent = String(event._id);
      const job: any = await Job.create({ title: 'API Engineer', company: 'Test Co', description: 'Build APIs',
        source: 'Related Test Source', applyUrl: 'https://example.com/apply', location: 'Remote' });
      sourceIds.jobListing = String(job._id);
      const audit: any = await AuditLog.create({ category: 'admin', action: 'fixture.created',
        status: 'success', userId: user._id, details: 'Test fixture', metadata: { fixture: true } });
      sourceIds.auditEvent = String(audit._id);
      const tx: any = await Transaction.create({ userId: user._id, planId: plan._id,
        transactionId: `legacy-tx-${stamp}`, amount: 12.5, currency: 'USD', status: 'success' });
      sourceIds.transaction = String(tx._id);
      const template: any = await InterviewTemplate.create({ name: 'Fixture Template',
        systemPrompt: 'Ask questions', evaluationPrompt: 'Evaluate', feedbackPrompt: 'Give feedback', postedBy: user._id });
      sourceIds.template = String(template._id);
      const prompt: any = await SystemPrompt.create({ category: 'interview', name: 'Fixture Prompt',
        content: 'Act as an interviewer', lastUpdatedBy: user._id });
      sourceIds.prompt = String(prompt._id);
      const setting: any = await SystemSetting.create({ general: { appName: 'Fixture' }, ai: { model: 'fixture' } });
      sourceIds.setting = String(setting._id);
      const config: any = await ScraperConfig.create({ keywords: ['Node'] });
      sourceIds.scraperConfig = String(config._id);
      const log: any = await ScraperLog.create({ status: 'success', jobsImported: 1 });
      sourceIds.scraperLog = String(log._id);
    } finally { await mongoose.disconnect(); }

    try {
      const preview = await migrateRelated(false);
      assert.equal(preview.counts.answers.inspected, 1);
      assert.equal(await pg.answer.count({ where: { id: id('answer') } }), 0);
      const first = await migrateRelated(true);
      assert.deepEqual(first.failures, []);
      assert.deepEqual(first.warnings, []);
      for (const kind of Object.keys(first.counts) as Array<keyof typeof first.counts>) {
        assert.equal(first.counts[kind].created, 1, kind);
        assert.equal(first.mappedCounts[kind], 1, kind);
        assert.equal(first.missingMapped[kind], 0, kind);
      }
      const repeat = await migrateRelated(true);
      assert.deepEqual(repeat.failures, []);
      assert.equal(repeat.counts.paymentOrders.alreadyPresent, 1);
      const answer = await pg.answer.findUnique({ where: { id: id('answer') }, include: { session: true, question: true } });
      assert.equal(answer?.session.userId, id('user'));
      assert.equal(answer?.question.interviewId, id('interview'));
      const pass = await pg.subscription.findUnique({ where: { id: id('subscription') }, include: { order: true } });
      assert.equal(pass?.order?.amountMinor, 12500);
      assert.equal((await pg.usageLedgerEntry.findUnique({ where: { id: id('usageLedger') } }))?.periodKey,
        `paid:${id('subscription')}`);
      assert.equal((await pg.usageCounter.findUnique({ where: { id: id('usageCounter') } }))?.periodKey,
        `paid:${id('subscription')}`);
      assert.equal((await pg.legacyTransaction.findUnique({ where: { id: id('transaction') } }))?.amountMinor, 1250);
      assert.equal((await pg.jobListing.findUnique({ where: { id: stableUuid('legacyPgJob', 'legacy-pg-fixture') } }))?.salaryMin, 50000);
      console.log(JSON.stringify({ rehearsal: 'related_data', sourceUsers: first.sourceUsers,
        mappedUsers: first.mappedUsers, sourceByKind: Object.fromEntries(Object.entries(first.counts).map(([key, value]) => [key, value.inspected])),
        createdByKind: Object.fromEntries(Object.entries(first.counts).map(([key, value]) => [key, value.created])),
        mappedByKind: first.mappedCounts, exceptions: first.failures, warnings: first.warnings,
        rerunAlreadyPresent: Object.fromEntries(Object.entries(repeat.counts).map(([key, value]) => [key, value.alreadyPresent])) }));
    } finally {
      await pg.jobListing.deleteMany({ where: { id: stableUuid('legacyPgJob', 'legacy-pg-fixture') } });
      await pg.jobSource.deleteMany({ where: { name: 'legacy_pg_fixture' } });
      await legacyPg.query('DROP TABLE IF EXISTS jobs');
      await legacyPg.end();
      delete process.env.LEGACY_JOBS_DATABASE_URL;
      await pg.jobListing.deleteMany({ where: { id: id('jobListing') } });
      await pg.jobSource.deleteMany({ where: { name: 'Related Test Source' } });
      await pg.auditEvent.deleteMany({ where: { id: id('auditEvent') } });
      await pg.scraperLog.deleteMany({ where: { id: id('scraperLog') } });
      await pg.scraperConfig.deleteMany({ where: { id: id('scraperConfig') } });
      await pg.systemSetting.deleteMany({ where: { id: id('setting') } });
      await pg.systemPrompt.deleteMany({ where: { id: id('prompt') } });
      await pg.interviewTemplate.deleteMany({ where: { id: id('template') } });
      await pg.legacyTransaction.deleteMany({ where: { id: id('transaction') } });
      await pg.usageCounter.deleteMany({ where: { id: id('usageCounter') } });
      await pg.paymentEvent.deleteMany({ where: { id: id('paymentEvent') } });
      await pg.usageLedgerEntry.deleteMany({ where: { id: id('usageLedger') } });
      await pg.answer.deleteMany({ where: { id: id('answer') } });
      await pg.session.deleteMany({ where: { id: id('session') } });
      await pg.question.deleteMany({ where: { id: id('question') } });
      await pg.interview.deleteMany({ where: { id: id('interview') } });
      await pg.resume.deleteMany({ where: { id: id('resume') } });
      await pg.subscription.deleteMany({ where: { id: id('subscription') } });
      await pg.paymentOrder.deleteMany({ where: { id: id('paymentOrder') } });
      await pg.plan.deleteMany({ where: { id: id('plan') } });
      await pg.user.deleteMany({ where: { id: id('user') } });
      await pg.$disconnect();
      await mongoose.connect(uri!);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });
