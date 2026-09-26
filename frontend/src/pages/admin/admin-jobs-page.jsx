/**
 * AdminJobsPage — job listings manager (GET/POST/PATCH/DELETE /admin/jobs, /admin/jobs/stats, /admin/jobs/bulk).
 *  - Stat tiles (active, pinned, featured, archived) that double as posting filters.
 *  - Search, contract-type + posting filters, column sorting, table / card layouts, pagination.
 *  - Add / edit modal with validation and duplicate-listing override (409 → ignoreDuplicate).
 *  - Preview drawer, per-row delete, multi-select bulk actions (pin, feature, archive, delete).
 *  - Client-side CSV import (title, company, description, …) and CSV export of the current page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Archive, ArchiveRestore, ArrowDown, ArrowUp, ArrowUpDown, Briefcase, ChevronDown, Download, Edit3, Eye,
  LayoutGrid, List, MapPin, Pin, PinOff, Plus, Search, SearchX, Star, StarOff, Trash2, Upload,
} from 'lucide-react';
import {
  getAdminJobs, getAdminJobStats, createAdminJob, deleteAdminJob, bulkAdminJobsAction,
} from '@/services/admin.service';
import {
  Button, Card, Checkbox, Dropdown, EmptyState, ErrorState, Input, MenuItem, PageHeader, Pagination,
  Segmented, Select, Skeleton, StatTile, TableShell, useConfirm,
} from '@/components/ui';
import { cn, formatDate, getErrorMessage } from '@/utils';
import { useDebounce } from '@/utils/use-debounce';
import { CONTRACT_TYPES, ContractPill, JobFlags, POSTING_FILTERS } from './admin-jobs/job-meta';
import JobFormModal from './admin-jobs/job-form-modal';
import JobPreviewDrawer from './admin-jobs/job-preview-drawer';

const PAGE_SIZE = 10;

const BULK_ACTIONS = [
  { action: 'pin', label: 'Pin listings', icon: Pin },
  { action: 'unpin', label: 'Unpin listings', icon: PinOff },
  { action: 'feature', label: 'Feature listings', icon: Star },
  { action: 'unfeature', label: 'Unfeature listings', icon: StarOff },
  { action: 'archive', label: 'Archive listings', icon: Archive },
  { action: 'unarchive', label: 'Restore listings', icon: ArchiveRestore },
];

// ─── Sortable column header ───────────────────────────────────────
function SortHeader({ field, label, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn('inline-flex items-center gap-1.5 uppercase tracking-mono transition-colors hover:text-ink', active && 'text-ink')}
      >
        {label}
        <Icon size={12} className={active ? '' : 'text-faint'} aria-hidden="true" />
      </button>
    </th>
  );
}

// ─── Clickable stat tile (sets the posting filter) ────────────────
function FilterTile({ active, onClick, ...tile }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-r24 text-left transition-transform hover:-translate-y-0.5 focus-visible:shadow-ring focus-visible:outline-none',
        active && 'ring-2 ring-ink ring-offset-2 ring-offset-paper',
      )}
    >
      <StatTile className="h-full sm:min-h-[136px]" {...tile} />
    </button>
  );
}

function RowActions({ job, onPreview, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" iconOnly icon={Eye} aria-label={`Preview ${job.title}`} title="Preview" onClick={() => onPreview(job)} />
      <Button variant="ghost" size="sm" iconOnly icon={Edit3} aria-label={`Edit ${job.title}`} title="Edit" onClick={() => onEdit(job)} />
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={Trash2}
        aria-label={`Delete ${job.title}`}
        title="Delete"
        className="hover:bg-coral-soft hover:text-coral"
        onClick={() => onDelete(job)}
      />
    </div>
  );
}

// ─── Main Job Manager Page ────────────────────────────────────────
export default function AdminJobsPage() {
  const confirm = useConfirm();

  const [data, setData] = useState({ jobs: [], total: 0, pages: 1 });
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [contractType, setContractType] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [importing, setImporting] = useState(false);

  // Drawer & modal state
  const [previewJob, setPreviewJob] = useState(null);
  const [formState, setFormState] = useState(null); // null | { job?: object }

  const fileInputRef = useRef(null);
  const requestId = useRef(0);
  const debouncedSearch = useDebounce(search, 350);

  // Fetch job stats & paginated listings
  const fetchStats = useCallback(async () => {
    try {
      const s = await getAdminJobStats();
      setStats(s);
      setStatsError(false);
    } catch {
      setStatsError(true);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await getAdminJobs({
        page, limit: PAGE_SIZE, search: debouncedSearch, contractType, filterType, sortBy, sortDir,
      });
      if (id !== requestId.current) return;
      setData({ jobs: d?.jobs || [], total: d?.total || 0, pages: d?.pages || 1 });
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, debouncedSearch, contractType, filterType, sortBy, sortDir]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleUpdate = () => {
    fetchJobs();
    fetchStats();
  };

  const hasFilters = !!search || contractType !== 'all' || filterType !== 'all';
  const clearFilters = () => {
    setSearch('');
    setContractType('all');
    setFilterType('all');
    setPage(1);
  };

  const changeFilterType = (value) => { setFilterType(value); setPage(1); };

  const handleDelete = async (job) => {
    const ok = await confirm({
      title: 'Delete this listing?',
      description: `“${job.title}” at ${job.company} will be permanently removed from the jobs board. This can’t be undone.`,
      confirmLabel: 'Delete listing',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAdminJob(job._id);
      toast.success('Job listing deleted.');
      setPreviewJob((p) => (p?._id === job._id ? null : p));
      setSelectedJobIds((p) => p.filter((id) => id !== job._id));
      if (data.jobs.length === 1 && page > 1) {
        setPage((p) => p - 1);
        fetchStats();
      } else {
        handleUpdate();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete failed.'));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedJobIds.length === 0) return;
    const count = selectedJobIds.length;
    if (action === 'delete') {
      const ok = await confirm({
        title: `Delete ${count} listing${count === 1 ? '' : 's'}?`,
        description: 'The selected listings will be permanently removed from the jobs board. This can’t be undone.',
        confirmLabel: 'Delete listings',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBulkPending(true);
    try {
      await bulkAdminJobsAction(action, selectedJobIds);
      toast.success(`Bulk ${action} completed on ${count} listing${count === 1 ? '' : 's'}.`);
      setSelectedJobIds([]);
      if (action === 'delete' && data.jobs.every((j) => selectedJobIds.includes(j._id)) && page > 1) {
        setPage((p) => p - 1);
        fetchStats();
      } else {
        handleUpdate();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Bulk action failed.'));
    } finally {
      setBulkPending(false);
    }
  };

  // Selection checkboxes
  const pageIds = data.jobs.map((j) => j._id);
  const selectedOnPage = pageIds.filter((id) => selectedJobIds.includes(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedJobIds((p) => Array.from(new Set([...p, ...pageIds])));
    } else {
      setSelectedJobIds((p) => p.filter((id) => !pageIds.includes(id)));
    }
  };

  const handleSelectRow = (jobId) => {
    setSelectedJobIds((p) => (p.includes(jobId) ? p.filter((id) => id !== jobId) : [...p, jobId]));
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((p) => (p === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  // CSV export (current page)
  const exportToCSV = () => {
    if (data.jobs.length === 0) {
      toast.error('No job listings available to export.');
      return;
    }
    const headers = ['ID', 'Title', 'Company', 'Location', 'Contract Type', 'Category', 'Salary Min', 'Salary Max', 'Featured', 'Pinned', 'Archived'];
    const rows = data.jobs.map((j) => [
      j._id,
      j.title,
      j.company,
      j.location,
      j.contractType,
      j.category,
      j.salaryMin ?? '',
      j.salaryMax ?? '',
      j.isFeatured ? 'Yes' : 'No',
      j.isPinned ? 'Yes' : 'No',
      j.isArchived ? 'Yes' : 'No',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jobs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${data.jobs.length} listing${data.jobs.length === 1 ? '' : 's'}.`);
  };

  // CSV import parser (client-side runner)
  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length <= 1) {
        toast.error('CSV file is empty or missing content.');
        return;
      }

      // Read header mapping
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const parsedJobs = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic comma parsing (safe for quoted strings)
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < headers.length) continue;

        const row = matches.map((val) => val.trim().replace(/^["']|["']$/g, ''));
        const jobObj = {};

        headers.forEach((h, idx) => {
          const val = row[idx];
          if (h === 'title') jobObj.title = val;
          if (h === 'company') jobObj.company = val;
          if (h === 'location') jobObj.location = val;
          if (h === 'description') jobObj.description = val;
          if (h === 'applyUrl') jobObj.applyUrl = val;
          if (h === 'category') jobObj.category = val;
          if (h === 'contractType') jobObj.contractType = val;
        });

        if (jobObj.title && jobObj.company && jobObj.description) {
          parsedJobs.push(jobObj);
        }
      }

      if (parsedJobs.length === 0) {
        toast.error('Couldn’t parse any listings. Make sure the CSV has title, company and description columns.');
        return;
      }

      setImporting(true);
      const toastId = toast.loading(`Importing ${parsedJobs.length} job postings…`);

      let successCount = 0;
      for (const pJob of parsedJobs) {
        try {
          await createAdminJob({ ...pJob, ignoreDuplicate: true });
          successCount++;
        } catch { /* ignore single error */ }
      }

      setImporting(false);
      if (successCount === 0) {
        toast.error(`Import failed: none of the ${parsedJobs.length} listings were published.`, { id: toastId });
      } else {
        toast.success(`Import completed: ${successCount} of ${parsedJobs.length} listings published.`, { id: toastId });
      }
      handleUpdate();
    };
    reader.onerror = () => toast.error('Couldn’t read that file.');
    reader.readAsText(file);
    // Reset file input
    e.target.value = null;
  };

  const statValue = (key) => (statsError ? '—' : stats?.[key] ?? 0);
  const statsLoading = !stats && !statsError;
  const filterOptions = POSTING_FILTERS.map((f) => ({
    ...f,
    count: stats ? { all: stats.totalJobs, featured: stats.featuredJobs, pinned: stats.pinnedJobs, archived: stats.archivedJobs }[f.value] : undefined,
  }));

  const openEdit = (job) => { setPreviewJob(null); setFormState({ job }); };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Jobs"
        title="Job listings"
        description="Publish listings to the candidate jobs board, pin or feature the best ones, and bulk import or export via CSV."
        actions={
          <>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" aria-hidden="true" tabIndex={-1} />
            <Button variant="soft" icon={Upload} loading={importing} onClick={() => fileInputRef.current?.click()}>
              Import CSV
            </Button>
            <Button variant="soft" icon={Download} onClick={exportToCSV} title="Export the listings on this page">
              Export CSV
            </Button>
            <Button variant="ink" icon={Plus} onClick={() => setFormState({})}>
              Add job
            </Button>
          </>
        }
      />

      {/* ── Stat tiles ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <FilterTile tone="ink" icon={Briefcase} label="Active listings" value={statValue('totalJobs')} sub={statsError ? 'Stats unavailable' : 'Live on the jobs board'} loading={statsLoading} active={filterType === 'all'} onClick={() => changeFilterType('all')} />
        <FilterTile icon={Pin} label="Pinned" value={statValue('pinnedJobs')} sub="Forced to the top" loading={statsLoading} active={filterType === 'pinned'} onClick={() => changeFilterType('pinned')} />
        <FilterTile tone="lime" icon={Star} label="Featured" value={statValue('featuredJobs')} sub="Highlighted to candidates" loading={statsLoading} active={filterType === 'featured'} onClick={() => changeFilterType('featured')} />
        <FilterTile tone="stone" icon={Archive} label="Archived" value={statValue('archivedJobs')} sub="Hidden from candidates" loading={statsLoading} active={filterType === 'archived'} onClick={() => changeFilterType('archived')} />
      </div>

      {/* ── Filters & layout toggle ──────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-[1_1_260px]">
            <Input
              icon={Search}
              type="search"
              aria-label="Search listings"
              placeholder="Search by job title or company…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select
            aria-label="Contract type"
            className="w-full sm:w-52"
            value={contractType}
            onChange={(e) => { setContractType(e.target.value); setPage(1); }}
          >
            <option value="all">All contract types</option>
            {CONTRACT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented ariaLabel="Posting filter" options={filterOptions} value={filterType} onChange={changeFilterType} />
          <Segmented
            ariaLabel="Layout"
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'table', label: 'Table', icon: List },
              { value: 'cards', label: 'Cards', icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────── */}
      <section className="space-y-3" aria-label="Job listings">
        {selectedJobIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-r18 bg-stone px-4 py-2.5">
            <span className="mr-1 text-[14px] font-medium tabular">{selectedJobIds.length} selected</span>
            <Dropdown
              align="left"
              trigger={({ open, toggle }) => (
                <Button variant="ink" size="sm" iconRight={ChevronDown} onClick={toggle} loading={bulkPending} aria-expanded={open} aria-haspopup="menu">
                  Bulk actions
                </Button>
              )}
            >
              {({ close }) => (
                <div className="py-1.5">
                  {BULK_ACTIONS.map(({ action, label, icon }) => (
                    <MenuItem key={action} icon={icon} disabled={bulkPending} onClick={() => { close(); handleBulkAction(action); }}>
                      {label}
                    </MenuItem>
                  ))}
                  <div className="my-1.5 border-t border-line-2" />
                  <MenuItem icon={Trash2} tone="danger" disabled={bulkPending} onClick={() => { close(); handleBulkAction('delete'); }}>
                    Delete listings
                  </MenuItem>
                </div>
              )}
            </Dropdown>
            <Button variant="ghost" size="sm" onClick={() => setSelectedJobIds([])}>Clear selection</Button>
          </div>
        ) : (
          !loadError && (
            <p className="mono-label text-muted" aria-live="polite">
              {loading ? 'Loading listings…' : `${data.total} listing${data.total === 1 ? '' : 's'}${hasFilters ? ' match' : ''}`}
            </p>
          )
        )}

        {loadError ? (
          <ErrorState
            title="Couldn’t load job listings"
            description={getErrorMessage(loadError, 'The jobs service did not respond.')}
            onRetry={handleUpdate}
          />
        ) : !loading && data.jobs.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No listings match"
              description="Try a different search term, contract type or posting filter."
              action={<Button variant="soft" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No job listings yet"
              description="Add a listing by hand, or import a CSV with title, company and description columns."
              action={
                <>
                  <Button variant="ink" icon={Plus} onClick={() => setFormState({})}>Add job</Button>
                  <Button variant="soft" icon={Upload} onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
                </>
              }
            />
          )
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="space-y-3 p-5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-14" />
                  </Card>
                ))
              : data.jobs.map((job) => {
                  const isChecked = selectedJobIds.includes(job._id);
                  return (
                    <Card key={job._id} className={cn('flex flex-col p-5 transition-colors', isChecked && 'border-ink/40 bg-brand-50/40')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ContractPill type={job.contractType} />
                          <JobFlags job={job} className="contents" />
                        </div>
                        <Checkbox checked={isChecked} onChange={() => handleSelectRow(job._id)} aria-label={`Select ${job.title}`} />
                      </div>
                      <button type="button" onClick={() => setPreviewJob(job)} className="mt-3 text-left">
                        <h3 className="line-clamp-2 text-[16px] font-medium leading-snug tracking-tight1 transition-colors hover:text-brand-600">{job.title}</h3>
                      </button>
                      <p className="mt-1 text-[13.5px] text-muted-strong">{job.company}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                        <MapPin size={13} aria-hidden="true" /> {job.location || '—'}
                      </p>
                      <p className="mb-4 mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-muted">{job.description}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-2 pt-3">
                        <span className="font-mono text-[10.5px] uppercase tracking-mono text-faint">{formatDate(job.createdAt)}</span>
                        <RowActions job={job} onPreview={setPreviewJob} onEdit={openEdit} onDelete={handleDelete} />
                      </div>
                    </Card>
                  );
                })}
          </div>
        ) : (
          <TableShell minWidth={920}>
            <thead>
              <tr>
                <th className="w-12">
                  <Checkbox
                    ref={(el) => { if (el) el.indeterminate = selectedOnPage > 0 && !allOnPageSelected; }}
                    checked={allOnPageSelected}
                    onChange={handleSelectAll}
                    disabled={loading || data.jobs.length === 0}
                    aria-label="Select all listings on this page"
                  />
                </th>
                <SortHeader field="title" label="Job title" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader field="company" label="Company" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <th>Location</th>
                <th>Type</th>
                <th>Category</th>
                <SortHeader field="createdAt" label="Posted" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton className="h-[18px] w-[18px] rounded-[5px]" /></td>
                      <td><Skeleton className="h-4 w-44" /></td>
                      <td><Skeleton className="h-4 w-24" /></td>
                      <td><Skeleton className="h-4 w-20" /></td>
                      <td><Skeleton className="h-6 w-20 rounded-full" /></td>
                      <td><Skeleton className="h-4 w-20" /></td>
                      <td><Skeleton className="h-4 w-20" /></td>
                      <td><Skeleton className="ml-auto h-8 w-24 rounded-full" /></td>
                    </tr>
                  ))
                : data.jobs.map((job) => {
                    const isChecked = selectedJobIds.includes(job._id);
                    return (
                      <tr key={job._id} className={cn(isChecked && 'bg-brand-50/60')}>
                        <td>
                          <Checkbox checked={isChecked} onChange={() => handleSelectRow(job._id)} aria-label={`Select ${job.title}`} />
                        </td>
                        <td>
                          <button type="button" onClick={() => setPreviewJob(job)} className="block max-w-[280px] truncate text-left font-medium transition-colors hover:text-brand-600" title={job.title}>
                            {job.title}
                          </button>
                          <JobFlags job={job} className="mt-1.5 flex flex-wrap gap-1" />
                        </td>
                        <td className="text-muted-strong">{job.company}</td>
                        <td className="text-muted">{job.location || '—'}</td>
                        <td><ContractPill type={job.contractType} /></td>
                        <td className="text-muted">{job.category || '—'}</td>
                        <td className="whitespace-nowrap font-mono text-[12px] text-muted tabular">{formatDate(job.createdAt)}</td>
                        <td><RowActions job={job} onPreview={setPreviewJob} onEdit={openEdit} onDelete={handleDelete} /></td>
                      </tr>
                    );
                  })}
            </tbody>
          </TableShell>
        )}

        {!loadError && (
          <Pagination page={page} totalPages={data.pages} onPageChange={setPage} disabled={loading} className="pt-2" />
        )}
      </section>

      {/* ── Drawer & modals ─────────────────────────────────── */}
      <JobPreviewDrawer job={previewJob} onClose={() => setPreviewJob(null)} onEdit={openEdit} onDelete={handleDelete} />

      {formState && (
        <JobFormModal
          key={formState.job?._id || 'new'}
          job={formState.job}
          onSave={handleUpdate}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
