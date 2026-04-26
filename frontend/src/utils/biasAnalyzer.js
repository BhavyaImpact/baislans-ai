/**
 * utils/biasAnalyzer.js — v3
 * ---------------------------
 * Core in-browser bias detection engine.
 *
 * Bug fixed in v3:
 *  🐛  "loan_amount" was matching the keyword "loan" via substring search,
 *      causing it to be detected as the outcome column instead of "approved".
 *      All group rates then computed as 0% because numeric loan amounts like
 *      "15000" never passed the isPositiveOutcome() check.
 *
 *  ✅  Fix: columnMatchesKeyword() now tokenises column names by splitting on
 *      underscore / hyphen / space, then requires an EXACT token match.
 *      "loan_amount" → tokens ["loan","amount"] matches "loan" — still wrong!
 *      So outcome detection now uses a PRIORITY list: exact-name keywords first,
 *      then token-match, with ambiguous short tokens ("loan","status") deprioritised.
 *
 *  ✅  Also fixed: "age" no longer matches "percentage", "stage", "mileage" etc.
 *  ✅  Also fixed: detectOutcomeColumn now scores candidates and picks highest.
 */

'use strict';

// ── Sensitive attribute keywords ──────────────────────────────────────────────
// These identify demographic columns that may be sources of bias.
export const SENSITIVE_COL_KEYWORDS = [
  'gender', 'sex', 'race', 'ethnicity',
  'religion', 'nationality', 'marital', 'disability',
  'color', 'origin', 'orientation', 'caste', 'age',
];

// ── Outcome column keywords (scored by specificity) ───────────────────────────
// HIGH score  → very specific, almost certainly an outcome column
// LOW score   → ambiguous — only use if nothing better found
const OUTCOME_KEYWORD_SCORES = {
  approved:  10,
  approval:  10,
  hired:     10,
  admitted:  10,
  accepted:  10,
  promoted:  10,
  granted:   10,
  qualified: 10,
  selected:   8,
  passed:     8,
  outcome:    8,
  result:     8,
  decision:   8,
  label:      6,
  target:     6,
  status:     4,  // ambiguous: "employment_status", "marital_status" etc.
  loan:       2,  // very ambiguous: "loan_amount", "loan_type" etc.
};

export const BIAS_THRESHOLD = 0.20;

// ── Token-based column matcher ────────────────────────────────────────────────
/**
 * Splits a column name into tokens (split on _ - space) and checks whether
 * any token EXACTLY equals the keyword.
 *
 * Examples:
 *   columnMatchesKeyword("loan_amount", "loan")    → true  (token "loan" matches)
 *   columnMatchesKeyword("loan_amount", "approved")→ false
 *   columnMatchesKeyword("approved",    "approved") → true
 *   columnMatchesKeyword("percentage",  "age")      → false (no token "age")
 *   columnMatchesKeyword("age_group",   "age")      → true  (token "age" matches)
 */
function columnMatchesKeyword(colName, keyword) {
  const col    = colName.toLowerCase();
  const kw     = keyword.toLowerCase();
  // Exact full-name match
  if (col === kw) return true;
  // Token match: split on non-alpha characters
  const tokens = col.split(/[\s_\-\.]+/);
  return tokens.includes(kw);
}

// ── Sensitive column detector ─────────────────────────────────────────────────
export function detectSensitiveColumns(columns) {
  return columns.filter(col =>
    SENSITIVE_COL_KEYWORDS.some(kw => columnMatchesKeyword(col, kw))
  );
}

// ── Outcome column detector ───────────────────────────────────────────────────
/**
 * Scores every column against OUTCOME_KEYWORD_SCORES and returns the
 * column with the highest score. Ties broken by column order (first wins).
 * Returns null if no column scores above 0.
 */
export function detectOutcomeColumn(columns) {
  let bestCol   = null;
  let bestScore = 0;

  columns.forEach(col => {
    let colScore = 0;
    Object.entries(OUTCOME_KEYWORD_SCORES).forEach(([kw, score]) => {
      if (columnMatchesKeyword(col, kw)) {
        colScore = Math.max(colScore, score);
      }
    });
    // Strict tie-breaking: first column wins, so only replace on strictly higher score
    if (colScore > bestScore) {
      bestScore = colScore;
      bestCol   = col;
    }
  });

  return bestScore > 0 ? bestCol : null;
}

// ── Outcome value normaliser ──────────────────────────────────────────────────
/**
 * Returns true for values that represent a "positive" outcome.
 * Handles binary (0/1), boolean strings, and word labels.
 */
function isPositiveOutcome(value) {
  const v = String(value).toLowerCase().trim();
  return (
    v === '1'        ||
    v === 'yes'      ||
    v === 'true'     ||
    v === 'approved' ||
    v === 'pass'     ||
    v === 'passed'   ||
    v === 'hired'    ||
    v === 'selected' ||
    v === 'admitted' ||
    v === 'accepted' ||
    v === 'granted'  ||
    v === 'promoted' ||
    v === 'qualified'
  );
}

// ── Group rate calculator ─────────────────────────────────────────────────────
/**
 * For one sensitive column, computes the positive-outcome rate per group.
 * Returns: [{ group, rate, total, positive }, ...]
 */
export function computeGroupRates(data, sensitiveCol, outcomeCol) {
  const groups = {};

  data.forEach(row => {
    const group = String(row[sensitiveCol] ?? 'Unknown').trim();
    if (!groups[group]) groups[group] = { total: 0, positive: 0 };
    groups[group].total++;
    if (isPositiveOutcome(row[outcomeCol])) groups[group].positive++;
  });

  return Object.entries(groups).map(([group, s]) => ({
    group,
    rate:     s.total > 0 ? s.positive / s.total : 0,
    total:    s.total,
    positive: s.positive,
  }));
}

