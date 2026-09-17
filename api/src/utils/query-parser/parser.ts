import { ruleBasedParse, ambiguityScore, AMBIGUITY_THRESHOLD, llmFallbackParse } from './engine';
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

// ─── Public Entry Point ───────────────────────────────────────────────────────

/**
 * Parse a natural-language job-search query using §2.2 strategy:
 *   Rule-based → ambiguity check → LLM fallback (if needed)
 *
 * @param {string}  query          - Free-text query
 * @param {object}  [options]
 * @param {boolean} [options.forceLlm=false]   - Skip rules, go straight to LLM
 * @param {boolean} [options.disableLlm=false] - Never use LLM (useful in tests)
 * @returns {Promise<{
 *   keywords   : string|null,
 *   location   : string|null,
 *   remote     : boolean,
 *   experience : number|null,
 *   what       : string,
 *   where      : string|null,
 *   contract   : string|null,
 *   salaryMin  : number|null,
 *   salaryMax  : number|null,
 *   sortBy     : string|null,
 *   sortDir    : string|null,
 *   _parser    : 'rule-based'|'llm-fallback',
 *   _ambiguityScore: number,
 * }>}
 */
export async function parseQuery(query, { forceLlm = false, disableLlm = false } = {}) {
  if (!query || typeof query !== 'string') {
    return _withMeta({}, 0, 'rule-based');
  }

  // ── Stage 1: Rule-based ───────────────────────────────────────────
  const ruleResult = ruleBasedParse(query);
  const aScore     = ambiguityScore(query, ruleResult);

  // ── Stage 2: Ambiguity gate ───────────────────────────────────────
  const needsLlm = !disableLlm && (forceLlm || aScore >= AMBIGUITY_THRESHOLD);

  let finalResult;
  let parserUsed;

  if (needsLlm) {
    const llmResult = await llmFallbackParse(query, ruleResult);
    finalResult     = llmResult;
    parserUsed      = 'llm-fallback';
  } else {
    finalResult = ruleResult;
    parserUsed  = 'rule-based';
  }

  return _withMeta(finalResult, aScore, parserUsed);
}

/**
 * Attach parser metadata and derive the Adzuna `what` / `where` adapter fields.
 *
 * @param {object} parsed
 * @param {number} aScore
 * @param {string} parser
 * @returns {object}
 */
export function _withMeta(parsed, aScore, parser) {
  const where = parsed.remote
    ? 'remote'
    : (parsed.location ?? null);

  return {
    // ── Spec §2.2 canonical output ────────────────────────────────
    keywords   : parsed.keywords   ?? null,
    location   : parsed.location   ?? null,
    remote     : parsed.remote     ?? false,
    experience : parsed.experience ?? null,

    // ── Adzuna adapter ────────────────────────────────────────────
    what       : parsed.keywords   ?? '',
    where,
    contract   : parsed.contract   ?? null,
    salaryMin  : parsed.salaryMin  ?? null,
    salaryMax  : parsed.salaryMax  ?? null,
    sortBy     : parsed.sortBy     ?? null,
    sortDir    : parsed.sortDir    ?? null,

    // ── Parser metadata ───────────────────────────────────────────
    _parser         : parser,
    _ambiguityScore : aScore,
  };
}

// ─── Synchronous Thin Wrapper (for non-async callers) ─────────────────────────

/**
 * Synchronous rule-based only parse — no LLM, no async.
 * Use this when you cannot await (e.g. cache key building).
 *
 * @param {string} query
 * @returns {object}
 */
export function parseQuerySync(query) {
  const ruleResult = ruleBasedParse(query);
  const aScore     = ambiguityScore(query, ruleResult);
  return _withMeta(ruleResult, aScore, 'rule-based');
}

// ─── mergeWithParsed (used by adzuna.service.js) ─────────────────────────────

/**
 * Merge NL-parsed fields with explicit query params.
 * Explicit params always win. Async because parseQuery may invoke LLM.
 *
 * @param {object} explicitParams - Structured params from req.query
 * @param {string} [nlQuery]      - Optional free-text "q" param
 * @param {object} [options]      - Passed through to parseQuery()
 * @returns {Promise<object>}     - Merged params ready for searchJobs()
 */
export async function mergeWithParsed(explicitParams, nlQuery, options = {}) {
  if (!nlQuery) return explicitParams;

  const parsed = await parseQuery(nlQuery, options);

  // Strip meta keys before merging into Adzuna params
  const { _parser, _ambiguityScore, keywords, location, remote, experience, ...adzunaFields } = parsed;

  // Explicit params take precedence
  const merged = {
    ...adzunaFields,
    ...Object.fromEntries(
      Object.entries(explicitParams).filter(([, v]) => v !== undefined && v !== '')
    ),
  };

  // Carry parser metadata forward so it can be surfaced in the response
    // @ts-expect-error TODO(ts-migration): type this site
  merged._queryMeta = { parser: _parser, ambiguityScore: _ambiguityScore };

  return merged;
}


