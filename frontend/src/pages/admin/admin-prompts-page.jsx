/**
 * AdminPromptsPage — system prompt editor with version control.
 *
 * Left: prompt categories (GET /admin/prompts — the API seeds defaults on first load).
 * Right: editor for the selected prompt (GET/PATCH /admin/prompts/:id), a live preview that
 * interpolates `${variable}` placeholders with sample values, and the version history with
 * restore (POST /admin/prompts/:id/restore).
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  FileCode, History, RefreshCw, Save, Eye, EyeOff, CheckCircle2, RotateCcw, Braces, ChevronDown, Lock, Undo2,
} from 'lucide-react';
import {
  getAdminPrompts, getAdminPrompt, updateAdminPrompt, restoreAdminPromptVersion,
} from '@/services/admin.service';
import { useAdminAuth } from '@/context';
import {
  Alert, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Pill, Select, Skeleton, Textarea, useConfirm,
} from '@/components/ui';
import { cn, formatDateTime, getErrorMessage, timeAgo } from '@/utils';

const PREVIEW_FIELDS = [
  { key: 'jobTitle', label: 'Job title' },
  { key: 'expectedKeywordsText', label: 'Expected keywords' },
  { key: 'questionText', label: 'Question', wide: true },
  { key: 'answerText', label: 'Candidate answer', wide: true },
  { key: 'summary', label: 'Feedback summary', wide: true, multiline: true },
];

const VAR_RE = /\$\{(\w+)\}/g;

const categoryLabel = (c) => (c ? c.replace(/_/g, ' ') : 'uncategorised');

function editorName(h) {
  if (h?.updatedBy && typeof h.updatedBy === 'object') return h.updatedBy.name || h.updatedBy.email || 'Admin';
  if (h?.updatedBy) return 'Admin';
  return 'System';
}

/** Interpolate `${key}` with sample values; highlight substitutions and unresolved placeholders. */
function renderPreview(content, vars) {
  const parts = [];
  let last = 0;
  let i = 0;
  VAR_RE.lastIndex = 0;
  let m = VAR_RE.exec(content);
  while (m) {
    if (m.index > last) parts.push(<Fragment key={`t${i++}`}>{content.slice(last, m.index)}</Fragment>);
    const key = m[1];
    parts.push(
      vars[key] !== undefined ? (
        <mark key={`v${i++}`} className="rounded-[4px] bg-lime-soft px-0.5 text-lime-ink">{vars[key]}</mark>
      ) : (
        <span key={`u${i++}`} className="rounded-[4px] bg-coral-bg px-0.5 text-coral" title="No sample value for this placeholder">{m[0]}</span>
      ),
    );
    last = m.index + m[0].length;
    m = VAR_RE.exec(content);
  }
  if (last < content.length) parts.push(<Fragment key={`t${i++}`}>{content.slice(last)}</Fragment>);
  return parts;
}

function CollapsibleHeader({ icon: Icon, title, caption, open, onToggle, controls }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-stone-2 text-ink">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-medium tracking-tight1">{title}</h2>
          {caption && <p className="truncate text-[13px] text-muted">{caption}</p>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        iconRight={ChevronDown}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className={cn('flex-shrink-0 [&>svg]:transition-transform', open && '[&>svg]:rotate-180')}
      >
        {open ? 'Hide' : 'Show'}
      </Button>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <Card className="p-5 sm:p-6" role="status" aria-label="Loading prompt">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-r14" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-56 max-w-full" /><Skeleton className="h-3 w-80 max-w-full" /></div>
      </div>
      <Skeleton className="mt-6 h-3.5 w-32" />
      <Skeleton className="mt-2 h-[340px] rounded-r14" />
      <Skeleton className="mt-5 h-12 rounded-r14" />
    </Card>
  );
}

