import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ClipboardList, FileText, Plus, Play, Trophy, TrendingUp, History } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { userAPI, sessionAPI, resumeAPI, interviewAPI } from '@/services/api';
import { useAuthStore } from '@/store/auth-store';
import { useBillingMe } from '@/hooks/use-billing';
import {
  Button, Card, CHART, ChartTooltip, EmptyState, ErrorState, PageHeader, ProgressBar, ScorePill, Skeleton, StatTile,
} from '@/components/ui';
import { cn, formatDate, getErrorMessage, timeAgo } from '@/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function ResumeCard({ session }) {
  const title = session.interviewId?.jobTitle || 'Your interview';
  return (
    <div className="flex flex-col gap-5 rounded-r24 bg-lime p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[14px] text-lime-ink">Pick up where you left off</p>
        <p className="mt-1.5 text-[26px] font-medium leading-tight tracking-tight3">{title}</p>
        <p className="mt-1 text-[13.5px] text-lime-ink">
          {session.interviewId?.company ? `${session.interviewId.company} · ` : ''}Started {timeAgo(session.startedAt || session.createdAt)}
        </p>
      </div>
      <Button to={`/interviews/${session.interviewId?._id || session.interviewId}/session`} variant="ink" cta className="py-[6px] [&_.btn-cta-disc]:bg-lime [&_.btn-cta-disc]:text-ink">
        Resume session
      </Button>
    </div>
  );
}

