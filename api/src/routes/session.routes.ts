import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware';
import {
  startSession,
  submitAnswer,
  completeSession,
  getMySessions,
  getSessionById,
} from '../controllers/session.controller';

router.use(protect);

router.get('/', getMySessions);
router.post('/start', startSession);
router.get('/:id', getSessionById);
router.post('/:id/answer', submitAnswer);
router.post('/:id/complete', completeSession);

export default router;