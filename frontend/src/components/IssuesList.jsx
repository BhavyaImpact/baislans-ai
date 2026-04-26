/**
 * IssuesList.jsx
 * ---------------
 * Severity-coded issue cards. Sorted high → medium → low.
 * No changes to logic — visual polish only in v2.
 */

import React from 'react';

const SEV = {
  high:   { label: 'High',   bg: 'bg-red-50',    leftBorder: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500'   },
  medium: { label: 'Medium', bg: 'bg-amber-50',  leftBorder: 'border-l-amber-400',  badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  low:    { label: 'Low',    bg: 'bg-yellow-50', leftBorder: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-700',dot: 'bg-yellow-400'},
  info:   { label: 'Info',   bg: 'bg-blue-50',   leftBorder: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'  },
};

function IssueCard({ issue }) {
  const s = SEV[issue.severity] || SEV.info;

  return (
    <div className={`rounded-xl border border-gray-100 border-l-4 ${s.leftBorder} ${s.bg} p-4`}>
      {/* Title row */}
      <div className="flex items-start gap-2 mb-1.5 flex-wrap">
        <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0">{issue.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${s.badge}`}>
          {s.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{issue.description}</p>

      {/* Group pills */}
      {issue.allRates && issue.allRates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {issue.allRates
            .slice()
            .sort((a, b) => b.rate - a.rate)
            .map(r => (
              <span key={r.group}
                className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200
                           rounded-full px-2.5 py-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} inline-block`}/>
                {r.group}: <strong>{Math.round(r.rate * 100)}%</strong>
                <span className="text-gray-400">(n={r.total})</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

export default function IssuesList({ issues }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 border-l-4 border-l-green-500
                      rounded-xl p-4 fade-in">
        <p className="text-sm font-semibold text-green-800">✓ No significant bias detected</p>
        <p className="text-sm text-green-700 mt-1 leading-relaxed">
          All group differences are within the 20% threshold.
          The dataset appears relatively fair for the selected attributes.
        </p>
      </div>
    );
  }

  const sorted = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, info: 3 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="space-y-3">
      {sorted.map(issue => <IssueCard key={issue.id} issue={issue} />)}
    </div>
  );
}
