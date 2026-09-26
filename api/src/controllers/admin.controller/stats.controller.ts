import type { Request, Response, NextFunction } from 'express';
import User from '../../models/user.model';
import Interview from '../../models/interview.model';
import Session from '../../models/session.model';
import Resume from '../../models/resume.model';
import Job from '../../models/job.model';
import PaymentOrder from '../../models/payment-order.model';
import Subscription from '../../models/subscription.model';
import AuditLog from '../../models/audit-log.model';
import AppError from '../../utils/app-error';
export const ADMIN_ROLES = ['admin', 'super_admin'];


// ─── GET /api/admin/stats ──────────────────────────────────────────
export const getStats = async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    premiumUsers,
    totalInterviews,
    totalSessions,
    totalResumes,
    activeUsers,
    completedSessions,
    interviewsToday,
    jobsCount,
  ] = await Promise.all([
    User.countDocuments({ role: 'candidate' }),
    Subscription.distinct('userId', { status: 'active', currentPeriodEnd: { $gt: new Date() } }).then(ids => ids.length),
    Interview.countDocuments(),
    Session.countDocuments(),
    Resume.countDocuments(),
    User.countDocuments({ isActive: true, role: 'candidate' }),
    Session.countDocuments({ status: 'completed' }),
    Interview.countDocuments({ createdAt: { $gte: today } }),
    Job.countDocuments({ isArchived: false }),
  ]);

  const freeUsers = Math.max(0, totalUsers - premiumUsers);
  const applicationsCount = totalResumes + totalSessions;

  // Real aggregate platform revenue
  const revAgg = await PaymentOrder.aggregate([
    { $match: { status: { $in: ['success', 'refund_pending'] } } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } }
  ]);
  const totalRevenue = (revAgg[0]?.total || 0) / 100;

  // Recent registrations (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo }, role: 'candidate' });

  // Average session score
  const scoreAgg = await Session.aggregate([
    { $match: { status: 'completed', overallScore: { $ne: null } } },
    { $group: { _id: null, avgScore: { $avg: '$overallScore' } } },
  ]);

  // Fetch recent data to build system activity feed
  const [recentRegs, recentSess, recentRes] = await Promise.all([
    User.find({ role: 'candidate' }).sort('-createdAt').limit(5),
    Session.find().sort('-createdAt').limit(5).populate({ path: 'userId', select: 'name email' }).populate({ path: 'interviewId', select: 'jobTitle' }),
    Resume.find().sort('-createdAt').limit(5).populate({ path: 'userId', select: 'name email' }),
  ]);

  let activities = [];
  recentRegs.forEach(u => {
    activities.push({
      id: `user-${u._id}`,
      type: 'user',
      title: 'New Candidate Registered',
      message: `${u.name} (${u.email}) joined the platform`,
      timestamp: u.createdAt,
    });
  });
  recentSess.forEach(s => {
    if (s.userId) {
      activities.push({
        id: `session-${s._id}`,
        type: 'session',
        title: 'Interview Completed',
    // @ts-expect-error TODO(ts-migration): type this site
        message: `${s.userId.name} completed mock interview for ${s.interviewId?.jobTitle || 'Developer'}`,
        timestamp: s.createdAt,
        score: s.overallScore,
      });
    }
  });
  recentRes.forEach(r => {
    if (r.userId) {
      activities.push({
        id: `resume-${r._id}`,
        type: 'resume',
        title: 'Resume Uploaded',
    // @ts-expect-error TODO(ts-migration): type this site
        message: `${r.userId.name} uploaded a new resume file`,
        timestamp: r.createdAt,
      });
    }
  });

  // Sort unified activities in descending order
    // @ts-expect-error TODO(ts-migration): type this site
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  activities = activities.slice(0, 8);

  // Generate charts datasets (User Growth, Revenue, Interviews, Daily Activity)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [usersTrend, revTrend, intTrend] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, role: 'candidate' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      }
    ]),
    PaymentOrder.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ['success', 'refund_pending'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: { $divide: ['$amountMinor', 100] } }
        }
      }
    ]),
    Session.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const userGrowthMap = {};
  usersTrend.forEach(u => { userGrowthMap[u._id] = u.count; });
  
  const revMap = {};
  revTrend.forEach(r => { revMap[r._id] = r.total; });

  const intMap = {};
  intTrend.forEach(i => { intMap[i._id] = i.count; });

  const monthData = [];
  let cumulativeUsers = await User.countDocuments({ createdAt: { $lt: sixMonthsAgo }, role: 'candidate' });

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = monthNames[d.getMonth()];
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyRegs = userGrowthMap[key] || 0;
    cumulativeUsers += monthlyRegs;

    monthData.push({
      monthName,
      users: cumulativeUsers,
      revenue: revMap[key] || 0,
      interviews: intMap[key] || 0
    });
  }

  const charts = {
    userGrowth: monthData.map(m => ({ month: m.monthName, users: m.users })),
    revenue: monthData.map(m => ({ month: m.monthName, amount: m.revenue })),
    interviews: monthData.map(m => ({ month: m.monthName, count: m.interviews })),
    dailyActivity: [],
  };

  // Daily activity distribution (days of current week Mon-Sun)
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const startOfWeek = new Date();
  const dayOfWeek = startOfWeek.getDay();
  const diffOffset = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diffOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const [weekSessions, weekUsers] = await Promise.all([
    Session.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 }
        }
      }
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: startOfWeek }, role: 'candidate' } },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const sessionDaysMap = {};
  weekSessions.forEach(s => { sessionDaysMap[s._id] = s.count; });
  
  const userDaysMap = {};
  weekUsers.forEach(u => { userDaysMap[u._id] = u.count; });

  const mongoDayMapping = [2, 3, 4, 5, 6, 7, 1]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  charts.dailyActivity = daysOfWeek.map((day, idx) => {
    const mongoDay = mongoDayMapping[idx];
    return {
      day,
      sessions: sessionDaysMap[mongoDay] || 0,
      users: userDaysMap[mongoDay] || 0,
    };
  });

  // System warning / error logs from database
  const failures = await AuditLog.find({ status: { $in: ['failed', 'warning'] } })
    .sort('-createdAt')
    .limit(5);

  const recentErrors = failures.map(f => ({
    id: f._id,
    service: f.category.toUpperCase() + ' - ' + f.action,
    message: f.details,
    timestamp: f.createdAt,
    severity: f.status,
  }));

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      premiumUsers,
      freeUsers,
      interviewsToday,
      totalInterviews,
      jobsCount,
      applicationsCount,
      totalRevenue,
      activeUsers,
      newUsersThisWeek: newUsers,
      platformAvgScore: scoreAgg[0]?.avgScore?.toFixed(1) ?? 0,
      activities,
      charts,
      recentErrors,
    },
  });
};

