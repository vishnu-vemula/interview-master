import { CONTRACT_PATTERNS, SORT_PATTERNS, SALARY_RANGE_RE, parseSalary, SALARY_MIN_RE, SALARY_EXACT_RE, EXPERIENCE_RE, REMOTE_RE, cleanText, LEVEL_EXPERIENCE_MAP , LOCATION_RE} from './rules';
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

// ─── STAGE 1 — Rule-Based Parser ─────────────────────────────────────────────

/**
 * Extract all structured fields from the query using regex rules.
 * Returns the spec §2.2 canonical shape plus Adzuna adapter fields.
 *
 * @param {string} raw - Free-text query
 * @returns {object}
 */
export function ruleBasedParse(raw) {
  if (!raw || typeof raw !== 'string') return {};

  let text    = raw.trim();
  const out   = {
    keywords  : null,
    location  : null,
    remote    : false,
    experience: null,

    // Adzuna adapter
    contract  : null,
    salaryMin : null,
    salaryMax : null,
    sortBy    : null,
    sortDir   : null,
  };

  // ── Contract type ──────────────────────────────────────────────────
  for (const { regex, value } of CONTRACT_PATTERNS) {
    if (regex.test(text)) {
      out.contract = value;
      text = text.replace(regex, '').trim();
      break;
    }
  }

  // ── Sort intent ────────────────────────────────────────────────────
  for (const { regex, sortBy, sortDir } of SORT_PATTERNS) {
    if (regex.test(text)) {
      out.sortBy  = sortBy;
      out.sortDir = sortDir;
      text = text.replace(regex, '').trim();
      break;
    }
  }

  // ── Salary range ("60k-80k", "60k to 80k") ────────────────────────
  const rangeM = SALARY_RANGE_RE.exec(text);
  if (rangeM) {
    const isK = /k/i.test(rangeM[0]);
    out.salaryMin = parseSalary(rangeM[1], isK);
    out.salaryMax = parseSalary(rangeM[2], isK);
    text = text.replace(SALARY_RANGE_RE, '').trim();
  } else {
    const minM = SALARY_MIN_RE.exec(text);
    if (minM) {
      out.salaryMin = parseSalary(minM[1], true);
      text = text.replace(SALARY_MIN_RE, '').trim();
    } else {
      const exactM = SALARY_EXACT_RE.exec(text);
      if (exactM) {
        out.salaryMin = parseSalary(exactM[1]);
        text = text.replace(SALARY_EXACT_RE, '').trim();
      }
    }
  }

  // ── Experience (explicit years) ────────────────────────────────────
  const expM = EXPERIENCE_RE.exec(text);
  if (expM) {
    out.experience = parseInt(expM[1], 10);
    text = text.replace(EXPERIENCE_RE, '').trim();
  }

  // ── Remote / location ─────────────────────────────────────────────
  if (REMOTE_RE.test(text)) {
    out.remote = true;
    text = text.replace(REMOTE_RE, '').trim();
  }

  const locM = LOCATION_RE.exec(text);
  if (locM) {
    out.location = cleanText(locM[1]);
    text = text.replace(LOCATION_RE, '').trim();
  }

  // ── Experience fallback from seniority level ───────────────────────
  if (out.experience === null) {
    for (const { regex, years } of LEVEL_EXPERIENCE_MAP) {
      if (regex.test(text)) {
        out.experience = years;
        break; // don't strip — seniority word stays in keywords
      }
    }
  }

  // ── Keywords — whatever survives all extractions ───────────────────
  const keywords = cleanText(text);
  if (keywords) out.keywords = keywords;

  return out;
}

// ─── STAGE 2 — Ambiguity Detector ────────────────────────────────────────────

/**
 * Score how ambiguous a raw query is (0 = crystal-clear, 100 = total mystery).
 * The LLM fallback is triggered when score ≥ AMBIGUITY_THRESHOLD.
 *
 * Heuristics:
 *   +30  Very short (≤ 2 words) — almost no signal
 *   +20  No keywords extracted after all other fields removed
 *   +20  Location absent AND no remote flag — could be anywhere
 *   +15  Query contains slash-separated alternatives ("python/java")
 *   +10  Query contains parentheses or brackets — unusual phrasing
 *   +10  Multiple comma-separated clauses with no extracted structure
 *   -20  At least one structured field extracted (salary / contract / sort)
 *
 * @param {string}  raw      - Original raw query
 * @param {object}  parsed   - Output of ruleBasedParse()
 * @returns {number} 0–100
 */
