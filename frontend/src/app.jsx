/**
 * App.jsx — Route definitions only
 *
 * No UI, no components — just routing structure.
 * Auth state comes from Zustand (authStore) via useAuth().
 *
 * Route categories:
 *  - Public      → accessible to everyone
 *  - GuestOnly   → redirect to /dashboard if already logged in
 *  - Protected   → redirect to /login if not authenticated
 *  - AdminOnly   → redirect to /dashboard if not admin
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { useAdminAuth } from '@/context';

import ErrorBoundary from '@/components/admin/error-boundary';
import SuspenseLoader from '@/components/admin/suspense-loader';

// ─── Layouts ─────────────────────────────────────────────────────
import AuthLayout      from '@/layouts/auth-layout';
import DashboardLayout from '@/layouts/dashboard-layout';
import AdminLayout     from '@/layouts/admin-layout';

// ─── Pages ───────────────────────────────────────────────────────
import LandingPage          from '@/pages/landing-page';
import LoginPage            from '@/pages/auth/login-page';
import RegisterPage         from '@/pages/auth/register-page';
import DashboardPage        from '@/pages/dashboard/dashboard-page';
import NewInterviewPage     from '@/pages/interview/new-interview-page';
import InterviewListPage    from '@/pages/interview/interview-list-page';
import InterviewSessionPage from '@/pages/interview/interview-session-page';
import SessionResultPage    from '@/pages/interview/session-result-page';
import SessionHistoryPage   from '@/pages/session/session-history-page';
import ResumesPage          from '@/pages/resume/resumes-page';
import ProfilePage          from '@/pages/profile/profile-page';
import Jobs                 from '@/pages/jobs';

// ─── Admin Pages ──────────────────────────────────────────────────
const AdminLoginPage       = lazy(() => import('@/pages/admin/admin-login-page'));
const AdminDashboardPage   = lazy(() => import('@/pages/admin/admin-dashboard-page'));
const AdminUsersPage       = lazy(() => import('@/pages/admin/admin-users-page'));
const AdminInterviewsPage  = lazy(() => import('@/pages/admin/admin-interviews-page'));
const AdminSessionsPage    = lazy(() => import('@/pages/admin/admin-sessions-page'));
const AdminResumesPage     = lazy(() => import('@/pages/admin/admin-resumes-page'));
const AdminJobsPage        = lazy(() => import('@/pages/admin/admin-jobs-page'));
const AdminAtsPage         = lazy(() => import('@/pages/admin/admin-ats-page'));
const AdminSubscriptionPage = lazy(() => import('@/pages/admin/admin-subscription-page'));
const AdminPaymentsPage    = lazy(() => import('@/pages/admin/admin-payments-page'));
const AdminAnalyticsPage   = lazy(() => import('@/pages/admin/admin-analytics-page'));
const AdminSettingsPage    = lazy(() => import('@/pages/admin/admin-settings-page'));
const AdminScraperPage     = lazy(() => import('@/pages/admin/admin-scraper-page'));
const AdminPromptsPage     = lazy(() => import('@/pages/admin/admin-prompts-page'));
const AdminLogsPage        = lazy(() => import('@/pages/admin/admin-logs-page'));
import RecommendedJobs     from '@/pages/recommended-jobs';

// ─── Route Guards ─────────────────────────────────────────────────

/**
 * ProtectedRoute — Requires authentication.
 * Redirects to /login if user is not authenticated.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * GuestRoute — Only for non-authenticated users.
 * Redirects to /dashboard if already logged in as a user.
 */
const GuestRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return children;
  return <Navigate to="/dashboard" replace />;
};

/**
 * AdminRoute — Only for authenticated admins (via AdminAuthContext).
 * Redirects to /admin/login if not authenticated.
 * Redirects to /dashboard if authenticated but not admin.
 */
