/**
 * middleware/index.js — Barrel file
 *
 * Centralises all middleware exports so routes can import cleanly:
 *   import { protect, restrictTo } from '../middleware';
 */

import { protect, restrictTo } from './auth.middleware';
import errorHandler from './error-handler';
import upload from './upload.middleware';
export {
  protect,
  restrictTo,
  errorHandler,
  upload,
};
