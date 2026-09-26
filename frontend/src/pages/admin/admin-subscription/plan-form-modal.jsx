/**
 * PlanFormModal — create / edit a subscription plan (POST /admin/plans, PATCH /admin/plans/:id).
 *
 * The API derives `amountMinor` (what PayU charges) as round((price − directDiscount) × 100) and
 * rejects anything below 100 paise, so the form validates the same rule inline. On create the plan
 * `code` is derived from the name and must be unique (archived plans keep theirs).
 */

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Tag, Ticket, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createAdminPlan, updateAdminPlan } from '@/services/admin.service';
import { Alert, Button, Field, Input, Modal, Switch } from '@/components/ui';
import { cn, formatINR, getErrorMessage } from '@/utils';

const toCode = (name) =>
  String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

const numOrNaN = (v) => (String(v).trim() === '' ? NaN : Number(v));
const hasMax2dp = (v) => /^\d+(\.\d{1,2})?$/.test(String(v).trim());
const isPositiveInt = (v) => /^\d+$/.test(String(v).trim()) && Number(v) >= 1;

function validate(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Give the plan a name.';
  else if (!/[a-z0-9]/i.test(name)) errors.name = 'Use at least one letter or number — the plan code is built from the name.';
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';

  const price = numOrNaN(form.price);
  if (Number.isNaN(price)) errors.price = 'Enter the list price in rupees.';
  else if (price < 0) errors.price = 'Price can’t be negative.';
  else if (!hasMax2dp(form.price)) errors.price = 'Use rupees with at most 2 decimal places.';

  const discount = String(form.directDiscount).trim() === '' ? 0 : Number(form.directDiscount);
  if (Number.isNaN(discount) || discount < 0) errors.directDiscount = 'Discount can’t be negative.';
  else if (discount > 0 && !hasMax2dp(form.directDiscount)) errors.directDiscount = 'Use rupees with at most 2 decimal places.';
  else if (!errors.price && discount > price) errors.directDiscount = 'Discount can’t be more than the list price.';

  if (!errors.price && !errors.directDiscount && Math.round((price - discount) * 100) < 100) {
    const msg = 'PayU checkout needs at least ₹1 after the discount.';
    if (discount > 0) errors.directDiscount = msg;
    else errors.price = msg;
  }

  if (!isPositiveInt(form.durationDays)) errors.durationDays = 'Enter a whole number of days (1 or more).';
  if (!isPositiveInt(form.credits)) errors.credits = 'Enter a whole number of credits (1 or more).';

  return { errors, price, discount };
}