export const AMBIGUITY_THRESHOLD = 35;

export function ambiguityScore(raw, parsed) {
  const words = raw.trim().split(/\s+/);
  let score = 0;

  if (words.length <= 2)                           score += 30;
  if (!parsed.keywords)                            score += 20;
  if (!parsed.location && !parsed.remote)          score += 20;
  if (/[\/\\]/.test(raw))                          score += 15;
  if (/[()[\]{}]/.test(raw))                       score += 10;

  // Multiple comma-clauses with no extracted structure
  const commaClauses = raw.split(',').length - 1;
  if (commaClauses >= 2 && !parsed.contract && !parsed.salaryMin) score += 10;

  // Discount: if we extracted meaningful structured fields the parse was good
  const structuredFields = ['contract', 'salaryMin', 'salaryMax', 'sortBy', 'experience']
    .filter((k) => parsed[k] !== null && parsed[k] !== undefined);
  if (structuredFields.length > 0)                 score -= 20;

  return Math.max(0, Math.min(100, score));
}

// ─── STAGE 3 — LLM Fallback (Groq) ───────────────────────────────────────────

/**
 * Call Groq to parse an ambiguous query into the canonical shape.
 * Only invoked when ambiguityScore ≥ AMBIGUITY_THRESHOLD.
 *
 * Uses llama-3.3-70b-versatile at temperature=0 for deterministic JSON.
 *
 * @param {string} query
 * @param {object} partial - Partial output from ruleBasedParse (may have some fields)
 * @returns {Promise<object>} Canonical shape (same keys as ruleBasedParse output)
 */
export async function llmFallbackParse(query, partial = {}) {
  // Lazy-require so the module is still importable without Groq configured
  let groq;
  try {
    groq = require('../config/groq');
  } catch {
    // Groq not configured — return partial result with a flag
    return { ...partial, _llmSkipped: true };
  }

  const systemPrompt = `You are a job-search query parser. Extract structured fields from the user's query.

Rules:
- keywords : the job title and/or skills (string, lowercase, space-separated)
- location : city or region name (string | null). Do NOT include country names unless specified.
- remote   : true if query mentions remote/WFH/telecommute, else false (boolean)
- experience: minimum years of experience as an integer (number | null). Infer from "senior"→5, "junior"→0, etc.
- contract : "full_time" | "part_time" | "contract" | "permanent" | null
- salaryMin: integer (null if not mentioned)
- salaryMax: integer (null if not mentioned)
- sortBy   : "date" | "salary" | "relevance" | null
- sortDir  : "up" | "down" | null

Return ONLY valid JSON with exactly these keys. No explanation, no markdown.`;

  const userPrompt = `Parse this job-search query:
"${query}"

Partial rule-based extraction for reference (may be incomplete):
${JSON.stringify(partial, null, 2)}

Return the complete JSON object now:`;

  try {
    const response = await groq.chat.completions.create({
      model          : 'llama-3.3-70b-versatile',
      messages       : [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature    : 0,
      max_tokens     : 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    const llmOut = JSON.parse(content);

    // Merge: LLM fills in what rules missed, but non-null rule values still win
    return mergeOutputs(partial, llmOut);
  } catch (err) {
    // LLM failed — degrade gracefully to rule-based result
    // @ts-expect-error TODO(ts-migration): type this site
    console.warn('[queryParser] LLM fallback failed, using rule-based result:', err.message);
    return { ...partial, _llmFailed: true };
  }
}

/**
 * Merge rule-based and LLM outputs.
 * Rule-based wins when it has a non-null value; LLM fills the gaps.
 *
 * @param {object} rules
 * @param {object} llm
 * @returns {object}
 */
export function mergeOutputs(rules, llm) {
  const KEYS = ['keywords', 'location', 'remote', 'experience', 'contract', 'salaryMin', 'salaryMax', 'sortBy', 'sortDir'];
  const merged = {};

  for (const key of KEYS) {
    const rVal = rules[key];
    const lVal = llm[key];

    if (rVal !== null && rVal !== undefined && rVal !== false) {
      merged[key] = rVal;       // rule-based wins
    } else if (lVal !== null && lVal !== undefined) {
      merged[key] = lVal;       // LLM fills the gap
    } else {
      merged[key] = rVal ?? null;
    }
  }

  return merged;
}

