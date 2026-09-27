/**
 * AdminScraperPage — Adzuna job-scraper control room.
 *
 * Scheduler state + manual run / pause / resume (POST /admin/scraper/run|pause|resume),
 * schedule, country, remote filter and keyword pipeline (PATCH /admin/scraper/settings),
 * and paginated run history (GET /admin/scraper/logs). Status and logs poll every 12s.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  RefreshCw, Play, Pause, Save, Plus, X, Clock, Timer, Radar, History, Globe, Terminal,
  AlertTriangle, Lock, Undo2, Tag,
} from 'lucide-react';
import {
  getAdminScraperStatus, updateAdminScraperSettings, triggerAdminScrape,
  pauseAdminScraper, resumeAdminScraper, getAdminScraperLogs,
} from '@/services/admin.service';
import { useAdminAuth } from '@/context';
import {
  Alert, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Pagination, Pill,
  Skeleton, Switch, TableShell, useConfirm,
} from '@/components/ui';
import { cn, formatDateTime, getErrorMessage, timeAgo } from '@/utils';

const POLL_MS = 12000;
const LOG_LIMIT = 8;

const LOG_STATUS = {
  success: { tone: 'ok', label: 'Success' },
  failed: { tone: 'coral', label: 'Failed' },
  running: { tone: 'blue', label: 'Running' },
  interrupted: { tone: 'stone', label: 'Interrupted' },
};

const toDraft = (c) => ({
  interval: String(c?.scrapeInterval ?? 60),
  maxJobs: String(c?.maxJobs ?? 50),
  country: c?.country ?? 'us',
  remoteOnly: c?.remoteOnly ?? true,
  keywords: Array.isArray(c?.keywords) ? c.keywords : [],
});

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const secs = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return `${m}m ${secs % 60}s`;
}

function validate(d) {
  const e = {};
  const interval = Number(d.interval);
  if (String(d.interval).trim() === '' || !Number.isInteger(interval)) e.interval = 'Enter a whole number of minutes.';
  else if (interval < 5) e.interval = 'The interval can’t be shorter than 5 minutes.';
  const maxJobs = Number(d.maxJobs);
  if (String(d.maxJobs).trim() === '' || !Number.isInteger(maxJobs)) e.maxJobs = 'Enter a whole number.';
  else if (maxJobs < 5) e.maxJobs = 'Fetch at least 5 jobs per keyword.';
  if (!/^[a-z]{2}$/i.test(d.country.trim())) e.country = 'Use a two-letter Adzuna country code, e.g. us, gb, in.';
  return e;
}

function StatusTile({ label, value, sub, icon: Icon, tone = 'white', loading }) {
  const tones = { white: 'card', ink: 'card-ink', lime: 'card-lime', blue: 'rounded-r24 bg-brand text-white' };
  const subTone = { ink: 'text-on-dark', lime: 'text-lime-ink', blue: 'text-brand-50' }[tone] || 'text-muted';
  return (
    <div className={cn(tones[tone], 'flex min-h-[136px] flex-col p-5')}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('mono-label', subTone)}>{label}</span>
        <span className={cn('grid h-8 w-8 flex-shrink-0 place-items-center rounded-full', tone === 'white' ? 'bg-stone-2' : 'bg-white/15')}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-auto pt-4 text-[28px] font-medium leading-none tracking-tight3">
        {loading ? <Skeleton className="h-7 w-24" /> : value}
      </div>
      <p className={cn('mt-2 truncate text-[13px]', subTone)}>{loading ? ' ' : sub}</p>
    </div>
  );
}

export default function AdminScraperPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { hasPermission } = useAdminAuth();
  const canRun = hasPermission('run:scraper');
  const canConfigure = hasPermission('update:settings');

  const [logPage, setLogPage] = useState(1);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringScrape, setTriggeringScrape] = useState(false);
  const [togglingScheduler, setTogglingScheduler] = useState(false);

  // Settings form local state
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordError, setKeywordError] = useState('');

  // ── Status + configuration (polled) ──
  const statusQuery = useQuery({
    queryKey: ['admin-scraper-status'],
    queryFn: getAdminScraperStatus,
    refetchInterval: POLL_MS,
  });
  const statusData = statusQuery.data?.success ? statusQuery.data.data : null;
  const config = statusData?.config || null;
  const schedulerRunning = !!statusData?.schedulerRunning;

  // ── Run history (polled, paginated) ──
  const logsQuery = useQuery({
    queryKey: ['admin-scraper-logs', logPage],
    queryFn: () => getAdminScraperLogs({ page: logPage, limit: LOG_LIMIT }),
    refetchInterval: POLL_MS,
    placeholderData: (prev) => prev,
  });
  const logs = logsQuery.data?.logs || [];
  const totalLogs = logsQuery.data?.total || 0;
  const totalPages = logsQuery.data?.pages || 1;

  const serverDraft = useMemo(() => (config ? toDraft(config) : null), [config]);
  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline);

  // Sync the form from the server — but never clobber edits in progress during polling.
  useEffect(() => {
    if (!serverDraft) return;
    if (!draft || !dirty) {
      setDraft(serverDraft);
      setBaseline(serverDraft);
    }

  }, [serverDraft]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-scraper-status'] });
    queryClient.invalidateQueries({ queryKey: ['admin-scraper-logs'] });
  };

  // Handle manual run trigger
  const handleTriggerScrape = async () => {
    if (config?.status === 'running') return;
    const count = config?.keywords?.length || 0;
    const ok = await confirm({
      title: 'Run the scraper now?',
      description: `This queries Adzuna for ${count} keyword${count === 1 ? '' : 's'} and imports up to ${config?.maxJobs ?? 50} listings per keyword. It runs in the background.`,
      confirmLabel: 'Run scraper',
    });
    if (!ok) return;
    setTriggeringScrape(true);
    try {
      await triggerAdminScrape();
      toast.success('Scrape started. Progress appears in the run history.');
      refreshAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t start the scraper.'));
    } finally {
      setTriggeringScrape(false);
    }
  };

  // Pause / Resume scheduler
  const handleToggleScheduler = async () => {
    if (config?.isActiveScheduler) {
      const ok = await confirm({
        title: 'Pause the scheduler?',
        description: 'Automatic imports stop until the scheduler is resumed. Manual runs still work.',
        confirmLabel: 'Pause scheduler',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setTogglingScheduler(true);
    try {
      if (config?.isActiveScheduler) {
        await pauseAdminScraper();
        toast.success('Scheduler paused.');
      } else {
        await resumeAdminScraper();
        toast.success('Scheduler resumed.');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-scraper-status'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t change the scheduler state.'));
      queryClient.invalidateQueries({ queryKey: ['admin-scraper-status'] });
    } finally {
      setTogglingScheduler(false);
    }
  };

  const setField = (key) => (value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => { const next = { ...e }; delete next[key]; return next; });
    setServerError('');
  };

  // Save Settings Form
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!canConfigure || !draft) return;
    const v = validate(draft);
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(`scraper-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    setSavingSettings(true);
    setServerError('');
    try {
      const saved = await updateAdminScraperSettings({
        scrapeInterval: parseInt(draft.interval, 10) || 60,
        maxJobs: parseInt(draft.maxJobs, 10) || 50,
        keywords: draft.keywords,
        country: draft.country.toLowerCase().trim(),
        remoteOnly: draft.remoteOnly,
      });
      toast.success('Scraper configuration saved.');
      if (saved) {
        const next = toDraft(saved);
        setDraft(next);
        setBaseline(next);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-scraper-status'] });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Couldn’t save the scraper configuration.'));
      toast.error('Scraper configuration wasn’t saved.');
    } finally {
      setSavingSettings(false);
    }
  };

  const discard = () => {
    if (baseline) setDraft(baseline);
    setErrors({});
    setServerError('');
    setKeywordError('');
    setNewKeyword('');
  };

  // Keywords management
  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    if (draft.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setKeywordError(`“${kw}” is already in the pipeline.`);
      return;
    }
    setField('keywords')([...draft.keywords, kw]);
    setNewKeyword('');
    setKeywordError('');
  };

  const removeKeyword = (kw) => {
    setField('keywords')(draft.keywords.filter((k) => k !== kw));
  };

  const isRunning = config?.status === 'running';
  const statusLoading = statusQuery.isLoading;
  const adzunaEnabled = (config?.enabledSources || ['adzuna']).includes('adzuna');

  if (statusQuery.isError && !statusData) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Admin · System" title="Job scraper" description="Adzuna sync schedule, keyword pipeline and run history." />
        <ErrorState
          title="Couldn’t load the scraper status"
          description={getErrorMessage(statusQuery.error, 'The scraper service did not respond.')}
          onRetry={() => statusQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · System"
        title="Job scraper"
        description="Adzuna sync schedule, keyword pipeline and run history for imported job listings."
        actions={
          <>
            <Button
              variant="soft"
              icon={RefreshCw}
              onClick={refreshAll}
              loading={(statusQuery.isFetching || logsQuery.isFetching) && !statusLoading}
            >
              Refresh
            </Button>
            {canRun && (
              <>
                {config && (
                  <Button
                    variant="soft"
                    icon={config.isActiveScheduler ? Pause : Play}
                    onClick={handleToggleScheduler}
                    loading={togglingScheduler}
                  >
                    {config.isActiveScheduler ? 'Pause scheduler' : 'Resume scheduler'}
                  </Button>
                )}
                <Button
                  variant="ink"
                  icon={Play}
                  onClick={handleTriggerScrape}
                  loading={isRunning || triggeringScrape}
                  disabled={!config}
                >
                  {isRunning ? 'Scraping…' : 'Run scraper now'}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ── Scheduler status ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusTile
          tone="ink"
          icon={Clock}
          label="Scheduler"
          loading={statusLoading}
          value={config?.isActiveScheduler ? 'Active' : 'Paused'}
          sub={schedulerRunning ? 'Timer running in the API' : 'No timer running in the API'}
        />
        <StatusTile
          tone={isRunning ? 'blue' : 'white'}
          icon={Radar}
          label="Run status"
          loading={statusLoading}
          value={<span className="capitalize">{config?.status || 'idle'}</span>}
          sub={isRunning ? 'Importing listings now' : 'Waiting for the next run'}
        />
        <StatusTile
          icon={Timer}
          label="Interval"
          loading={statusLoading}
          value={<span className="tabular">{config?.scrapeInterval ?? '—'} min</span>}
          sub={`Up to ${config?.maxJobs ?? '—'} jobs per keyword`}
        />
        <StatusTile
          icon={History}
          label="Last run"
          loading={statusLoading}
          value={config?.lastRun ? timeAgo(config.lastRun) : 'Never'}
          sub={config?.lastRun ? formatDateTime(config.lastRun) : 'No completed runs yet'}
        />
      </div>

      {config?.isActiveScheduler && !schedulerRunning && !statusLoading && (
        <Alert tone="warn" icon={AlertTriangle} title="Schedule enabled, but no timer is running">
          The scheduler is switched on in the saved configuration, but the API process has no active timer, so automatic imports won’t fire.
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        {/* ── Configuration + keywords ── */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <form onSubmit={handleSaveSettings} noValidate>
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-medium tracking-tight1">Configuration</h2>
                <p className="mt-0.5 text-[13.5px] text-muted">Schedule, search scope and the keywords each run queries.</p>
              </div>
              {dirty && <Pill tone="blue" mono>Unsaved</Pill>}
            </div>

            {!canConfigure && (
              <Alert tone="info" icon={Lock} className="mb-5">
                Your role can run the scraper but not change its configuration.
              </Alert>
            )}

            {!draft ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-12 rounded-r14" /></div>
                ))}
              </div>
            ) : (
              <fieldset disabled={!canConfigure || savingSettings} className="min-w-0">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Scrape interval (minutes)" required error={errors.interval} hint="Minimum 5 minutes.">
                    <Input id="scraper-interval" type="number" min="5" step="1" inputMode="numeric" value={draft.interval} onChange={(e) => setField('interval')(e.target.value)} />
                  </Field>
                  <Field label="Max jobs per keyword" required error={errors.maxJobs} hint="Per keyword, per run. Minimum 5.">
                    <Input id="scraper-maxJobs" type="number" min="5" step="1" inputMode="numeric" value={draft.maxJobs} onChange={(e) => setField('maxJobs')(e.target.value)} />
                  </Field>
                  <Field label="Country (Adzuna code)" required error={errors.country}>
                    <Input
                      id="scraper-country"
                      icon={Globe}
                      maxLength={2}
                      value={draft.country}
                      onChange={(e) => setField('country')(e.target.value)}
                      placeholder="us, gb, in"
                      className="font-mono uppercase"
                      autoComplete="off"
                    />
                  </Field>
                  <div className="field-label">
                    <span>Remote filter</span>
                    <div className="flex items-center justify-between gap-4 rounded-r14 border border-line bg-paper px-4 py-[12px]">
                      <label htmlFor="scraper-remoteOnly" className="cursor-pointer text-[15px] font-normal">Remote-only postings</label>
                      <Switch id="scraper-remoteOnly" checked={draft.remoteOnly} onChange={setField('remoteOnly')} label="Remote-only postings" />
                    </div>
                    <span className="field-hint">{draft.remoteOnly ? 'On-site roles are skipped.' : 'On-site and remote roles are imported.'}</span>
                  </div>
                </div>

                <p className="divider-label mb-4 mt-8">Keyword pipeline</p>
                {draft.keywords.length === 0 ? (
                  <p className="rounded-r14 border border-dashed border-line bg-paper px-4 py-3 text-[13.5px] text-muted">
                    No keywords configured — runs will not import anything until you add one.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2" aria-label="Keywords">
                    {draft.keywords.map((kw) => (
                      <li key={kw} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pl-3 pr-1.5 text-[13.5px]">
                        <Tag size={12} className="text-faint" aria-hidden="true" />
                        {kw}
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          aria-label={`Remove keyword ${kw}`}
                          className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-coral-soft hover:text-coral disabled:pointer-events-none"
                        >
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <div className="flex gap-2">
                    <Input
                      id="scraper-newKeyword"
                      aria-label="New keyword"
                      aria-invalid={keywordError ? true : undefined}
                      aria-describedby={keywordError ? 'scraper-newKeyword-error' : undefined}
                      invalid={!!keywordError}
                      className="min-w-0 flex-1"
                      placeholder="Add a keyword, e.g. Docker"
                      value={newKeyword}
                      onChange={(e) => { setNewKeyword(e.target.value); setKeywordError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    />
                    <Button variant="soft" icon={Plus} onClick={addKeyword} disabled={!newKeyword.trim()} className="flex-shrink-0 self-stretch">
                      Add
                    </Button>
                  </div>
                  {keywordError && (
                    <p id="scraper-newKeyword-error" role="alert" className="field-error-text mt-1.5">{keywordError}</p>
                  )}
                </div>
              </fieldset>
            )}

            {serverError && (
              <Alert tone="error" className="mt-5" title="Configuration wasn’t saved">{serverError}</Alert>
            )}

            {canConfigure && draft && (
              <div className="mt-6 flex items-center gap-2 border-t border-line-2 pt-5 sm:justify-end">
                <Button variant="ghost" icon={Undo2} onClick={discard} disabled={!dirty || savingSettings} className="px-3 sm:px-[18px]">
                  <span className="sr-only sm:not-sr-only">Discard</span>
                </Button>
                <Button type="submit" variant="ink" icon={Save} loading={savingSettings} className="flex-1 sm:flex-none">
                  {savingSettings ? 'Saving…' : 'Save configuration'}
                </Button>
              </div>
            )}
          </form>
        </Card>

        {/* ── Sources ── */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-[17px] font-medium tracking-tight1">Sources</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">Where scraped listings come from.</p>
          <ul className="mt-5 space-y-2">
            <li className="flex items-center gap-3 rounded-r14 border border-line-2 bg-paper px-3.5 py-3">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-brand-50 text-brand-600">
                <Globe size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">Adzuna Jobs</p>
                <p className="text-[12.5px] text-muted">API search connection</p>
              </div>
              {statusLoading ? <Skeleton className="h-6 w-16 rounded-full" /> : adzunaEnabled ? <Pill tone="ok" mono>Enabled</Pill> : <Pill tone="stone" mono>Off</Pill>}
            </li>
            <li className="flex items-center gap-3 rounded-r14 border border-line-2 px-3.5 py-3 opacity-70">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-stone-2 text-muted">
                <Terminal size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">LinkedIn web</p>
                <p className="text-[12.5px] text-muted">HTML scraper pipeline</p>
              </div>
              <Pill tone="outline" mono>Disabled</Pill>
            </li>
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            API connections use deterministic field mappings. Unlicensed web scraping stays disabled.
          </p>
        </Card>
      </div>

      {/* ── Run history ── */}
      <section className="space-y-3" aria-labelledby="scraper-history-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="scraper-history-title" className="text-[17px] font-medium tracking-tight1">Run history</h2>
          {logsQuery.data && (
            <span className="mono-label text-muted tabular">{totalLogs} run{totalLogs === 1 ? '' : 's'} recorded</span>
          )}
        </div>

        {logsQuery.isLoading ? (
          <TableShell minWidth={760}>
            <tbody>
              {[0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                    <td key={j}><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : logsQuery.isError && !logsQuery.data ? (
          <ErrorState
            compact
            title="Couldn’t load the run history"
            description={getErrorMessage(logsQuery.error, 'The scraper log service did not respond.')}
            onRetry={() => logsQuery.refetch()}
          />
        ) : logs.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="No scraper runs yet"
            description="Each scheduled or manual run is logged here with its imports, duplicates and errors."
          />
        ) : (
          <>
            <TableShell minWidth={760}>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th className="text-right">Imported</th>
                  <th className="text-right">Updated</th>
                  <th className="text-right">Duplicates</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const st = LOG_STATUS[log.status] || { tone: 'stone', label: log.status || 'Unknown' };
                  return (
                    <tr key={log._id}>
                      <td className="whitespace-nowrap">
                        <span className="block text-[14px]">{formatDateTime(log.startTime)}</span>
                        <span className="font-mono text-[10.5px] uppercase tracking-mono text-faint">{timeAgo(log.startTime)}</span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[13px] text-muted tabular">{formatDuration(log.startTime, log.endTime)}</td>
                      <td><Pill tone={st.tone} mono>{st.label}</Pill></td>
                      <td className="text-right font-medium tabular">{log.jobsImported ?? 0}</td>
                      <td className="text-right tabular text-muted-strong">{log.jobsUpdated ?? 0}</td>
                      <td className="text-right tabular text-muted">{log.duplicateCount ?? 0}</td>
                      <td className="max-w-[260px]">
                        {log.error ? (
                          <span className="flex items-start gap-1.5 text-[13px] text-coral" title={log.error}>
                            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="line-clamp-2 break-words">{log.error}</span>
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <Pagination
              page={logPage}
              totalPages={totalPages}
              onPageChange={setLogPage}
              disabled={logsQuery.isFetching}
            />
          </>
        )}
      </section>
    </div>
  );
}
