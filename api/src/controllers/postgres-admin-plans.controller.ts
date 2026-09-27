import type { Request, Response, NextFunction } from 'express';
import { Prisma, type Plan } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';

const present = (row: Plan & { postedBy?: { id: string; displayName: string; email: string } | null }) => ({
  ...row, _id: row.id, price: row.amountMinor / 100 + row.directDiscount,
  postedBy: row.postedBy ? { _id: row.postedBy.id, name: row.postedBy.displayName, email: row.postedBy.email } : null,
});
const include = { postedBy: { select: { id: true, displayName: true, email: true } } } as const;
const amount = (price: unknown, discount: unknown) => Math.round((Number(price) - Number(discount || 0)) * 100);
const valid = (amountMinor: number, durationDays: unknown, credits: unknown) => Number.isSafeInteger(amountMinor) &&
  amountMinor >= 100 && Number.isInteger(Number(durationDays)) && Number(durationDays) >= 1 &&
  Number.isInteger(Number(credits)) && Number(credits) >= 1;

export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  const { name, price, durationDays, credits, features, coupons, directDiscount = 0, isPublished = true } = req.body;
  if (typeof name !== 'string' || !name.trim() || price === undefined) return next(new AppError('Plan name, price, duration, and credits are required.', 400));
  const amountMinor = amount(price, directDiscount);
  if (!valid(amountMinor, durationDays, credits)) return next(new AppError('Plan price, duration or allowance is invalid.', 400));
  const code = String(req.body.code || name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  try {
    const row = await prisma.plan.create({ data: { code, name: name.trim(),
      description: (Array.isArray(features) ? features : []).join(' · '), amountMinor,
      durationDays: Number(durationDays), credits: Number(credits),
      features: Array.isArray(features) ? features.map(String) : [],
      coupons: (Array.isArray(coupons) ? coupons : []) as Prisma.InputJsonValue,
      directDiscount: Number(directDiscount), isPublished: Boolean(isPublished),
      active: Boolean(isPublished), entitlements: { credits: Number(credits), durationDays: Number(durationDays) },
      postedById: String(req.admin?.id || req.admin?._id),
    }, include });
    res.status(201).json({ success: true, plan: present(row) });
  } catch (error: any) {
    if (error?.code === 'P2002') return next(new AppError('A plan with this code already exists.', 409));
    next(error);
  }
};

export const getAllPlans = async (req: Request, res: Response) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 10));
  const where = req.query.archived === 'all' ? {} : { isArchived: req.query.archived === 'true' };
  const [rows, total] = await Promise.all([
    prisma.plan.findMany({ where, include, orderBy: { amountMinor: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.plan.count({ where }),
  ]);
  res.json({ success: true, data: { plans: rows.map(present), total, page, pages: Math.ceil(total / limit) } });
};

export const getPlanStats = async (_req: Request, res: Response) => {
  const [totalPlans, activePlans, premium, credits] = await Promise.all([
    prisma.plan.count({ where: { isArchived: false } }),
    prisma.plan.count({ where: { isPublished: true, isArchived: false } }),
    prisma.subscription.groupBy({ by: ['userId'], where: { status: 'active', currentPeriodEnd: { gt: new Date() } } }),
    prisma.user.aggregate({ _sum: { credits: true } }),
  ]);
  res.json({ success: true, data: { totalPlans, activePlans, premiumUsers: premium.length,
    totalUserCredits: credits._sum.credits || 0 } });
};

export const getPlanById = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.plan.findUnique({ where: { id: String(req.params.id) }, include });
  if (!row) return next(new AppError('Plan not found.', 404));
  res.json({ success: true, plan: present(row) });
};

export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const old = await prisma.plan.findUnique({ where: { id } });
  if (!old) return next(new AppError('Plan not found.', 404));
  const price = req.body.price ?? (old.amountMinor / 100 + old.directDiscount);
  const directDiscount = req.body.directDiscount ?? old.directDiscount;
  const durationDays = req.body.durationDays ?? old.durationDays;
  const credits = req.body.credits ?? old.credits;
  const amountMinor = amount(price, directDiscount);
  if (!valid(amountMinor, durationDays, credits)) return next(new AppError('Plan price, duration or allowance is invalid.', 400));
  const features = req.body.features !== undefined ? req.body.features : old.features;
  if (!Array.isArray(features)) return next(new AppError('Plan features must be an array.', 400));
  const isPublished = req.body.isPublished ?? old.isPublished;
  const isArchived = req.body.isArchived ?? old.isArchived;
  const row = await prisma.plan.update({ where: { id }, data: {
    name: req.body.name !== undefined ? String(req.body.name).trim() : old.name,
    description: features.join(' · '), amountMinor, durationDays: Number(durationDays), credits: Number(credits),
    features: features.map(String), directDiscount: Number(directDiscount),
    ...(req.body.coupons !== undefined && { coupons: req.body.coupons as Prisma.InputJsonValue }),
    isPublished: Boolean(isPublished), isArchived: Boolean(isArchived), active: Boolean(isPublished && !isArchived),
    entitlements: { credits: Number(credits), durationDays: Number(durationDays), features },
  }, include });
  res.json({ success: true, plan: present(row) });
};

export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  if (!await prisma.plan.findUnique({ where: { id } })) return next(new AppError('Plan not found.', 404));
  await prisma.plan.update({ where: { id }, data: { isArchived: true, isPublished: false, active: false } });
  res.json({ success: true, message: 'Plan archived successfully.' });
};
