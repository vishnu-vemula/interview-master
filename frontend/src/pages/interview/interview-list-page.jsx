import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Play, Plus, RotateCcw, Search, Trash2, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { interviewAPI } from '@/services/api';
import {
  Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Pill, Segmented, SkeletonList, useConfirm,
} from '@/components/ui';
import { formatDate, getErrorMessage } from '@/utils';

const PAGE_SIZE = 50;

const STATUS = {
  draft: { label: 'Needs questions', tone: 'stone' },
  ready: { label: 'Ready', tone: 'blue' },
  in_progress: { label: 'In progress', tone: 'lime' },
  completed: { label: 'Completed', tone: 'ok' },
};

const GENERATION = {
  pending: { label: 'Not generated', tone: 'outline' },
  generating: { label: 'Generating…', tone: 'blue' },
  failed: { label: 'Generation failed', tone: 'coral' },
};

function primaryAction(interview) {
  const to = `/interviews/${interview._id}/session`;
  if (interview.generationStatus !== 'generated') return { to, label: 'Generate', icon: Wand2, variant: 'outline' };
  if (interview.status === 'in_progress') return { to, label: 'Resume', icon: Play, variant: 'lime' };
  if (interview.status === 'completed') return { to, label: 'Practice again', icon: RotateCcw, variant: 'outline' };
  return { to, label: 'Start', icon: Play, variant: 'ink' };
}

export default function InterviewListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['interviews', { page, limit: PAGE_SIZE }],
    queryFn: () => interviewAPI.getAll({ page, limit: PAGE_SIZE }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
  const interviews = data?.interviews || [];

  const counts = useMemo(() => {
    const c = { all: interviews.length, ready: 0, in_progress: 0, completed: 0, draft: 0 };
    interviews.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [interviews]);

  const filtered = interviews.filter((i) => {
    const q = search.trim().toLowerCase();
    const matches = !q || i.jobTitle?.toLowerCase().includes(q) || i.company?.toLowerCase().includes(q);
    return matches && (filter === 'all' || i.status === filter);
  });

  const handleDelete = async (interview) => {
    const ok = await confirm({
      title: 'Delete this interview?',
      description: `“${interview.jobTitle}” and its questions will be removed. Completed reports stay in your history.`,
      confirmLabel: 'Delete interview',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(interview._id);
    try {
      await interviewAPI.delete(interview._id);
      toast.success('Interview deleted');
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t delete the interview'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Practice"
        title="Interviews"
        description={data ? `${data.total} interview${data.total === 1 ? '' : 's'} tailored to the roles you’re going for.` : 'Every interview is tailored to one role and your resume.'}
        actions={<Button to="/interviews/new" variant="lime" icon={Plus}>New interview</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          ariaLabel="Filter interviews by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'ready', label: 'Ready', count: counts.ready },
            { value: 'in_progress', label: 'In progress', count: counts.in_progress },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'draft', label: 'Drafts', count: counts.draft },
          ]}
        />
        <div className="w-full lg:max-w-xs">
          <Input
            icon={Search}
            type="search"
            aria-label="Search interviews"
            placeholder="Search by role or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState title="Couldn’t load interviews" description={getErrorMessage(error)} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        interviews.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No interviews yet"
            description="Paste a job description and we’ll build a mock interview for that exact role."
            action={<Button to="/interviews/new" variant="lime" icon={Plus}>Create your first interview</Button>}
          />
        ) : (
          <EmptyState
            compact
            icon={Search}
            title="Nothing matches"
            description="Try a different search term or status."
            action={<Button variant="soft" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Button>}
          />
        )
      ) : (
        <ul className="space-y-3" aria-busy={isFetching}>
          {filtered.map((interview) => {
            const status = STATUS[interview.status] || STATUS.draft;
            const gen = GENERATION[interview.generationStatus];
            const action = primaryAction(interview);
            return (
              <li key={interview._id}>
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-r14 bg-stone-2 text-ink">
                      <Briefcase size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[17px] font-medium tracking-tight1">{interview.jobTitle}</h2>
                        <Pill tone={status.tone}>{status.label}</Pill>
                        {gen && interview.status === 'draft' && <Pill tone={gen.tone}>{gen.label}</Pill>}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-2 text-[13.5px] text-muted">
                        {interview.company && <span>{interview.company}</span>}
                        {interview.company && <span aria-hidden="true">·</span>}
                        <span className="capitalize">{interview.experienceLevel} level</span>
                        <span aria-hidden="true">·</span>
                        <span>{interview.numberOfQuestions} questions</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(interview.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Delete ${interview.jobTitle}`}
                      title="Delete"
                      loading={deleting === interview._id}
                      onClick={() => handleDelete(interview)}
                      className="hover:bg-coral-soft hover:text-coral"
                    />
                    <Button to={action.to} variant={action.variant} icon={action.icon}>{action.label}</Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} disabled={isFetching} />
    </div>
  );
}
