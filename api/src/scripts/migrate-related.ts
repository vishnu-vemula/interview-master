import 'dotenv/config';
import mongoose from 'mongoose';
import { Prisma, PrismaClient } from '@prisma/client';
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
import { Client as PgClient } from 'pg';
import { stableUuid } from './migrate-users';

type Kind = 'resumes' | 'interviews' | 'questions' | 'sessions' | 'answers' |
  'plans' | 'paymentOrders' | 'subscriptions' | 'usageLedger' | 'usageCounters' |
  'paymentEvents' | 'jobs' | 'legacyPgJobs' | 'auditEvents' | 'transactions' |
  'templates' | 'prompts' | 'settings' | 'scraperConfigs' | 'scraperLogs';
type Failure = { kind: Kind; legacyId: string; reason: string };
const kinds: Kind[] = ['resumes', 'interviews', 'questions', 'sessions', 'answers', 'plans',
  'paymentOrders', 'subscriptions', 'usageLedger', 'usageCounters', 'paymentEvents', 'jobs',
  'legacyPgJobs', 'auditEvents', 'transactions', 'templates', 'prompts', 'settings',
  'scraperConfigs', 'scraperLogs'];
const entityForKind: Record<Kind, string> = {
  resumes: 'resume', interviews: 'interview', questions: 'question', sessions: 'session', answers: 'answer',
  plans: 'plan', paymentOrders: 'paymentOrder', subscriptions: 'subscription', usageLedger: 'usageLedger',
  usageCounters: 'usageCounter', paymentEvents: 'paymentEvent', jobs: 'jobListing', legacyPgJobs: 'legacyPgJob',
  auditEvents: 'auditEvent', transactions: 'transaction', templates: 'template', prompts: 'prompt',
  settings: 'setting', scraperConfigs: 'scraperConfig', scraperLogs: 'scraperLog',
};
const idOf = (entity: string, legacyId: unknown) => stableUuid(entity, String(legacyId));
const optionalId = (entity: string, legacyId: unknown) => legacyId ? idOf(entity, legacyId) : null;
const json = (value: unknown) => value == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const date = (value: unknown, fallback = new Date()) => value ? new Date(value as string) : fallback;
const optionalDate = (value: unknown) => value ? new Date(value as string) : null;
const allowed = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  values.includes(value as T) ? value as T : fallback;
const nonnegativeInt = (value: unknown, fallback = 0) => Number.isSafeInteger(Number(value)) && Number(value) >= 0
  ? Number(value) : fallback;

