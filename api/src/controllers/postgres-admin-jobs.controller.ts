import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma, type JobListing } from '@prisma/client';
import prisma from '../config/prisma';
import { clearJobsCache } from '../config/redis';
import AppError from '../utils/app-error';
import { jobFingerprint } from '../utils/deduplicator';

const pageOf = (value: unknown) => Math.max(1, Math.min(100000, Number.parseInt(String(value), 10) || 1));
const limitOf = (value: unknown) => Math.max(1, Math.min(100, Number.parseInt(String(value), 10) || 15));
const validApplyUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
};
type Loaded = JobListing & { source?: { name: string }; postedBy?: { id: string; displayName: string; email: string } | null };
const present = (row: Loaded) => ({ ...row, _id: row.id,
  adzunaId: row.source?.name === 'Adzuna' ? row.externalId : undefined,
  postedTime: row.postedAt, isActive: row.active, isFeatured: row.featured,
  isPinned: row.pinned, isArchived: row.archived, redirectUrl: row.applyUrl,
  source: row.source?.name || 'local',
  postedBy: row.postedBy ? { _id: row.postedBy.id, name: row.postedBy.displayName,
    email: row.postedBy.email } : null,
});
const include = { source: { select: { name: true } }, postedBy: {
  select: { id: true, displayName: true, email: true },
} } as const;

export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  const { title, company, location = 'Remote', description, applyUrl = '', salaryMin, salaryMax,
    contractType = 'full_time', category = 'General', isFeatured, isPinned, ignoreDuplicate } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
    typeof company !== 'string' || !company.trim() || company.length > 200 ||
    typeof description !== 'string' || !description.trim() || description.length > 20000 ||
    typeof location !== 'string' || location.length > 200 || !validApplyUrl(applyUrl)) {
    return next(new AppError('Job title, company, and description are required.', 400));
  }
  const fingerprint = jobFingerprint({ title, company, location });
  if (!ignoreDuplicate && await prisma.jobListing.findFirst({ where: { jobHash: fingerprint, archived: false } })) {
    return res.status(409).json({ success: false, duplicateDetected: true,
      message: 'A job listing with the same title, company, and location already exists.' });
  }
  const source = await prisma.jobSource.upsert({ where: { name: 'local' }, update: {}, create: { name: 'local' } });
  try {
    const row = await prisma.jobListing.create({ data: { sourceId: source.id, externalId: randomUUID(),
      title: title.trim(), company: company.trim(), location: location.trim() || 'Remote', description,
      applyUrl: applyUrl.trim(), salaryMin: salaryMin ?? null, salaryMax: salaryMax ?? null,
      contractType, category, featured: Boolean(isFeatured), pinned: Boolean(isPinned),
      jobHash: ignoreDuplicate ? null : fingerprint, postedById: String(req.admin?.id || req.admin?._id),
      postedAt: new Date(),
    }, include });
    await clearJobsCache();
    res.status(201).json({ success: true, job: present(row) });
  } catch (error: any) {
    if (error?.code === 'P2002') return next(new AppError('Duplicate job listing.', 409));
    next(error);
  }
};

export const getAllJobs = async (req: Request, res: Response) => {
  const page = pageOf(req.query.page);
  const limit = limitOf(req.query.limit);
  const search = String(req.query.search || '').slice(0, 100);
  const where: Prisma.JobListingWhereInput = {};
  if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } },
    { company: { contains: search, mode: 'insensitive' } }];
  if (req.query.contractType && req.query.contractType !== 'all') where.contractType = String(req.query.contractType);
  if (req.query.filterType === 'featured') where.featured = true;
  if (req.query.filterType === 'pinned') where.pinned = true;
  where.archived = req.query.filterType === 'archived';
  const sortField = ['createdAt', 'title', 'company', 'postedAt'].includes(String(req.query.sortBy))
    ? String(req.query.sortBy) : 'createdAt';
  const direction = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const [jobs, total] = await Promise.all([
    prisma.jobListing.findMany({ where, include, orderBy: [{ pinned: 'desc' }, { [sortField]: direction }],
      skip: (page - 1) * limit, take: limit }),
    prisma.jobListing.count({ where }),
  ]);
  res.json({ success: true, data: { jobs: jobs.map(present), total, page, pages: Math.ceil(total / limit) } });
};