export default function AdminPromptsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('update:prompts');

  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Form inputs
  const [content, setContent] = useState('');
  const [reason, setReason] = useState('');
  const [contentError, setContentError] = useState('');
  const [serverError, setServerError] = useState('');

  // Live preview sample values
  const [previewVars, setPreviewVars] = useState({
    jobTitle: 'Senior React Developer',
    questionText: 'What is the difference between useMemo and useCallback in React?',
    expectedKeywordsText: 'memoization, function reference, performance optimization',
    answerText: 'useMemo memoizes the computed value of a function, whereas useCallback memoizes the actual function reference itself.',
    summary: 'Q1: What is memoization?\nScore: 9/10\nAnswer: Memoization caches function results based on inputs.',
  });
  const [previewOpen, setPreviewOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState(null);

  // ── Prompt headers ──
  const listQuery = useQuery({ queryKey: ['admin-prompts'], queryFn: getAdminPrompts });
  const prompts = useMemo(() => listQuery.data || [], [listQuery.data]);

  useEffect(() => {
    if (!selectedId && prompts.length > 0) setSelectedId(prompts[0]._id);
  }, [prompts, selectedId]);

  // ── Selected prompt (full document with history) ──
  const detailQuery = useQuery({
    queryKey: ['admin-prompt', selectedId],
    queryFn: () => getAdminPrompt(selectedId),
    enabled: !!selectedId,
  });
  const activePrompt = detailQuery.data || null;

  useEffect(() => {
    if (!activePrompt) return;
    setContent(activePrompt.content || '');
    setReason('');
    setContentError('');
    setServerError('');
  }, [activePrompt]);

  useEffect(() => { setExpandedVersion(null); }, [selectedId]);

  const dirty = !!activePrompt && content !== (activePrompt.content || '');

  const history = useMemo(() => [...(activePrompt?.history || [])].reverse(), [activePrompt]);

  const variables = useMemo(() => {
    const found = new Set();
    VAR_RE.lastIndex = 0;
    let m = VAR_RE.exec(content);
    while (m) { found.add(m[1]); m = VAR_RE.exec(content); }
    return [...found];
  }, [content]);

  const refreshPromptData = (id) => {
    queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-prompt', id] });
  };

  const selectPrompt = async (id) => {
    if (!id || id === selectedId) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved edits?',
        description: `Your changes to “${activePrompt?.name}” haven’t been saved and will be lost.`,
        confirmLabel: 'Discard edits',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setSelectedId(id);
  };

  // Save prompt
  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit || !selectedId) return;
    if (!content.trim()) {
      setContentError('Prompt content can’t be empty.');
      document.getElementById('prompt-content')?.focus();
      return;
    }
    setSaving(true);
    setServerError('');
    const id = selectedId;
    try {
      const updated = await updateAdminPrompt(id, {
        content,
        changeReason: reason.trim() || 'Updated via Prompt Editor',
      });
      toast.success(updated?.version ? `Prompt saved as v${updated.version}.` : 'Prompt saved.');
      if (updated) queryClient.setQueryData(['admin-prompt', id], updated);
      setReason('');
      refreshPromptData(id);
    } catch (err) {
      setServerError(getErrorMessage(err, 'Couldn’t save the prompt. Please try again.'));
      toast.error('Prompt wasn’t saved.');
    } finally {
      setSaving(false);
    }
  };

  // Restore history version
  const handleRestore = async (ver) => {
    if (ver === activePrompt?.version) return toast.error('Selected version is already active.');
    const ok = await confirm({
      title: `Restore v${ver}?`,
      description: `The current v${activePrompt?.version} is kept in history and v${ver}’s content becomes the new active version.${dirty ? ' Your unsaved edits will be discarded.' : ''}`,
      confirmLabel: `Restore v${ver}`,
    });
    if (!ok) return;
    setRestoring(true);
    const id = selectedId;
    try {
      const res = await restoreAdminPromptVersion(id, ver);
      toast.success(`Prompt restored to v${ver}.`);
      if (res?.prompt) queryClient.setQueryData(['admin-prompt', id], res.prompt);
      setReason('');
      refreshPromptData(id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Version restore failed.'));
    } finally {
      setRestoring(false);
    }
  };

  const discard = () => {
    setContent(activePrompt?.content || '');
    setReason('');
    setContentError('');
    setServerError('');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · System"
        title="Prompt editor"
        description="The system prompts behind interviews, resume parsing, ATS scoring and coaching — versioned, previewable and restorable."
        actions={
          <Button
            variant="soft"
            icon={RefreshCw}
            onClick={() => { listQuery.refetch(); if (selectedId) detailQuery.refetch(); }}
            loading={(listQuery.isFetching || detailQuery.isFetching) && !listQuery.isLoading}
          >
            Refresh
          </Button>
        }
      />

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="hidden space-y-2 p-2 lg:block">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-r14" />)}
          </Card>
          <Skeleton className="h-12 rounded-r14 lg:hidden" />
          <EditorSkeleton />
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title="Couldn’t load system prompts"
          description={getErrorMessage(listQuery.error, 'The prompt service did not respond.')}
          onRetry={() => listQuery.refetch()}
        />
      ) : prompts.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title="No system prompts yet"
          description="The API seeds the default prompt set the first time this list loads. If it stays empty, check the API logs and try again."
          action={<Button variant="ink" icon={RefreshCw} onClick={() => listQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* ── Prompt list ── */}
          <aside className="lg:sticky lg:top-[92px]">
            <Field label="Prompt" className="lg:hidden">
              <Select value={selectedId || ''} onChange={(e) => selectPrompt(e.target.value)}>
                {prompts.map((p) => (
                  <option key={p._id} value={p._id}>{p.name} · v{p.version}</option>
                ))}
              </Select>
            </Field>
            <Card className="hidden p-2 lg:block">
              <p className="mono-label px-3 pb-2 pt-2 text-muted">{prompts.length} prompt{prompts.length === 1 ? '' : 's'}</p>
              <ul className="space-y-1">
                {prompts.map((p) => {
                  const active = selectedId === p._id;
                  return (
                    <li key={p._id}>
                      <button
                        type="button"
                        onClick={() => selectPrompt(p._id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'w-full rounded-r14 px-3.5 py-3 text-left transition-colors',
                          active ? 'bg-ink text-white' : 'text-ink hover:bg-paper',
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-medium leading-snug">{p.name}</span>
                          <span className={cn('pill pill-mono flex-shrink-0', active ? 'bg-lime text-ink' : 'pill-stone')}>v{p.version}</span>
                        </span>
                        <span className={cn('mt-1 block font-mono text-[10.5px] uppercase tracking-mono', active ? 'text-on-dark' : 'text-muted')}>
                          {categoryLabel(p.category)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </aside>

          {/* ── Editor, preview, history ── */}
          <div className="min-w-0 space-y-4">
            {!selectedId || detailQuery.isLoading ? (
              <EditorSkeleton />
            ) : detailQuery.isError || !activePrompt ? (
              <ErrorState
                compact
                title="Couldn’t load this prompt"
                description={getErrorMessage(detailQuery.error, 'The prompt could not be found.')}
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <>
                <Card className="p-5 sm:p-6">
                  <form onSubmit={handleSave} noValidate>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-r14 bg-ink text-lime">
                          <FileCode size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-[19px] font-medium leading-snug tracking-tight1">{activePrompt.name}</h2>
                          {activePrompt.description && (
                            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{activePrompt.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <Pill tone="stone" mono>{categoryLabel(activePrompt.category)}</Pill>
                        <Pill tone="lime" mono>Active v{activePrompt.version}</Pill>
                      </div>
                    </div>
                    <p className="mt-3 font-mono text-[10.5px] uppercase tracking-mono text-faint">
                      Updated {timeAgo(activePrompt.updatedAt) || '—'}
                      {activePrompt.lastUpdatedBy?.name ? ` · by ${activePrompt.lastUpdatedBy.name}` : ''}
                    </p>

                    {!canEdit && (
                      <Alert tone="info" icon={Lock} className="mt-5">
                        Your role can read prompts but not change or restore them.
                      </Alert>
                    )}

                    <Field
                      className="mt-6"
                      label="System prompt"
                      required
                      error={contentError}
                      hint="Use ${variable} placeholders — they are filled in when the prompt runs."
                      labelRight={
                        <span className="font-mono text-[10.5px] font-normal uppercase tracking-mono text-faint tabular">
                          {content.length.toLocaleString()} chars
                        </span>
                      }
                    >
                      <Textarea
                        id="prompt-content"
                        value={content}
                        onChange={(e) => { setContent(e.target.value); setContentError(''); setServerError(''); }}
                        readOnly={!canEdit}
                        spellCheck={false}
                        rows={16}
                        className="font-mono text-[13px] leading-relaxed scroll-thin"
                      />
                    </Field>

                    {variables.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="mono-label mr-1 inline-flex items-center gap-1.5 text-muted">
                          <Braces size={13} aria-hidden="true" /> Placeholders
                        </span>
                        {variables.map((v) => (
                          <Pill
                            key={v}
                            tone={previewVars[v] !== undefined ? 'blue' : 'outline'}
                            className="font-mono"
                            title={previewVars[v] !== undefined ? 'Has a preview sample value' : 'No preview sample value'}
                          >
                            {v}
                          </Pill>
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      <>
                        <Field className="mt-6" label="Change note" hint="Stored with this save in the version history.">
                          <Input
                            id="prompt-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Added communication-depth weighting"
                            maxLength={200}
                          />
                        </Field>

                        {serverError && (
                          <Alert tone="error" className="mt-5" title="Prompt wasn’t saved">{serverError}</Alert>
                        )}

                        <div className="mt-6 flex flex-col gap-3 border-t border-line-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="flex items-center gap-2 text-[13.5px]" aria-live="polite">
                            <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dirty ? 'bg-coral-bar' : 'bg-lime-ok')} aria-hidden="true" />
                            {dirty ? 'Unsaved edits' : <span className="text-muted">Matches active v{activePrompt.version}</span>}
                          </p>
                          <div className="flex gap-2">
                            <Button variant="ghost" icon={Undo2} onClick={discard} disabled={!dirty || saving} className="px-3 sm:px-[18px]">
                              <span className="sr-only sm:not-sr-only">Discard</span>
                            </Button>
                            <Button type="submit" variant="ink" icon={Save} loading={saving} disabled={restoring} className="flex-1 sm:flex-none">
                              {saving ? 'Saving…' : 'Save & bump version'}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </form>
                </Card>

                {/* ── Live preview ── */}
                <Card className="p-5 sm:p-6">
                  <CollapsibleHeader
                    icon={previewOpen ? Eye : EyeOff}
                    title="Live preview"
                    caption="Placeholders filled with sample values"
                    open={previewOpen}
                    onToggle={() => setPreviewOpen((p) => !p)}
                    controls="prompt-preview"
                  />
                  {previewOpen && (
                    <div id="prompt-preview" className="mt-5 space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {PREVIEW_FIELDS.map((f) => (
                          <Field
                            key={f.key}
                            className={cn(f.wide && 'sm:col-span-2')}
                            label={f.label}
                            labelRight={<code className="font-mono text-[11px] font-normal text-brand-600">{'${' + f.key + '}'}</code>}
                          >
                            {f.multiline ? (
                              <Textarea
                                value={previewVars[f.key]}
                                onChange={(e) => setPreviewVars((p) => ({ ...p, [f.key]: e.target.value }))}
                                rows={3}
                                className="font-mono text-[13px]"
                              />
                            ) : (
                              <Input
                                value={previewVars[f.key]}
                                onChange={(e) => setPreviewVars((p) => ({ ...p, [f.key]: e.target.value }))}
                              />
                            )}
                          </Field>
                        ))}
                      </div>
                      <div>
                        <p className="mono-label mb-2 text-muted">Rendered output</p>
                        <div className="scroll-thin max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-r18 border border-line-2 bg-paper p-4 font-mono text-[12.5px] leading-relaxed text-ink">
                          {content ? renderPreview(content, previewVars) : <span className="text-faint">The prompt is empty.</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                {/* ── Version history ── */}
                <Card className="p-5 sm:p-6">
                  <CollapsibleHeader
                    icon={History}
                    title="Version history"
                    caption={`${history.length} snapshot${history.length === 1 ? '' : 's'} · newest first`}
                    open={historyOpen}
                    onToggle={() => setHistoryOpen((p) => !p)}
                    controls="prompt-history"
                  />
                  {historyOpen && (
                    <div id="prompt-history" className="mt-4">
                      {history.length === 0 ? (
                        <EmptyState compact icon={History} title="No previous versions" description="Each save keeps a snapshot of the version it replaced." />
                      ) : (
                        <ul className="divide-y divide-line-2">
                          {history.map((h, idx) => {
                            const isActive = h.version === activePrompt.version;
                            const rowKey = h._id || `${h.version}-${idx}`;
                            const expanded = expandedVersion === rowKey;
                            return (
                              <li key={rowKey} className="py-3.5 first:pt-1 last:pb-0">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                  <Pill tone={isActive ? 'ink' : 'stone'} mono className="tabular">v{h.version}</Pill>
                                  <div className="min-w-0 flex-1 basis-[180px]">
                                    <p className="truncate text-[14px]" title={h.changeReason}>{h.changeReason || '—'}</p>
                                    <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-mono text-faint">
                                      {formatDateTime(h.updatedAt)} · {editorName(h)}
                                    </p>
                                  </div>
                                  <div className="flex flex-shrink-0 items-center gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      icon={expanded ? EyeOff : Eye}
                                      onClick={() => setExpandedVersion(expanded ? null : rowKey)}
                                      aria-expanded={expanded}
                                    >
                                      {expanded ? 'Hide' : 'View'}
                                    </Button>
                                    {isActive ? (
                                      <Pill tone="ok" icon={CheckCircle2}>Active</Pill>
                                    ) : canEdit ? (
                                      <Button
                                        variant="soft"
                                        size="sm"
                                        icon={RotateCcw}
                                        onClick={() => handleRestore(h.version)}
                                        disabled={restoring || saving}
                                      >
                                        Restore v{h.version}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                                {expanded && (
                                  <pre className="scroll-thin mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-r14 border border-line-2 bg-paper p-3.5 font-mono text-[12px] leading-relaxed text-ink-soft">
                                    {h.content}
                                  </pre>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
