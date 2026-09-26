/**
 * AdminSettingsPage — platform-wide configuration (GET / PATCH /admin/settings).
 *
 * Sections: General (branding, support contacts, maintenance mode, socials), Security
 * (session expiry + API rate limit), AI engine (default model parameters), Storage
 * (read-only: resume files live in env-configured Cloudinary) and Feature flags.
 * Secrets are never returned by the API and are not editable here.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Settings, Shield, Sparkles, Database, ToggleLeft, Save, KeyRound, Github, Twitter, Linkedin,
  Briefcase, Radar, FileSearch, MessagesSquare, Construction, Lock, Undo2,
} from 'lucide-react';
import { getAdminSettings, saveAdminSettings } from '@/services/admin.service';
import { useAdminAuth } from '@/context';
import {
  Alert, Button, Card, ErrorState, Field, Input, PageHeader, Pill, Segmented, Select, Skeleton, Switch,
} from '@/components/ui';
import { cn, formatDateTime, getErrorMessage, timeAgo } from '@/utils';

// Same fallbacks the page has always used when a stored document is missing a key.
const DEFAULTS = {
  general: {
    appName: 'Rehearsly',
    logo: '',
    theme: 'dark',
    maintenanceMode: false,
    supportEmail: 'support@interviewmaster.com',
    supportPhone: '+1 (555) 019-2834',
    socialLinks: { github: '', twitter: '', linkedin: '' },
  },
  security: {
    jwtExpiry: '7d',
    apiKeys: { groq: '', stripe: '', adzunaId: '', adzunaKey: '' },
    rateLimits: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
  },
  ai: { model: 'llama-3.3-70b-versatile', temperature: 0.5, maxTokens: 1024 },
  storage: {
    provider: 'local',
    cloudinary: { cloudName: '', apiKey: '', apiSecret: '' },
    aws: { bucket: '', region: '', accessKey: '', secretKey: '' },
  },
  featureFlags: { enableJobs: true, enableScraper: true, enableATS: true, enableCoach: true },
};

/** Deep-merge the server document over DEFAULTS so every field the form reads exists. */
function normalize(s) {
  const src = s || {};
  return {
    ...src,
    general: {
      ...DEFAULTS.general,
      ...src.general,
      socialLinks: { ...DEFAULTS.general.socialLinks, ...src.general?.socialLinks },
    },
    security: {
      ...DEFAULTS.security,
      ...src.security,
      apiKeys: { ...DEFAULTS.security.apiKeys, ...src.security?.apiKeys },
      rateLimits: { ...DEFAULTS.security.rateLimits, ...src.security?.rateLimits },
    },
    ai: { ...DEFAULTS.ai, ...src.ai },
    storage: {
      ...DEFAULTS.storage,
      ...src.storage,
      cloudinary: { ...DEFAULTS.storage.cloudinary, ...src.storage?.cloudinary },
      aws: { ...DEFAULTS.storage.aws, ...src.storage?.aws },
    },
    featureFlags: { ...DEFAULTS.featureFlags, ...src.featureFlags },
  };
}

/** Flat, string-friendly editing model (number inputs keep what the admin typed). */
function toDraft(s) {
  return {
    appName: s.general.appName ?? '',
    logo: s.general.logo ?? '',
    theme: s.general.theme || 'dark',
    maintenanceMode: !!s.general.maintenanceMode,
    supportEmail: s.general.supportEmail ?? '',
    supportPhone: s.general.supportPhone ?? '',
    github: s.general.socialLinks.github ?? '',
    twitter: s.general.socialLinks.twitter ?? '',
    linkedin: s.general.socialLinks.linkedin ?? '',
    jwtExpiry: s.security.jwtExpiry ?? '',
    windowMinutes: String(Number(s.security.rateLimits.windowMs || 0) / 60000),
    maxRequests: String(s.security.rateLimits.maxRequests ?? ''),
    model: s.ai.model ?? '',
    temperature: Number(s.ai.temperature ?? 0.5),
    maxTokens: String(s.ai.maxTokens ?? ''),
    enableJobs: !!s.featureFlags.enableJobs,
    enableScraper: !!s.featureFlags.enableScraper,
    enableATS: !!s.featureFlags.enableATS,
    enableCoach: !!s.featureFlags.enableCoach,
  };
}

