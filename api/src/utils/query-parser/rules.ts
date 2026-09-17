'use strict';

/**
 * queryParser.js — §2.2 Query Parsing Layer
 *
 * Strategy:
 *   1. Rule-based parser  (zero latency, zero cost)   → always runs first
 *   2. Ambiguity detector (heuristic score 0–100)     → decides if LLM needed
 *   3. LLM fallback       (Groq, only when ambiguous) → fills in what rules missed
 *
 * Canonical output shape (spec §2.2):
 * {
 *   keywords   : string,        // job title / skills  e.g. "backend python"
 *   location   : string|null,   // city / region       e.g. "Bangalore"
 *   remote     : boolean,       // true if remote work mentioned
 *   experience : number|null,   // years of experience e.g. 5
 *
 *   // Adzuna adapter fields (derived from above, passed to buildSearchURL)
 *   what       : string,
 *   where      : string|null,
 *   contract   : string|null,
 *   salaryMin  : number|null,
 *   salaryMax  : number|null,
 *   sortBy     : string|null,
 *   sortDir    : string|null,
 *
 *   // Parser metadata
 *   _parser    : 'rule-based' | 'llm-fallback',
 *   _ambiguityScore : number,
 * }
 *
 * Examples:
 *   "backend python in Bangalore 5 years"
 *   → { keywords: "backend python", location: "Bangalore", remote: false, experience: 5 }
 *
 *   "remote react developer 60k+ latest"
 *   → { keywords: "react developer", location: null, remote: true, experience: null,
 *       salaryMin: 60000, sortBy: 'date', sortDir: 'down' }
 */

// ─── Rule Tables ──────────────────────────────────────────────────────────────

export const CONTRACT_PATTERNS = [
  { regex: /\b(full[\s-]?time)\b/i,                   value: 'full_time' },
  { regex: /\b(part[\s-]?time)\b/i,                   value: 'part_time' },
  { regex: /\b(contract|freelance|contractor)\b/i,    value: 'contract'  },
  { regex: /\b(permanent|perm)\b/i,                   value: 'permanent' },
];

export const SORT_PATTERNS = [
  { regex: /\b(latest|newest|recent)\b/i,             sortBy: 'date',   sortDir: 'down' },
  { regex: /\b(oldest|earliest)\b/i,                  sortBy: 'date',   sortDir: 'up'   },
  { regex: /\b(highest\s+salary|best\s+paid)\b/i,     sortBy: 'salary', sortDir: 'down' },
  { regex: /\b(lowest\s+salary|cheapest)\b/i,         sortBy: 'salary', sortDir: 'up'   },
];

// Salary: "60k+", "60k-80k", "£60,000", "$80k", "60000 to 80000"
export const SALARY_RANGE_RE = /[£$€]?\s*(\d[\d,]*)\s*k?\s*(?:to|[-–])\s*[£$€]?\s*(\d[\d,]*)\s*k?\b/i;
export const SALARY_MIN_RE   = /[£$€]?\s*(\d[\d,]*)\s*k\s*[+]/i;
export const SALARY_EXACT_RE = /[£$€]\s*(\d[\d,]+)/i;

// Experience: "5 years", "5+ yrs", "5 yr experience", "minimum 5 years"
export const EXPERIENCE_RE   = /\b(?:minimum\s+)?(\d{1,2})\s*[+]?\s*(?:years?|yrs?)\b(?:\s+(?:of\s+)?(?:experience|exp))?\b/i;

// Location: "in Bangalore", "at Mumbai", "near Chennai" — stops before known signal words
export const LOCATION_RE = /\b(?:in|at|near|from)\s+([A-Z][a-zA-Z\s,]{2,30}?)(?=\s*,|\s+(?:full|part|contract|perm|permanent|\d|£|\$|€|remote|latest|newest|recent)|$)/i;
export const REMOTE_RE   = /\b(remote(?:ly)?|work\s+from\s+home|wfh|telecommute)\b/i;

// Senior / level hints → infer minimum experience if explicit years absent
export const LEVEL_EXPERIENCE_MAP = [
  { regex: /\bjunior\b/i,          years: 0  },
  { regex: /\bmid[\s-]?level\b/i,  years: 3  },
  { regex: /\bsenior\b/i,          years: 5  },
  { regex: /\blead\b/i,            years: 7  },
  { regex: /\bstaff\b/i,           years: 8  },
  { regex: /\bprincipal\b/i,       years: 10 },
  { regex: /\bdirector\b/i,        years: 12 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseSalary(raw, isK = false) {
  const num = parseFloat(raw.replace(/[,\s]/g, ''));
  if (isNaN(num)) return null;
  return isK || num < 1000 ? Math.round(num * 1000) : Math.round(num);
}

export function cleanText(str) {
  return str
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

