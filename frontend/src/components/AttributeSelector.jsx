/**
 * AttributeSelector.jsx
 * ----------------------
 * Lets users confirm/adjust which columns to treat as sensitive attributes
 * before running the bias analysis.
 *
 * Shows:
 *  - All auto-detected sensitive columns pre-checked
 *  - All other columns unchecked (user can add them)
 *  - The detected outcome column as a read-only indicator
 *
 * Props:
 *   allColumns        — string[] all CSV column names
 *   autoDetected      — string[] columns BiasLens detected as sensitive
 *   outcomeColumn     — string | null detected outcome column
 *   selected          — string[] currently checked columns (controlled)
 *   onChange(cols)    — called with new selected array when user toggles
 */

import React from 'react';

// Human-readable descriptions for known sensitive attributes
const ATTR_DESCRIPTIONS = {
  gender:      'Gender / sex identity',
  sex:         'Biological sex',
  race:        'Race / racial group',
  ethnicity:   'Ethnic background',
  age:         'Age (can indicate age discrimination)',
  religion:    'Religious affiliation',
  nationality: 'Country of origin / citizenship',
  marital:     'Marital status',
  disability:  'Disability status',
  orientation: 'Sexual orientation',
  caste:       'Caste classification',
};

function getDescription(colName) {
  const key = Object.keys(ATTR_DESCRIPTIONS).find(k =>
    colName.toLowerCase().includes(k)
  );
  return key ? ATTR_DESCRIPTIONS[key] : 'Custom attribute';
}

export default function AttributeSelector({
  allColumns,
  autoDetected,
  outcomeColumn,
  selected,
  onChange,
}) {
  // Columns available for selection = all except the outcome column
  const selectableColumns = allColumns.filter(c => c !== outcomeColumn);

  function toggle(col) {
    if (selected.includes(col)) {
      onChange(selected.filter(c => c !== col));
    } else {
      onChange([...selected, col]);
    }
  }

  function selectAll()   { onChange(selectableColumns); }
  function clearAll()    { onChange([]); }

  return (
    <div className="section-card p-5 space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Select sensitive attributes to analyze
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            BiasLens will measure outcome disparities across groups in each checked column.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={selectAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            All
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium">
            None
          </button>
        </div>
      </div>

      {/* Column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {selectableColumns.map(col => {
          const isChecked    = selected.includes(col);
          const wasDetected  = autoDetected.includes(col);
          const desc         = getDescription(col);

          return (
            <label
              key={col}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer
                transition-all duration-100
                ${isChecked
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50'}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(col)}
                className="attr-checkbox mt-0.5"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 truncate">{col}</span>
                  {wasDetected && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                      auto-detected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Outcome column indicator */}
      {outcomeColumn && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400">Outcome column:</span>
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
            ★ {outcomeColumn}
          </span>
          <span className="text-xs text-gray-400">(auto-detected · not editable)</span>
        </div>
      )}

      {/* Warning if none selected */}
      {selected.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex gap-2">
          <span>⚠</span>
          <span>Select at least one attribute to run the analysis.</span>
        </div>
      )}
    </div>
  );
}
