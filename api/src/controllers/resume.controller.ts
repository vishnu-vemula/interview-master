import type { Request, Response, NextFunction } from 'express';
import pdf from 'pdf-parse';
import Resume from '../models/resume.model';
import Interview from '../models/interview.model';
import cloudinary from '../config/cloudinary';
import AppError from '../utils/app-error';
import { parseResumeAndJD } from '../services/ai.service';
import { chunkDocument, chunkResumeAndJD, estimateTokens } from '../services/chunking.service';
import { normalizeText } from '../utils/normalizer';
import { randomUUID } from 'node:crypto';


// ─── POST /api/resumes/upload ─────────────────────────────────────
export const uploadResume = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new AppError('Please upload a file.', 400));
  }

  const { originalname, size, mimetype, buffer } = req.file;
  if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') {
    return next(new AppError('The uploaded file is not a valid PDF.', 400));
  }

  // Extract text from PDF for AI context
  let extractedText = null;
  let parseStatus = 'pending';

  try {
    const pdfData = await pdf(buffer);
    extractedText = pdfData.text?.slice(0, 8000) ?? null;
    parseStatus = extractedText ? 'parsed' : 'failed';
  } catch {
    parseStatus = 'failed';
  }

  // AI-powered structured extraction (resume-only, no JD needed)
  let parsedData = null;
  let isParsed = false;
  if (extractedText) {
    try {
      parsedData = await parseResumeAndJD(extractedText, '');
      isParsed = true;
    } catch {
      // Non-fatal — raw text still stored
    }
  }

  const uploaded: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'raw', type: 'authenticated', folder: 'interviewmaster/resumes',
      public_id: `${req.user._id}-${randomUUID()}`,
    }, (error: Error | undefined, result: any) => error ? reject(error) : resolve(result));
    stream.end(buffer);
  });

  const resume = await Resume.create({
    userId: req.user._id,
    fileName: uploaded.public_id,
    originalName: originalname,
    fileUrl: '',
    deliveryType: 'authenticated',
    format: uploaded.format || 'pdf',
    publicId: uploaded.public_id,
    fileSize: size,
    mimeType: mimetype,
    extractedText,
    parseStatus,
    parsedData,
    isParsed,
    isDefault: false,
  });

  // Auto-set as default if first resume
  const count = await Resume.countDocuments({ userId: req.user._id });
  if (count === 1) {
    resume.isDefault = true;
    await resume.save();
  }

  const response = resume.toObject();
  delete response.fileUrl;
  res.status(201).json({ success: true, resume: response });
};

// ─── GET /api/resumes ─────────────────────────────────────────────
export const getMyResumes = async (req: Request, res: Response) => {
  const resumes = await Resume.find({ userId: req.user._id }).select('-fileUrl').sort('-createdAt');
  res.status(200).json({ success: true, count: resumes.length, resumes });
};

export const downloadResume = async (req: Request, res: Response, next: NextFunction) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id }).select('publicId format deliveryType');
  if (!resume) return next(new AppError('Resume not found.', 404));
  if (resume.deliveryType !== 'authenticated') {
    return next(new AppError('This legacy resume must be uploaded again to enable private access.', 409));
  }
  const url = cloudinary.utils.private_download_url(resume.publicId, resume.format || 'pdf', {
    resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  res.json({ success: true, url, expiresInSeconds: 60 });
};

// ─── DELETE /api/resumes/:id ──────────────────────────────────────
export const deleteResume = async (req: Request, res: Response, next: NextFunction) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return next(new AppError('Resume not found.', 404));

  if (await Interview.exists({ userId: req.user._id, resumeId: resume._id })) {
    return next(new AppError('This resume is used by an interview and cannot be deleted.', 409));
  }

  try {
    const result = await cloudinary.uploader.destroy(resume.publicId, { resource_type: 'raw', type: resume.deliveryType });
    if (!['ok', 'not found'].includes(result.result)) throw new Error('Storage deletion failed');
  } catch {
    return next(new AppError('Could not delete the stored resume. Please retry.', 503));
  }

  await resume.deleteOne();
  res.status(200).json({ success: true, message: 'Resume deleted successfully.' });
};

// ─── PATCH /api/resumes/:id/default ──────────────────────────────
export const setDefaultResume = async (req: Request, res: Response, next: NextFunction) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return next(new AppError('Resume not found.', 404));

  resume.isDefault = true;
  await resume.save(); // pre-save hook clears old defaults

  res.status(200).json({ success: true, message: 'Default resume updated.', resume });
};

// ─── POST /api/resumes/:id/parse ──────────────────────────────────
// Re-parse resume with an optional job description for richer context
export const parseResume = async (req: Request, res: Response, next: NextFunction) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return next(new AppError('Resume not found.', 404));

  if (!resume.extractedText) {
    return next(new AppError('No text extracted from this resume. Upload a valid PDF.', 400));
  }

  const jdText = req.body.jobDescription || '';

  try {
    const parsedData = await parseResumeAndJD(resume.extractedText, jdText);
    resume.parsedData = parsedData;
    resume.isParsed = true;
    await resume.save();

    res.status(200).json({ success: true, parsedData });
  } catch (err) {
    // @ts-expect-error TODO(ts-migration): type this site
    return next(new AppError(`AI parsing failed: ${err.message}`, 500));
  }
};

// ─── POST /api/resumes/chunk-preview ──────────────────────────────
// Debug endpoint: run semantic chunker on raw text, view metadata-tagged output
export const chunkPreview = async (req: Request, res: Response, next: NextFunction) => {
  const { resumeText = '', jobDescription = '' } = req.body;

  if (!resumeText && !jobDescription) {
    return next(new AppError('Provide at least one of resumeText or jobDescription.', 400));
  }

  const chunks = chunkResumeAndJD(resumeText, jobDescription);

  const enriched = chunks.map((chunk, i) => ({
    index:             i,
    content:           chunk.content,
    normalizedContent: normalizeText(chunk.content),
    metadata:          chunk.metadata,
    estimatedTokens:   estimateTokens(chunk.content),
    charCount:         chunk.content.length,
  }));

  const summary = {
    totalChunks:       enriched.length,
    resumeChunks:      enriched.filter((c) => c.metadata.type === 'resume').length,
    jdChunks:          enriched.filter((c) => c.metadata.type === 'job_description').length,
    sectionsFound:     [...new Set(enriched.map((c) => c.metadata.section))],
    avgTokensPerChunk: Math.round(enriched.reduce((s, c) => s + c.estimatedTokens, 0) / (enriched.length || 1)),
    maxTokensInChunk:  Math.max(...enriched.map((c) => c.estimatedTokens)),
  };

  res.status(200).json({ success: true, summary, chunks: enriched });
};