export default function PlanFormModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan?._id;
  const [form, setForm] = useState({
    name: plan?.name || '',
    price: plan?.price !== undefined && plan?.price !== null ? String(plan.price) : '',
    directDiscount: plan?.directDiscount ? String(plan.directDiscount) : '0',
    durationDays: String(plan?.durationDays || 30),
    credits: String(plan?.credits || 10),
    isPublished: plan?.isPublished !== undefined ? plan.isPublished : true,
  });
  const [features, setFeatures] = useState(Array.isArray(plan?.features) ? plan.features : []);
  const [newFeature, setNewFeature] = useState('');
  const [featureError, setFeatureError] = useState('');

  const [coupons, setCoupons] = useState(Array.isArray(plan?.coupons) ? plan.coupons : []);
  const [couponCode, setCouponCode] = useState('');
  const [couponPct, setCouponPct] = useState('10');
  const [couponError, setCouponError] = useState('');

  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const { errors: clientErrors, price, discount } = useMemo(() => validate(form), [form]);
  const errors = touched ? { ...clientErrors, ...serverErrors } : serverErrors;
  const net = !clientErrors.price && !Number.isNaN(discount) ? Math.max(0, price - discount) : null;
  const netOk = net !== null && Math.round(net * 100) >= 100;

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    if (serverErrors[key]) setServerErrors((s) => ({ ...s, [key]: undefined }));
  };

  const addFeature = () => {
    const f = newFeature.trim();
    if (!f) return setFeatureError('Type a feature first.');
    if (features.includes(f)) return setFeatureError('That feature is already listed.');
    setFeatures((p) => [...p, f]);
    setNewFeature('');
    setFeatureError('');
    return undefined;
  };

  const addCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    const pct = Number(couponPct);
    if (!code) return setCouponError('Enter a coupon code.');
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return setCouponError('Codes use 3–30 letters, numbers, - or _.');
    if (coupons.some((c) => c.code === code)) return setCouponError('That code is already on this plan.');
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) return setCouponError('Discount must be a whole percent from 1 to 100.');
    setCoupons((p) => [...p, { code, discountPercent: pct, isActive: true }]);
    setCouponCode('');
    setCouponPct('10');
    setCouponError('');
    return undefined;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setFormError('');
    setServerErrors({});
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price,
        durationDays: Number(form.durationDays),
        credits: Number(form.credits),
        directDiscount: discount,
        isPublished: form.isPublished,
        features,
        coupons,
      };

      if (isEdit) {
        await updateAdminPlan(plan._id, payload);
      } else {
        await createAdminPlan(payload);
      }
      toast.success(isEdit ? 'Plan updated.' : 'Plan created.');
      onSaved?.();
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      const message = getErrorMessage(err, 'Couldn’t save the subscription plan.');
      if (status === 409) {
        setServerErrors({ name: 'A plan with this name already exists (archived plans keep their name reserved). Choose another name.' });
      } else if (/₹1|price|discount/i.test(message) && status === 400) {
        setServerErrors(discount > 0 ? { directDiscount: message } : { price: message });
      } else {
        setFormError(message);
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const code = isEdit ? plan.code : toCode(form.name);

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="lg"
      title={isEdit ? 'Edit plan' : 'New subscription plan'}
      description="Prices are in INR. PayU charges the price after the direct discount."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="plan-form" variant="ink" loading={saving}>
            {isEdit ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && <Alert tone="error" icon={AlertTriangle} title="Plan not saved">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Plan name"
            required
            error={errors.name}
            hint="Shown to candidates on the pricing page."
            labelRight={code ? <span className="max-w-[60%] truncate font-mono text-[10.5px] uppercase tracking-mono text-muted">Code · {code}</span> : null}
          >
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Pro · 30 days" maxLength={120} autoComplete="off" />
          </Field>

          <Field label="List price (₹)" required error={errors.price}>
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="499" />
          </Field>

          <Field label="Direct discount (₹)" error={errors.directDiscount} hint="Flat amount taken off the list price.">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.directDiscount} onChange={set('directDiscount')} />
          </Field>

          <Field label="Validity (days)" required error={errors.durationDays}>
            <Input type="number" inputMode="numeric" min="1" step="1" value={form.durationDays} onChange={set('durationDays')} />
          </Field>

          <Field label="Interview credits" required error={errors.credits} hint="Credits granted with each purchase.">
            <Input type="number" inputMode="numeric" min="1" step="1" value={form.credits} onChange={set('credits')} />
          </Field>

          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-r18 px-4 py-3.5 sm:col-span-2',
              net === null ? 'bg-stone-2' : netOk ? 'bg-lime-soft' : 'bg-coral-soft',
            )}
            aria-live="polite"
          >
            <div className="flex items-center gap-2.5">
              {net !== null && !netOk ? (
                <AlertTriangle size={16} className="flex-shrink-0 text-coral" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} className={cn('flex-shrink-0', netOk ? 'text-lime-ok' : 'text-muted')} aria-hidden="true" />
              )}
              <span className="text-[13.5px] text-muted-strong">
                {net === null ? 'Enter a price to see the checkout amount.' : netOk ? 'Candidates pay at PayU checkout' : 'Below PayU’s ₹1 minimum'}
              </span>
            </div>
            <span className="text-[20px] font-medium tracking-tight1 tabular">{net === null ? '—' : formatINR(net)}</span>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-r18 border border-line-2 px-4 py-3.5 sm:col-span-2">
            <div>
              <p id="plan-published-label" className="text-[14px] font-medium">Published</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Visible on the pricing page and available at checkout.</p>
            </div>
            <Switch
              checked={form.isPublished}
              onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
              label="Published"
            />
          </div>
        </div>

        {/* Features */}
        <section className="space-y-3 border-t border-line-2 pt-5" aria-labelledby="plan-features-heading">
          <div>
            <h3 id="plan-features-heading" className="text-[15px] font-medium tracking-tight1">Included features</h3>
            <p className="mt-0.5 text-[12.5px] text-muted">Bullet points shown with the plan on the pricing page.</p>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input
                aria-label="New feature"
                aria-invalid={featureError ? true : undefined}
                invalid={!!featureError}
                value={newFeature}
                onChange={(e) => { setNewFeature(e.target.value); setFeatureError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                placeholder="e.g. Detailed feedback on every answer"
                maxLength={140}
              />
            </div>
            <Button variant="soft" icon={Plus} onClick={addFeature} className="flex-shrink-0">Add</Button>
          </div>
          {featureError && <p className="field-error-text" role="alert">{featureError}</p>}
          {features.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {features.map((f) => (
                <li key={f} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pl-3 pr-1.5 text-[13px]">
                  <Tag size={12} className="flex-shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{f}</span>
                  <button
                    type="button"
                    onClick={() => setFeatures((p) => p.filter((x) => x !== f))}
                    aria-label={`Remove feature ${f}`}
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-stone hover:text-ink"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-faint">No features listed yet.</p>
          )}
        </section>

        {/* Coupons */}
        <section className="space-y-3 border-t border-line-2 pt-5" aria-labelledby="plan-coupons-heading">
          <div>
            <h3 id="plan-coupons-heading" className="text-[15px] font-medium tracking-tight1">Promotion codes</h3>
            <p className="mt-0.5 text-[12.5px] text-muted">Percentage codes saved with this plan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-[1_1_180px]">
              <Input
                aria-label="Coupon code"
                invalid={!!couponError}
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoupon(); } }}
                placeholder="e.g. SUMMER50"
                className="font-mono uppercase"
                maxLength={30}
              />
            </div>
            <div className="relative w-[112px] flex-shrink-0">
              <Input
                aria-label="Coupon discount percent"
                invalid={!!couponError}
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                step="1"
                value={couponPct}
                onChange={(e) => { setCouponPct(e.target.value); setCouponError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoupon(); } }}
                className="pr-9"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted" aria-hidden="true">%</span>
            </div>
            <Button variant="soft" icon={Plus} onClick={addCoupon} className="flex-shrink-0">Add code</Button>
          </div>
          {couponError && <p className="field-error-text" role="alert">{couponError}</p>}
          {coupons.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {coupons.map((c) => (
                <li
                  key={c.code}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-[13px]',
                    c.isActive === false ? 'border border-line bg-white text-muted' : 'bg-lime-soft text-lime-ink',
                  )}
                >
                  <Ticket size={12} className="flex-shrink-0" aria-hidden="true" />
                  <span className="font-mono text-[12px] uppercase tracking-mono">{c.code}</span>
                  <span className="tabular">−{c.discountPercent}%</span>
                  {c.isActive === false && <span className="font-mono text-[10px] uppercase tracking-mono">inactive</span>}
                  <button
                    type="button"
                    onClick={() => setCoupons((p) => p.filter((x) => x.code !== c.code))}
                    aria-label={`Remove coupon ${c.code}`}
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full transition-colors hover:bg-white/70"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-faint">No promotion codes on this plan.</p>
          )}
        </section>
      </form>
    </Modal>
  );
}
