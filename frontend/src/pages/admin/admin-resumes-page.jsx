/**
 * AdminResumesPage — every resume uploaded across the platform (GET /admin/resumes),
 * paginated, with parse status and super-admin delete (DELETE /admin/resumes/:id).
 */

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ExternalLink, FileText, RefreshCw, ScanSearch, Trash2 } from 'lucide-react';
import { getAdminResumes, deleteAdminResume } from '@/services/admin.service';
import { useAdminAuth } from '@/context';
import {
  Avatar, Button, EmptyState, ErrorState, PageHeader, Pagination, Pill, Skeleton, TableShell, useConfirm,
} from '@/components/ui';
import { cn, formatDate, getErrorMessage, timeAgo } from '@/utils';

const PAGE_SIZE = 15;

const PARSE_STATUS = {
  parsed: { tone: 'ok', label: 'Parsed' },
  pending: { tone: 'blue', label: 'Pending' },
  failed: { tone: 'coral', label: 'Failed' },
};

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function AdminResumesPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useQuery({
    queryKey: ['admin-resumes', { page, limit: PAGE_SIZE }],
    queryFn: () => getAdminResumes({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const resumes = data?.resumes ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 0;

  // After a delete empties the last page, step back.
  useEffect(() => {
    if (data && data.pages > 0 && page > data.pages) setPage(data.pages);
  }, [data, page]);

  const handleDelete = async (r) => {
    const name = r.originalName || r.fileName || 'this resume';
    const ok = await confirm({
      title: 'Delete this resume?',
      description: `“${name}”${r.userId?.name ? ` uploaded by ${r.userId.name}` : ''} will be permanently removed. This can’t be undone.`,
      confirmLabel: 'Delete resume',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(r._id);
    try {
      await deleteAdminResume(r._id);
      toast.success('Resume deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ats-resumes'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t delete this resume.'));
    } finally {
      setDeletingId(null);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Resumes"
        title="Resumes"
        description={
          isLoading || total === 0
            ? 'Every resume uploaded by candidates across Rehearsly, newest first.'
            : `${total} ${total === 1 ? 'resume' : 'resumes'} uploaded by candidates across Rehearsly, newest first.`
        }
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
              Refresh
            </Button>
            <Button variant="ink" icon={ScanSearch} to="/admin/ats">
              ATS pipeline
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState
          title="Couldn’t load resumes"
          description={getErrorMessage(error, 'The resume service did not respond.')}
          onRetry={refetch}
        />
      ) : !isLoading && resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes uploaded yet"
          description="Resumes appear here as soon as candidates upload them from their workspace."
        />
      ) : (
        <div className="space-y-5">
          <TableShell minWidth={900} className={cn(isFetching && isPlaceholderData && 'opacity-60 transition-opacity')}>
            <thead>
              <tr>
                <th>File</th>
                <th>Candidate</th>
                <th>Parse status</th>
                <th>Size</th>
                <th>Default</th>
                <th>Uploaded</th>
                {isSuperAdmin && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-r9" />
                        <Skeleton className="h-3.5 w-40" />
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </td>
                    <td><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td><Skeleton className="h-4 w-14" /></td>
                    <td><Skeleton className="h-4 w-10" /></td>
                    <td><Skeleton className="h-4 w-24" /></td>
                    {isSuperAdmin && <td><Skeleton className="ml-auto h-8 w-8 rounded-full" /></td>}
                  </tr>
                ))
                : resumes.map((r) => {
                  const parse = PARSE_STATUS[r.parseStatus] || { tone: 'stone', label: r.parseStatus || 'Unknown' };
                  const name = r.originalName || r.fileName || 'Untitled resume';
                  return (
                    <tr key={r._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-stone-2">
                            <FileText size={15} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[240px] truncate font-medium" title={name}>{name}</p>
                            {r.fileUrl ? (
                              <a
                                href={`https://docs.google.com/viewer?url=${encodeURIComponent(r.fileUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link inline-flex items-center gap-1 text-[12.5px]"
                              >
                                View file <ExternalLink size={11} aria-hidden="true" />
                              </a>
                            ) : (
                              <p className="font-mono text-[10.5px] uppercase tracking-mono text-muted">{r.format || 'pdf'}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.userId ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.userId.name} size={28} tone="stone" />
                            <div className="min-w-0">
                              <p className="max-w-[200px] truncate text-[13.5px]">{r.userId.name ?? '—'}</p>
                              <p className="max-w-[200px] truncate text-[12.5px] text-muted">{r.userId.email ?? ''}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[13px] text-muted">Deleted account</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <Pill tone={parse.tone} mono>{parse.label}</Pill>
                          {r.parseStatus === 'parsed' && (
                            <span className={cn('font-mono text-[10px] uppercase tracking-mono', r.isParsed ? 'text-lime-ok' : 'text-muted')}>
                              {r.isParsed ? 'AI-structured' : 'Text only'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-muted tabular">{formatBytes(r.fileSize)}</td>
                      <td>
                        {r.isDefault ? <Pill tone="lime" mono>Default</Pill> : <span className="text-[13px] text-faint">—</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        <p className="whitespace-nowrap text-[13px]">{formatDate(r.createdAt)}</p>
                        <p className="whitespace-nowrap text-[12px] text-muted">{timeAgo(r.createdAt)}</p>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Trash2}
                              title="Delete resume"
                              aria-label={`Delete ${name}`}
                              loading={deletingId === r._id}
                              className="hover:bg-coral-soft hover:text-coral"
                              onClick={() => handleDelete(r)}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </TableShell>

          {!isLoading && totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="mono-label text-muted tabular">Showing {from}–{to} of {total}</p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={isFetching} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
