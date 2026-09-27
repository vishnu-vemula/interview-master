/**
 * App.jsx — Route definitions only
 *
 * Auth state comes from Zustand (authStore) via useAuth().
 *
 * Route categories:
 *  - Public      → accessible to everyone
 *  - GuestOnly   → redirect to /dashboard if already logged in
 *  - Protected   → redirect to /login?next=… if not authenticated
 *  - AdminOnly   → admin session (AdminAuthContext) + per-page permissions
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { useAdminAuth } from '@/context';

import RouteErrorBoundary, { CrashTest } from '@/components/common/route-error-boundary';
import SuspenseLoader from '@/components/admin/suspense-loader';
import PublicLayout from '@/components/navigation/public-chrome';

// ─── Layouts ─────────────────────────────────────────────────────
import AuthLayout      from '@/layouts/auth-layout';
import DashboardLayout from '@/layouts/dashboard-layout';
import AdminLayout     from '@/layouts/admin-layout';

// ─── Pages ───────────────────────────────────────────────────────
import LandingPage          from '@/pages/landing-page';
import LoginPage            from '@/pages/auth/login-page';
import RegisterPage         from '@/pages/auth/register-page';
import ForgotPasswordPage   from '@/pages/auth/forgot-password-page';
import ResetPasswordPage    from '@/pages/auth/reset-password-page';
import DashboardPage        from '@/pages/dashboard/dashboard-page';
import NewInterviewPage     from '@/pages/interview/new-interview-page';
import InterviewListPage    from '@/pages/interview/interview-list-page';
import InterviewSessionPage from '@/pages/interview/interview-session-page';
import SessionResultPage    from '@/pages/interview/session-result-page';
import SessionHistoryPage   from '@/pages/session/session-history-page';
import ResumesPage          from '@/pages/resume/resumes-page';
import ProfilePage          from '@/pages/profile/profile-page';
import PricingPage          from '@/pages/billing/pricing-page';
import BillingResultPage    from '@/pages/billing/result-page';
import Jobs                 from '@/pages/jobs';
import RecommendedJobs      from '@/pages/recommended-jobs';
import NotFoundPage         from '@/pages/not-found-page';

// ─── Admin Pages (code-split) ─────────────────────────────────────
const AdminLoginPage        = lazy(() => import('@/pages/admin/admin-login-page'));
const AdminDashboardPage    = lazy(() => import('@/pages/admin/admin-dashboard-page'));
const AdminUsersPage        = lazy(() => import('@/pages/admin/admin-users-page'));
const AdminInterviewsPage   = lazy(() => import('@/pages/admin/admin-interviews-page'));
const AdminSessionsPage     = lazy(() => import('@/pages/admin/admin-sessions-page'));
const AdminResumesPage      = lazy(() => import('@/pages/admin/admin-resumes-page'));
const AdminJobsPage         = lazy(() => import('@/pages/admin/admin-jobs-page'));
const AdminAtsPage          = lazy(() => import('@/pages/admin/admin-ats-page'));
const AdminSubscriptionPage = lazy(() => import('@/pages/admin/admin-subscription-page'));
const AdminPaymentsPage     = lazy(() => import('@/pages/admin/admin-payments-page'));
const AdminAnalyticsPage    = lazy(() => import('@/pages/admin/admin-analytics-page'));
const AdminSettingsPage     = lazy(() => import('@/pages/admin/admin-settings-page'));
const AdminScraperPage      = lazy(() => import('@/pages/admin/admin-scraper-page'));
const AdminPromptsPage      = lazy(() => import('@/pages/admin/admin-prompts-page'));
const AdminLogsPage         = lazy(() => import('@/pages/admin/admin-logs-page'));

// ─── Route Guards ─────────────────────────────────────────────────

/** Requires a signed-in candidate; remembers where they were going. */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <SuspenseLoader fullScreen />;
  if (isAuthenticated) return children;
  const next = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?next=${next}`} replace />;
};

/** Only for signed-out visitors. */
const GuestRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SuspenseLoader fullScreen />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

/** /pricing renders inside the app shell when signed in, marketing chrome otherwise. */
const AdaptiveRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated
    ? <DashboardLayout>{children}</DashboardLayout>
    : <PublicLayout><RouteErrorBoundary>{children}</RouteErrorBoundary></PublicLayout>;
};

const AdminRoute = ({ children }) => {
  const { isAdminAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <SuspenseLoader fullScreen />;
  if (!isAdminAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
};

const AdminPermissionRoute = ({ permission, children }) => {
  const { hasPermission, isLoading } = useAdminAuth();
  if (isLoading) return null;
  if (!hasPermission(permission)) return <Navigate to="/admin" replace />;
  return children;
};

const AdminGuestRoute = ({ children }) => {
  const { isAdminAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <SuspenseLoader fullScreen />;
  if (isAdminAuthenticated) return <Navigate to="/admin" replace />;
  return children;
};

const withPermission = (permission, element) => (
  <AdminPermissionRoute permission={permission}>{element}</AdminPermissionRoute>
);

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* ── Public ──────────────────────────────── */}
      <Route path="/" element={<RouteErrorBoundary><LandingPage /></RouteErrorBoundary>} />
      <Route path="/pricing" element={<AdaptiveRoute><PricingPage /></AdaptiveRoute>} />

      {/* ── Guest-only (auth) ────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
      </Route>

      {/* ── Admin login ───────────────────────────── */}
      <Route
        path="/admin/login"
        element={
          <RouteErrorBoundary home="/admin/login" homeLabel="Admin login">
            <Suspense fallback={<SuspenseLoader fullScreen />}>
              <AdminGuestRoute>
                <AdminLoginPage />
              </AdminGuestRoute>
            </Suspense>
          </RouteErrorBoundary>
        }
      />

      {/* ── Admin protected routes ────────────────── */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin"              element={<AdminDashboardPage />} />
        <Route path="/admin/users"        element={<AdminUsersPage />} />
        <Route path="/admin/jobs"         element={<AdminJobsPage />} />
        <Route path="/admin/interviews"   element={<AdminInterviewsPage />} />
        <Route path="/admin/resumes"      element={<AdminResumesPage />} />
        <Route path="/admin/sessions"     element={<AdminSessionsPage />} />
        <Route path="/admin/ats"          element={<AdminAtsPage />} />
        <Route path="/admin/subscription" element={withPermission('view:settings', <AdminSubscriptionPage />)} />
        <Route path="/admin/payments"     element={withPermission('view:payments', <AdminPaymentsPage />)} />
        <Route path="/admin/analytics"    element={withPermission('view:analytics', <AdminAnalyticsPage />)} />
        <Route path="/admin/settings"     element={withPermission('view:settings', <AdminSettingsPage />)} />
        <Route path="/admin/scraper"      element={withPermission('view:scraper', <AdminScraperPage />)} />
        <Route path="/admin/prompts"      element={withPermission('view:prompts', <AdminPromptsPage />)} />
        <Route path="/admin/logs"         element={withPermission('view:logs', <AdminLogsPage />)} />
        <Route path="/admin/*"            element={<NotFoundInAdmin />} />
      </Route>

      {/* ── Protected (candidate app) ─────────────── */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard"              element={<DashboardPage />} />
        <Route path="/interviews"             element={<InterviewListPage />} />
        <Route path="/interviews/new"         element={<NewInterviewPage />} />
        <Route path="/interviews/:id/session" element={<InterviewSessionPage />} />
        <Route path="/sessions/:id/results"   element={<SessionResultPage />} />
        <Route path="/sessions"               element={<SessionHistoryPage />} />
        <Route path="/resumes"                element={<ResumesPage />} />
        <Route path="/jobs"                   element={<Jobs />} />
        <Route path="/jobs/recommended"       element={<RecommendedJobs />} />
        <Route path="/profile"                element={<ProfilePage />} />
        <Route path="/billing/result"         element={<BillingResultPage />} />
      </Route>

      {/* Dev-only route to verify the error boundary renders in the design system. */}
      {import.meta.env.DEV && (
        <Route path="/__crash" element={<RouteErrorBoundary><CrashTest /></RouteErrorBoundary>} />
      )}

      {/* ── 404 ──────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function NotFoundInAdmin() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="mono-label text-muted">Error 404</p>
      <h1 className="mt-3 text-[40px] font-medium tracking-tight2">No admin page here.</h1>
      <p className="mt-2 text-[15px] text-muted">
        <span className="font-mono text-[13px]">{pathname}</span> doesn’t exist.
      </p>
      <a href="/admin" className="btn btn-ink mt-6">Admin dashboard</a>
    </div>
  );
}
