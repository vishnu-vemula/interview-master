import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import {
  uploadResume,
  getMyResumes,
  deleteResume,
  setDefaultResume,
  parseResume,
  downloadResume,
} from '../controllers/resume.controller';

router.use(protect);

router.post('/upload', upload.single('resume'), uploadResume);
router.get('/', getMyResumes);
router.get('/:id/download', downloadResume);
router.delete('/:id', deleteResume);
router.patch('/:id/default', setDefaultResume);
router.post('/:id/parse', body('jobDescription').optional().isString().isLength({ max: 5000 }), validate, parseResume);

export default router;
