/**
 * Admin error boundary — the shared design-system boundary pointed at the admin home.
 */

import RouteErrorBoundary from '@/components/common/route-error-boundary';

export default function ErrorBoundary({ children }) {
  return (
    <RouteErrorBoundary home="/admin" homeLabel="Admin dashboard">
      {children}
    </RouteErrorBoundary>
  );
}
