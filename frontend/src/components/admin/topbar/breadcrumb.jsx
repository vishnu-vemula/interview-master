/**
 * Breadcrumb — derived from the current /admin path.
 */

import { Link, useLocation } from 'react-router-dom';

const SEGMENT_LABELS = {
  admin: 'Admin',
  users: 'Users',
  jobs: 'Jobs',
  interviews: 'Interviews',
  sessions: 'Sessions',
  resumes: 'Resumes',
  ats: 'ATS pipeline',
  subscription: 'Plans',
  payments: 'Payments',
  analytics: 'Analytics',
  settings: 'Settings',
  scraper: 'Job scraper',
  prompts: 'Prompt editor',
  logs: 'Audit logs',
};

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));
  if (crumbs.length === 1) crumbs.push({ label: 'Dashboard', path: '/admin' });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-mono">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.path + i} className="flex min-w-0 items-center gap-2">
              {i > 0 && <span className="text-faint-3" aria-hidden="true">/</span>}
              {last ? (
                <span className="truncate text-ink" aria-current="page">{c.label}</span>
              ) : (
                <Link to={c.path} className="text-muted hover:text-ink">{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
