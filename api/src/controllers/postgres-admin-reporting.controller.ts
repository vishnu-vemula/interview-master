import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

const day = (d: Date) => d.toISOString().slice(0, 10);
const series = (start: Date, rows: { createdAt: Date; value?: number }[], field = 'count') => {
  const buckets = new Map<string, number>();
  for (const row of rows) buckets.set(day(row.createdAt), (buckets.get(day(row.createdAt)) || 0) + (row.value ?? 1));
  const result: Record<string, string | number>[] = [];
  for (let d = new Date(start); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = day(d); result.push({ date: key, [field]: buckets.get(key) || 0 });
  }
  return result;
};
export const getStats = async (_req: Request, res: Response) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86400000);
  const [totalUsers, premiumUsers, totalInterviews, totalSessions, totalResumes,
    activeUsers, interviewsToday, jobsCount, newUsers, score, revenue, registrations, sessions, resumes, errors] = await Promise.all([
    prisma.user.count({ where: { role: 'candidate' } }),
    prisma.user.count({ where: { role: 'candidate', isPremium: true } }),
    prisma.interview.count(), prisma.session.count(), prisma.resume.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: 'candidate', status: 'active' } }),
    prisma.interview.count({ where: { createdAt: { gte: today } } }),
    prisma.jobListing.count({ where: { active: true, archived: false } }),
    prisma.user.count({ where: { role: 'candidate', createdAt: { gte: week } } }),
    prisma.session.aggregate({ where: { status: 'completed' }, _avg: { overallScore: true } }),
    prisma.paymentOrder.aggregate({ where: { status: { in: ['success', 'refund_pending'] } }, _sum: { amountMinor: true } }),
    prisma.user.findMany({ where: { role: 'candidate' }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.session.findMany({ orderBy: { createdAt: 'desc' }, take: 5,
      include: { user: true, interview: true } }),
    prisma.resume.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: true } }),
    prisma.auditEvent.findMany({ where: { status: { in: ['failed', 'warning'] } },
      orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  const activities = [
    ...registrations.map(u => ({ id: `user-${u.id}`, type: 'user', title: 'New Candidate Registered',
      message: `${u.displayName} (${u.email}) joined the platform`, timestamp: u.createdAt })),
    ...sessions.map(s => ({ id: `session-${s.id}`, type: 'session', title: 'Interview Completed',
      message: `${s.user.displayName} completed mock interview for ${s.interview.jobTitle}`,
      timestamp: s.createdAt, score: s.overallScore })),
    ...resumes.map(r => ({ id: `resume-${r.id}`, type: 'resume', title: 'Resume Uploaded',
      message: `${r.user.displayName} uploaded a new resume file`, timestamp: r.createdAt })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);
  const months: { month: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i, 1);
    months.push({ month: d.toLocaleString('en-US', { month: 'short' }), key: d.toISOString().slice(0, 7) }); }
  const periodStart = new Date(`${months[0].key}-01T00:00:00.000Z`);
  const [monthlyUsers, monthlyOrders, monthlyInterviews, priorUsers] = await Promise.all([
    prisma.user.findMany({ where: { role: 'candidate', createdAt: { gte: periodStart } }, select: { createdAt: true } }),
    prisma.paymentOrder.findMany({ where: { status: { in: ['success', 'refund_pending'] },
      createdAt: { gte: periodStart } }, select: { createdAt: true, amountMinor: true } }),
    prisma.interview.findMany({ where: { createdAt: { gte: periodStart } }, select: { createdAt: true } }),
    prisma.user.count({ where: { role: 'candidate', createdAt: { lt: periodStart } } }),
  ]);
  let cumulative = priorUsers;
  const charts = { userGrowth: months.map(m => { cumulative += monthlyUsers.filter(u => u.createdAt.toISOString().startsWith(m.key)).length;
    return { month: m.month, users: cumulative }; }),
    revenue: months.map(m => ({ month: m.month, amount: monthlyOrders.filter(o => o.createdAt.toISOString().startsWith(m.key))
      .reduce((sum, o) => sum + o.amountMinor, 0) / 100 })),
    interviews: months.map(m => ({ month: m.month, count: monthlyInterviews.filter(i => i.createdAt.toISOString().startsWith(m.key)).length })),
    dailyActivity: [] as { day: string; sessions: number; users: number }[] };
  res.json({ success: true, data: { totalUsers, premiumUsers, freeUsers: Math.max(0, totalUsers - premiumUsers),
    interviewsToday, totalInterviews, jobsCount, applicationsCount: totalResumes + totalSessions,
    totalRevenue: (revenue._sum.amountMinor || 0) / 100, activeUsers, newUsersThisWeek: newUsers,
    platformAvgScore: score._avg.overallScore?.toFixed(1) ?? 0, activities, charts,
    recentErrors: errors.map(e => ({ id: e.id, service: `${(e.category || 'system').toUpperCase()} - ${e.action}`,
      message: e.details, timestamp: e.createdAt, severity: e.status })) } });
};
export const getAnalytics = async (req: Request, res: Response) => {
  const days = req.query.range === '7d' ? 7 : req.query.range === '90d' ? 90 : req.query.range === '1y' ? 365 : 30;
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days); start.setUTCHours(0, 0, 0, 0);
  const [totalCandidates, premiumCandidates, totalJobs, activeSessionsCount, completedSessionsCount,
    score, registrations, orders, sessions, jobs] = await Promise.all([
    prisma.user.count({ where: { role: 'candidate' } }),
    prisma.user.count({ where: { role: 'candidate', isPremium: true } }),
    prisma.jobListing.count({ where: { archived: false } }),
    prisma.session.count(), prisma.session.count({ where: { status: 'completed' } }),
    prisma.session.aggregate({ _avg: { overallScore: true } }),
    prisma.user.findMany({ where: { role: 'candidate', createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.paymentOrder.findMany({ where: { status: { in: ['success', 'refund_pending'] },
      createdAt: { gte: start } }, select: { createdAt: true, amountMinor: true } }),
    prisma.session.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.jobListing.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
  ]);
  res.json({ success: true, data: { metrics: { totalCandidates, premiumCandidates,
    conversionRate: totalCandidates ? +(100 * premiumCandidates / totalCandidates).toFixed(2) : 0,
    totalJobs, activeSessionsCount, completedSessionsCount,
    completionRate: activeSessionsCount ? +(100 * completedSessionsCount / activeSessionsCount).toFixed(2) : 0,
    averageMockScore: +(score._avg.overallScore || 0).toFixed(1) },
    trends: { users: series(start, registrations), revenue: series(start,
      orders.map(o => ({ createdAt: o.createdAt, value: o.amountMinor / 100 })), 'amount'),
      sessions: series(start, sessions), jobs: series(start, jobs) },
    retention: [] } });
};
export const getAllLogs = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const where: Prisma.AuditEventWhereInput = {};
  if (req.query.category && req.query.category !== 'all') where.category = String(req.query.category);
  if (req.query.status && req.query.status !== 'all') where.status = String(req.query.status);
  if (req.query.search) where.OR = [{ action: { contains: String(req.query.search), mode: 'insensitive' } },
    { details: { contains: String(req.query.search), mode: 'insensitive' } }];
  const [rows, total] = await Promise.all([prisma.auditEvent.findMany({ where,
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
    include: { actor: { select: { id: true, displayName: true, email: true } } } }),
  prisma.auditEvent.count({ where })]);
  res.json({ success: true, data: { logs: rows.map(row => ({ ...row, _id: row.id,
    userId: row.actor && { _id: row.actor.id, name: row.actor.displayName, email: row.actor.email } })),
    total, page, pages: Math.ceil(total / limit) } });
};
