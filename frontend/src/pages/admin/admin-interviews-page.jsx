/**
 * AdminInterviewsPage — interviews & templates manager.
 *  - Candidate interviews tab: audit log of generated mock interviews (GET /admin/interviews,
 *    DELETE /admin/interviews/:id — super admin only; also removes the interview's sessions).
 *  - AI templates tab: CRUD for interview templates — prompts, difficulty, duration and voice presets
 *    (GET/POST/PATCH/DELETE /admin/templates).
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Briefcase, Clock, Edit3, Eye, FileText, Globe, MessageSquare, Plus, RefreshCw, Sparkles, Trash2, Volume2,
} from 'lucide-react';
import {
  getAdminInterviews, deleteAdminInterview,
  getAdminTemplates, deleteAdminTemplate,
} from '@/services/admin.service';
import {
  Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Pill, Segmented, Skeleton, TableShell, useConfirm,
} from '@/components/ui';
import { formatDate, getErrorMessage, timeAgo } from '@/utils';
import { DifficultyPill, STATUS_TONE, humanize } from './admin-interviews/template-meta';
import PromptPreviewModal from './admin-interviews/prompt-preview-modal';
import TemplateFormModal from './admin-interviews/template-form-modal';

const INTERVIEWS_PAGE_SIZE = 12;
const TEMPLATES_PAGE_SIZE = 8;

function TemplateCard({ temp, onInspect, onEdit, onDelete }) {
  const meta = [
    { icon: Clock, label: 'Duration', value: `${temp.duration ?? '—'} min` },
    { icon: FileText, label: 'Questions', value: `${temp.questionCount ?? '—'} Qs` },
    { icon: Globe, label: 'Language', value: (temp.language || '—').toUpperCase() },
    { icon: Volume2, label: 'Voice', value: `${temp.voiceId ? temp.voiceId.charAt(0).toUpperCase() + temp.voiceId.slice(1) : '—'} · ${Number(temp.voiceSpeed || 1).toFixed(1)}×` },
  ];
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <DifficultyPill difficulty={temp.difficulty} />
        <span className="font-mono text-[10.5px] uppercase tracking-mono text-faint" title={formatDate(temp.createdAt)}>
          {timeAgo(temp.createdAt) || '—'}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-[16px] font-medium leading-snug tracking-tight1" title={temp.name}>{temp.name}</h3>
      {temp.postedBy?.name && <p className="mt-1 text-[13px] text-muted">By {temp.postedBy.name}</p>}

      <dl className="mb-4 mt-4 grid grid-cols-2 gap-2">
        {meta.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-r14 bg-paper px-3 py-2.5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-mono text-muted">
              <Icon size={11} aria-hidden="true" /> {label}
            </dt>
            <dd className="mt-1 truncate text-[13.5px] text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-2 pt-3">
        <Button variant="ghost" size="sm" icon={Eye} onClick={() => onInspect(temp)} className="-ml-2">
          Prompts
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" iconOnly icon={Edit3} aria-label={`Edit ${temp.name}`} title="Edit template" onClick={() => onEdit(temp)} />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Trash2}
            aria-label={`Delete ${temp.name}`}
            title="Delete template"
            className="hover:bg-coral-soft hover:text-coral"
            onClick={() => onDelete(temp)}
          />
        </div>
      </div>
    </Card>
  );
}

// ─── Main View Controller ─────────────────────────────────────────
export default function AdminInterviewsPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews' | 'templates'

  // Tab 1: candidate interviews
  const [data, setData] = useState({ interviews: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [interviewsError, setInterviewsError] = useState(null);
  const [interviewsLoaded, setInterviewsLoaded] = useState(false);

  // Tab 2: templates CRUD
  const [templates, setTemplates] = useState([]);
  const [tempPage, setTempPage] = useState(1);
  const [tempTotal, setTempTotal] = useState(0);
  const [tempPages, setTempPages] = useState(1);
  const [templatesError, setTemplatesError] = useState(null);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [activeInspector, setActiveInspector] = useState(null);
  const [activeFormTemplate, setActiveFormTemplate] = useState(null);
  const [tempAddOpen, setTempAddOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  // ─── Fetch candidate interviews ──────────────────────────────────
  const fetchInterviews = useCallback(async () => {
    try {
      const d = await getAdminInterviews({ page, limit: INTERVIEWS_PAGE_SIZE });
      setData({ interviews: d?.interviews || [], total: d?.total || 0, pages: d?.pages || 1 });
      setInterviewsError(null);
      setInterviewsLoaded(true);
    } catch (err) {
      setInterviewsError(err);
    }
  }, [page]);

  // ─── Fetch templates ─────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await getAdminTemplates({ page: tempPage, limit: TEMPLATES_PAGE_SIZE });
      setTemplates(res?.templates || []);
      setTempTotal(res?.total || 0);
      setTempPages(res?.pages || 1);
      setTemplatesError(null);
      setTemplatesLoaded(true);
    } catch (err) {
      setTemplatesError(err);
    }
  }, [tempPage]);

  // Loader dispatcher
  const loadActiveData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'interviews') {
      await fetchInterviews();
    } else {
      await fetchTemplates();
    }
    setLoading(false);
  }, [activeTab, fetchInterviews, fetchTemplates]);

  useEffect(() => {
    loadActiveData();
  }, [loadActiveData]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'interviews') setPage(1);
    else setTempPage(1);
  };

  const handleDeleteInterview = async (iv) => {
    const who = iv.userId?.name ? `${iv.userId.name}’s` : 'This';
    const ok = await confirm({
      title: 'Delete this interview?',
      description: `${who} mock interview for “${iv.jobTitle}” and all of its practice sessions will be permanently deleted.`,
      confirmLabel: 'Delete interview',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAdminInterview(iv._id);
      toast.success('Interview deleted.');
      if (data.interviews.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchInterviews();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Deletion failed.'));
    }
  };

  const handleDeleteTemplate = async (temp) => {
    const ok = await confirm({
      title: 'Delete this template?',
      description: `“${temp.name}” will be permanently deleted and candidates will no longer be able to pick it.`,
      confirmLabel: 'Delete template',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAdminTemplate(temp._id);
      toast.success('Interview template deleted.');
      setActiveInspector((p) => (p?._id === temp._id ? null : p));
      if (templates.length === 1 && tempPage > 1) setTempPage((p) => p - 1);
      else fetchTemplates();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Deletion failed.'));
    }
  };

  const openEditTemplate = (temp) => {
    setActiveInspector(null);
    setActiveFormTemplate(temp);
  };

  const tabs = [
    {
      value: 'interviews',
      label: <><span className="sm:hidden">Interviews</span><span className="hidden sm:inline">Candidate interviews</span></>,
      icon: Briefcase,
      count: interviewsLoaded ? data.total : undefined,
    },
    {
      value: 'templates',
      label: <><span className="sm:hidden">Templates</span><span className="hidden sm:inline">AI templates</span></>,
      icon: Sparkles,
      count: templatesLoaded ? tempTotal : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Interviews"
        title="Interviews & templates"
        description="Audit the mock interviews candidates generate, and manage the AI templates — prompts, difficulty, length and voice."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={loadActiveData} loading={loading}>
              Refresh
            </Button>
            <Button variant="ink" icon={Plus} onClick={() => setTempAddOpen(true)}>
              New template
            </Button>
          </>
        }
      />

      <Segmented ariaLabel="Interviews sections" options={tabs} value={activeTab} onChange={switchTab} />

      {/* ── TAB 1: Candidate interviews ─────────────────────── */}
      {activeTab === 'interviews' && (
        <section className="space-y-3" role="tabpanel" aria-label="Candidate interviews">
          {!interviewsError && (
            <p className="mono-label text-muted" aria-live="polite">
              {loading ? 'Loading interviews…' : `${data.total} interview${data.total === 1 ? '' : 's'}${data.total ? ' · newest first' : ''}`}
            </p>
          )}

          {interviewsError ? (
            <ErrorState
              title="Couldn’t load candidate interviews"
              description={getErrorMessage(interviewsError, 'The interviews service did not respond.')}
              onRetry={loadActiveData}
            />
          ) : !loading && data.interviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No interviews yet"
              description="When candidates generate mock interviews, they’ll be listed here with their status and question count."
            />
          ) : (
            <TableShell minWidth={860}>
              <thead>
                <tr>
                  <th>Role / company</th>
                  <th>Candidate</th>
                  <th>Level</th>
                  <th className="text-right">Questions</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="relative text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-24" /></td>
                        <td><div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></td>
                        <td><Skeleton className="h-6 w-16 rounded-full" /></td>
                        <td><Skeleton className="ml-auto h-4 w-8" /></td>
                        <td><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td><Skeleton className="h-4 w-20" /></td>
                        <td><Skeleton className="ml-auto h-8 w-8 rounded-full" /></td>
                      </tr>
                    ))
                  : data.interviews.map((iv) => (
                      <tr key={iv._id}>
                        <td>
                          <p className="max-w-[240px] truncate font-medium" title={iv.jobTitle}>{iv.jobTitle || 'Untitled role'}</p>
                          <p className="mt-0.5 text-[13px] text-muted">{iv.company || '—'}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={iv.userId?.name || '?'} size={32} tone="stone" />
                            <div className="min-w-0">
                              <p className="max-w-[200px] truncate text-[14px]">{iv.userId?.name ?? 'Deleted user'}</p>
                              <p className="max-w-[200px] truncate text-[12.5px] text-muted">{iv.userId?.email ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td><Pill tone="outline" className="capitalize">{humanize(iv.experienceLevel)}</Pill></td>
                        <td className="text-right font-medium tabular">{iv.numberOfQuestions ?? '—'}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            <Pill tone={STATUS_TONE[iv.status] || 'stone'} mono>{humanize(iv.status)}</Pill>
                            {iv.generationStatus === 'failed' && (
                              <Pill tone="coral" mono title={iv.generationError || undefined}>Generation failed</Pill>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-mono text-[12px] text-muted tabular">{formatDate(iv.createdAt)}</td>
                        <td>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Trash2}
                              aria-label={`Delete interview for ${iv.jobTitle}`}
                              title="Delete interview"
                              className="hover:bg-coral-soft hover:text-coral"
                              onClick={() => handleDeleteInterview(iv)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </TableShell>
          )}

          {!interviewsError && (
            <Pagination page={page} totalPages={data.pages} onPageChange={setPage} disabled={loading} className="pt-2" />
          )}
        </section>
      )}

      {/* ── TAB 2: AI templates ─────────────────────────────── */}
      {activeTab === 'templates' && (
        <section className="space-y-3" role="tabpanel" aria-label="AI templates">
          {!templatesError && (
            <p className="mono-label text-muted" aria-live="polite">
              {loading ? 'Loading templates…' : `${tempTotal} template${tempTotal === 1 ? '' : 's'}${tempTotal ? ' · newest first' : ''}`}
            </p>
          )}

          {templatesError ? (
            <ErrorState
              title="Couldn’t load templates"
              description={getErrorMessage(templatesError, 'The templates service did not respond.')}
              onRetry={loadActiveData}
            />
          ) : loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="space-y-3 p-5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-12 rounded-r14" />)}
                  </div>
                  <Skeleton className="h-8" />
                </Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No templates yet"
              description="Templates bundle the interviewer’s system, evaluation and feedback prompts with a difficulty, length and voice preset."
              action={<Button variant="ink" icon={Plus} onClick={() => setTempAddOpen(true)}>New template</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {templates.map((temp) => (
                <TemplateCard
                  key={temp._id}
                  temp={temp}
                  onInspect={setActiveInspector}
                  onEdit={openEditTemplate}
                  onDelete={handleDeleteTemplate}
                />
              ))}
            </div>
          )}

          {!templatesError && (
            <Pagination page={tempPage} totalPages={tempPages} onPageChange={setTempPage} disabled={loading} className="pt-2" />
          )}
        </section>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {activeInspector && (
        <PromptPreviewModal
          key={activeInspector._id}
          template={activeInspector}
          onClose={() => setActiveInspector(null)}
          onEdit={openEditTemplate}
        />
      )}

      {tempAddOpen && (
        <TemplateFormModal
          onSave={() => (activeTab === 'templates' ? fetchTemplates() : switchTab('templates'))}
          onClose={() => setTempAddOpen(false)}
        />
      )}

      {activeFormTemplate && (
        <TemplateFormModal
          key={activeFormTemplate._id}
          template={activeFormTemplate}
          onSave={fetchTemplates}
          onClose={() => setActiveFormTemplate(null)}
        />
      )}
    </div>
  );
}
