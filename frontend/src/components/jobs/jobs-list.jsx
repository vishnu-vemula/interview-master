import { memo } from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState, Pagination, Skeleton } from '@/components/ui';
import { cn } from '@/utils';
import JobCard from './job-card';

function JobSkeleton() {
  return (
    <div className="card flex h-full flex-col p-5" aria-hidden="true">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-4 flex gap-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-24 rounded-full" /></div>
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
      <Skeleton className="mt-6 h-8 w-full" />
    </div>
  );
}

const JobsList = memo(function JobsList({ jobs = [], loading = false, page, totalPages, onPageChange, onSelectJob, searchQuery = '', onClearFilters }) {
  if (loading && jobs.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="status" aria-label="Loading jobs">
        {Array.from({ length: 6 }).map((_, i) => <JobSkeleton key={i} />)}
      </div>
    );
  }

  if (!loading && jobs.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No jobs match"
        description="Try a broader keyword, a different location or fewer filters."
        action={onClearFilters && <button type="button" className="btn btn-soft btn-sm" onClick={onClearFilters}>Clear search & filters</button>}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className={cn('grid grid-cols-1 gap-3 transition-opacity md:grid-cols-2', loading && 'opacity-60')} aria-busy={loading}>
        {jobs.map((job, idx) => (
          <JobCard key={job.id || idx} job={job} onClick={() => onSelectJob?.(job)} searchQuery={searchQuery} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} disabled={loading} />
    </div>
  );
});

export default JobsList;