// ── Main analysis function ────────────────────────────────────────────────────
/**
 * @param {object[]}       data             Parsed CSV rows
 * @param {string[]}       columns          All column names
 * @param {string[]|null}  userSelectedCols User-chosen sensitive columns (overrides auto-detect)
 */
export function analyzeDataset(data, columns, userSelectedCols = null) {
  const sensitiveColumns = (userSelectedCols && userSelectedCols.length > 0)
    ? userSelectedCols
    : detectSensitiveColumns(columns);

  const outcomeColumn = detectOutcomeColumn(columns);
  const issues        = [];
  const groupStats    = {};

  // ── Edge: no outcome column ──────────────────────────────────────────────────
  if (!outcomeColumn) {
    return {
      score: 5, category: 'low',
      issues: [{
        id: 'no-outcome', severity: 'info', column: null,
        title: 'No outcome column detected',
        description:
          'Rename your decision/result column to something like ' +
          '"approved", "hired", "outcome", or "result" and re-upload.',
      }],
      groupStats: {}, outcomeColumn: null,
      sensitiveColumns, totalRows: data.length, worstDisparity: null,
    };
  }

  // ── Edge: no sensitive columns ───────────────────────────────────────────────
  if (sensitiveColumns.length === 0) {
    return {
      score: 5, category: 'low',
      issues: [{
        id: 'no-sensitive', severity: 'info', column: null,
        title: 'No sensitive attribute columns found',
        description:
          'Use the attribute selector to choose which demographic columns to analyze ' +
          '(gender, race, age…).',
      }],
      groupStats: {}, outcomeColumn,
      sensitiveColumns: [], totalRows: data.length, worstDisparity: null,
    };
  }

  // ── Per-column analysis ──────────────────────────────────────────────────────
  sensitiveColumns.forEach(col => {
    // Skip: don't analyze the outcome column as if it were a sensitive attribute
    if (col === outcomeColumn) return;

    const rates = computeGroupRates(data, col, outcomeColumn);
    groupStats[col] = rates;
    if (rates.length < 2) return;

    const rateValues = rates.map(r => r.rate);
    const maxRate    = Math.max(...rateValues);
    const minRate    = Math.min(...rateValues);
    const diff       = maxRate - minRate;

    if (diff > BIAS_THRESHOLD) {
      const bestGroup  = rates.find(r => r.rate === maxRate);
      const worstGroup = rates.find(r => r.rate === minRate);
      const severity   = diff > 0.40 ? 'high' : diff > 0.25 ? 'medium' : 'low';

      issues.push({
        id:    `bias-${col}`,
        severity, column: col, diff,
        bestGroup, worstGroup, allRates: rates,
        title: `${col} bias in "${outcomeColumn}"`,
        description:
          `"${bestGroup.group}" has a ${Math.round(bestGroup.rate * 100)}% approval rate vs ` +
          `"${worstGroup.group}" at ${Math.round(worstGroup.rate * 100)}% — ` +
          `a ${Math.round(diff * 100)}% gap (threshold: 20%).`,
      });
    }
  });

  // ── Bias score (0–100) ───────────────────────────────────────────────────────
  let rawScore = issues.length === 0 ? 5 : 0;
  issues.forEach(i => {
    rawScore += i.severity === 'high' ? 40 : i.severity === 'medium' ? 25 : 12;
  });
  rawScore = Math.min(95, rawScore);

  const score    = rawScore;
  const category = score <= 30 ? 'low' : score <= 70 ? 'medium' : 'high';

  // ── Worst single disparity (for the DisparityBanner) ────────────────────────
  const worstDisparity = issues.length > 0
    ? issues.reduce((a, b) => (b.diff > a.diff ? b : a))
    : null;

  return {
    score, category, issues,
    groupStats, outcomeColumn,
    sensitiveColumns, totalRows: data.length,
    worstDisparity,
  };
}

// ── Summary builder (sent to Gemini) ─────────────────────────────────────────
export function buildDatasetSummary(analysisResult, columns) {
  const { score, issues, groupStats, outcomeColumn, sensitiveColumns, totalRows } = analysisResult;

  const lines = [
    `Total rows: ${totalRows}`,
    `All columns: ${columns.join(', ')}`,
    `Sensitive columns analyzed: ${sensitiveColumns.length > 0 ? sensitiveColumns.join(', ') : 'none'}`,
    `Outcome column: ${outcomeColumn || 'not found'}`,
    `Bias score: ${score}/100 (${score <= 30 ? 'Low' : score <= 70 ? 'Medium' : 'High'} risk)`,
    `Issues found: ${issues.length}`,
    '',
    'Detailed findings:',
  ];

  issues.forEach(issue => {
    lines.push(`  [${issue.severity.toUpperCase()}] ${issue.title}`);
    lines.push(`    ${issue.description}`);
    if (issue.allRates) {
      issue.allRates.forEach(r =>
        lines.push(`    - ${r.group}: ${Math.round(r.rate * 100)}% (n=${r.total})`)
      );
    }
  });

  if (Object.keys(groupStats).length > 0 && issues.length === 0) {
    lines.push('  All group differences are within the 20% threshold.');
    Object.entries(groupStats).forEach(([col, rates]) => {
      lines.push(
        `  ${col}: ${rates.map(r => `${r.group}=${Math.round(r.rate * 100)}%`).join(', ')}`
      );
    });
  }

  return lines.join('\n');
}
