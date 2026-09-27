import { Banknote, Building2, ExternalLink, MapPin } from 'lucide-react';
import { Pill } from '@/components/ui';
import { CONTRACT_TYPES } from './filters-panel';
import { safeExternalUrl } from '@/lib/external-url';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlight matched keywords in text. */
export function HighlightText({ text, query }) {
  if (!query || typeof text !== 'string') return <>{text}</>;
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="rounded bg-lime px-0.5 text-ink">{part}</mark>
          : part,
      )}
    </>
  );
}

export const contractLabel = (v) => CONTRACT_TYPES.find((c) => c.value === v)?.label;

export default function JobCard({ job, onClick, searchQuery = '' }) {
  const { title, company, location, salary, summary, apply_url: applyUrl, url, contractType } = job;
  const link = safeExternalUrl(applyUrl) || safeExternalUrl(url);

  return (
    <article className="card card-interactive group relative flex h-full flex-col p-5">
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 rounded-r24 focus-visible:shadow-ring focus-visible:outline-none"
        aria-label={`View details for ${title} at ${company}`}
      />
      <div className="pointer-events-none relative">
        <h3 className="line-clamp-2 text-[17px] font-medium leading-snug tracking-tight1"><HighlightText text={title} query={searchQuery} /></h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
          <Building2 size={14} aria-hidden="true" /> <HighlightText text={company} query={searchQuery} />
        </p>
      </div>
      <div className="pointer-events-none relative mt-4 flex flex-wrap gap-1.5">
        {location && <Pill tone="stone" icon={MapPin}><span className="max-w-[160px] truncate">{location}</span></Pill>}
        {salary && <Pill tone="ok" icon={Banknote}>{salary}</Pill>}
        {contractLabel(contractType) && contractType && <Pill tone="outline">{contractLabel(contractType)}</Pill>}
      </div>
      <p className="pointer-events-none relative mt-4 line-clamp-3 flex-1 text-[14px] leading-relaxed text-muted-strong">
        <HighlightText text={summary || 'No description provided.'} query={searchQuery} />
      </p>
      <div className="relative mt-5 flex items-center justify-between border-t border-line-2 pt-4">
        <span className="mono-label text-muted">Details ↗</span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-soft btn-sm relative z-[1]"
          >
            Apply <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
