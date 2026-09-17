import type { Request, Response, NextFunction } from 'express';
import User from '../../models/user.model';
import Interview from '../../models/interview.model';
import Session from '../../models/session.model';
import Resume from '../../models/resume.model';
import Job from '../../models/job.model';
import Transaction from '../../models/transaction.model';
import AuditLog from '../../models/audit-log.model';
import AppError from '../../utils/app-error';
const ADMIN_EMAIL = 'admin@interviewmaster.com';
const ADMIN_ROLES = ['admin', 'super_admin'];


// ─── GET /api/admin/users ──────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response) => {
  const page    = parseInt(String(req.query.page))  || 1;
  const limit   = parseInt(String(req.query.limit)) || 20;
  const skip    = (page - 1) * limit;
  const search  = req.query.search || '';
  const role    = req.query.role;
  const status  = req.query.status;
  const sortBy  = req.query.sortBy  || 'createdAt';
  const sortDir = req.query.sortDir || 'desc';

  const filter = {};
  if (search) {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role && role !== 'all') {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.role = role;
  }
  
  if (status && status !== 'all') {
    if (status === 'active') {
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isActive = true;
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isBanned = false;
    } else if (status === 'inactive') {
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isActive = false;
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isBanned = false;
    } else if (status === 'banned') {
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isBanned = true;
    } else if (status === 'premium') {
    // @ts-expect-error TODO(ts-migration): type this site
      filter.isPremium = true;
    }
  }

  // Build dynamic sort query
  const sortQuery = {};
  sortQuery[String(sortBy)] = sortDir === 'asc' ? 1 : -1;

  const [users, total] = await Promise.all([
    User.find(filter).sort(sortQuery).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { users, total, page, pages: Math.ceil(total / limit) },
  });
};

// ─── GET /api/admin/users/:id ──────────────────────────────────────
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id)
    .populate('resumes')
    .populate({
      path: 'sessions',
      options: { sort: { createdAt: -1 } },
      populate: { path: 'interviewId', select: 'jobTitle company' }
    });
  if (!user) return next(new AppError('User not found.', 404));

  const [interviewCount, sessionCount, resumeCount] = await Promise.all([
    Interview.countDocuments({ userId: user._id }),
    Session.countDocuments({ userId: user._id }),
    Resume.countDocuments({ userId: user._id }),
  ]);

  res.status(200).json({
    success: true,
    data: { user, interviewCount, sessionCount, resumeCount },
  });
};

// ─── PATCH /api/admin/users/:id ────────────────────────────────────
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  const { name, role, isActive, isBanned, isPremium, credits, creditsChange } = req.body;

  // Prevent removing admin role from the super admin
  const target = await User.findById(req.params.id);
  if (!target) return next(new AppError('User not found.', 404));
  // Prevent modifying the super admin's own role
  if (target.email === ADMIN_EMAIL && role && role !== 'super_admin') {
    return next(new AppError('Cannot change the role of the super admin.', 403));
  }

  const allowedFields = {};
    // @ts-expect-error TODO(ts-migration): type this site
  if (name !== undefined) allowedFields.name = name;
    // @ts-expect-error TODO(ts-migration): type this site
  if (role !== undefined) allowedFields.role = role;
    // @ts-expect-error TODO(ts-migration): type this site
  if (isActive !== undefined) allowedFields.isActive = isActive;
    // @ts-expect-error TODO(ts-migration): type this site
  if (isBanned !== undefined) allowedFields.isBanned = isBanned;
    // @ts-expect-error TODO(ts-migration): type this site
  if (isPremium !== undefined) allowedFields.isPremium = isPremium;
    // @ts-expect-error TODO(ts-migration): type this site
  if (credits !== undefined) allowedFields.credits = credits;

  if (creditsChange !== undefined) {
    // @ts-expect-error TODO(ts-migration): type this site
    allowedFields.$inc = { credits: creditsChange };
  }

  const user = await User.findByIdAndUpdate(req.params.id, allowedFields, {
    new: true, runValidators: true,
  });

  res.status(200).json({ success: true, user });
};

// ─── POST /api/admin/users/bulk ────────────────────────────────────
export const bulkUserAction = async (req: Request, res: Response, next: NextFunction) => {
  const { userIds, action } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return next(new AppError('No user IDs provided.', 400));
  }

  if (!['activate', 'deactivate', 'ban', 'unban', 'delete'].includes(action)) {
    return next(new AppError('Invalid bulk action.', 400));
  }

  // Prevent modifying the super admin in bulk actions
  const safeUserIds = [];
  const usersToInspect = await User.find({ _id: { $in: userIds } });
  
  usersToInspect.forEach(u => {
    if (u.email !== ADMIN_EMAIL) {
      safeUserIds.push(u._id);
    }
  });

  if (safeUserIds.length === 0) {
    return next(new AppError('No modifications allowed on the protected super admin account.', 403));
  }

  if (action === 'activate') {
    await User.updateMany({ _id: { $in: safeUserIds } }, { isActive: true });
  } else if (action === 'deactivate') {
    await User.updateMany({ _id: { $in: safeUserIds } }, { isActive: false });
  } else if (action === 'ban') {
    await User.updateMany({ _id: { $in: safeUserIds } }, { isBanned: true });
  } else if (action === 'unban') {
    await User.updateMany({ _id: { $in: safeUserIds } }, { isBanned: false });
  } else if (action === 'delete') {
    // Cascade delete user data for all targeted users
    await Promise.all([
      Interview.deleteMany({ userId: { $in: safeUserIds } }),
      Session.deleteMany({ userId: { $in: safeUserIds } }),
      Resume.deleteMany({ userId: { $in: safeUserIds } }),
      User.deleteMany({ _id: { $in: safeUserIds } }),
    ]);
  }

  res.status(200).json({
    success: true,
    message: `Bulk ${action} operation completed successfully on ${safeUserIds.length} users.`,
  });
};

// ─── DELETE /api/admin/users/:id ───────────────────────────────────
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));
  if (user.email === ADMIN_EMAIL) {
    return next(new AppError('Cannot delete the super admin account.', 403));
  }

  // Cascade delete all user data
  await Promise.all([
    Interview.deleteMany({ userId: user._id }),
    Session.deleteMany({ userId: user._id }),
    Resume.deleteMany({ userId: user._id }),
    user.deleteOne(),
  ]);

  res.status(200).json({ success: true, message: 'User and all associated data deleted.' });
};