/** Import a snapshot after migrate:users. Existing rows are never overwritten. */
export async function migrateRelated(apply: boolean) {
  if (!process.env.MONGO_URI || !process.env.DATABASE_URL) throw new Error('MONGO_URI and DATABASE_URL are required');
  await mongoose.connect(process.env.MONGO_URI);
  const db = new PrismaClient();
  const counts = Object.fromEntries(kinds.map(kind => [kind, { inspected: 0, created: 0, alreadyPresent: 0 }])) as
    Record<Kind, { inspected: number; created: number; alreadyPresent: number }>;
  const failures: Failure[] = [];
  const warnings: Failure[] = [];
  const expectedIds = Object.fromEntries(kinds.map(kind => [kind, []])) as Record<Kind, string[]>;
  const importOne = async (kind: Kind, legacyId: unknown, action: () => Promise<'created' | 'alreadyPresent'>) => {
    counts[kind].inspected++;
    expectedIds[kind].push(idOf(entityForKind[kind], legacyId));
    if (!apply) return;
    try { counts[kind][await action()]++; }
    catch (error: any) { failures.push({ kind, legacyId: String(legacyId),
      reason: String(error?.message || 'unknown').slice(0, 160) }); }
  };
  const assertUser = async (legacyId: unknown) => {
    const id = idOf('user', legacyId);
    if (!await db.user.findUnique({ where: { id }, select: { id: true } })) throw new Error('user_not_migrated');
    return id;
  };
  try {
    // Identity import is a separate, reviewed step because it also writes Firebase.
    const sourceUsers = await User.countDocuments();
    let mappedUsers = 0;
    for await (const source of User.find().select('_id').lean().cursor()) {
      if (await db.user.findUnique({ where: { id: idOf('user', source._id) }, select: { id: true } })) mappedUsers++;
    }
    if (apply && mappedUsers < sourceUsers) throw new Error('Run migrate:users first; PostgreSQL has fewer mapped users than MongoDB');

    for await (const row of Resume.find().lean().cursor()) {
      const source: any = row;
      await importOne('resumes', source._id, async () => {
        const id = idOf('resume', source._id);
        if (await db.resume.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        if (!source.publicId) throw new Error('missing_storage_key');
        await db.resume.create({ data: {
          id, userId, storageKey: String(source.publicId),
          originalName: String(source.originalName || 'resume.pdf'), fileName: source.fileName || null,
          contentType: String(source.mimeType || 'application/pdf'),
          format: String(source.format || 'pdf'), deliveryType: String(source.deliveryType || 'upload'),
          legacyFileUrl: source.deliveryType === 'authenticated' ? null : source.fileUrl || null,
          sizeBytes: nonnegativeInt(source.fileSize),
          parseStatus: allowed(source.parseStatus, ['pending', 'parsed', 'failed'] as const, 'pending'),
          extractedText: source.extractedText || null, parsedData: json(source.parsedData),
          isParsed: Boolean(source.isParsed),
          isDefault: Boolean(source.isDefault), createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        if (source.deliveryType !== 'authenticated') warnings.push({ kind: 'resumes', legacyId: String(source._id), reason: 'public_object_requires_private_reupload_before_download' });
        return 'created';
      });
    }

    for await (const row of Interview.find().lean().cursor()) {
      const source: any = row;
      await importOne('interviews', source._id, async () => {
        const id = idOf('interview', source._id);
        if (await db.interview.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const resumeId = optionalId('resume', source.resumeId);
        const mappedResume = resumeId ? await db.resume.findUnique({ where: { id: resumeId }, select: { id: true, userId: true } }) : null;
        if (mappedResume && mappedResume.userId !== userId) throw new Error('resume_owned_by_different_user');
        await db.interview.create({ data: {
          id, userId, resumeId: mappedResume?.id || null,
          resumeSnapshot: source.resumeId && !mappedResume ? json({ legacyResumeId: String(source.resumeId), migrationNote: 'private_reupload_required' }) : Prisma.JsonNull,
          jobTitle: String(source.jobTitle || 'Untitled role'), company: source.company || null,
          jobDescription: String(source.jobDescription || ''), experienceLevel: String(source.experienceLevel || 'mid'),
          questionCount: nonnegativeInt(source.numberOfQuestions, source.questions?.length || 0),
          questionTypes: Array.isArray(source.questionTypes) ? source.questionTypes.map(String) : [],
          generationStartedAt: optionalDate(source.generationStartedAt),
          generationAttemptId: source.generationAttemptId || null,
          generationStatus: allowed(source.generationStatus, ['pending', 'generating', 'generated', 'failed'] as const, 'pending'),
          status: allowed(source.status, ['draft', 'ready', 'in_progress', 'completed'] as const, 'draft'),
          errorCode: source.generationError || null,
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
      for (const [ordinal, question] of (source.questions || []).entries()) {
        await importOne('questions', question._id, async () => {
          const id = idOf('question', question._id);
          if (await db.question.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
          if (!await db.interview.findUnique({ where: { id: idOf('interview', source._id) }, select: { id: true } })) throw new Error('interview_not_migrated');
          await db.question.create({ data: {
            id, interviewId: idOf('interview', source._id), ordinal,
            category: String(question.category || 'technical'), difficulty: String(question.difficulty || 'medium'),
            prompt: String(question.questionText || ''), expectedKeywords: Array.isArray(question.expectedKeywords) ? question.expectedKeywords.map(String) : [],
            generationVersion: 'legacy-mongo',
          } });
          return 'created';
        });
      }
    }

    for await (const row of Session.find().lean().cursor()) {
      const source: any = row;
      await importOne('sessions', source._id, async () => {
        const id = idOf('session', source._id);
        if (await db.session.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const interviewId = idOf('interview', source.interviewId);
        const interview = await db.interview.findUnique({ where: { id: interviewId }, select: { userId: true } });
        if (!interview || interview.userId !== userId) throw new Error('interview_not_migrated_or_wrong_owner');
        await db.session.create({ data: {
          id, userId, interviewId,
          status: allowed(source.status, ['started', 'in_progress', 'evaluating', 'evaluation_failed', 'completed', 'abandoned'] as const, 'started'),
          currentQuestionOrdinal: nonnegativeInt(source.answers?.length),
          startedAt: date(source.startedAt), completedAt: optionalDate(source.completedAt),
          evaluationStartedAt: optionalDate(source.evaluationStartedAt),
          durationSeconds: nonnegativeInt(source.totalTimeTaken), overallScore: source.overallScore ?? null,
          feedback: json({ overallFeedback: source.overallFeedback, strengths: source.strengths,
            areasForImprovement: source.areasForImprovement, recommendedResources: source.recommendedResources }),
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
      for (const answer of source.answers || []) {
        await importOne('answers', answer._id, async () => {
          const id = idOf('answer', answer._id);
          if (await db.answer.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
          const sessionId = idOf('session', source._id);
          if (!await db.session.findUnique({ where: { id: sessionId }, select: { id: true } })) throw new Error('session_not_migrated');
          const questionId = idOf('question', answer.questionId);
          if (!await db.question.findUnique({ where: { id: questionId }, select: { id: true } })) throw new Error('question_not_migrated');
          await db.answer.create({ data: {
            id, interviewId: idOf('interview', source.interviewId), sessionId, questionId,
            text: String(answer.answerText || ''), questionText: answer.questionText || null,
            answerAudio: answer.answerAudio || null, followupUsed: Boolean(answer.followupUsed),
            skipped: Boolean(answer.skipped),
            timeTakenSeconds: nonnegativeInt(answer.timeTaken),
            submittedAt: date(source.updatedAt), score: answer.aiScore ?? null,
            feedback: answer.aiFeedback || null,
            evaluationStatus: source.status === 'completed' ? 'completed' :
              source.status === 'evaluation_failed' ? 'unavailable' : 'pending',
          } });
          return 'created';
        });
      }
    }

    for await (const row of Plan.find().lean().cursor()) {
      const source: any = row;
      await importOne('plans', source._id, async () => {
        const id = idOf('plan', source._id);
        if (await db.plan.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        if (source.currency && source.currency !== 'INR') throw new Error('unsupported_plan_currency');
        const amountMinor = source.amountMinor ?? Math.round(Number(source.price) * 100);
        if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error('invalid_plan_amount');
        await db.plan.create({ data: {
          id, code: String(source.code || `LEGACY_${source._id}`), name: String(source.name),
          description: (source.features || []).join(' · '), billingInterval: 'one_time',
          durationDays: nonnegativeInt(source.durationDays, 30), credits: nonnegativeInt(source.credits),
          features: Array.isArray(source.features) ? source.features.map(String) : [],
          coupons: json(source.coupons || []), directDiscount: Number(source.directDiscount || 0),
          isPublished: Boolean(source.isPublished), isArchived: Boolean(source.isArchived),
          postedById: source.postedBy ? await assertUser(source.postedBy) : null,
          currency: 'INR', amountMinor, active: Boolean(source.isPublished && !source.isArchived),
          entitlements: { credits: nonnegativeInt(source.credits), durationDays: nonnegativeInt(source.durationDays, 30), features: source.features || [] },
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of PaymentOrder.find().lean().cursor()) {
      const source: any = row;
      await importOne('paymentOrders', source._id, async () => {
        const id = idOf('paymentOrder', source._id);
        if (await db.paymentOrder.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const planId = idOf('plan', source.planId);
        if (!await db.plan.findUnique({ where: { id: planId }, select: { id: true } })) throw new Error('plan_not_migrated');
        await db.paymentOrder.create({ data: {
          id, userId, planId, transactionId: String(source.transactionId), idempotencyKey: String(source.idempotencyKey),
          amountMinor: nonnegativeInt(source.amountMinor), currency: String(source.currency || 'INR'),
          creditLimit: nonnegativeInt(source.creditLimit), durationDays: nonnegativeInt(source.durationDays),
          status: allowed(source.status, ['pending', 'success', 'failed', 'refund_pending', 'refunded'] as const, 'pending'),
          payuId: source.payuId || null, refundToken: source.refundToken || null,
          refundRequestId: source.refundRequestId || null,
          productInfo: source.productInfo || null, firstName: source.firstName || null,
          email: source.email || null, phone: source.phone || null,
          callbackEmailTag: source.callbackEmailTag || null, callbackPhoneTag: source.callbackPhoneTag || null,
          failureCode: source.failureCode || null,
          lastReconciledAt: optionalDate(source.lastReconciledAt),
          reconcileLeaseUntil: optionalDate(source.reconcileLeaseUntil),
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of Subscription.find().lean().cursor()) {
      const source: any = row;
      await importOne('subscriptions', source._id, async () => {
        const id = idOf('subscription', source._id);
        if (await db.subscription.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const orderId = idOf('paymentOrder', source.orderId);
        const order = await db.paymentOrder.findUnique({ where: { id: orderId }, select: { userId: true, planId: true } });
        if (!order || order.userId !== idOf('user', source.userId) || order.planId !== idOf('plan', source.planId)) throw new Error('payment_order_not_migrated_or_mismatched');
        await db.subscription.create({ data: {
          id, userId: order.userId, planId: order.planId, orderId,
          status: allowed(source.status, ['active', 'canceled', 'refunded', 'expired'] as const, 'expired'),
          creditLimit: nonnegativeInt(source.creditLimit),
          currentPeriodStart: date(source.currentPeriodStart), currentPeriodEnd: date(source.currentPeriodEnd),
          cancelAtPeriodEnd: Boolean(source.cancelAtPeriodEnd), canceledAt: optionalDate(source.canceledAt),
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of UsageLedger.find().lean().cursor()) {
      const source: any = row;
      await importOne('usageLedger', source._id, async () => {
        const id = idOf('usageLedger', source._id);
        if (await db.usageLedgerEntry.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const interviewId = idOf('interview', source.interviewId);
        if (!await db.interview.findUnique({ where: { id: interviewId }, select: { id: true } })) throw new Error('interview_not_migrated');
        const periodKey = String(source.periodKey || '').replace(/^paid:([0-9a-f]{24})$/i,
          (_match: string, legacyId: string) => `paid:${idOf('subscription', legacyId)}`);
        await db.usageLedgerEntry.create({ data: {
          id, userId, interviewId, feature: 'question_generation',
          unitsDelta: Number(source.unitsDelta), periodKey, reason: String(source.reason),
          status: String(source.status || 'committed'),
          idempotencyKey: `legacy:${source._id}`, createdAt: date(source.createdAt),
        } });
        return 'created';
      });
    }

    for await (const row of UsageCounter.find().lean().cursor()) {
      const source: any = row;
      await importOne('usageCounters', source._id, async () => {
        const id = idOf('usageCounter', source._id);
        if (await db.usageCounter.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const periodKey = String(source.periodKey || '').replace(/^paid:([0-9a-f]{24})$/i,
          (_match: string, legacyId: string) => `paid:${idOf('subscription', legacyId)}`);
        await db.usageCounter.create({ data: { id, userId, periodKey,
          units: nonnegativeInt(source.units), createdAt: date(source.createdAt), updatedAt: date(source.updatedAt) } });
        return 'created';
      });
    }

    for await (const row of WebhookLog.find().lean().cursor()) {
      const source: any = row;
      await importOne('paymentEvents', source._id, async () => {
        const id = idOf('paymentEvent', source._id);
        if (await db.paymentEvent.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        await db.paymentEvent.create({ data: {
          id, provider: String(source.provider), providerEventId: String(source.eventId || source._id),
          eventType: String(source.eventType), receivedAt: date(source.createdAt),
          processedAt: source.status === 'processed' ? date(source.updatedAt) : null,
          status: source.status === 'processed' ? 'processed' : source.status === 'failed' ? 'failed' : 'received',
          error: source.error || null, payload: json(source.payload),
        } });
        return 'created';
      });
    }

    for await (const row of Job.find().lean().cursor()) {
      const source: any = row;
      await importOne('jobs', source._id, async () => {
        const id = idOf('jobListing', source._id);
        if (await db.jobListing.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const url = source.redirectUrl || source.applyUrl;
        let parsed: URL;
        try { parsed = new URL(url); } catch { throw new Error('invalid_apply_url'); }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid_apply_url');
        const name = String(source.adzunaId || source.jobHash ? source.source || 'Adzuna'
          : source.source && source.source !== 'Adzuna' ? source.source : 'local');
        const sourceId = idOf('jobSource', name);
        await db.jobSource.upsert({ where: { id: sourceId }, update: {}, create: { id: sourceId, name } });
        await db.jobListing.create({ data: {
          id, sourceId, externalId: String(source.adzunaId || source.jobHash || source._id),
          title: String(source.title), company: String(source.company), location: source.location || null,
          description: String(source.description), applyUrl: parsed.href,
          salaryMin: source.salaryMin ?? null, salaryMax: source.salaryMax ?? null,
          category: source.category || null, contractType: source.contractType || null,
          featured: Boolean(source.isFeatured), pinned: Boolean(source.isPinned),
          archived: Boolean(source.isArchived), skills: Array.isArray(source.skills) ? source.skills.map(String) : [],
          experience: source.experience || null, jobHash: source.jobHash || null,
          postedById: source.postedBy ? await assertUser(source.postedBy) : null,
          postedAt: optionalDate(source.postedTime), active: Boolean(source.isActive && !source.isArchived),
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of AuditLog.find().lean().cursor()) {
      const source: any = row;
      await importOne('auditEvents', source._id, async () => {
        const id = idOf('auditEvent', source._id);
        if (await db.auditEvent.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const actorId = optionalId('user', source.userId);
        const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { id: true } }) : null;
        await db.auditEvent.create({ data: {
          id, actorUserId: actor?.id || null, action: String(source.action),
          targetType: String(source.category), targetId: String(source._id),
          category: source.category || null, status: source.status || null, details: source.details || null,
          metadata: json({ status: source.status, details: source.details, legacyMetadata: source.metadata }),
          createdAt: date(source.createdAt),
        } });
        return 'created';
      });
    }

    for await (const row of Transaction.find().lean().cursor()) {
      const source: any = row;
      await importOne('transactions', source._id, async () => {
        const id = idOf('transaction', source._id);
        if (await db.legacyTransaction.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const userId = await assertUser(source.userId);
        const planId = source.planId ? idOf('plan', source.planId) : null;
        if (planId && !await db.plan.findUnique({ where: { id: planId }, select: { id: true } })) throw new Error('plan_not_migrated');
        await db.legacyTransaction.create({ data: { id, userId, planId,
          transactionId: String(source.transactionId), amountMinor: Math.round(Number(source.amount) * 100),
          currency: String(source.currency || 'USD'), status: String(source.status || 'success'),
          invoiceUrl: source.invoiceUrl || null, paymentMethod: source.paymentMethod || null,
          refundReason: source.refundReason || null, refundedAt: optionalDate(source.refundedAt),
          error: source.error || null, createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of InterviewTemplate.find().lean().cursor()) {
      const source: any = row;
      await importOne('templates', source._id, async () => {
        const id = idOf('template', source._id);
        if (await db.interviewTemplate.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        await db.interviewTemplate.create({ data: { id, name: String(source.name),
          difficulty: String(source.difficulty || 'medium'), duration: nonnegativeInt(source.duration, 30),
          questionCount: nonnegativeInt(source.questionCount, 5), systemPrompt: String(source.systemPrompt || ''),
          evaluationPrompt: String(source.evaluationPrompt || ''), feedbackPrompt: String(source.feedbackPrompt || ''),
          voiceId: String(source.voiceId || 'alloy'), voiceSpeed: Number(source.voiceSpeed || 1),
          voicePitch: Number(source.voicePitch || 1), language: String(source.language || 'en'),
          postedById: source.postedBy ? await assertUser(source.postedBy) : null,
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of SystemPrompt.find().lean().cursor()) {
      const source: any = row;
      await importOne('prompts', source._id, async () => {
        const id = idOf('prompt', source._id);
        if (await db.systemPrompt.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        const history = [] as Record<string, unknown>[];
        for (const item of source.history || []) history.push({
          version: item.version, content: item.content, changeReason: item.changeReason,
          updatedBy: item.updatedBy ? await assertUser(item.updatedBy) : null,
          updatedAt: item.updatedAt,
        });
        await db.systemPrompt.create({ data: { id, category: String(source.category),
          name: String(source.name), content: String(source.content), description: String(source.description || ''),
          version: nonnegativeInt(source.version, 1), history: json(history),
          lastUpdatedById: source.lastUpdatedBy ? await assertUser(source.lastUpdatedBy) : null,
          createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of SystemSetting.find().lean().cursor()) {
      const source: any = row;
      await importOne('settings', source._id, async () => {
        const id = idOf('setting', source._id);
        if (await db.systemSetting.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        if (await db.systemSetting.count()) throw new Error('multiple_legacy_settings_require_manual_merge');
        const secrets = [source.security?.apiKeys?.groq, source.security?.apiKeys?.stripe,
          source.security?.apiKeys?.adzunaId, source.security?.apiKeys?.adzunaKey,
          source.storage?.cloudinary?.apiKey, source.storage?.cloudinary?.apiSecret,
          source.storage?.aws?.accessKey, source.storage?.aws?.secretKey].some(Boolean);
        if (secrets) warnings.push({ kind: 'settings', legacyId: String(source._id),
          reason: 'legacy_secrets_not_copied_configure_provider_environment' });
        await db.systemSetting.create({ data: { id, singletonKey: 'system', general: json(source.general),
          security: json({ rateLimits: source.security?.rateLimits || { windowMs: 900000, maxRequests: 100 } }),
          ai: json(source.ai), storage: json({ provider: source.storage?.provider || 'cloudinary',
            cloudinary: { cloudName: source.storage?.cloudinary?.cloudName || '' },
            aws: { bucket: source.storage?.aws?.bucket || '', region: source.storage?.aws?.region || '' } }),
          featureFlags: json(source.featureFlags), createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of ScraperConfig.find().lean().cursor()) {
      const source: any = row;
      await importOne('scraperConfigs', source._id, async () => {
        const id = idOf('scraperConfig', source._id);
        if (await db.scraperConfig.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        if (await db.scraperConfig.count()) throw new Error('multiple_legacy_scraper_configs_require_manual_merge');
        await db.scraperConfig.create({ data: { id, singletonKey: 'scraper',
          scrapeInterval: nonnegativeInt(source.scrapeInterval, 60), maxJobs: nonnegativeInt(source.maxJobs, 50),
          keywords: source.keywords || [], country: String(source.country || 'us'),
          remoteOnly: Boolean(source.remoteOnly), enabledSources: source.enabledSources || [],
          status: String(source.status || 'idle'), isActiveScheduler: Boolean(source.isActiveScheduler),
          lastRun: optionalDate(source.lastRun), createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    for await (const row of ScraperLog.find().lean().cursor()) {
      const source: any = row;
      await importOne('scraperLogs', source._id, async () => {
        const id = idOf('scraperLog', source._id);
        if (await db.scraperLog.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
        await db.scraperLog.create({ data: { id, startTime: date(source.startTime), endTime: optionalDate(source.endTime),
          status: String(source.status || 'running'), jobsImported: nonnegativeInt(source.jobsImported),
          jobsUpdated: nonnegativeInt(source.jobsUpdated), duplicateCount: nonnegativeInt(source.duplicateCount),
          error: source.error || null, createdAt: date(source.createdAt), updatedAt: date(source.updatedAt),
        } });
        return 'created';
      });
    }

    if (process.env.LEGACY_JOBS_DATABASE_URL) {
      const old = new PgClient({ connectionString: process.env.LEGACY_JOBS_DATABASE_URL });
      await old.connect();
      try {
        const rows = await old.query('SELECT to_jsonb(j) AS data FROM jobs AS j');
        for (const entry of rows.rows) {
          const source = entry.data as Record<string, any>;
          const legacyId = String(source.id || source.adzuna_id || source.adzunaId || '');
          await importOne('legacyPgJobs', legacyId, async () => {
            if (!legacyId) throw new Error('legacy_pg_job_missing_identity');
            const id = idOf('legacyPgJob', legacyId);
            if (await db.jobListing.findUnique({ where: { id }, select: { id: true } })) return 'alreadyPresent';
            const externalId = String(source.adzuna_id || source.adzunaId || legacyId);
            const sourceName = String(source.source || 'legacy_postgresql');
            const sourceId = idOf('jobSource', sourceName);
            await db.jobSource.upsert({ where: { id: sourceId }, update: {}, create: { id: sourceId, name: sourceName } });
            const existing = await db.jobListing.findUnique({ where: { sourceId_externalId: { sourceId, externalId } } });
            if (existing) {
              warnings.push({ kind: 'legacyPgJobs', legacyId,
                reason: `external_identity_matches_existing_listing:${existing.id}` });
              return 'alreadyPresent';
            }
            const applyUrl = String(source.redirect_url || source.redirectUrl || source.apply_url || source.url || '');
            const parsed = new URL(applyUrl);
            if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid_apply_url');
            await db.jobListing.create({ data: { id, sourceId, externalId,
              title: String(source.title || ''), company: String(source.company || ''),
              location: source.location || null, description: String(source.description || ''), applyUrl: parsed.href,
              salaryMin: source.salary_min ?? source.salaryMin ?? null,
              salaryMax: source.salary_max ?? source.salaryMax ?? null,
              category: source.category || null, contractType: source.contract_type || source.contractType || null,
              skills: Array.isArray(source.skills) ? source.skills.map(String) : [],
              postedAt: optionalDate(source.posted_time || source.postedTime),
              active: source.is_active ?? source.isActive ?? true,
            } });
            return 'created';
          });
        }
      } finally { await old.end(); }
    }

    const modelForKind: Record<Kind, string> = {
      resumes: 'resume', interviews: 'interview', questions: 'question', sessions: 'session', answers: 'answer',
      plans: 'plan', paymentOrders: 'paymentOrder', subscriptions: 'subscription',
      usageLedger: 'usageLedgerEntry', usageCounters: 'usageCounter', paymentEvents: 'paymentEvent',
      jobs: 'jobListing', legacyPgJobs: 'jobListing', auditEvents: 'auditEvent',
      transactions: 'legacyTransaction', templates: 'interviewTemplate', prompts: 'systemPrompt',
      settings: 'systemSetting', scraperConfigs: 'scraperConfig', scraperLogs: 'scraperLog',
    };
    const destinationCounts = {} as Record<Kind, number>;
    const mappedCounts = {} as Record<Kind, number>;
    for (const kind of kinds) {
      const model = (db as any)[modelForKind[kind]];
      destinationCounts[kind] = await model.count();
      mappedCounts[kind] = 0;
      for (let start = 0; start < expectedIds[kind].length; start += 500) {
        mappedCounts[kind] += await model.count({ where: { id: { in: expectedIds[kind].slice(start, start + 500) } } });
      }
    }
    return { apply, sourceUsers, mappedUsers, counts, destinationCounts, mappedCounts, failures, warnings,
      missingMapped: Object.fromEntries(kinds.map(kind => [kind, counts[kind].inspected - mappedCounts[kind]])) };
  } finally {
    await Promise.allSettled([db.$disconnect(), mongoose.disconnect()]);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/migrate-related.ts')) {
  migrateRelated(process.argv.includes('--apply')).then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (result.failures.length || (result.apply && (result.warnings.length ||
      Object.values(result.missingMapped).some(count => count > 0)))) process.exitCode = 1;
  }).catch(error => { console.error(`Related data migration failed: ${error.message}`); process.exitCode = 1; });
}