/** Rebuild the full settings document (same shape the page has always PATCHed). */
function toPayload(s, d) {
  return {
    ...s,
    general: {
      ...s.general,
      appName: d.appName.trim(),
      logo: d.logo.trim(),
      theme: d.theme,
      maintenanceMode: d.maintenanceMode,
      supportEmail: d.supportEmail.trim(),
      supportPhone: d.supportPhone.trim(),
      socialLinks: { github: d.github.trim(), twitter: d.twitter.trim(), linkedin: d.linkedin.trim() },
    },
    security: {
      ...s.security,
      jwtExpiry: d.jwtExpiry.trim(),
      rateLimits: {
        windowMs: Math.round(Number(d.windowMinutes) * 60 * 1000),
        maxRequests: parseInt(d.maxRequests, 10),
      },
    },
    ai: { ...s.ai, model: d.model.trim(), temperature: d.temperature, maxTokens: parseInt(d.maxTokens, 10) },
    featureFlags: {
      enableJobs: d.enableJobs,
      enableScraper: d.enableScraper,
      enableATS: d.enableATS,
      enableCoach: d.enableCoach,
    },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Duration grammar accepted by jsonwebtoken's `expiresIn` (the `ms` package): "7d", "12h", "30 minutes", "3600".
const DURATION_RE = /^\d+(\.\d+)?\s*(ms|msecs?|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|yrs?|years?)?$/i;
const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
const isPositiveInt = (v) => /^\d+$/.test(String(v).trim()) && parseInt(v, 10) > 0;

function validate(d) {
  const e = {};
  if (!d.appName.trim()) e.appName = 'Enter the platform name.';
  if (d.logo.trim() && !d.logo.trim().startsWith('/') && !isHttpUrl(d.logo.trim())) e.logo = 'Use a full http(s) URL or a path starting with “/”.';
  if (!d.supportEmail.trim()) e.supportEmail = 'Enter a support email.';
  else if (!EMAIL_RE.test(d.supportEmail.trim())) e.supportEmail = 'Enter a valid email address.';
  ['github', 'twitter', 'linkedin'].forEach((k) => {
    if (d[k].trim() && !isHttpUrl(d[k].trim())) e[k] = 'Use a full URL starting with https://';
  });
  if (!d.jwtExpiry.trim()) e.jwtExpiry = 'Enter a token lifetime.';
  else if (!DURATION_RE.test(d.jwtExpiry.trim())) e.jwtExpiry = 'Use a duration like 7d, 12h or 30m.';
  const win = Number(d.windowMinutes);
  if (String(d.windowMinutes).trim() === '' || !Number.isFinite(win) || win <= 0) e.windowMinutes = 'Enter a window longer than 0 minutes.';
  if (!isPositiveInt(d.maxRequests)) e.maxRequests = 'Enter a whole number of 1 or more.';
  if (!d.model.trim()) e.model = 'Enter a model name.';
  if (!isPositiveInt(d.maxTokens)) e.maxTokens = 'Enter a whole number of 1 or more.';
  return e;
}

const SECTIONS = [
  { id: 'general', label: 'General', sub: 'Brand, support & maintenance', icon: Settings, fields: ['appName', 'logo', 'theme', 'maintenanceMode', 'supportEmail', 'supportPhone', 'github', 'twitter', 'linkedin'] },
  { id: 'security', label: 'Security', sub: 'Sessions & rate limits', icon: Shield, fields: ['jwtExpiry', 'windowMinutes', 'maxRequests'] },
  { id: 'ai', label: 'AI engine', sub: 'Model defaults', icon: Sparkles, fields: ['model', 'temperature', 'maxTokens'] },
  { id: 'storage', label: 'Storage', sub: 'Resume files', icon: Database, fields: [] },
  { id: 'features', label: 'Feature flags', sub: 'Candidate modules', icon: ToggleLeft, fields: ['enableJobs', 'enableScraper', 'enableATS', 'enableCoach'] },
];

const FLAGS = [
  { key: 'enableJobs', icon: Briefcase, title: 'Jobs module', body: 'Job search, applications and matching against posted listings.' },
  { key: 'enableScraper', icon: Radar, title: 'Adzuna job scraper', body: 'Background sync that imports Adzuna listings on the scraper schedule.' },
  { key: 'enableATS', icon: FileSearch, title: 'ATS evaluator', body: 'Lets candidates score their resume against a job description.' },
  { key: 'enableCoach', icon: MessagesSquare, title: 'Career coach', body: 'AI feedback and career-advice conversations after practice.' },
];

const THEME_LABELS = { dark: 'Dark', light: 'Light', custom: 'Custom' };

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-r14 bg-stone-2 text-ink">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[17px] font-medium tracking-tight1">{title}</h2>
        {description && <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{description}</p>}
      </div>
    </div>
  );
}

