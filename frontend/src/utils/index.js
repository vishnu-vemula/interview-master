/**
 * utils/index.js — Barrel for utility helpers
 */

/**
 * cn — Merge class names conditionally (wrapper around clsx)
 * Usage: cn('base-class', isActive && 'active-class', { 'other': flag })
 */
export { clsx as cn } from 'clsx';

/**
 * formatDate — Format a date string to human-readable form
 * @param {string|Date} date
 * @param {Intl.DateTimeFormatOptions} options
 */
export const formatDate = (date, options = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  date ? new Date(date).toLocaleDateString('en-US', options) : '—';

export const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

/** timeAgo — "3 min ago" style relative time. */
export const timeAgo = (date) => {
  if (!date) return '';
  const diff = Math.max(0, Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units = [
    [60 * 60 * 24 * 365, 'yr'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24 * 7, 'wk'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hr'],
    [60, 'min'],
  ];
  for (const [secs, label] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return `${n} ${label}${n > 1 && label !== 'min' && label !== 'hr' ? 's' : ''} ago`;
    }
  }
  return 'just now';
};

/**
 * formatDuration — Convert seconds to MM:SS
 * @param {number} seconds
 */
export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * truncate — Truncate a string to a max length
 */
export const truncate = (str, max = 100) =>
  str?.length > max ? `${str.slice(0, max)}...` : str;

/**
 * getScoreColor — text colour class for a 0–100 practice score
 */
export const getScoreColor = (score) => {
  if (score >= 70) return 'text-lime-ok';
  if (score >= 40) return 'text-brand-600';
  return 'text-coral';
};

/** getErrorMessage — best human message from an axios error. */
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  const data = err?.response?.data;
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  if (err?.code === 'ERR_NETWORK') return 'Can’t reach the server. Check your connection and try again.';
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return fallback;
};

/** Format INR from rupees. */
export const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
