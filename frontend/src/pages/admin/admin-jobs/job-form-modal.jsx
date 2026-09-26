/**
 * JobFormModal — create / edit a job listing (POST /admin/jobs, PATCH /admin/jobs/:id).
 * On create, the API answers 409 { duplicateDetected } when a live listing with the same
 * title + company + location exists; the admin can then re-submit with ignoreDuplicate.
 */

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Send } from 'lucide-react';
import { createAdminJob, updateAdminJob } from '@/services/admin.service';
import { Alert, Button, Checkbox, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { getErrorMessage } from '@/utils';
import { CONTRACT_TYPES } from './job-meta';

const FORM_ID = 'admin-job-form';

function initialForm(job) {
  return {
    title: job?.title || '',
    company: job?.company || '',
    location: job?.location || 'Remote',
    description: job?.description || '',
    salaryMin: job?.salaryMin ?? '',
    salaryMax: job?.salaryMax ?? '',
    contractType: job?.contractType || 'full_time',
    category: job?.category || 'General',
    isFeatured: job?.isFeatured || false,
    isPinned: job?.isPinned || false,
    applyUrl: job?.applyUrl || '',
    ignoreDuplicate: false,
  };
}

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Enter a job title.';
  else if (form.title.trim().length > 160) errors.title = 'Keep the title under 160 characters.';
  if (!form.company.trim()) errors.company = 'Enter the company name.';
  if (!form.description.trim()) errors.description = 'Add a description of the role.';

  const min = form.salaryMin === '' ? null : Number(form.salaryMin);
  const max = form.salaryMax === '' ? null : Number(form.salaryMax);
  if (min !== null && (!Number.isFinite(min) || min < 0)) errors.salaryMin = 'Enter a positive number.';
  if (max !== null && (!Number.isFinite(max) || max < 0)) errors.salaryMax = 'Enter a positive number.';
  if (!errors.salaryMin && !errors.salaryMax && min !== null && max !== null && max < min) {
    errors.salaryMax = 'Max salary must be at least the min salary.';
  }

  const url = form.applyUrl.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch {
      errors.applyUrl = 'Enter a full URL starting with https://';
    }
  }
  return errors;
}

export default function JobFormModal({ job, onSave, onClose }) {
  const isEdit = !!job?._id;
  const [form, setForm] = useState(() => initialForm(job));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dupPrompt, setDupPrompt] = useState(false);
  const formRef = useRef(null);
  const alertRef = useRef(null);

  // Bring the duplicate / server-error banner into view (the body may be scrolled to the description).
  useEffect(() => {
    if (dupPrompt || serverError) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [dupPrompt, serverError]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (ignoreDuplicate = false) => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSaving(true);
    setServerError('');
    try {
      const payload = {
        ...form,
        ignoreDuplicate,
        salaryMin: form.salaryMin !== '' ? parseInt(form.salaryMin, 10) : null,
        salaryMax: form.salaryMax !== '' ? parseInt(form.salaryMax, 10) : null,
      };

      const res = isEdit ? await updateAdminJob(job._id, payload) : await createAdminJob(payload);

      // Duplicate hook from API response
      if (res?.duplicateDetected) {
        setDupPrompt(true);
        return;
      }

      toast.success(isEdit ? 'Job listing updated.' : 'Job listing published.');
      onSave();
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        setDupPrompt(true);
      } else {
        const message = getErrorMessage(err, 'Error saving job details.');
        setServerError(message);
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setDupPrompt(false);
    submit(false);
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="lg"
      title={isEdit ? 'Edit job listing' : 'Add job listing'}
      description={isEdit ? 'Changes go live on the jobs board as soon as you save.' : 'Publish a listing to the candidate jobs board.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="ink" type="submit" form={FORM_ID} loading={saving && !dupPrompt} disabled={saving} icon={Send}>
            {isEdit ? 'Save changes' : 'Publish listing'}
          </Button>
        </>
      }
    >
      <form ref={formRef} id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-5">
        <div ref={alertRef} hidden={!dupPrompt && !serverError} className="scroll-mt-4 space-y-3">
          {dupPrompt && (
            <Alert
              tone="warn"
              icon={AlertTriangle}
              title="Duplicate listing detected"
              action={
                <Button variant="outline" size="sm" loading={saving} onClick={() => submit(true)}>
                  Post anyway
                </Button>
              }
            >
              A live listing with the same title, company and location already exists.
            </Alert>
          )}
          {serverError && (
            <Alert tone="error" icon={AlertTriangle} title="Couldn’t save this listing">
              {serverError}
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Job title" required error={errors.title}>
            <Input value={form.title} onChange={set('title')} placeholder="e.g. Senior Frontend Engineer" maxLength={200} />
          </Field>
          <Field label="Company" required error={errors.company}>
            <Input value={form.company} onChange={set('company')} placeholder="e.g. Acme Labs" />
          </Field>
          <Field label="Location" hint="Defaults to Remote when left blank.">
            <Input value={form.location} onChange={set('location')} placeholder="e.g. Remote / Bengaluru" />
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={set('category')} placeholder="e.g. Engineering" />
          </Field>
          <Field label="Salary min ($)" error={errors.salaryMin}>
            <Input type="number" inputMode="numeric" min="0" value={form.salaryMin} onChange={set('salaryMin')} placeholder="e.g. 80000" />
          </Field>
          <Field label="Salary max ($)" error={errors.salaryMax}>
            <Input type="number" inputMode="numeric" min="0" value={form.salaryMax} onChange={set('salaryMax')} placeholder="e.g. 120000" />
          </Field>
          <Field label="Contract type">
            <Select value={form.contractType} onChange={set('contractType')}>
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Apply URL" error={errors.applyUrl}>
            <Input type="url" value={form.applyUrl} onChange={set('applyUrl')} placeholder="https://careers.company.com/apply" />
          </Field>
        </div>

        <Field label="Description" required error={errors.description}>
          <Textarea
            rows={7}
            value={form.description}
            onChange={set('description')}
            placeholder="Responsibilities, requirements and anything candidates should know."
          />
        </Field>

        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-r18 bg-paper px-4 py-3.5">
          <Checkbox label="Featured listing" checked={form.isFeatured} onChange={set('isFeatured')} />
          <Checkbox label="Pin to top" checked={form.isPinned} onChange={set('isPinned')} />
        </div>
      </form>
    </Modal>
  );
}
