/**
 * middleware/validate.js
 *
 * Reusable express-validator result checker.
 * Drop this after any validation chain to auto-reject bad requests:
 *
 *   router.post('/login', [...validationRules], validate, loginController);
 */

import { validationResult } from 'express-validator';
import AppError from '../utils/app-error';
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    return next(new AppError(message, 400));
  }
  next();
};

export default validate;