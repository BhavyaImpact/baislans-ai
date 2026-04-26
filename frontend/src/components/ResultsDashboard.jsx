/**
 * ResultsDashboard.jsx
 * ---------------------
 * Top-level results wrapper. Shows:
 *  1. Key disparity banner (the single worst finding, prominent callout)
 *  2. Score + group comparison bars (BiasScoreCard)
 *  3. Issue list (IssuesList)
 *
 * Accepts the full analysisResult object from biasAnalyzer.
 *
 * Props:
 *   result       — full analyzeDataset() return value
 *   apiWarning   — optional string (e.g. "Input truncated due to size limits")
 *   fromCache    — boolean (true if Gemini response was cached)
 */

import React from 'react';
import BiasScoreCard from './BiasScoreCard';
import IssuesList    from './IssuesList';

// ── Key disparity banner ──────────────────────────────────────────────────────
// Surfaced as the very first thing users see — one-sentence impact statement.
function DisparityBanner({ disparity }) {
  if (!disparity) return null;

  const { bestGroup, worstGroup, diff, column, severity } = disparity;
  const diffPct = Math.round(diff * 100);

  const styles = {
    high:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   icon: '🔴', ring: 'pulse-ring' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '🟡', ring: '' },
    low:    { bg: 'bg-yellow-50',border: 'border-yellow-200',text: 'text-yellow-800',icon: '🟡', ring: '' },
  };
  const s = styles[severity] || styles.medium;

  return (
    <div className={`rounded-2xl border p-5 ${s.bg} ${s.border} ${s.ring} fade-in`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{s.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${s.text}`}>
          Key disparity detected
        </span>
      </div>
      <p className={`text-lg font-semibold leading-snug ${s.text}`}>
        "{worstGroup.group}" has a{' '}
        <span className="underline decoration-2 underline-offset-2">{diffPct}% lower</span>{' '}
        {disparity.column !== null ? `${column} ` : ''}approval rate than "{bestGroup.group}"
      </p>
      <p className={`text-sm mt-1.5 opacity-75 ${s.text}`}>
        {Math.round(bestGroup.rate * 100)}% vs {Math.round(worstGroup.rate * 100)}%
        &nbsp;—&nbsp;this exceeds the 20% fairness threshold (disparate impact doctrine)
      </p>
    </div>
  );
}

// ── Metadata bar ─────────────────────────────────────────────────────────────
function MetaBar({ result, apiWarning, fromCache }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
      <span>{result.totalRows.toLocaleString()} rows analyzed</span>
      <span>·</span>
      <span>{result.sensitiveColumns.length} attribute{result.sensitiveColumns.length !== 1 ? 's' : ''}</span>
      <span>·</span>
      <span>outcome: <strong className="text-gray-600">{result.outcomeColumn || 'none'}</strong></span>

      {fromCache && (
        <>
          <span>·</span>
          <span className="text-indigo-400 font-medium">⚡ cached result</span>
        </>
      )}

      {apiWarning && (
        <span className="ml-auto bg-amber-100 text-amber-700 border border-amber-200
                         rounded-full px-2.5 py-0.5 font-medium">
          ⚠ {apiWarning}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ResultsDashboard({ result, apiWarning, fromCache }) {
  return (
    <div className="space-y-5 fade-in">
      {/* Key disparity banner — most impactful finding upfront */}
      <DisparityBanner disparity={result.worstDisparity} />

      {/* Metadata */}
      <MetaBar result={result} apiWarning={apiWarning} fromCache={fromCache} />

      {/* Bias score + group comparison bars */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Bias score
        </p>
        <BiasScoreCard
          score={result.score}
          category={result.category}
          totalRows={result.totalRows}
          issueCount={result.issues.length}
          sensitiveCount={result.sensitiveColumns.length}
          groupStats={result.groupStats}
          outcomeColumn={result.outcomeColumn}
        />
      </div>

      {/* Detected issues */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Detected issues
        </p>
        <IssuesList issues={result.issues} />
      </div>
    </div>
  );
}
