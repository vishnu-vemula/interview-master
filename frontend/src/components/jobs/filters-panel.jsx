import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';

// Must match api/src/models/job.model.ts contractType enum.
export const CONTRACT_TYPES = [
  { value: '', label: 'Any' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

const SALARY_MAX = 150000;

/** FiltersPanel — draft filters applied on "Apply" (salary floor + contract type). Salaries are GBP (Adzuna UK). */
export default function FiltersPanel({ filters, onApply }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { setDraft(filters); }, [filters]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = draft.salaryMin !== filters.salaryMin || draft.jobType !== filters.jobType;
  const reset = () => {
    const cleared = { salaryMin: 0, jobType: '' };
    setDraft(cleared);
    onApply(cleared);
  };

  return (
    <div className="card p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[16px] font-medium"><SlidersHorizontal size={16} aria-hidden="true" /> Filters</p>
        {(filters.salaryMin > 0 || filters.jobType) && (
          <button type="button" onClick={reset} className="mono-label text-brand-600 hover:text-ink">Reset</button>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="salary-min" className="mono-label text-muted">Minimum salary</label>
          <span className="text-[14px] font-medium tabular">{Number(draft.salaryMin) > 0 ? `£${Number(draft.salaryMin).toLocaleString('en-GB')}+` : 'Any'}</span>
        </div>
        <input
          id="salary-min"
          type="range"
          min="0"
          max={SALARY_MAX}
          step="10000"
          value={draft.salaryMin}
          onChange={(e) => set('salaryMin', Number(e.target.value))}
          className="mt-3 w-full accent-ink"
        />
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint"><span>£0</span><span>£150k</span></div>
      </div>

      <fieldset className="mt-6">
        <legend className="mono-label mb-3 text-muted">Contract</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONTRACT_TYPES.map((o) => (
            <button key={o.value || 'any'} type="button" className="chip-toggle py-1.5 text-[13px]" aria-pressed={draft.jobType === o.value} onClick={() => set('jobType', o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button variant="ink" className="mt-6 w-full" disabled={!dirty} onClick={() => onApply(draft)}>
        Apply filters
      </Button>
    </div>
  );
}
