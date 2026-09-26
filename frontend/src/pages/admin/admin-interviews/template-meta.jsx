/**
 * Shared interview / template metadata for the admin interviews page.
 */

import { Pill } from '@/components/ui';

export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', tone: 'ok' },
  { value: 'medium', label: 'Medium', tone: 'blue' },
  { value: 'hard', label: 'Hard', tone: 'coral' },
];

export const VOICES = [
  { value: 'alloy', label: 'Alloy (neutral)' },
  { value: 'echo', label: 'Echo (male)' },
  { value: 'fable', label: 'Fable (male)' },
  { value: 'onyx', label: 'Onyx (male)' },
  { value: 'nova', label: 'Nova (female)' },
  { value: 'shimmer', label: 'Shimmer (female)' },
];

export const PROMPT_KINDS = [
  { value: 'system', label: 'System', key: 'systemPrompt' },
  { value: 'evaluation', label: 'Evaluation', key: 'evaluationPrompt' },
  { value: 'feedback', label: 'Feedback', key: 'feedbackPrompt' },
];

/** Interview status → pill tone (draft/ready/in progress/completed). */
export const STATUS_TONE = {
  draft: 'stone',
  ready: 'blue',
  in_progress: 'blue',
  completed: 'ok',
};

export function DifficultyPill({ difficulty }) {
  const match = DIFFICULTIES.find((d) => d.value === difficulty);
  return (
    <Pill tone={match?.tone || 'stone'} mono>
      {match?.label || difficulty || '—'}
    </Pill>
  );
}

export const humanize = (value) => (value ? String(value).replace(/_/g, ' ') : '—');
