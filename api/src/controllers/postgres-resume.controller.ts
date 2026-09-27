import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma, type Resume } from '@prisma/client';
import pdf from 'pdf-parse';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';
import AppError from '../utils/app-error';
import { parseResumeAndJD } from '../services/ai.service';
import { deletePostgresResume } from '../services/postgres-resume-deletion';

const ownerId = (req: Request) => String(req.user?.id || req.user?._id || '');
const present = (row: Resume) => ({
  _id: row.id, id: row.id, userId: row.userId,
  fileName: row.fileName || row.storageKey, originalName: row.originalName,
  deliveryType: row.deliveryType, format: row.format, publicId: row.storageKey,
  fileSize: row.sizeBytes, mimeType: row.contentType, extractedText: row.extractedText,
  parsedData: row.parsedData, isParsed: row.isParsed,
  isDefault: row.isDefault, parseStatus: row.parseStatus,
  createdAt: row.createdAt, updatedAt: row.updatedAt,
});

export const uploadResume = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return next(new AppError('Please upload a file.', 400));
  const { originalname, size, mimetype, buffer } = req.file;
  if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') return next(new AppError('The uploaded file is not a valid PDF.', 400));
  let extractedText: string | null = null;
  try { extractedText = (await pdf(buffer)).text?.slice(0, 8000) || null; } catch { /* A parse retry remains available. */ }
  let parsedData: unknown = null;
  if (extractedText) {
    try { parsedData = await parseResumeAndJD(extractedText, ''); } catch { /* Keep the extracted text. */ }
  }
  const uploaded: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'raw', type: 'authenticated', folder: 'interviewmaster/resumes',
      public_id: `${ownerId(req)}-${randomUUID()}`,
    }, (error: Error | undefined, result: any) => error ? reject(error) : resolve(result));
    stream.end(buffer);
  });
  try {
    const row = await prisma.$transaction(async tx => {
      // Serialize default selection for this owner even on concurrent uploads.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId(req)}::uuid FOR UPDATE`;
      const hasDefault = await tx.resume.count({ where: { userId: ownerId(req), isDefault: true, deletedAt: null } });
      return tx.resume.create({ data: {
        userId: ownerId(req), storageKey: String(uploaded.public_id), fileName: String(uploaded.public_id),
        originalName: originalname, contentType: mimetype, sizeBytes: size,
        deliveryType: 'authenticated', format: String(uploaded.format || 'pdf'),
        extractedText, parseStatus: extractedText ? 'parsed' : 'failed',
        parsedData: parsedData ? parsedData as Prisma.InputJsonValue : Prisma.JsonNull,
        isParsed: Boolean(parsedData),
        isDefault: hasDefault === 0,
      } });
    });
    res.status(201).json({ success: true, resume: present(row) });
  } catch (error) {
    await cloudinary.uploader.destroy(String(uploaded.public_id), { resource_type: 'raw', type: 'authenticated' }).catch(() => {});
    next(error);
  }
};

export const getMyResumes = async (req: Request, res: Response) => {
  const rows = await prisma.resume.findMany({ where: { userId: ownerId(req), deletedAt: null }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: rows.length, resumes: rows.map(present) });
};

export const downloadResume = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.resume.findFirst({ where: { id: String(req.params.id), userId: ownerId(req), deletedAt: null } });
  if (!row) return next(new AppError('Resume not found.', 404));
  if (row.deliveryType !== 'authenticated') return next(new AppError('This legacy resume must be uploaded again to enable private access.', 409));
  const url = cloudinary.utils.private_download_url(row.storageKey, row.format, {
    resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  res.json({ success: true, url, expiresInSeconds: 60 });
};

export const deleteResume = async (req: Request, res: Response, next: NextFunction) => {
  try { await deletePostgresResume(String(req.params.id), ownerId(req)); }
  catch (error) { return next(error); }
  res.json({ success: true, message: 'Resume deleted successfully.' });
};

export const setDefaultResume = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId(req)}::uuid FOR UPDATE`;
    const target = await tx.resume.findFirst({ where: { id: String(req.params.id), userId: ownerId(req), deletedAt: null } });
    if (!target) return null;
    await tx.resume.updateMany({ where: { userId: ownerId(req), isDefault: true }, data: { isDefault: false } });
    return tx.resume.update({ where: { id: target.id }, data: { isDefault: true } });
  });
  if (!row) return next(new AppError('Resume not found.', 404));
  res.json({ success: true, message: 'Default resume updated.', resume: present(row) });
};

export const parseResume = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.resume.findFirst({ where: { id: String(req.params.id), userId: ownerId(req), deletedAt: null } });
  if (!row) return next(new AppError('Resume not found.', 404));
  if (!row.extractedText) return next(new AppError('No text extracted from this resume. Upload a valid PDF.', 400));
  try {
    const parsedData = await parseResumeAndJD(row.extractedText, req.body.jobDescription || '');
    await prisma.resume.update({ where: { id: row.id }, data: { parsedData: parsedData as Prisma.InputJsonValue, parseStatus: 'parsed', isParsed: true } });
    res.json({ success: true, parsedData });
  } catch { next(new AppError('AI parsing failed. Please retry.', 503)); }
};
