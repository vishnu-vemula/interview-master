/**
 * AdminAtsPage — ATS pipeline health for uploaded resumes.
 *
 * Backed by GET /admin/resumes (newest first). Fetches the latest SAMPLE_SIZE resumes and derives:
 *  - headline metrics (all-time total from `total`; stage counts + extraction rate from the sample)
 *  - pipeline breakdown: uploaded → text extracted → AI-structured, plus failed / pending
 *  - top skills counted across parsedData.skills of AI-structured resumes
 *  - a filterable table of the latest resumes with status, skill count, candidate and date
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, FileText, Info, Percent, RefreshCw, ScanSearch, Sparkles, Upload,
} from 'lucide-react';
import { getAdminResumes } from '@/services/admin.service';
import {
  Alert, Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Pill, ProgressBar,
  Segmented, Skeleton, StatTile, TableShell,
} from '@/components/ui';
import { formatDate, getErrorMessage, timeAgo } from '@/utils';

const SAMPLE_SIZE = 100;
const TOP_SKILLS = 12;
const TABLE_PAGE_SIZE = 10;

const PARSE_STATUS = {
  parsed: { tone: 'ok', label: 'Text extracted' },
  pending: { tone: 'blue', label: 'Pending' },
  failed: { tone: 'coral', label: 'Failed' },
};

// ─── Skill extraction (parsedData is free-form JSON from the AI parser) ──
function collectSkills(value, out, depth = 0) {
  if (value === null || value === undefined || depth > 3) return;
  if (typeof value === 'string') {
    value.split(/[,;\n]/).forEach((s) => {
      const t = s.trim();
      if (t && t.length <= 48) out.push(t);
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectSkills(v, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return collectSkills(value.name, out, depth + 1);
    if (typeof value.skill === 'string') return collectSkills(value.skill, out, depth + 1);
    // Categorised skills, e.g. { languages: [...], frameworks: [...] }
    Object.values(value).forEach((v) => collectSkills(v, out, depth + 1));
  }
}

/** Unique (case-insensitive) skills listed on one resume. */
function getSkills(parsedData) {
  if (!parsedData || typeof parsedData !== 'object') return [];
  const source = parsedData.skills ?? parsedData.resume?.skills ?? parsedData.Resume?.skills ?? parsedData.candidate?.skills;
  const raw = [];
  collectSkills(source, raw);
  const unique = new Map();
  raw.forEach((s) => {
    const key = s.toLowerCase();
    if (!unique.has(key)) unique.set(key, s);
  });
  return [...unique.values()];
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function SectionHeading({ title, caption }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-[17px] font-medium tracking-tight1">{title}</h2>
      {caption && <span className="mono-label text-muted">{caption}</span>}
    </div>
  );
}

