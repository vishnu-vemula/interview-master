/**
 * AdminLogsPage — system audit trail (GET /admin/logs): filter by category and status,
 * search action/details, paginate, export the current page as CSV and inspect a log's
 * metadata payload in a side drawer.
 */

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ScrollText, Search, Download, Eye, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, Copy,
} from 'lucide-react';
import { getAdminLogs } from '@/services/admin.service';
import {
  Button, Drawer, EmptyState, ErrorState, Input, PageHeader, Pagination, Pill, Segmented, Select,
  Skeleton, TableShell,
} from '@/components/ui';
import { formatDateTime, getErrorMessage, timeAgo } from '@/utils';
import { useDebounce } from '@/utils/use-debounce';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'auth', label: 'Auth & sign-ins' },
  { value: 'admin', label: 'Admin actions' },
  { value: 'ai', label: 'AI (Groq)' },
  { value: 'payment', label: 'Payments' },
  { value: 'scraper', label: 'Job scraper' },
  { value: 'email', label: 'Email' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const STATUS_META = {
  success: { tone: 'ok', icon: CheckCircle2 },
  failed: { tone: 'coral', icon: XCircle },
  warning: { tone: 'outline', icon: AlertTriangle },
  info: { tone: 'blue', icon: Info },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { tone: 'stone', icon: Info };
  return (
    <Pill tone={meta.tone} icon={meta.icon} mono>
      {status || 'unknown'}
    </Pill>
  );
}

const csvCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

const COLUMN_COUNT = 7;

export default function AdminLogsPage() {
  // Filters & search
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 400);

  // Pagination
  const [page, setPage] = useState(1);

  // Inspector details
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    setAppliedSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-logs', { page, search: appliedSearch, category, status }],
    queryFn: () => getAdminLogs({ page, limit: 15, search: appliedSearch, category, status }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.logs || [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.pages || 1;
  const filtered = category !== 'all' || status !== 'all' || !!appliedSearch;

  // Handle filter/search resets
  const handleFilterChange = (type, val) => {
    setPage(1);
    if (type === 'category') setCategory(val);
    if (type === 'status') setStatus(val);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    const term = search.trim();
    if (term === appliedSearch) refetch();
    else setAppliedSearch(term);
  };

  const clearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setCategory('all');
    setStatus('all');
    setPage(1);
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return toast.error('No log records compiled to export.');

    const headers = ['Timestamp', 'Category', 'Action Event', 'Status', 'User Trigger', 'Details', 'Metadata Payload'];
    const rows = logs.map((l) => [
      new Date(l.createdAt).toLocaleString(),
      l.category,
      l.action,
      l.status,
      l.userId ? `${l.userId.name} (${l.userId.email})` : 'System Daemon',
      l.details,
      JSON.stringify(l.metadata || {}),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `system_logs_export_${category}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('System logs CSV downloaded.');
    return undefined;
  };

  const copyMetadata = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedLog?.metadata || {}, null, 2));
      toast.success('Metadata copied to clipboard.');
    } catch {
      toast.error('Couldn’t copy — select the JSON and copy it manually.');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Audit logs"
        title="System logs"
        description="Sign-ins, admin changes, AI calls, PayU events, scraper runs and email dispatches, newest first."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
              Refresh
            </Button>
            <Button variant="ink" icon={Download} onClick={handleExportCSV} disabled={isLoading || logs.length === 0}>
              Export CSV
            </Button>
          </>
        }
      />

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} role="search" className="flex min-w-0 flex-[1_1_320px] gap-2">
            <div className="min-w-0 flex-1">
              <Input
                icon={Search}
                type="search"
                aria-label="Search logs by action or details"
                placeholder="Search action or details…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="py-[11px]"
              />
            </div>
            <Button type="submit" variant="soft" className="flex-shrink-0">Search</Button>
          </form>
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full py-[11px] sm:w-auto sm:min-w-[200px]"
          >
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel="Filter by status"
            size="sm"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => handleFilterChange('status', v)}
          />
          <span className="mono-label text-muted tabular" aria-live="polite">
            {isLoading ? 'Loading…' : `${totalItems} log${totalItems === 1 ? '' : 's'}${filtered ? ' match' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Logs table ──────────────────────────────────────── */}
      {isError ? (
        <ErrorState
          title="Couldn’t load audit logs"
          description={getErrorMessage(error, 'Failed to load system audit logs.')}
          onRetry={refetch}
        />
      ) : isLoading ? (
        <TableShell minWidth={1060}>
          <thead>
            <tr>
              {Array.from({ length: COLUMN_COUNT }).map((_, i) => <th key={i}><Skeleton className="h-3 w-16" /></th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                  <td key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? 'No logs match these filters' : 'No audit logs yet'}
          description={
            filtered
              ? 'Try a different search term, category or status.'
              : 'Sign-ins, admin changes, payments and scraper runs will be recorded here as they happen.'
          }
          action={filtered ? <Button variant="soft" size="sm" onClick={clearFilters}>Clear filters</Button> : null}
        />
      ) : (
        <div className="space-y-4">
          <TableShell minWidth={1060} className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Category</th>
                <th>Action</th>
                <th>Status</th>
                <th>Triggered by</th>
                <th>Details</th>
                <th className="relative text-right"><span className="sr-only">Inspect</span></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="whitespace-nowrap">
                    <p className="whitespace-nowrap text-[13.5px] tabular">{formatDateTime(log.createdAt)}</p>
                    <p className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-mono text-faint">{timeAgo(log.createdAt)}</p>
                  </td>
                  <td><Pill tone="stone" mono>{log.category || '—'}</Pill></td>
                  <td className="max-w-[200px]">
                    <p className="truncate font-medium" title={log.action}>{log.action}</p>
                  </td>
                  <td><StatusPill status={log.status} /></td>
                  <td className="max-w-[220px]">
                    {log.userId ? (
                      <>
                        <p className="truncate text-[13.5px] font-medium">{log.userId.name || '—'}</p>
                        <p className="truncate text-[12px] text-muted">{log.userId.email}</p>
                      </>
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-mono text-faint">System</span>
                    )}
                  </td>
                  <td className="w-full max-w-0">
                    <p className="truncate text-[13.5px] text-muted-strong" title={log.details}>{log.details}</p>
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" icon={Eye} onClick={() => setSelectedLog(log)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={isFetching} />
        </div>
      )}

      {/* ── Payload inspector ───────────────────────────────── */}
      <Drawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action || 'Log entry'}
        subtitle={
          selectedLog && (
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone="stone" mono>{selectedLog.category}</Pill>
              <StatusPill status={selectedLog.status} />
              <span className="text-[13px]">{formatDateTime(selectedLog.createdAt)}</span>
            </span>
          )
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedLog(null)}>Close</Button>
            <Button variant="soft" icon={Copy} onClick={copyMetadata}>Copy JSON</Button>
          </>
        }
      >
        {selectedLog && (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-4 rounded-r18 border border-line-2 bg-white p-5 sm:grid-cols-2">
              <div>
                <dt className="mono-label text-muted">Recorded</dt>
                <dd className="mt-1 text-[14px] tabular">
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="mono-label text-muted">Triggered by</dt>
                <dd className="mt-1 text-[14px]">
                  {selectedLog.userId ? (
                    <>
                      {selectedLog.userId.name || '—'}
                      <span className="block break-all text-[12.5px] text-muted">{selectedLog.userId.email}</span>
                    </>
                  ) : (
                    'System'
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="mono-label text-muted">Log ID</dt>
                <dd className="mt-1 break-all font-mono text-[12.5px]">{selectedLog._id}</dd>
              </div>
            </dl>

            <div>
              <h3 className="mono-label mb-2 text-muted">Details</h3>
              <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{selectedLog.details || '—'}</p>
            </div>

            <div>
              <h3 className="mono-label mb-2 text-muted">Metadata</h3>
              <pre className="scroll-thin max-h-[420px] overflow-auto rounded-r18 bg-ink p-4 font-mono text-[12px] leading-relaxed text-on-dark-bright">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
