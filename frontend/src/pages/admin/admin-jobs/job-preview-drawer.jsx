/**
 * JobPreviewDrawer — read-only detail sheet for one listing, with edit / delete shortcuts.
 */

import { DollarSign, Edit3, ExternalLink, MapPin, Tag, Trash2 } from 'lucide-react';
import { Button, Drawer } from '@/components/ui';
import { formatDateTime } from '@/utils';
import { ContractPill, JobFlags, formatSalary } from './job-meta';
import { safeExternalUrl } from '@/lib/external-url';

function MetaRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="mono-label text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[14px] text-ink">{children}</dd>
    </div>
  );
}

export default function JobPreviewDrawer({ job, onClose, onEdit, onDelete }) {
  const salary = formatSalary(job);

  return (
    <Drawer
      open={!!job}
      onClose={onClose}
      title={job?.title}
      subtitle={job?.company}
      footer={
        job && (
          <>
            <Button variant="danger" icon={Trash2} onClick={() => onDelete(job)}>
              Delete
            </Button>
            <Button variant="ink" icon={Edit3} onClick={() => onEdit(job)}>
              Edit listing
            </Button>
          </>
        )
      }
    >
      {job && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ContractPill type={job.contractType} />
            <JobFlags job={job} className="contents" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="card-inset flex items-center gap-3 px-4 py-3">
              <MapPin size={16} className="flex-shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="mono-label text-muted">Location</p>
                <p className="truncate text-[14px]">{job.location || '—'}</p>
              </div>
            </div>
            <div className="card-inset flex items-center gap-3 px-4 py-3">
              <Tag size={16} className="flex-shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="mono-label text-muted">Category</p>
                <p className="truncate text-[14px]">{job.category || '—'}</p>
              </div>
            </div>
          </div>

          {salary && (
            <div className="flex items-center gap-3 rounded-r18 bg-lime-soft px-4 py-3.5">
              <DollarSign size={18} className="flex-shrink-0 text-lime-ok" aria-hidden="true" />
              <div>
                <p className="mono-label text-lime-ok">Salary range</p>
                <p className="text-[15px] font-medium tabular">{salary}</p>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[15px] font-medium tracking-tight1">Job description</h3>
            <div className="card whitespace-pre-wrap break-words px-4 py-4 text-[14px] leading-relaxed text-muted-strong">
              {job.description || 'No description provided.'}
            </div>
          </section>

          {safeExternalUrl(job.applyUrl) && (
            <Button variant="blue" href={safeExternalUrl(job.applyUrl)} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink} className="w-full justify-center">
              Open apply link
            </Button>
          )}

          <dl className="card divide-y divide-line-2 px-4">
            <MetaRow label="Posted by">{job.postedBy?.name || 'Admin'}</MetaRow>
            <MetaRow label="Created">{formatDateTime(job.createdAt)}</MetaRow>
            {job.updatedAt && <MetaRow label="Updated">{formatDateTime(job.updatedAt)}</MetaRow>}
          </dl>
        </div>
      )}
    </Drawer>
  );
}