export const getJobStats = async (_req: Request, res: Response) => {
  const [totalJobs, pinnedJobs, featuredJobs, archivedJobs, grouped] = await Promise.all([
    prisma.jobListing.count({ where: { archived: false } }),
    prisma.jobListing.count({ where: { pinned: true, archived: false } }),
    prisma.jobListing.count({ where: { featured: true, archived: false } }),
    prisma.jobListing.count({ where: { archived: true } }),
    prisma.jobListing.groupBy({ by: ['contractType'], where: { archived: false }, _count: true }),
  ]);
  res.json({ success: true, data: { totalJobs, pinnedJobs, featuredJobs, archivedJobs,
    contractTypes: grouped.map(row => ({ _id: row.contractType, count: row._count })) } });
};

export const getJobById = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.jobListing.findUnique({ where: { id: String(req.params.id) }, include });
  if (!row) return next(new AppError('Job listing not found.', 404));
  res.json({ success: true, job: present(row) });
};

export const updateJob = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const old = await prisma.jobListing.findUnique({ where: { id } });
  if (!old) return next(new AppError('Job listing not found.', 404));
  if (req.body.applyUrl !== undefined && !validApplyUrl(req.body.applyUrl)) return next(new AppError('Apply URL must be a valid HTTPS address.', 400));
  const data: Prisma.JobListingUpdateInput = {};
  for (const field of ['title', 'company', 'location', 'description', 'contractType', 'category'] as const) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== 'string' || !req.body[field].trim()) return next(new AppError(`Invalid ${field}.`, 400));
      (data as any)[field] = req.body[field].trim();
    }
  }
  if (req.body.salaryMin !== undefined) data.salaryMin = req.body.salaryMin;
  if (req.body.salaryMax !== undefined) data.salaryMax = req.body.salaryMax;
  if (req.body.applyUrl !== undefined) data.applyUrl = req.body.applyUrl.trim();
  if (req.body.isFeatured !== undefined) data.featured = Boolean(req.body.isFeatured);
  if (req.body.isPinned !== undefined) data.pinned = Boolean(req.body.isPinned);
  if (req.body.isArchived !== undefined) data.archived = Boolean(req.body.isArchived);
  if (old.jobHash && (data.title || data.company || data.location)) data.jobHash = jobFingerprint({
    title: data.title || old.title, company: data.company || old.company, location: data.location || old.location,
  });
  try {
    const row = await prisma.jobListing.update({ where: { id }, data, include });
    await clearJobsCache();
    res.json({ success: true, job: present(row) });
  } catch (error: any) {
    if (error?.code === 'P2002') return next(new AppError('Duplicate job listing.', 409));
    next(error);
  }
};

export const deleteJob = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  if (!await prisma.jobListing.findUnique({ where: { id } })) return next(new AppError('Job listing not found.', 404));
  await prisma.jobListing.delete({ where: { id } });
  await clearJobsCache();
  res.json({ success: true, message: 'Job listing deleted successfully.' });
};

export const bulkJobAction = async (req: Request, res: Response, next: NextFunction) => {
  const { jobIds, action } = req.body;
  if (!Array.isArray(jobIds) || !jobIds.length || jobIds.length > 100 ||
    jobIds.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) return next(new AppError('No job IDs provided.', 400));
  const actions: Record<string, Prisma.JobListingUpdateManyMutationInput> = {
    archive: { archived: true }, unarchive: { archived: false }, feature: { featured: true },
    unfeature: { featured: false }, pin: { pinned: true }, unpin: { pinned: false },
  };
  if (action !== 'delete' && !actions[action]) return next(new AppError('Invalid bulk action.', 400));
  const count = action === 'delete'
    ? (await prisma.jobListing.deleteMany({ where: { id: { in: jobIds } } })).count
    : (await prisma.jobListing.updateMany({ where: { id: { in: jobIds } }, data: actions[action] })).count;
  await clearJobsCache();
  res.json({ success: true, message: `Bulk ${action} operation completed successfully on ${count} listings.` });
};
