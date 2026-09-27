import express from 'express';
import { body } from 'express-validator';
const router = express.Router();

import {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  firebaseSession,
  firebaseDeleteAccount,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import {
  authProviders,
  forgotPassword,
  resetPassword,
  oauthStart,
  oauthCallback,
  oauthExchange,
} from '../controllers/account-recovery.controller';

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);
router.post('/firebase/session', firebaseSession);

// Account recovery + social sign-in (JWT mode; Firebase mode handles these itself)
router.get('/providers', authProviders);
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
], forgotPassword);
router.post('/reset-password', [
  body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Reset link is invalid'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
], resetPassword);
router.get('/oauth/:provider/start', oauthStart);
router.get('/oauth/:provider/callback', oauthCallback);
router.post('/oauth/exchange', oauthExchange);
router.delete('/firebase/account', firebaseDeleteAccount);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;
