/**
 * BiasScoreCard.jsx
 * ------------------
 * Score gauge + per-group horizontal bar chart.
 *
 * Changes v2:
 *  - Mobile-responsive grid (1 col on sm, 3 on md+)
 *  - Cleaner score ring indicator
 *  - Disparity delta label on group bars
 */

import React from 'react';

const CATEGORY = {
  low:    { text: 'text-green-700', bar: 'bg-green-500', bg: 'bg-green-50',  border: 'border-green-200', label: 'Low Risk',    emoji: '✅' },
  medium: { text: 'text-amber-700', bar: 'bg-amber-400', bg: 'bg-amber-50',  border: 'border-amber-200', label: 'Medium Risk', emoji: '⚠️' },
  high:   { text: 'text-red-700',   bar: 'bg-red-500',   bg: 'bg-red-50',    border: 'border-red-200',   label: 'High Risk',   emoji: '🔴' },
};

function MetricTile({ label, value, sub, valueClass = '' }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function GroupBar({ group, rate, isHighest, isLowest, maxRate }) {
  const pct       = Math.round(rate * 100);
  const maxPct    = Math.round(maxRate * 100);
  const delta     = isLowest && !isHighest ? maxPct - pct : null;
  const barColor  = isHighest ? 'bg-green-500' : isLowest ? 'bg-red-400' : 'bg-blue-400';

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 sm:w-24 shrink-0 text-xs text-gray-500 truncate">{group}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full score-bar-fill ${barColor}`} style={{ width: `${pct}%` }}/>
      </div>
      <span className="w-10 text-right text-xs font-semibold text-gray-700">{pct}%</span>
      {delta !== null && (
        <span className="text-xs text-red-500 font-medium w-14 text-right shrink-0">
          −{delta}%
        </span>
      )}
    </div>
  );
}

export default function BiasScoreCard({ score, category, totalRows, issueCount, sensitiveCount, groupStats, outcomeColumn }) {
  const s = CATEGORY[category] || CATEGORY.medium;

  return (
    <div className="space-y-4">
      {/* ── Metric tiles — responsive grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Score tile */}
        <div className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
          <p className="text-xs text-gray-500 mb-1">Overall bias score</p>
          <p className={`text-3xl font-bold ${s.text}`}>
            {score}
            <span className="text-sm font-normal opacity-70">/100</span>
          </p>
          <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
            <div className={`h-full rounded-full score-bar-fill ${s.bar}`} style={{ width: `${score}%` }}/>
          </div>
          <span className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold
                            px-2.5 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
            {s.emoji} {s.label}
          </span>
        </div>

        <MetricTile
          label="Issues found"
          value={issueCount}
          sub="bias violations detected"
          valueClass={issueCount > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <MetricTile
          label="Attributes analyzed"
          value={sensitiveCount}
          sub={`across ${totalRows.toLocaleString()} records`}
        />
      </div>

      {/* ── Group comparison bars ── */}
      {Object.entries(groupStats).map(([col, rates]) => {
        if (rates.length < 2) return null;
        const maxRate = Math.max(...rates.map(r => r.rate));
        const minRate = Math.min(...rates.map(r => r.rate));

        return (
          <div key={col} className="section-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {col} → {outcomeColumn}
              </p>
              <span className="text-xs text-gray-400">
                n = {rates.reduce((s, r) => s + r.total, 0)}
              </span>
            </div>

            <div className="space-y-2">
              {rates
                .slice()
                .sort((a, b) => b.rate - a.rate)
                .map(r => (
                  <GroupBar
                    key={r.group}
                    group={r.group}
                    rate={r.rate}
                    isHighest={r.rate === maxRate}
                    isLowest={r.rate === minRate}
                    maxRate={maxRate}
                  />
                ))}
            </div>

            {/* Delta legend */}
            <div className="flex gap-4 text-xs text-gray-400 pt-1 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> Highest rate</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/> Lowest rate</span>
              <span className="flex items-center gap-1 ml-auto text-red-500 font-medium">−X% = gap vs highest</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