export default function AdminAtsPage() {
  const [filter, setFilter] = useState('all');
  const [tablePage, setTablePage] = useState(1);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-ats-resumes', { page: 1, limit: SAMPLE_SIZE }],
    queryFn: () => getAdminResumes({ page: 1, limit: SAMPLE_SIZE }),
    staleTime: 60_000,
  });

  const resumes = useMemo(() => data?.resumes ?? [], [data]);
  const total = data?.total ?? 0;
  const n = resumes.length;
  const partial = total > n;

  const rows = useMemo(
    () => resumes.map((r) => ({ ...r, skills: getSkills(r.parsedData) })),
    [resumes],
  );

  const stats = useMemo(() => {
    const extracted = rows.filter((r) => r.parseStatus === 'parsed').length;
    const failed = rows.filter((r) => r.parseStatus === 'failed').length;
    const pending = rows.length - extracted - failed;
    const structured = rows.filter((r) => r.isParsed).length;

    const counts = new Map();
    rows.forEach((r) => r.skills.forEach((s) => {
      const key = s.toLowerCase();
      const hit = counts.get(key);
      if (hit) hit.count += 1;
      else counts.set(key, { label: s, count: 1 });
    }));
    const withSkills = rows.filter((r) => r.skills.length > 0).length;
    const topSkills = [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, TOP_SKILLS);

    return { extracted, failed, pending, structured, distinctSkills: counts.size, withSkills, topSkills };
  }, [rows]);

  const scopeLabel = partial ? `Latest ${n}` : `All ${n}`;
  const ofScope = partial ? `of the latest ${n}` : `of ${n} ${n === 1 ? 'resume' : 'resumes'}`;

  const FILTERS = [
    { value: 'all', label: 'All', count: n },
    { value: 'parsed', label: 'Extracted', count: stats.extracted },
    { value: 'structured', label: 'AI-structured', count: stats.structured },
    { value: 'failed', label: 'Failed', count: stats.failed },
    ...(stats.pending > 0 ? [{ value: 'pending', label: 'Pending', count: stats.pending }] : []),
  ];

  const filtered = useMemo(() => {
    if (filter === 'structured') return rows.filter((r) => r.isParsed);
    if (filter === 'parsed' || filter === 'failed') return rows.filter((r) => r.parseStatus === filter);
    if (filter === 'pending') return rows.filter((r) => r.parseStatus !== 'parsed' && r.parseStatus !== 'failed');
    return rows;
  }, [rows, filter]);
  const tablePages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentTablePage = Math.min(tablePage, tablePages);
  const tableRows = filtered.slice((currentTablePage - 1) * TABLE_PAGE_SIZE, currentTablePage * TABLE_PAGE_SIZE);

  const stages = [
    { key: 'uploaded', label: 'Uploaded', hint: 'PDFs received', count: n, tone: 'ink' },
    { key: 'extracted', label: 'Text extracted', hint: 'Readable text pulled from the PDF', count: stats.extracted, tone: 'blue' },
    { key: 'structured', label: 'AI-structured', hint: 'Skills, experience and education parsed', count: stats.structured, tone: 'lime' },
    { key: 'failed', label: 'Extraction failed', hint: 'No readable text found', count: stats.failed, tone: 'coral' },
    ...(stats.pending > 0 ? [{ key: 'pending', label: 'Pending', hint: 'Not processed yet', count: stats.pending, tone: 'soft' }] : []),
  ];

  const empty = !isLoading && total === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · ATS pipeline"
        title="Resume parsing pipeline"
        description="How candidate resumes move through text extraction and AI structuring, and which skills they surface."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
              Refresh
            </Button>
            <Button variant="ink" icon={FileText} to="/admin/resumes">
              All resumes
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState
          title="Couldn’t load the ATS pipeline"
          description={getErrorMessage(error, 'The resume service did not respond.')}
          onRetry={refetch}
        />
      ) : (
        <>
          {partial && (
            <Alert tone="info" icon={Info} title={`Metrics cover the latest ${n} of ${total} resumes`}>
              The total counts every upload; stage counts, extraction rate, skills and the table below are computed from the {n} most recent resumes.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile
              tone="ink"
              icon={Upload}
              label="Total resumes"
              value={total}
              sub="All-time uploads"
              loading={isLoading}
              className="sm:col-span-2 sm:min-h-[148px] xl:col-span-1"
            />
            <StatTile
              icon={CheckCircle2}
              label="Text extracted"
              value={stats.extracted}
              sub={n ? `${pct(stats.extracted, n)}% ${ofScope}` : 'No uploads yet'}
              loading={isLoading}
              className="sm:min-h-[148px]"
            />
            <StatTile
              icon={AlertTriangle}
              label="Extraction failed"
              value={stats.failed}
              sub={n ? `${pct(stats.failed, n)}% ${ofScope}` : 'No uploads yet'}
              loading={isLoading}
              className="sm:min-h-[148px]"
            />
            <StatTile
              icon={Sparkles}
              label="AI-structured"
              value={stats.structured}
              sub={n ? `${pct(stats.structured, n)}% ${ofScope}` : 'No uploads yet'}
              loading={isLoading}
              className="sm:min-h-[148px]"
            />
            <StatTile
              tone="lime"
              icon={Percent}
              label="Extraction rate"
              value={n ? `${pct(stats.extracted, n)}%` : '—'}
              sub={partial ? `Latest ${n} uploads` : 'Text extracted ÷ uploads'}
              loading={isLoading}
              className="sm:min-h-[148px]"
            />
          </div>

          {empty ? (
            <EmptyState
              icon={ScanSearch}
              title="No resumes in the pipeline yet"
              description="When candidates upload resumes, text extraction and AI structuring results — and the skills they surface — appear here."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                <Card className="p-5 sm:p-6 lg:col-span-2">
                  <SectionHeading title="Pipeline breakdown" caption={isLoading ? undefined : scopeLabel} />
                  {isLoading ? (
                    <div className="space-y-5">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <ol className="space-y-5">
                        {stages.map((s) => (
                          <li key={s.key}>
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium">{s.label}</p>
                                <p className="text-[12.5px] text-muted">{s.hint}</p>
                              </div>
                              <p className="flex-shrink-0 font-mono text-[12px] tabular text-muted">
                                <span className="text-[15px] text-ink">{s.count}</span> · {pct(s.count, n)}%
                              </p>
                            </div>
                            <ProgressBar value={s.count} max={n} tone={s.tone} label={`${s.label}: ${s.count} of ${n}`} />
                          </li>
                        ))}
                      </ol>
                      <p className="mt-6 rounded-r14 bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-muted-strong">
                        {stats.extracted
                          ? `AI structuring succeeded for ${pct(stats.structured, stats.extracted)}% of resumes with extracted text.`
                          : 'No resume text has been extracted yet, so nothing could be AI-structured.'}
                      </p>
                    </>
                  )}
                </Card>

                <Card className="p-5 sm:p-6 lg:col-span-3">
                  <SectionHeading
                    title="Top extracted skills"
                    caption={
                      isLoading
                        ? undefined
                        : `${stats.distinctSkills} distinct · ${stats.withSkills} ${stats.withSkills === 1 ? 'resume' : 'resumes'}`
                    }
                  />
                  {isLoading ? (
                    <div className="space-y-3.5">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                    </div>
                  ) : stats.topSkills.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Sparkles}
                      title="No skills extracted yet"
                      description="Skills appear once resumes are AI-structured. Resumes with failed or text-only parsing don’t contribute."
                    />
                  ) : (
                    <ol className="space-y-3">
                      {stats.topSkills.map((s, i) => (
                        <li key={s.label} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
                          <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
                            <span className="w-5 flex-shrink-0 font-mono text-[10.5px] text-faint tabular">{String(i + 1).padStart(2, '0')}</span>
                            <span className="truncate" title={s.label}>{s.label}</span>
                          </span>
                          <ProgressBar
                            value={s.count}
                            max={stats.topSkills[0].count}
                            tone={i < 3 ? 'blue' : 'soft'}
                            label={`${s.label}: listed on ${s.count} ${s.count === 1 ? 'resume' : 'resumes'}`}
                          />
                          <span className="whitespace-nowrap text-right font-mono text-[11.5px] tabular text-muted">
                            <span className="text-ink">{s.count}</span> · {pct(s.count, stats.withSkills)}%
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-medium tracking-tight1">Latest resumes</h2>
                    <p className="mt-1 text-[13.5px] text-muted">
                      {partial ? `The ${n} most recent uploads, newest first.` : 'Every upload, newest first.'}
                    </p>
                  </div>
                  {!isLoading && (
                    <Segmented
                      size="sm"
                      options={FILTERS}
                      value={filter}
                      onChange={(v) => { setFilter(v); setTablePage(1); }}
                      ariaLabel="Filter resumes by pipeline stage"
                    />
                  )}
                </div>

                {!isLoading && filtered.length === 0 ? (
                  <EmptyState
                    compact
                    icon={FileText}
                    title="No resumes at this stage"
                    description={`None ${ofScope} match this filter.`}
                    action={<Button variant="soft" size="sm" onClick={() => setFilter('all')}>Show all</Button>}
                  />
                ) : (
                  <>
                    <TableShell minWidth={860}>
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>File</th>
                          <th>Parse status</th>
                          <th>Skills</th>
                          <th>Uploaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading
                          ? Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i}>
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <Skeleton className="h-7 w-7 flex-shrink-0 rounded-full" />
                                  <div className="space-y-1.5">
                                    <Skeleton className="h-3.5 w-28" />
                                    <Skeleton className="h-3 w-36" />
                                  </div>
                                </div>
                              </td>
                              <td><Skeleton className="h-3.5 w-40" /></td>
                              <td><Skeleton className="h-6 w-28 rounded-full" /></td>
                              <td><Skeleton className="h-4 w-32" /></td>
                              <td><Skeleton className="h-4 w-24" /></td>
                            </tr>
                          ))
                          : tableRows.map((r) => {
                            const parse = PARSE_STATUS[r.parseStatus] || PARSE_STATUS.pending;
                            const name = r.originalName || r.fileName || 'Untitled resume';
                            return (
                              <tr key={r._id}>
                                <td>
                                  {r.userId ? (
                                    <div className="flex items-center gap-2.5">
                                      <Avatar name={r.userId.name} size={28} tone="stone" />
                                      <div className="min-w-0">
                                        <p className="max-w-[200px] truncate text-[13.5px] font-medium">{r.userId.name ?? '—'}</p>
                                        <p className="max-w-[200px] truncate text-[12.5px] text-muted">{r.userId.email ?? ''}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-muted">Deleted account</span>
                                  )}
                                </td>
                                <td>
                                  <p className="max-w-[220px] truncate text-[13.5px]" title={name}>{name}</p>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1.5">
                                    <Pill tone={parse.tone} mono>{parse.label}</Pill>
                                    {r.isParsed && <Pill tone="lime" mono icon={Sparkles}>AI</Pill>}
                                  </div>
                                </td>
                                <td>
                                  {r.skills.length ? (
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="font-medium tabular">{r.skills.length}</span>
                                      <span className="max-w-[200px] truncate text-[12.5px] text-muted" title={r.skills.join(', ')}>
                                        {r.skills.slice(0, 3).join(', ')}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-faint">—</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap">
                                  <p className="whitespace-nowrap text-[13px]">{formatDate(r.createdAt)}</p>
                                  <p className="whitespace-nowrap text-[12px] text-muted">{timeAgo(r.createdAt)}</p>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </TableShell>

                    {!isLoading && tablePages > 1 && (
                      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="mono-label text-muted tabular">
                          Showing {(currentTablePage - 1) * TABLE_PAGE_SIZE + 1}–{Math.min(currentTablePage * TABLE_PAGE_SIZE, filtered.length)} of {filtered.length}
                        </p>
                        <Pagination page={currentTablePage} totalPages={tablePages} onPageChange={setTablePage} />
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
