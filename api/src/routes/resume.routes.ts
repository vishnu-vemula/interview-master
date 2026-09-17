import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import {
  uploadResume,
  getMyResumes,
  deleteResume,
  setDefaultResume,
  parseResume,
  chunkPreview,
} from '../controllers/resume.controller';

router.use(protect);

router.post('/upload', upload.single('resume'), uploadResume);
router.post('/chunk-preview', chunkPreview);      // ← debug: test chunker output
router.get('/', getMyResumes);
router.delete('/:id', deleteResume);
router.patch('/:id/default', setDefaultResume);
router.post('/:id/parse', parseResume);

export default router;