const AdminRoute = ({ children }) => {
  const { isAdminAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return null; // wait for session restore
  if (!isAdminAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
};

const AdminPermissionRoute = ({ permission, children }) => {
  const { hasPermission, isLoading } = useAdminAuth();
  if (isLoading) return null;
  if (!hasPermission(permission)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

/**
 * AdminGuestRoute — /admin/login page.
 * If already authenticated as admin, redirect to /admin.
 */
const AdminGuestRoute = ({ children }) => {
  const { isAdminAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return null;
  if (isAdminAuthenticated) return <Navigate to="/admin" replace />;
  return children;
};

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* ── Public ──────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Guest-only (auth) ────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={<GuestRoute><LoginPage /></GuestRoute>}
        />
        <Route
          path="/register"
          element={<GuestRoute><RegisterPage /></GuestRoute>}
        />
      </Route>

      {/* ── Admin Login (guest-only for admins) ──── */}
      <Route
        path="/admin/login"
        element={
          <ErrorBoundary>
            <Suspense fallback={<SuspenseLoader />}>
              <AdminGuestRoute>
                <AdminLoginPage />
              </AdminGuestRoute>
            </Suspense>
          </ErrorBoundary>
        }
      />

      {/* ── Admin protected routes ────────────────── */}
      <Route
        element={
          <AdminRoute>
            <ErrorBoundary>
              <Suspense fallback={<SuspenseLoader />}>
                <AdminLayout />
              </Suspense>
            </ErrorBoundary>
          </AdminRoute>
        }
      >
        <Route path="/admin"             element={<AdminDashboardPage />} />
        <Route path="/admin/users"       element={<AdminUsersPage />} />
        <Route path="/admin/jobs"        element={<AdminJobsPage />} />
        <Route path="/admin/interviews"  element={<AdminInterviewsPage />} />
        <Route path="/admin/resumes"     element={<AdminResumesPage />} />
        <Route path="/admin/sessions"    element={<AdminSessionsPage />} />
        <Route path="/admin/ats"         element={<AdminAtsPage />} />
        <Route path="/admin/subscription" element={<AdminPermissionRoute permission="view:settings"><AdminSubscriptionPage /></AdminPermissionRoute>} />
        <Route path="/admin/payments"     element={<AdminPermissionRoute permission="view:payments"><AdminPaymentsPage /></AdminPermissionRoute>} />
        <Route path="/admin/analytics"    element={<AdminPermissionRoute permission="view:analytics"><AdminAnalyticsPage /></AdminPermissionRoute>} />
        <Route path="/admin/settings"     element={<AdminPermissionRoute permission="view:settings"><AdminSettingsPage /></AdminPermissionRoute>} />
        <Route path="/admin/scraper"      element={<AdminPermissionRoute permission="view:scraper"><AdminScraperPage /></AdminPermissionRoute>} />
        <Route path="/admin/prompts"      element={<AdminPermissionRoute permission="view:prompts"><AdminPromptsPage /></AdminPermissionRoute>} />
        <Route path="/admin/logs"         element={<AdminPermissionRoute permission="view:logs"><AdminLogsPage /></AdminPermissionRoute>} />
      </Route>

      {/* ── Protected (dashboard) ────────────────── */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard"                    element={<DashboardPage />} />
        <Route path="/interviews"                   element={<InterviewListPage />} />
        <Route path="/interviews/new"               element={<NewInterviewPage />} />
        <Route path="/interviews/:id/session"       element={<InterviewSessionPage />} />
        <Route path="/sessions/:id/results"         element={<SessionResultPage />} />
        <Route path="/sessions"                     element={<SessionHistoryPage />} />
        <Route path="/resumes"                      element={<ResumesPage />} />
        <Route path="/jobs"                         element={<Jobs />} />
        <Route path="/jobs/recommended"             element={<RecommendedJobs />} />
        <Route path="/profile"                      element={<ProfilePage />} />
      </Route>

      {/* ── 404 fallback ─────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

