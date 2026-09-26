/**
 * NotificationDropdown — recent platform activity from GET /admin/stats
 * (new sign-ups, completed sessions, resume uploads). "Mark all read" stores a
 * last-seen timestamp locally; nothing here is demo data.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, UserPlus, CheckCircle2, FileText } from 'lucide-react';
import { getAdminStats } from '@/services/admin.service';
import { Dropdown } from '@/components/ui';
import { cn, timeAgo } from '@/utils';

const SEEN_KEY = 'admin-notifications-seen-at';
const ICONS = { user: UserPlus, session: CheckCircle2, resume: FileText };
const TONES = { user: 'bg-brand-50 text-brand-600', session: 'bg-lime-soft text-lime-ok', resume: 'bg-stone text-ink' };

export default function NotificationDropdown() {
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(SEEN_KEY) || 0));
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    staleTime: 60_000,
  });

  const items = data?.activities ?? [];
  const unread = useMemo(
    () => items.filter((a) => new Date(a.timestamp).getTime() > seenAt).length,
    [items, seenAt],
  );

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setSeenAt(now);
  };

  return (
    <Dropdown
      panelClassName="w-[min(360px,calc(100vw-24px))]"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          aria-expanded={open}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:border-ink"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-lime px-1 font-mono text-[10px] text-ink ring-2 ring-white">
              {unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between border-b border-line-2 px-4 py-3">
            <span className="mono-label text-muted">Recent activity</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-[12px] text-brand-600 hover:text-ink">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}
              </div>
            ) : isError ? (
              <p className="px-4 py-8 text-center text-[13.5px] text-coral">Couldn’t load activity.</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13.5px] text-muted">No platform activity yet.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {items.map((a) => {
                  const Icon = ICONS[a.type] || Bell;
                  const isNew = new Date(a.timestamp).getTime() > seenAt;
                  return (
                    <li key={a.id} className={cn('flex items-start gap-3 px-4 py-3', isNew && 'bg-paper/70')}>
                      <span className={cn('mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-r9', TONES[a.type] || 'bg-stone')}>
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[13.5px] font-medium">
                          <span className="truncate">{a.title}</span>
                          {isNew && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" aria-label="new" />}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{a.message}</p>
                        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-mono text-faint">{timeAgo(a.timestamp)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-line-2 px-4 py-2.5 text-center">
            <Link to="/admin" onClick={close} className="font-mono text-[10.5px] uppercase tracking-mono text-muted hover:text-ink">
              Open dashboard
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
