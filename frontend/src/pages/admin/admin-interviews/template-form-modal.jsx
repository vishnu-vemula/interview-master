/**
 * TemplateFormModal — create / edit an AI interview template
 * (POST /admin/templates, PATCH /admin/templates/:id): name, difficulty, duration, question count,
 * language, voice preset + speed/pitch, and the system / evaluation / feedback prompts.
 */

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Save } from 'lucide-react';
import { createAdminTemplate, updateAdminTemplate } from '@/services/admin.service';
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { getErrorMessage } from '@/utils';
import { DIFFICULTIES, VOICES } from './template-meta';

const FORM_ID = 'admin-template-form';

function initialForm(template) {
  return {
    name: template?.name || '',
    difficulty: template?.difficulty || 'medium',
    duration: String(template?.duration || 30),
    questionCount: String(template?.questionCount || 5),
    language: template?.language || 'en',
    voiceId: template?.voiceId || 'alloy',
    voiceSpeed: template?.voiceSpeed || 1.0,
    voicePitch: template?.voicePitch || 1.0,
    systemPrompt: template?.systemPrompt || '',
    evaluationPrompt: template?.evaluationPrompt || '',
    feedbackPrompt: template?.feedbackPrompt || '',
  };
}

const isWhole = (v) => /^\d+$/.test(String(v).trim());

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Give the template a name.';
  else if (form.name.trim().length > 120) errors.name = 'Keep the name under 120 characters.';
  if (!isWhole(form.duration) || Number(form.duration) < 5) errors.duration = 'At least 5 minutes.';
  else if (Number(form.duration) > 240) errors.duration = 'At most 240 minutes.';
  if (!isWhole(form.questionCount) || Number(form.questionCount) < 1) errors.questionCount = 'At least 1 question.';
  else if (Number(form.questionCount) > 50) errors.questionCount = 'At most 50 questions.';
  if (!form.language.trim()) errors.language = 'Enter a language code, e.g. en.';
  else if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,4})?$/.test(form.language.trim())) errors.language = 'Use a code like en, fr or en-IN.';
  if (!form.systemPrompt.trim()) errors.systemPrompt = 'The system prompt is required.';
  if (!form.evaluationPrompt.trim()) errors.evaluationPrompt = 'The evaluation prompt is required.';
  if (!form.feedbackPrompt.trim()) errors.feedbackPrompt = 'The feedback prompt is required.';
  return errors;
}

function RangeField({ label, value, onChange }) {
  return (
    <Field label={label} labelRight={<span className="font-mono text-[12px] text-muted tabular">{Number(value).toFixed(1)}×</span>}>
      <input
        type="range"
        min="0.5"
        max="2.0"
        step="0.1"
        value={value}
        onChange={onChange}
        className="h-11 w-full cursor-pointer accent-ink"
      />
    </Field>
  );
}

export default function TemplateFormModal({ template, onSave, onClose }) {
  const isEdit = !!template?._id;
  const [form, setForm] = useState(() => initialForm(template));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const alertRef = useRef(null);

  useEffect(() => {
    if (serverError) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [serverError]);

  const set = (key, parse) => (e) => {
    const value = parse ? parse(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSaving(true);
    setServerError('');
    const payload = {
      ...form,
      name: form.name.trim(),
      language: form.language.trim(),
      duration: parseInt(form.duration, 10),
      questionCount: parseInt(form.questionCount, 10),
    };
    try {
      if (isEdit) {
        await updateAdminTemplate(template._id, payload);
      } else {
        await createAdminTemplate(payload);
      }
      toast.success(isEdit ? 'Template updated.' : 'Template created.');
      onSave();
      onClose();
    } catch (err) {
      const message = getErrorMessage(err, 'Error saving template specifications.');
      setServerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="xl"
      title={isEdit ? 'Edit interview template' : 'New interview template'}
      description="Templates set the interviewer’s prompts, difficulty, length and voice."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="ink" type="submit" form={FORM_ID} loading={saving} icon={Save}>
            {isEdit ? 'Save changes' : 'Create template'}
          </Button>
        </>
      }
    >
      <form ref={formRef} id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-6">
        <div ref={alertRef} hidden={!serverError} className="scroll-mt-4">
          {serverError && (
            <Alert tone="error" icon={AlertTriangle} title="Couldn’t save this template">
              {serverError}
            </Alert>
          )}
        </div>

        <section className="space-y-4">
          <h3 className="mono-label text-muted">Basics</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Template name" required error={errors.name} className="sm:col-span-2">
              <Input value={form.name} onChange={set('name')} placeholder="e.g. Senior Backend Python Developer" maxLength={160} />
            </Field>
            <Field label="Difficulty">
              <Select value={form.difficulty} onChange={set('difficulty')}>
                {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label="Duration (minutes)" required error={errors.duration}>
              <Input type="number" inputMode="numeric" min="5" value={form.duration} onChange={set('duration')} />
            </Field>
            <Field label="Question count" required error={errors.questionCount}>
              <Input type="number" inputMode="numeric" min="1" value={form.questionCount} onChange={set('questionCount')} />
            </Field>
            <Field label="Language code" required error={errors.language}>
              <Input value={form.language} onChange={set('language')} placeholder="e.g. en, fr, de" maxLength={10} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="mono-label text-muted">Voice</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Voice preset (OpenAI)">
              <Select value={form.voiceId} onChange={set('voiceId')}>
                {VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </Select>
            </Field>
            <RangeField label="Voice speed" value={form.voiceSpeed} onChange={set('voiceSpeed', parseFloat)} />
            <RangeField label="Voice pitch" value={form.voicePitch} onChange={set('voicePitch', parseFloat)} />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="mono-label text-muted">Prompts</h3>
          <Field label="System prompt" hint="Context generator: the interviewer’s persona, tone and skill domain." required error={errors.systemPrompt}>
            <Textarea
              rows={5}
              className="font-mono text-[13px]"
              value={form.systemPrompt}
              onChange={set('systemPrompt')}
              placeholder="Instruct the interviewer model on its persona, tone, and skills domain…"
            />
          </Field>
          <Field label="Evaluation prompt" hint="Response scorer: how each answer should be evaluated." required error={errors.evaluationPrompt}>
            <Textarea
              rows={5}
              className="font-mono text-[13px]"
              value={form.evaluationPrompt}
              onChange={set('evaluationPrompt')}
              placeholder="Instruct the model on how to evaluate the candidate’s answers…"
            />
          </Field>
          <Field label="Feedback prompt" hint="Session analyser: the summary report generated at the end." required error={errors.feedbackPrompt}>
            <Textarea
              rows={5}
              className="font-mono text-[13px]"
              value={form.feedbackPrompt}
              onChange={set('feedbackPrompt')}
              placeholder="Instruct the model on generating the overall summary report at session end…"
            />
          </Field>
        </section>
      </form>
    </Modal>
  );
}
