import express from 'express';
import { body } from 'express-validator';
const router = express.Router();
import { protectPostgres } from '../middleware/postgres-auth.middleware';
import {
  getProfile,
  updateProfile,
  changePassword,
  getDashboard,
  deleteMyAccount,
} from '../controllers/postgres-user.controller';

router.use(protectPostgres);

router.get('/profile', getProfile);
router.put('/profile', [
  body('name').optional().isString().trim().isLength({ min: 2, max: 50 }),
  body('avatar').optional({ nullable: true }).isURL({ protocols: ['https'], require_protocol: true }).isLength({ max: 2048 }),
], updateProfile);
router.put('/change-password', [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], changePassword);
router.get('/dashboard', getDashboard);
router.delete('/account', [body('currentPassword').isString().notEmpty()], deleteMyAccount);

export default router;
