import type { Request, Response, NextFunction } from 'express';
import User from '../../models/user.model';
import Interview from '../../models/interview.model';
import Session from '../../models/session.model';
import Resume from '../../models/resume.model';
import Job from '../../models/job.model';
import AppError from '../../utils/app-error';
import { retireCandidateAccount } from '../../services/account-deletion.service';
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


// ─── GET /api/admin/users ──────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response) => {
  const page    = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
  const skip    = (page - 1) * limit;
  const search  = String(req.query.search || '').slice(0, 100);
  const role    = req.query.role;
  const status  = req.query.status;
  const sortBy  = req.query.sortBy  || 'createdAt';
  const sortDir = req.query.sortDir || 'desc';

  const filter: any = {};
  if (search) {
    filter.$or = [
      { name:  { $regex: escapeRegex(search), $options: 'i' } },
      { email: { $regex: escapeRegex(search), $options: 'i' } },
    ];
  }
  if (role && role !== 'all') {
    filter.role = role;
  }
  
  if (status && status !== 'all') {
    if (status === 'active') {
      filter.isActive = true;
      filter.isBanned = false;
    } else if (status === 'inactive') {
      filter.isActive = false;
      filter.isBanned = false;
    } else if (status === 'banned') {
      filter.isBanned = true;
    } else if (status === 'premium') {
      filter.isPremium = true;
    }
  }

  // Build dynamic sort query
  const sortQuery: any = {};
  sortQuery[['createdAt', 'name', 'email', 'lastLogin'].includes(String(sortBy)) ? String(sortBy) : 'createdAt'] = sortDir === 'asc' ? 1 : -1;

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
  const { name, role, isActive, isBanned } = req.body;

  // Prevent removing admin role from the super admin
  const target = await User.findById(req.params.id);
  if (!target) return next(new AppError('User not found.', 404));
  if (role !== undefined && (!['candidate', 'support', 'content_manager', 'admin', 'super_admin'].includes(role) || req.admin?.role !== 'super_admin')) {
    return next(new AppError('Only a super admin may assign roles.', 403));
  }
  if (target.role === 'super_admin' && req.admin?.role !== 'super_admin') {
    return next(new AppError('Super admin account is protected.', 403));
  }
  if (target.role !== 'candidate' && req.admin?.role !== 'super_admin') {
    return next(new AppError('Staff accounts can only be managed by a super admin.', 403));
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
  if (userIds.length > 100 || userIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
    return next(new AppError('Provide at most 100 valid user IDs.', 400));
  }

  if (!['activate', 'deactivate', 'ban', 'unban', 'delete'].includes(action)) {
    return next(new AppError('Invalid bulk action.', 400));
  }
  if (action === 'delete' && req.admin?.role !== 'super_admin') {
    return next(new AppError('Bulk deletion requires a super admin.', 403));
  }

  // Prevent modifying the super admin in bulk actions
  const safeUserIds = [];
  const usersToInspect = await User.find({ _id: { $in: userIds } });
  
  usersToInspect.forEach(u => {
    if (u.role === 'candidate' && String(u._id) !== String(req.admin?._id)) {
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
    for (const id of safeUserIds) await retireCandidateAccount(String(id));
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
  if (user.role === 'super_admin') {
    return next(new AppError('Cannot delete the super admin account.', 403));
  }

  await retireCandidateAccount(String(user._id));

  res.status(200).json({ success: true, message: 'Candidate data removed and account retired; anonymized financial records retained.' });
};

