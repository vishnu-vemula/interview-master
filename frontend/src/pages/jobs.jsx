import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import SearchBar from '@/components/jobs/search-bar';
import FiltersPanel from '@/components/jobs/filters-panel';
import JobsList from '@/components/jobs/jobs-list';
import JobDetailsDrawer from '@/components/jobs/job-details-drawer';
import { useJobs } from '@/hooks/use-jobs';
import { ErrorState, PageHeader } from '@/components/ui';
import { getErrorMessage } from '@/utils';

const INITIAL = { q: '', where: '', page: 1, salaryMin: 0, jobType: '' };

export default function JobsPage() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchParams, setSearchParams] = useState(INITIAL);
  const [searchKey, setSearchKey] = useState(0); // remounts the search bar when filters are cleared

  const { data, isLoading, isError, error, isPlaceholderData, refetch } = useJobs(searchParams);
  const jobs = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;
  const total = data?.meta?.total ?? 0;

  const handleSearch = (next) => setSearchParams((prev) => ({ ...prev, ...next, page: 1 }));
  const handleFilterApply = (filters) => setSearchParams((prev) => ({ ...prev, ...filters, page: 1 }));
  const handlePageChange = (page) => {
    setSearchParams((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clearAll = () => { setSearchParams(INITIAL); setSearchKey((k) => k + 1); };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Prepare"
        title="Job board"
        description="Find a role, see what it asks for, and practise for it — open any listing to turn it into a tailored interview."
        actions={<Link to="/jobs/recommended" className="btn btn-soft"><Sparkles size={16} aria-hidden="true" /> Matched to my resume</Link>}
      />

      <SearchBar key={searchKey} onSearch={handleSearch} initialQuery={searchParams.q} initialLocation={searchParams.where} isFetching={isLoading || isPlaceholderData} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <FiltersPanel filters={{ salaryMin: searchParams.salaryMin, jobType: searchParams.jobType }} onApply={handleFilterApply} />
        </aside>
        <section aria-label="Results" className="min-w-0">
          {!isError && !isLoading && (
            <p className="mono-label mb-3 text-muted">{total.toLocaleString()} role{total === 1 ? '' : 's'}{searchParams.q ? ` for “${searchParams.q}”` : ''}</p>
          )}
          {isError ? (
            <ErrorState title="Couldn’t load jobs" description={getErrorMessage(error, 'The job board is unavailable right now.')} onRetry={refetch} />
          ) : (
            <JobsList
              jobs={jobs}
              loading={isLoading || isPlaceholderData}
              page={searchParams.page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onSelectJob={setSelectedJob}
              searchQuery={searchParams.q}
              onClearFilters={clearAll}
            />
          )}
        </section>
      </div>

      {selectedJob && <JobDetailsDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}
