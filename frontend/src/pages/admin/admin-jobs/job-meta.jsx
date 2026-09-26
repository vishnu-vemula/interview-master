/**
 * Shared job-listing metadata for the admin jobs page: contract types, filter options,
 * contract/flag pills and salary formatting.
 *
 * Note: <Pill> builds its class as `pill-${tone}`, which Tailwind's JIT cannot see. The tones used
 * here are listed literally so their component classes are generated:
 * pill-lime pill-ink pill-ok pill-outline pill-blue pill-stone pill-coral
 */

import { Archive, Pin, Star } from 'lucide-react';
import { Pill } from '@/components/ui';

export const CONTRACT_TYPES = [
  { value: 'full_time', label: 'Full time', tone: 'blue' },
  { value: 'part_time', label: 'Part time', tone: 'stone' },
  { value: 'contract', label: 'Contract', tone: 'outline' },
  { value: 'internship', label: 'Internship', tone: 'ok' },
  { value: 'temporary', label: 'Temporary', tone: 'stone' },
];

export const POSTING_FILTERS = [
  { value: 'all', label: <><span className="sm:hidden">All</span><span className="hidden sm:inline">All postings</span></> },
  { value: 'featured', label: 'Featured', icon: Star },
  { value: 'pinned', label: 'Pinned', icon: Pin },
  { value: 'archived', label: 'Archived', icon: Archive },
];

export function ContractPill({ type }) {
  const match = CONTRACT_TYPES.find((c) => c.value === type);
  if (!match) return <Pill tone="stone" mono>{type ? String(type).replace(/_/g, ' ') : '—'}</Pill>;
  return <Pill tone={match.tone} mono>{match.label}</Pill>;
}

/** Pinned / featured / archived markers. */
export function JobFlags({ job, className }) {
  if (!job?.isPinned && !job?.isFeatured && !job?.isArchived) return null;
  return (
    <span className={className ?? 'inline-flex flex-wrap gap-1'}>
      {job.isPinned && <Pill tone="ink" icon={Pin}>Pinned</Pill>}
      {job.isFeatured && <Pill tone="lime" icon={Star}>Featured</Pill>}
      {job.isArchived && <Pill tone="stone" icon={Archive}>Archived</Pill>}
    </span>
  );
}

const fmtAmount = (n) => (n || n === 0 ? `$${Number(n).toLocaleString()}` : '—');

/** "$80,000 – $120,000", or null when neither bound is set. */
export function formatSalary(job) {
  if (!job?.salaryMin && !job?.salaryMax) return null;
  return `${fmtAmount(job.salaryMin)} – ${fmtAmount(job.salaryMax)}`;
}
