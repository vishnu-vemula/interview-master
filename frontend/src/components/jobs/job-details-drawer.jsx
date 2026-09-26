import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Banknote, Building2, Calendar, ExternalLink, MapPin, Play } from 'lucide-react';
import { jobsAPI } from '@/services/api';
import { Button, Drawer, Pill, Skeleton } from '@/components/ui';
import { formatDate } from '@/utils';
import { contractLabel } from './job-card';

/**
 * JobDetailsDrawer — list data immediately; full Adzuna details are fetched only for
 * Adzuna-sourced jobs (numeric ids — the only ids GET /api/jobs/:id accepts).
 */
export default function JobDetailsDrawer({ job, onClose }) {
  const navigate = useNavigate();
  const isAdzunaId = /^\d+$/.test(String(job?.id || ''));

  const { data: detail, isLoading } = useQuery({
    queryKey: ['job', job?.id],
    queryFn: () => jobsAPI.getById(job.id).then((r) => r.data?.data ?? r.data),
    enabled: !!job && isAdzunaId,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (!job) return null;
  const d = { ...job, ...(detail && typeof detail === 'object' ? detail : {}) };
  const link = d.apply_url || d.url;
  const posted = d.posted_at || d.postedTime;
  const description = d.description || d.summary || 'No detailed description was provided by the employer.';
  const skills = Array.isArray(d.skills) ? d.skills : [];

  const practice = () => {
    navigate('/interviews/new', {
      state: { prefill: { jobTitle: d.title, company: d.company !== 'Not Specified' ? d.company : '', jobDescription: d.description || d.summary || '' } },
    });
  };

  return (
    <Drawer
      open={!!job}
      onClose={onClose}
      title={d.title}
      subtitle={<span className="flex items-center gap-1.5"><Building2 size={14} aria-hidden="true" /> {d.company}</span>}
      footer={
        <>
          <Button variant="soft" icon={Play} onClick={practice}>Practice for this role</Button>
          {link && <Button href={link} target="_blank" rel="noopener noreferrer" variant="lime" iconRight={ExternalLink}>Apply</Button>}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {d.location && (
          <div className="rounded-r18 bg-white p-4">
            <p className="mono-label flex items-center gap-1 text-muted"><MapPin size={12} aria-hidden="true" /> Location</p>
            <p className="mt-1.5 text-[14px] font-medium">{d.location}</p>
          </div>
        )}
        {d.salary && (
          <div className="rounded-r18 bg-lime-soft p-4">
            <p className="mono-label flex items-center gap-1 text-lime-ok"><Banknote size={12} aria-hidden="true" /> Salary</p>
            <p className="mt-1.5 text-[14px] font-medium">{d.salary}</p>
          </div>
        )}
        <div className="rounded-r18 bg-white p-4">
          <p className="mono-label flex items-center gap-1 text-muted"><Calendar size={12} aria-hidden="true" /> Posted</p>
          <p className="mt-1.5 text-[14px] font-medium">{posted ? formatDate(posted) : 'Recently'}</p>
        </div>
      </div>

      {(contractLabel(d.contractType) || d.category) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {d.contractType && contractLabel(d.contractType) && <Pill tone="outline">{contractLabel(d.contractType)}</Pill>}
          {d.category && <Pill tone="stone">{d.category}</Pill>}
        </div>
      )}

      {skills.length > 0 && (
        <section className="mt-6">
          <p className="mono-label mb-2 text-muted">Skills</p>
          <div className="flex flex-wrap gap-1.5">{skills.map((s) => <Pill key={s} tone="blue">{s}</Pill>)}</div>
        </section>
      )}

      <section className="mt-6">
        <p className="mono-label mb-2 text-muted">Description</p>
        {isAdzunaId && isLoading ? (
          <div className="space-y-2"><Skeleton className="h-4" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /></div>
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{description}</p>
        )}
      </section>
    </Drawer>
  );
}
