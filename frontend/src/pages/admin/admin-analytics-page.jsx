/**
 * AdminAnalyticsPage — platform analytics for a selectable range (GET /admin/analytics/stats?range=):
 * candidate growth, conversion, session completion, average mock score, daily sign-up / revenue /
 * session / job trends and the retention curve. The full report can be exported as JSON.
 */

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Download, TrendingUp, Percent, Activity, Star, RefreshCw, Info } from 'lucide-react';
import { getAdminAnalytics } from '@/services/admin.service';
import {
  Button, Card, CHART, ChartTooltip, ErrorState, PageHeader, Pill, Segmented, Skeleton, StatTile,
} from '@/components/ui';
import { formatINR, getErrorMessage } from '@/utils';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

/** '2026-09-19' → 'Sep 19' (UTC buckets from the API, so format in UTC). */
const dayLabel = (iso, withYear) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC', ...(withYear ? { year: 'numeric' } : {}),
  });
};

const withLabels = (series, withYear) =>
  (Array.isArray(series) ? series : []).map((p) => ({ ...p, label: dayLabel(p.date, withYear) }));

const sumOf = (series, key) => series.reduce((acc, p) => acc + (Number(p[key]) || 0), 0);

function ChartCard({ title, caption, loading, empty, emptyLabel, className, children, badge, footer }) {
  return (
    <Card className={`p-5 sm:p-6 ${className || ''}`}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[17px] font-medium tracking-tight1">
          {title}
          {badge}
        </h2>
        {caption && <span className="mono-label text-muted tabular">{caption}</span>}
      </div>
      <div className="h-64">
        {loading ? (
          <Skeleton className="h-full w-full rounded-r18" />
        ) : empty ? (
          <div className="grid h-full place-items-center rounded-r18 bg-paper px-6 text-center text-[13.5px] text-muted">
            {emptyLabel || 'No data in this range'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
      {footer}
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState('30d');

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-analytics', range],
    queryFn: async () => {
      const res = await getAdminAnalytics({ range });
      if (!res?.success || !res.data) throw new Error('The analytics report came back empty.');
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() || range;
  const metrics = data?.metrics || {};
  const cohort = Array.isArray(data?.retention) ? data.retention : [];
  const trends = useMemo(() => {
    const t = data?.trends || {};
    const withYear = range === '1y';
    return {
      users: withLabels(t.users, withYear),
      revenue: withLabels(t.revenue, withYear),
      sessions: withLabels(t.sessions, withYear),
      jobs: withLabels(t.jobs, withYear),
    };
  }, [data, range]);

  const totals = {
    users: sumOf(trends.users, 'count'),
    revenue: sumOf(trends.revenue, 'amount'),
    sessions: sumOf(trends.sessions, 'count'),
    jobs: sumOf(trends.jobs, 'count'),
  };

  // Export full JSON report
  const handleExportReport = () => {
    if (!data) return toast.error('No analytics report compiled to export.');

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `platform_analytics_report_${range}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Analytics report downloaded as JSON.');
    return undefined;
  };

  const axisX = {
    dataKey: 'label',
    ...CHART.axisProps,
    minTickGap: 24,
    interval: 'preserveStartEnd',
    // 1-year view: "Sep 26, 2025" in the tooltip, "Sep 2025" on the axis.
    ...(range === '1y' ? { tickFormatter: (v) => String(v).replace(/\s\d{1,2},/, '') } : {}),
  };
  const margin = { top: 5, right: 26, left: -18, bottom: 0 };
  const loadingCharts = isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Analytics"
        title="Platform analytics"
        description="Candidate growth, premium conversion, practice completion, revenue and job imports over time."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
              Refresh
            </Button>
            <Button variant="ink" icon={Download} onClick={handleExportReport} disabled={isLoading || !data}>
              Export JSON
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented ariaLabel="Date range" options={RANGES} value={range} onChange={setRange} />
        <span className="mono-label text-muted" aria-live="polite">
          {isFetching ? 'Updating…' : `Trends · last ${rangeLabel} · UTC days`}
        </span>
      </div>

      {isError && !data ? (
        <ErrorState
          title="Couldn’t load platform analytics"
          description={getErrorMessage(error, 'Failed to load platform analytics report.')}
          onRetry={refetch}
        />
      ) : (
        <>
          {isError && (
            <ErrorState
              compact
              title={`Couldn’t refresh the ${rangeLabel} report`}
              description={`${getErrorMessage(error, 'The analytics service did not respond.')} Showing the last loaded report.`}
              onRetry={refetch}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              tone="ink"
              icon={TrendingUp}
              label="Candidates registered"
              value={metrics.totalCandidates ?? 0}
              sub={`Premium: ${metrics.premiumCandidates ?? 0}`}
              loading={isLoading}
            />
            <StatTile
              tone="lime"
              icon={Percent}
              label="Premium conversion"
              value={`${metrics.conversionRate ?? 0}%`}
              sub="Active passes / all candidates"
              loading={isLoading}
            />
            <StatTile
              icon={Activity}
              label="Session completion"
              value={`${metrics.completionRate ?? 0}%`}
              sub={`${metrics.completedSessionsCount ?? 0} of ${metrics.activeSessionsCount ?? 0} sessions finished`}
              loading={isLoading}
            />
            <StatTile
              icon={Star}
              label="Average mock score"
              value={
                <>
                  {metrics.averageMockScore ?? 0}
                  <span className="text-[18px] text-muted">/100</span>
                </>
              }
              sub={`${metrics.totalJobs ?? 0} live job listings`}
              loading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard
              title="Candidate sign-ups"
              caption={`${totals.users} in range`}
              loading={loadingCharts}
              empty={!totals.users}
              emptyLabel={`No candidate sign-ups in the last ${rangeLabel}`}
            >
              <AreaChart data={trends.users} margin={margin}>
                <defs>
                  <linearGradient id="an-users" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis {...axisX} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Sign-ups" stroke={CHART.blue} strokeWidth={2} fill="url(#an-users)" />
              </AreaChart>
            </ChartCard>

            <ChartCard
              title="Revenue"
              caption={`${formatINR(totals.revenue)} in range`}
              loading={loadingCharts}
              empty={!totals.revenue}
              emptyLabel={`No confirmed PayU revenue in the last ${rangeLabel}`}
            >
              <BarChart data={trends.revenue} margin={{ ...margin, left: -6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis {...axisX} />
                <YAxis {...CHART.axisProps} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<ChartTooltip formatter={formatINR} />} cursor={{ fill: '#F1F2F0' }} />
                <Bar dataKey="amount" name="Revenue" fill={CHART.ink} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Mock attempts started"
              caption={`${totals.sessions} in range`}
              loading={loadingCharts}
              empty={!totals.sessions}
              emptyLabel={`No practice sessions started in the last ${rangeLabel}`}
            >
              <LineChart data={trends.sessions} margin={margin}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis {...axisX} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="count" name="Attempts" stroke={CHART.blue} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>

            <ChartCard
              title="Jobs imported"
              caption={`${totals.jobs} in range`}
              loading={loadingCharts}
              empty={!totals.jobs}
              emptyLabel={`No job listings added in the last ${rangeLabel}`}
            >
              <BarChart data={trends.jobs} margin={margin}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis {...axisX} />
                <YAxis allowDecimals={false} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F2F0' }} />
                <Bar dataKey="count" name="Jobs" fill={CHART.blueSoft} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartCard>

            <ChartCard
              className="lg:col-span-2"
              title="Candidate retention"
              badge={<Pill tone="stone" mono>Reference curve</Pill>}
              caption="Weekly cohorts"
              loading={loadingCharts}
              empty={cohort.length === 0}
              emptyLabel="No retention data returned"
              footer={
                <p className="mt-4 flex items-start gap-2 text-[12.5px] text-muted">
                  <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  This is a fixed reference curve returned by the analytics API; it doesn’t change with the selected range.
                </p>
              }
            >
              <BarChart data={cohort} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} {...CHART.axisProps} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="cohort" width={104} {...CHART.axisProps} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} cursor={{ fill: '#F1F2F0' }} />
                <Bar dataKey="rate" name="Retention" fill={CHART.blue} radius={[0, 6, 6, 0]} maxBarSize={26} />
              </BarChart>
            </ChartCard>
          </div>

        </>
      )}
    </div>
  );
}
