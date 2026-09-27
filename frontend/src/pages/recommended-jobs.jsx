import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Building2, ExternalLink, FileText, MapPin, Play, SearchX, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsAPI, resumeAPI } from '@/services/api';
import { Button, Card, EmptyState, ErrorState, Modal, PageHeader, Pill, SkeletonList } from '@/components/ui';
import { getErrorMessage } from '@/utils';
import { safeExternalUrl } from '@/lib/external-url';

function salaryOf(job) {
  const v = job.salaryMin || job.salaryMax;
  return v ? `£${Math.round(v).toLocaleString('en-GB')}` : null;
}

export default function RecommendedJobs() {
  const navigate = useNavigate();
  const [generatingId, setGeneratingId] = useState(null);
  const [questionsModal, setQuestionsModal] = useState(null); // { title, company, questions, job }

  // 1) resumes (a resume is required for matching), 2) recommendations
  const resumes = useQuery({ queryKey: ['resumes'], queryFn: () => resumeAPI.getAll().then((r) => r.data.resumes || []) });
  const hasResume = (resumes.data?.length ?? 0) > 0;
  const recs = useQuery({
    queryKey: ['jobs', 'recommended'],
    queryFn: () => jobsAPI.getRecommended().then((r) => r.data),
    enabled: hasResume,
  });
  const jobs = recs.data?.results || [];
  const loading = resumes.isLoading || (hasResume && recs.isLoading);
  const error = resumes.error || recs.error;

  const keyOf = (job) => job.adzunaId || job._id;

  const handlePreviewQuestions = async (job) => {
    setGeneratingId(keyOf(job));
    const toastId = toast.loading('Writing sample questions from the job description…');
    try {
      const { data } = await jobsAPI.generateQuestionsDirect({ jobTitle: job.title, jobDescription: job.description });
      toast.dismiss(toastId);
      setQuestionsModal({ title: job.title, company: job.company, questions: data.questions || [], job });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t generate questions'), { id: toastId });
    } finally {
      setGeneratingId(null);
    }
  };

  const practice = (job) => {
    navigate('/interviews/new', { state: { prefill: { jobTitle: job.title, company: job.company || '', jobDescription: job.description || '' } } });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Prepare · Role match"
        title="Roles that match you"
        description="Listings scored against the skills in your default resume. We show roles where at least 60% of the required skills match."
        actions={<Button to="/jobs" variant="soft">Browse all jobs</Button>}
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState title="Couldn’t load recommendations" description={getErrorMessage(error)} onRetry={() => { resumes.refetch(); recs.refetch(); }} />
      ) : !hasResume ? (
        <EmptyState
          icon={FileText}
          title="Upload a resume to unlock matches"
          description="We compare the skills in your resume with each listing’s requirements."
          action={<Button to="/resumes" variant="lime">Upload resume</Button>}
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No strong matches yet"
          description={recs.data?.message || 'No listings match at least 60% of your resume skills right now. Try the full job board or refresh your resume.'}
          action={<Button to="/jobs" variant="ink">Browse all jobs</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {jobs.map((job) => {
            const salary = salaryOf(job);
            const link = safeExternalUrl(job.redirectUrl) || safeExternalUrl(job.applyUrl);
            return (
              <li key={keyOf(job)}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-[17px] font-medium leading-snug tracking-tight1">{job.title}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted"><Building2 size={14} aria-hidden="true" /> {job.company}</p>
                    </div>
                    <Pill tone={job.matchScore >= 80 ? 'lime' : 'blue'} className="flex-shrink-0 tabular">{job.matchScore}% match</Pill>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {job.location && <Pill tone="stone" icon={MapPin}><span className="max-w-[160px] truncate">{job.location}</span></Pill>}
                    {salary && <Pill tone="ok" icon={Banknote}>{salary}</Pill>}
                  </div>
                  <p className="mt-4 line-clamp-3 flex-1 text-[14px] leading-relaxed text-muted-strong">{job.description || 'No description provided.'}</p>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-line-2 pt-4">
                    <Button size="sm" variant="ink" icon={Play} onClick={() => practice(job)}>Practice</Button>
                    <Button size="sm" variant="soft" icon={Wand2} loading={generatingId === keyOf(job)} disabled={!!generatingId} onClick={() => handlePreviewQuestions(job)}>
                      Sample questions
                    </Button>
                    {link && <Button size="sm" variant="ghost" href={link} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink}>View job</Button>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!questionsModal}
        onClose={() => setQuestionsModal(null)}
        size="lg"
        title="Sample questions"
        description={questionsModal ? `For ${questionsModal.title}${questionsModal.company ? ` at ${questionsModal.company}` : ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuestionsModal(null)}>Close</Button>
            <Button variant="lime" icon={Play} onClick={() => practice(questionsModal.job)}>Practice this role</Button>
          </>
        }
      >
        {questionsModal?.questions.length ? (
          <ol className="space-y-2">
            {questionsModal.questions.map((q, i) => (
              <li key={i} className="flex gap-3 rounded-r18 bg-paper p-4">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] text-lime">{i + 1}</span>
                <p className="text-[14.5px] leading-relaxed">{q}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-[14px] text-muted">No questions came back. Please try again.</p>
        )}
      </Modal>
    </div>
  );
}
