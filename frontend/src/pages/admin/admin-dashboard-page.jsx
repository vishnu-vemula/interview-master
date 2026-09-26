/**
 * AdminDashboardPage — platform overview: headline metrics, growth/revenue/interview
 * trends, weekly engagement, recent activity and recent failures (GET /admin/stats).
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Star, UserCheck, Wallet, Activity, MessageSquare, Briefcase, FileText,
  RefreshCw, UserPlus, CheckCircle2, AlertTriangle, ArrowUpRight, Terminal, Settings,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { getAdminStats } from '@/services/admin.service';
import {
  Button, Card, CHART, ChartTooltip, EmptyState, ErrorState, PageHeader, Pill, Skeleton,
} from '@/components/ui';
import { cn, formatINR, getErrorMessage, timeAgo } from '@/utils';

function Metric({ icon: Icon, label, value, sub, to, tone = 'white', loading }) {
  const tones = {
    white: 'card text-ink',
    ink: 'card-ink',
    lime: 'card-lime',
    blue: 'rounded-r24 bg-brand text-white',
  };
  const subTone = { ink: 'text-on-dark', lime: 'text-lime-ink', blue: 'text-brand-50' }[tone] || 'text-muted';
  return (
    <Link to={to} className={cn(tones[tone], 'group flex min-h-[148px] flex-col p-5 transition-transform hover:-translate-y-0.5 hover:text-inherit')}>
      <div className="flex items-start justify-between">
        <span className={cn('mono-label', subTone)}>{label}</span>
        <span className={cn('grid h-8 w-8 place-items-center rounded-full', tone === 'white' ? 'bg-stone-2' : 'bg-white/15')}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-auto pt-5 text-[34px] font-medium leading-none tracking-tight3 tabular">
        {loading ? <Skeleton className="h-8 w-20" /> : value ?? '—'}
      </div>
      <p className={cn('mt-2 flex items-center justify-between text-[13px]', subTone)}>
        <span>{sub}</span>
        <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </p>
    </Link>
  );
}

function ChartCard({ title, caption, loading, empty, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-medium tracking-tight1">{title}</h2>
        {caption && <span className="mono-label text-muted">{caption}</span>}
      </div>
      <div className="h-60">
        {loading ? (
          <Skeleton className="h-full w-full rounded-r18" />
        ) : empty ? (
          <div className="grid h-full place-items-center rounded-r18 bg-paper text-[13.5px] text-muted">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

const ACTIVITY_ICON = { user: UserPlus, session: CheckCircle2, resume: FileText };
const ACTIVITY_TONE = { user: 'bg-brand-50 text-brand-600', session: 'bg-lime-soft text-lime-ok', resume: 'bg-stone text-ink' };

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    staleTime: 60_000,
  });

  const charts = stats?.charts || {};
  const isEmpty = (arr) => !arr || arr.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Overview"
        title="Platform dashboard"
        description="Sign-ups, practice activity, revenue and system health across Rehearsly."
        actions={
          <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
            Refresh
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          title="Couldn’t load platform stats"
          description={getErrorMessage(error, 'The stats service did not respond.')}
          onRetry={refetch}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric tone="ink" icon={Users} label="Total users" value={stats?.totalUsers} sub={`${stats?.newUsersThisWeek ?? 0} new this week`} to="/admin/users" loading={isLoading} />
            <Metric tone="lime" icon={Wallet} label="Confirmed revenue" value={stats ? formatINR(stats.totalRevenue) : undefined} sub="PayU-confirmed orders" to="/admin/payments" loading={isLoading} />
            <Metric icon={Star} label="Premium users" value={stats?.premiumUsers} sub="With a paid pass" to="/admin/users" loading={isLoading} />
            <Metric icon={UserCheck} label="Free users" value={stats?.freeUsers} sub="On the free allowance" to="/admin/users" loading={isLoading} />
            <Metric tone="blue" icon={Activity} label="Interviews today" value={stats?.interviewsToday} sub="Created since midnight" to="/admin/interviews" loading={isLoading} />
            <Metric icon={MessageSquare} label="Total interviews" value={stats?.totalInterviews} sub="All-time generated" to="/admin/interviews" loading={isLoading} />
            <Metric icon={Briefcase} label="Active jobs" value={stats?.jobsCount} sub="Live listings" to="/admin/jobs" loading={isLoading} />
            <Metric icon={FileText} label="Applications" value={stats?.applicationsCount} sub="Sessions + parsed resumes" to="/admin/resumes" loading={isLoading} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard title="User registrations" caption="Monthly" loading={isLoading} empty={isEmpty(charts.userGrowth)}>
              <AreaChart data={charts.userGrowth} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="adm-users" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" {...CHART.axisProps} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="users" name="Users" stroke={CHART.blue} strokeWidth={2} fill="url(#adm-users)" />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Revenue" caption="INR · monthly" loading={isLoading} empty={isEmpty(charts.revenue)}>
              <AreaChart data={charts.revenue} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="adm-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.ink} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={CHART.ink} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" {...CHART.axisProps} />
                <YAxis {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip formatter={formatINR} />} />
                <Area type="monotone" dataKey="amount" name="Revenue" stroke={CHART.ink} strokeWidth={2} fill="url(#adm-rev)" />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Interviews created" caption="Monthly" loading={isLoading} empty={isEmpty(charts.interviews)}>
              <BarChart data={charts.interviews} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" {...CHART.axisProps} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F2F0' }} />
                <Bar dataKey="count" name="Interviews" fill={CHART.blue} radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Weekly engagement" caption="Last 7 days" loading={isLoading} empty={isEmpty(charts.dailyActivity)}>
              <LineChart data={charts.dailyActivity} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" {...CHART.axisProps} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#5B6470' }} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke={CHART.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="users" name="Active candidates" stroke={CHART.ink} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card className="p-5 sm:p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[17px] font-medium tracking-tight1">Recent activity</h2>
                <span className="mono-label text-muted">Latest 8</span>
              </div>
              {isLoading ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : !stats?.activities?.length ? (
                <EmptyState compact icon={Activity} title="No activity yet" description="Sign-ups, completed sessions and uploads will appear here." />
              ) : (
                <ul className="divide-y divide-line-2">
                  {stats.activities.map((a) => {
                    const Icon = ACTIVITY_ICON[a.type] || Activity;
                    return (
                      <li key={a.id} className="flex items-start gap-3 py-3">
                        <span className={cn('grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9', ACTIVITY_TONE[a.type] || 'bg-stone')}>
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-[14px] font-medium">{a.title}</p>
                            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-mono text-faint">{timeAgo(a.timestamp)}</span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-muted">{a.message}</p>
                          {a.score !== undefined && a.score !== null && (
                            <Pill tone="blue" className="mt-1.5">Score {a.score}%</Pill>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <div className="space-y-3">
              <Card tone="ink" className="p-5 sm:p-6">
                <h2 className="text-[17px] font-medium tracking-tight1">Quick actions</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { to: '/admin/users', icon: Users, label: 'Users' },
                    { to: '/admin/jobs', icon: Briefcase, label: 'Jobs' },
                    { to: '/admin/logs', icon: Terminal, label: 'Audit logs' },
                    { to: '/admin/settings', icon: Settings, label: 'Settings' },
                  ].map(({ to, icon: Icon, label }) => (
                    <Link key={to} to={to} className="flex items-center gap-2 rounded-r14 border border-ink-line bg-ink-2 px-3 py-2.5 text-[13px] text-on-dark-bright transition-colors hover:border-lime/50 hover:text-white">
                      <Icon size={14} className="text-lime" aria-hidden="true" /> {label}
                    </Link>
                  ))}
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[17px] font-medium tracking-tight1">Recent failures</h2>
                  <Link to="/admin/logs" className="mono-label text-brand-600 hover:text-ink">Logs ↗</Link>
                </div>
                {isLoading ? (
                  <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : !stats?.recentErrors?.length ? (
                  <p className="flex items-center gap-2 rounded-r14 bg-lime-soft px-3.5 py-3 text-[13.5px] text-lime-ok">
                    <CheckCircle2 size={15} aria-hidden="true" /> No recent failures recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {stats.recentErrors.map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 rounded-r14 bg-paper px-3.5 py-3">
                        <AlertTriangle size={14} className={cn('mt-0.5 flex-shrink-0', e.severity === 'error' ? 'text-coral' : 'text-brand-600')} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-mono text-[10.5px] uppercase tracking-mono text-muted">{e.service} · {timeAgo(e.timestamp)}</p>
                          <p className="mt-0.5 break-words text-[13px] leading-snug">{e.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