function ToggleRow({ id, icon: Icon, title, body, checked, onChange, tone = 'default', disabled }) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      {Icon && (
        <span className={cn('hidden h-9 w-9 flex-shrink-0 place-items-center rounded-r9 sm:grid', checked ? (tone === 'danger' ? 'bg-coral-bg text-coral' : 'bg-lime-soft text-lime-ok') : 'bg-stone-2 text-muted')}>
          <Icon size={16} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="flex cursor-pointer flex-wrap items-center gap-2 text-[14.5px] font-medium">
          {title}
          {checked
            ? <Pill tone={tone === 'danger' ? 'coral' : 'ok'} mono>On</Pill>
            : <Pill tone="stone" mono>Off</Pill>}
        </label>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{body}</p>
      </div>
      <Switch id={id} checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]" role="status" aria-label="Loading settings">
      <Card className="hidden space-y-2 p-2 lg:block">
        {SECTIONS.map((s) => <Skeleton key={s.id} className="h-14 rounded-r14" />)}
      </Card>
      <Skeleton className="h-11 w-full rounded-full lg:hidden" />
      <Card className="p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-r14" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64 max-w-full" /></div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-12 rounded-r14" /></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('update:settings');

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'security' | 'ai' | 'storage' | 'features'
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
  });

  const settings = useMemo(() => (data ? normalize(data) : null), [data]);
  const baseline = useMemo(() => (settings ? toDraft(settings) : null), [settings]);

  // (Re)seed the form whenever a fresh server copy arrives (initial load / after save).
  useEffect(() => {
    if (baseline) {
      setDraft(baseline);
      setErrors({});
    }
  }, [baseline]);

  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline);

  const set = (key) => (value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => { const next = { ...e }; delete next[key]; return next; });
    setServerError('');
  };
  const bind = (key) => ({ value: draft?.[key] ?? '', onChange: (e) => set(key)(e.target.value) });

  const errorCount = (section) => section.fields.filter((f) => errors[f]).length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const v = validate(draft);
    setErrors(v);
    const keys = Object.keys(v);
    if (keys.length) {
      const first = SECTIONS.find((s) => s.fields.some((f) => v[f]));
      if (first) setActiveTab(first.id);
      setTimeout(() => document.getElementById(`setting-${first?.fields.find((f) => v[f])}`)?.focus(), 60);
      return;
    }
    setSaving(true);
    setServerError('');
    try {
      const saved = await saveAdminSettings(toPayload(settings, draft));
      if (saved) queryClient.setQueryData(['admin-settings'], saved);
      else await refetch();
      toast.success('Platform settings saved.');
    } catch (err) {
      const msg = getErrorMessage(err, 'Couldn’t save the settings. Please try again.');
      setServerError(msg);
      toast.error('Settings weren’t saved.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (baseline) setDraft(baseline);
    setErrors({});
    setServerError('');
  };

  const themeOptions = ['dark', 'light'];
  if (draft?.theme && !themeOptions.includes(draft.theme)) themeOptions.push(draft.theme);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · System"
        title="Platform settings"
        description="Branding, support contacts, session security, AI defaults and the modules candidates can use."
        actions={
          data?.updatedAt ? (
            <span className="mono-label text-muted" title={formatDateTime(data.updatedAt)}>
              Last saved {timeAgo(data.updatedAt)}
            </span>
          ) : null
        }
      />

      {isLoading || (settings && !draft) ? (
        <SettingsSkeleton />
      ) : isError || !settings ? (
        <ErrorState
          title="Couldn’t load platform settings"
          description={getErrorMessage(error, 'The settings service did not respond.')}
          onRetry={refetch}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* Section navigation — rail on desktop, segmented control on small screens */}
          <nav aria-label="Settings sections" className="lg:sticky lg:top-[92px]">
            <Segmented
              size="sm"
              className="lg:hidden"
              ariaLabel="Settings sections"
              value={activeTab}
              onChange={setActiveTab}
              options={SECTIONS.map((s) => ({ value: s.id, label: s.label, icon: s.icon, count: errorCount(s) || undefined }))}
            />
            <Card className="hidden p-2 lg:block">
              <ul className="space-y-1">
                {SECTIONS.map((s) => {
                  const active = activeTab === s.id;
                  const count = errorCount(s);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(s.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-r14 px-3 py-2.5 text-left transition-colors',
                          active ? 'bg-ink text-white' : 'text-ink hover:bg-paper',
                        )}
                      >
                        <span className={cn('grid h-8 w-8 flex-shrink-0 place-items-center rounded-r9', active ? 'bg-ink-3 text-lime' : 'bg-stone-2 text-muted')}>
                          <s.icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium">{s.label}</span>
                          <span className={cn('block truncate text-[12px]', active ? 'text-on-dark' : 'text-muted')}>{s.sub}</span>
                        </span>
                        {count > 0 && (
                          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-coral px-1.5 font-mono text-[10px] text-white" aria-label={`${count} field${count > 1 ? 's' : ''} need attention`}>
                            {count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </nav>

          <form id="admin-settings-form" onSubmit={handleSave} noValidate className="min-w-0 space-y-4">
            {!canEdit && (
              <Alert tone="info" icon={Lock} title="View-only access">
                Your admin role can view platform settings but not change them.
              </Alert>
            )}

            <fieldset disabled={!canEdit || saving} className="min-w-0">
              {activeTab === 'general' && (
                <Card className="p-5 sm:p-6">
                  <SectionHeading icon={Settings} title="General" description="How the platform identifies itself and how candidates reach support." />

                  <div className={cn('mb-6 rounded-r18 border px-4 py-4', draft.maintenanceMode ? 'border-coral/25 bg-coral-soft' : 'border-line-2 bg-paper')}>
                    <ToggleRow
                      id="setting-maintenanceMode"
                      icon={Construction}
                      tone="danger"
                      title="Maintenance mode"
                      body="Halts the candidate portal while the platform is being worked on."
                      checked={draft.maintenanceMode}
                      onChange={set('maintenanceMode')}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Platform name" required error={errors.appName}>
                      <Input id="setting-appName" {...bind('appName')} autoComplete="off" />
                    </Field>
                    <Field label="Logo asset URL" error={errors.logo} hint="Absolute URL or a path served by the web app.">
                      <Input id="setting-logo" {...bind('logo')} placeholder="https://cdn.example.com/logo.svg" inputMode="url" />
                    </Field>
                    <Field label="Support email" required error={errors.supportEmail}>
                      <Input id="setting-supportEmail" type="email" {...bind('supportEmail')} autoComplete="off" />
                    </Field>
                    <Field label="Support phone" error={errors.supportPhone}>
                      <Input id="setting-supportPhone" type="tel" {...bind('supportPhone')} />
                    </Field>
                    <Field label="Theme" hint="Stored platform theme preference.">
                      <Select id="setting-theme" {...bind('theme')}>
                        {themeOptions.map((t) => <option key={t} value={t}>{THEME_LABELS[t] || t}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <p className="divider-label mb-5 mt-8">Social profiles</p>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field label={<span className="inline-flex items-center gap-1.5"><Github size={14} aria-hidden="true" /> GitHub</span>} error={errors.github}>
                      <Input id="setting-github" {...bind('github')} placeholder="https://github.com/…" inputMode="url" />
                    </Field>
                    <Field label={<span className="inline-flex items-center gap-1.5"><Twitter size={14} aria-hidden="true" /> Twitter / X</span>} error={errors.twitter}>
                      <Input id="setting-twitter" {...bind('twitter')} placeholder="https://twitter.com/…" inputMode="url" />
                    </Field>
                    <Field label={<span className="inline-flex items-center gap-1.5"><Linkedin size={14} aria-hidden="true" /> LinkedIn</span>} error={errors.linkedin}>
                      <Input id="setting-linkedin" {...bind('linkedin')} placeholder="https://linkedin.com/company/…" inputMode="url" />
                    </Field>
                  </div>
                </Card>
              )}

              {activeTab === 'security' && (
                <Card className="p-5 sm:p-6">
                  <SectionHeading icon={Shield} title="Security" description="Session lifetime and the API request throttle." />

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="JWT token expiry" required error={errors.jwtExpiry} hint="Duration such as 7d, 12h or 30m.">
                      <Input id="setting-jwtExpiry" {...bind('jwtExpiry')} className="font-mono" autoComplete="off" />
                    </Field>
                  </div>

                  <p className="divider-label mb-5 mt-8">API rate limit</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Window (minutes)" required error={errors.windowMinutes}>
                      <Input id="setting-windowMinutes" type="number" min="1" step="1" inputMode="numeric" {...bind('windowMinutes')} />
                    </Field>
                    <Field label="Max requests per window" required error={errors.maxRequests}>
                      <Input id="setting-maxRequests" type="number" min="1" step="1" inputMode="numeric" {...bind('maxRequests')} />
                    </Field>
                  </div>
                  {!errors.windowMinutes && !errors.maxRequests && Number(draft.windowMinutes) > 0 && isPositiveInt(draft.maxRequests) && (
                    <p className="mt-3 text-[13px] text-muted">
                      Each client may make up to <span className="font-medium text-ink tabular">{parseInt(draft.maxRequests, 10)}</span> requests every{' '}
                      <span className="font-medium text-ink tabular">{Number(draft.windowMinutes)}</span> minute{Number(draft.windowMinutes) === 1 ? '' : 's'}.
                    </p>
                  )}

                  <Alert tone="info" icon={KeyRound} className="mt-8" title="Credentials live on the server">
                    PayU, AI and job-provider credentials are managed through server environment variables. They are never shown here.
                  </Alert>
                </Card>
              )}

              {activeTab === 'ai' && (
                <Card className="p-5 sm:p-6">
                  <SectionHeading icon={Sparkles} title="AI engine" description="Default Groq model parameters for generated questions and feedback." />

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Default model" required error={errors.model} hint="Groq model identifier.">
                      <Input id="setting-model" {...bind('model')} className="font-mono text-[14px]" autoComplete="off" spellCheck={false} />
                    </Field>
                    <Field label="Max completion tokens" required error={errors.maxTokens}>
                      <Input id="setting-maxTokens" type="number" min="1" step="1" inputMode="numeric" {...bind('maxTokens')} />
                    </Field>
                  </div>

                  <div className="mt-6 rounded-r18 border border-line-2 bg-paper px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="setting-temperature" className="text-[13.5px] font-medium">Temperature</label>
                      <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[12px] text-lime tabular">{Number(draft.temperature).toFixed(2)}</span>
                    </div>
                    <input
                      id="setting-temperature"
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={draft.temperature}
                      onChange={(e) => set('temperature')(parseFloat(e.target.value))}
                      className="mt-4 h-2 w-full cursor-pointer accent-ink disabled:cursor-not-allowed"
                      aria-describedby="setting-temperature-scale"
                    />
                    <div id="setting-temperature-scale" className="mt-2 flex justify-between font-mono text-[10.5px] uppercase tracking-mono text-faint">
                      <span>0 · Precise</span><span>1 · Balanced</span><span>2 · Creative</span>
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === 'storage' && (
                <Card className="p-5 sm:p-6">
                  <SectionHeading icon={Database} title="Storage" description="Where uploaded resumes are kept." />
                  <div className="rounded-r18 border border-line-2 bg-paper px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium">Resume storage</span>
                      <Pill tone="blue" mono>Private Cloudinary</Pill>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted-strong">
                      Resumes use private Cloudinary storage. Configure these variables on the API server:
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map((v) => (
                        <code key={v} className="rounded-r9 border border-line-2 bg-white px-2 py-1 font-mono text-[12px] text-ink">{v}</code>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === 'features' && (
                <Card className="p-5 sm:p-6">
                  <SectionHeading icon={ToggleLeft} title="Feature flags" description="Switch candidate-facing modules on or off." />
                  <div className="divide-y divide-line-2">
                    {FLAGS.map((f) => (
                      <ToggleRow
                        key={f.key}
                        id={`setting-${f.key}`}
                        icon={f.icon}
                        title={f.title}
                        body={f.body}
                        checked={draft[f.key]}
                        onChange={set(f.key)}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </fieldset>

            {canEdit && (
              <div className="sticky bottom-3 z-10 space-y-2">
                {serverError && (
                  <div className="rounded-r18 bg-white shadow-pop">
                    <Alert tone="error" title="Settings weren’t saved">{serverError}</Alert>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 rounded-r20 border border-line-2 bg-white/95 py-2.5 pl-4 pr-2.5 shadow-pop backdrop-blur sm:gap-3 sm:py-3 sm:pr-3">
                  <p className="flex min-w-0 items-center gap-2 text-[13.5px]" aria-live="polite">
                    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', Object.keys(errors).length || dirty ? 'bg-coral-bar' : 'bg-lime-ok')} aria-hidden="true" />
                    {Object.keys(errors).length > 0 ? (
                      <span className="truncate text-coral">
                        <span className="sm:hidden">Fix errors</span>
                        <span className="hidden sm:inline">Fix the highlighted fields to save.</span>
                      </span>
                    ) : dirty ? (
                      <span className="truncate">
                        <span className="sm:hidden">Unsaved</span>
                        <span className="hidden sm:inline">You have unsaved changes.</span>
                      </span>
                    ) : (
                      <span className="truncate text-muted">
                        <span className="sm:hidden">Saved</span>
                        <span className="hidden sm:inline">All changes saved.</span>
                      </span>
                    )}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                    <Button variant="ghost" icon={Undo2} onClick={discard} disabled={!dirty || saving} className="px-3 sm:px-[18px]">
                      <span className="sr-only sm:not-sr-only">Discard</span>
                    </Button>
                    <Button type="submit" variant="ink" icon={Save} loading={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