function GettingStarted({ resumes, interviews, sessions }) {
  const steps = [
    { done: resumes > 0, title: 'Upload your resume', body: 'PDF, up to 5 MB. Questions are grounded in it.', to: '/resumes', cta: 'Upload' },
    { done: interviews > 0, title: 'Paste a job description', body: 'Create an interview tailored to the role.', to: '/interviews/new', cta: 'Create' },
    { done: sessions > 0, title: 'Answer out loud or in text', body: 'Use voice input or type — follow-ups when an answer is thin.', to: '/interviews', cta: 'Practice' },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[22px] font-medium tracking-tight1">Get your first report in three steps</h2>
        <span className="mono-label text-muted">{steps.filter((s) => s.done).length}/3 done</span>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              'flex flex-col rounded-r20 p-5',
              s.done ? 'bg-stone-2' : i === next ? 'bg-ink text-white' : 'border border-line-2 bg-white',
            )}
          >
            <span className={cn('grid h-8 w-8 place-items-center rounded-full font-mono text-[12px]', s.done ? 'bg-lime text-ink' : i === next ? 'bg-lime text-ink' : 'bg-stone text-muted')}>
              {s.done ? <Check size={15} /> : `0${i + 1}`}
            </span>
            <p className="mt-6 text-[17px] font-medium tracking-tight1">{s.title}</p>
            <p className={cn('mt-1.5 flex-1 text-[13.5px] leading-relaxed', i === next && !s.done ? 'text-on-dark' : 'text-muted')}>{s.body}</p>
            {!s.done && (
              <Button to={s.to} size="sm" variant={i === next ? 'lime' : 'soft'} className="mt-4 self-start" iconRight={ArrowRight}>
                {s.cta}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => userAPI.getDashboard().then((r) => r.data.data) });
  const sessions = useQuery({ queryKey: ['sessions', { page: 1, limit: 10 }], queryFn: () => sessionAPI.getAll({ page: 1, limit: 10 }).then((r) => r.data) });
  const resumes = useQuery({ queryKey: ['resumes'], queryFn: () => resumeAPI.getAll().then((r) => r.data.resumes || []) });
  const interviews = useQuery({ queryKey: ['interviews', { page: 1, limit: 1 }], queryFn: () => interviewAPI.getAll({ page: 1, limit: 1 }).then((r) => r.data) });
  const billing = useBillingMe();

  const stats = dashboard.data;
  const loading = dashboard.isLoading;
  const active = sessions.data?.sessions?.find((s) => ['started', 'in_progress', 'evaluation_failed'].includes(s.status));
  const recent = stats?.recentSessions || [];
  const trend = [...recent].reverse().map((s, i) => ({ name: `#${i + 1}`, score: s.overallScore ?? 0, title: s.interviewId?.jobTitle }));
  const newUser = !loading && stats && stats.totalSessions === 0;
  const allowance = billing.data?.allowance;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
        description="Your practice at a glance — scores are practice feedback, never a hiring prediction."
        actions={<Button to="/interviews/new" variant="lime" icon={Plus}>New interview</Button>}
      />

      {dashboard.isError ? (
        <ErrorState title="Couldn’t load your dashboard" description={getErrorMessage(dashboard.error)} onRetry={dashboard.refetch} />
      ) : (
        <>
          {active && <ResumeCard session={active} />}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile tone="ink" label="Sessions" icon={ClipboardList} value={stats?.totalSessions ?? 0} sub="All time" loading={loading} />
            <StatTile label="Completed" icon={Check} value={stats?.completedSessions ?? 0} sub="With a full report" loading={loading} />
            <StatTile label="Average score" icon={TrendingUp} value={`${Number(stats?.averageScore ?? 0)}%`} sub="Across completed sessions" loading={loading} />
            <StatTile tone="lime" label="Best score" icon={Trophy} value={`${stats?.bestScore ?? 0}%`} sub="Personal best" loading={loading} />
          </div>

          {newUser && (
            <GettingStarted
              resumes={resumes.data?.length ?? 0}
              interviews={interviews.data?.total ?? 0}
              sessions={stats?.totalSessions ?? 0}
            />
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[17px] font-medium tracking-tight1">Score trend</h2>
                <span className="mono-label text-muted">Last {trend.length || 0}</span>
              </div>
              <div className="mt-5 h-52">
                {loading ? (
                  <Skeleton className="h-full w-full rounded-r18" />
                ) : trend.length === 0 ? (
                  <div className="grid h-full place-items-center rounded-r18 bg-paper px-6 text-center text-[13.5px] text-muted">
                    Finish a session to start your trend line.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" {...CHART.axisProps} />
                      <YAxis domain={[0, 100]} {...CHART.axisProps} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} cursor={{ fill: '#F1F2F0' }} />
                      <Bar dataKey="score" name="Score" radius={[6, 6, 6, 6]} maxBarSize={34}>
                        {trend.map((t, i) => <Cell key={i} fill={i === trend.length - 1 ? CHART.blue : CHART.blueSoft} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {allowance && (
                <div className="mt-6 border-t border-line-2 pt-5">
                  <div className="mb-2 flex justify-between text-[13.5px]">
                    <span>Interviews this period</span>
                    <span className="text-muted tabular">{allowance.used} of {allowance.limit} used</span>
                  </div>
                  <ProgressBar value={allowance.used} max={allowance.limit || 1} tone={allowance.remaining ? 'blue' : 'coral'} label="Interviews used" />
                  {allowance.remaining === 0 && (
                    <Link to="/pricing" className="mt-3 inline-block font-mono text-[10.5px] uppercase tracking-mono text-brand-600 hover:text-ink">
                      Get more interviews ↗
                    </Link>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-medium tracking-tight1">Recent reports</h2>
                <Link to="/sessions" className="mono-label text-brand-600 hover:text-ink">View all ↗</Link>
              </div>
              {loading ? (
                <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : recent.length === 0 ? (
                <EmptyState
                  compact
                  className="mt-4"
                  icon={History}
                  title="No reports yet"
                  description="Complete an interview and your per-answer report lands here."
                  action={<Button to="/interviews/new" variant="ink" size="sm" icon={Play}>Start practicing</Button>}
                />
              ) : (
                <ul className="mt-3 divide-y divide-line-2">
                  {recent.map((s) => (
                    <li key={s._id}>
                      <Link to={`/sessions/${s._id}/results`} className="group flex items-center justify-between gap-4 py-3.5 hover:text-ink">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-r14 bg-stone-2"><FileText size={17} aria-hidden="true" /></span>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-medium">{s.interviewId?.jobTitle || 'Interview'}</p>
                            <p className="mt-0.5 truncate text-[12.5px] text-muted">
                              {[s.interviewId?.company, s.interviewId?.experienceLevel && `${s.interviewId.experienceLevel} level`, formatDate(s.completedAt || s.createdAt)].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <ScorePill score={s.overallScore} />
                          <ArrowRight size={16} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { to: '/interviews/new', title: 'New interview', body: 'Paste a job description and get tailored questions.', tone: 'bg-ink text-white', sub: 'text-on-dark' },
              { to: '/resumes', title: 'Your resumes', body: `${resumes.data?.length ?? 0} uploaded · keep the latest one as default.`, tone: 'bg-stone', sub: 'text-muted' },
              { to: '/jobs/recommended', title: 'Roles that match you', body: 'Jobs scored against the skills in your resume.', tone: 'bg-brand text-white', sub: 'text-brand-50' },
            ].map((q) => (
              <Link key={q.to} to={q.to} className={cn('group flex min-h-[150px] flex-col rounded-r24 p-6 transition-transform hover:-translate-y-0.5 hover:text-inherit', q.tone)}>
                <span className="flex items-center justify-between text-[20px] font-medium tracking-tight1">
                  {q.title}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
                <span className={cn('mt-auto text-[14px] leading-relaxed', q.sub)}>{q.body}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
