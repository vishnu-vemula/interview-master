import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware';
import {
  getProfile,
  updateProfile,
  changePassword,
  getDashboard,
} from '../controllers/user.controller';

router.use(protect); // all user routes are protected

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.get('/dashboard', getDashboard);

export default router;