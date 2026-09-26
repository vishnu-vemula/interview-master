import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import {
  startSession,
  submitAnswer,
  completeSession,
  getMySessions,
  getSessionById,
} from '../controllers/session.controller';

router.use(protect);

router.get('/', getMySessions);
router.post('/start', body('interviewId').isMongoId(), validate, startSession);
router.get('/:id', getSessionById);
router.post('/:id/answer', [
  body('questionId').isMongoId(),
  body('answerText').optional().isString().isLength({ max: 4000 }),
  body('timeTaken').optional().isInt({ min: 0, max: 86400 }),
  body('skipped').optional().isBoolean(),
], validate, submitAnswer);
router.post('/:id/complete', completeSession);

export default router;
