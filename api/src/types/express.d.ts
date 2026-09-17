/**
 * Global Express type augmentations.
 *
 * Extends the stock Express typings with the custom fields this
 * application attaches at runtime, so every controller and middleware
 * gets full type-safety on `req.user` and the response helpers
 * installed by `utils/responseFormatter.attach`.
 */
import type { Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import type UserDocument from '../models/user.model';

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by candidate auth middleware after JWT verification */
    user?: AuthUser;
    /** Populated by admin auth middleware after admin JWT verification */
    admin?: AuthUser;
  }

  interface Response {
    /** Custom job-API senders installed by responseFormatter.attach middleware */
    sendSearch?: (opts: unknown) => Response;
    sendJobDetail?: (job: unknown) => Response;
    sendCategories?: (cats: unknown[]) => Response;
    sendError?: (err: unknown, status?: number) => Response;
  }
}
