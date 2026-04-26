/**
 * DataPreview.jsx
 * ----------------
 * Compact scrollable table showing first 8 rows.
 * Color-codes columns: purple = outcome, indigo = selected sensitive attribute.
 *
 * Props:
 *   data             — array of row objects
 *   headers          — all column names
 *   filename         — uploaded file name
 *   selectedColumns  — user-confirmed sensitive columns (indigo highlight)
 *   outcomeColumn    — detected outcome column (purple highlight)
 */

import React from 'react';

const MAX_ROWS = 8;

export default function DataPreview({ data, headers, filename, selectedColumns = [], outcomeColumn }) {
  const rows = data.slice(0, MAX_ROWS);

  function headerStyle(col) {
    if (col === outcomeColumn)         return 'bg-purple-100 text-purple-700';
    if (selectedColumns.includes(col)) return 'bg-indigo-100 text-indigo-700';
    return 'bg-gray-100 text-gray-500';
  }

  function cellStyle(col) {
    if (col === outcomeColumn)         return 'text-purple-700 font-medium';
    if (selectedColumns.includes(col)) return 'text-indigo-700';
    return 'text-gray-600';
  }

  return (
    <div className="section-card overflow-hidden fade-in">
      {/* File info bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.5L9.5 0H4zm5 1.5V4h2.5L9 1.5z"/>
          </svg>
          <span className="text-sm font-medium text-gray-700">{filename}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{data.length} rows</span>
          <span>·</span>
          <span>{headers.length} columns</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 text-xs text-gray-400 border-b border-gray-100 flex-wrap">
        {selectedColumns.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 inline-block"/>
            Sensitive attribute
          </span>
        )}
        {outcomeColumn && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-200 inline-block"/>
            Outcome column
          </span>
        )}
        {data.length > MAX_ROWS && (
          <span className="ml-auto">showing {MAX_ROWS} of {data.length} rows</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {headers.map(col => (
                <th key={col}
                  className={`px-3 py-2 text-left font-semibold whitespace-nowrap
                    border-b border-gray-100 ${headerStyle(col)}`}>
                  {col}
                  {selectedColumns.includes(col) && <span className="ml-1 text-indigo-400">●</span>}
                  {col === outcomeColumn && <span className="ml-1 text-purple-400">★</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 last:border-none">
                {headers.map(col => (
                  <td key={col} className={`px-3 py-2 whitespace-nowrap ${cellStyle(col)}`}>
                    {row[col] !== undefined ? String(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
