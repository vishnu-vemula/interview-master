/**
 * PromptPreviewModal — read-only inspector for a template's system / evaluation / feedback prompts.
 */

import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Button, Modal, Segmented } from '@/components/ui';
import { DifficultyPill, PROMPT_KINDS } from './template-meta';

export default function PromptPreviewModal({ template, onClose, onEdit }) {
  const [activePromptTab, setActivePromptTab] = useState('system'); // 'system' | 'evaluation' | 'feedback'
  const kind = PROMPT_KINDS.find((k) => k.value === activePromptTab);
  const text = template?.[kind.key];

  return (
    <Modal
      open={!!template}
      onClose={onClose}
      size="lg"
      title="Prompt inspector"
      description={template?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="ink" icon={Edit3} onClick={() => onEdit(template)}>Edit template</Button>
        </>
      }
    >
      {template && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              ariaLabel="Prompt type"
              size="sm"
              value={activePromptTab}
              onChange={setActivePromptTab}
              options={PROMPT_KINDS.map(({ value, label }) => ({ value, label }))}
            />
            <DifficultyPill difficulty={template.difficulty} />
          </div>
          <pre
            role="tabpanel"
            aria-label={`${kind.label} prompt`}
            className="scroll-thin max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-r18 border border-line-2 bg-paper p-4 font-mono text-[12.5px] leading-relaxed text-ink"
          >
            {text || <span className="text-muted">No {kind.label.toLowerCase()} prompt set.</span>}
          </pre>
          <p className="mono-label text-muted">
            {text ? `${text.length.toLocaleString()} characters` : 'Empty'}
          </p>
        </div>
      )}
    </Modal>
  );
}
