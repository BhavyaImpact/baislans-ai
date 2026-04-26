/**
 * UploadSection.jsx
 * ------------------
 * Two-mode data input:
 *   Mode A (default) — drag-and-drop / click CSV upload
 *   Mode B           — paste a plain-text dataset summary manually
 *
 * Props:
 *   onFileLoaded(data, fields, filename)  — called after CSV is parsed
 *   onSummarySubmit(summaryText)          — called when user submits text mode
 */

import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

// ── Sample CSV ────────────────────────────────────────────────────────────────
const SAMPLE_CSV = `age,gender,race,income,education,loan_amount,approved
35,Male,White,75000,Bachelor,15000,1
28,Female,Black,45000,Bachelor,12000,0
42,Male,White,92000,Master,25000,1
31,Female,Hispanic,38000,High School,8000,0
55,Male,White,110000,PhD,40000,1
26,Female,Black,32000,Some College,6000,0
39,Male,Asian,85000,Master,20000,1
33,Female,White,62000,Bachelor,14000,1
47,Male,Hispanic,58000,Bachelor,18000,0
29,Female,Black,28000,High School,5000,0
52,Male,White,98000,Master,35000,1
36,Female,Asian,72000,Bachelor,16000,1
41,Male,Black,55000,Bachelor,15000,0
30,Female,Hispanic,35000,Some College,7000,0
48,Male,White,88000,Bachelor,22000,1
27,Female,Black,25000,High School,4500,0
44,Male,Asian,95000,PhD,28000,1
32,Female,White,58000,Bachelor,13000,1
38,Male,Hispanic,48000,Bachelor,11000,0
25,Female,Black,22000,Some College,4000,0`;

// ── CSV parser wrapper ────────────────────────────────────────────────────────
function parseCSV(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: r => {
        if (r.errors.length > 0) reject(new Error(r.errors[0].message));
        else resolve({ data: r.data, fields: r.meta.fields || [] });
      },
      error: reject,
    });
  });
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UploadSection({ onFileLoaded, onSummarySubmit }) {
  const [mode, setMode]         = useState('csv');   // 'csv' | 'text'
  const [isDragging, setDrag]   = useState(false);
  const [error, setError]       = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [textError, setTextError]     = useState('');
  const inputRef = useRef(null);

  // ── CSV handlers ─────────────────────────────────────────────────────────────
  async function handleFile(file) {
    setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file (comma-separated values).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }
    try {
      const text = await file.text();
      const { data, fields } = await parseCSV(text);
      if (data.length === 0) { setError('CSV has no data rows. Check the file and try again.'); return; }
      onFileLoaded(data, fields, file.name);
    } catch (err) {
      setError('Could not parse file: ' + err.message);
    }
  }

  async function loadSample() {
    try {
      const { data, fields } = await parseCSV(SAMPLE_CSV);
      onFileLoaded(data, fields, 'loan_approvals_sample.csv');
    } catch (err) {
      setError('Failed to load sample: ' + err.message);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  }

  // ── Text summary handler ──────────────────────────────────────────────────────
  function handleTextSubmit() {
    setTextError('');
    const trimmed = summaryText.trim();
    if (trimmed.length < 30) {
      setTextError('Please enter a more detailed dataset summary (at least 30 characters).');
      return;
    }
    onSummarySubmit(trimmed);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="section-card p-6 space-y-4 fade-in">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <Tab label="Upload CSV file" active={mode === 'csv'}  onClick={() => setMode('csv')} />
        <Tab label="Paste summary"   active={mode === 'text'} onClick={() => setMode('text')} />
      </div>

      {/* ── Mode A: CSV upload ── */}
      {mode === 'csv' && (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer select-none
              transition-all duration-150
              ${isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'}`}
          >
            {/* Icon */}
            <div className="mx-auto w-12 h-12 mb-3 text-gray-400">
              <svg viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="10" fill="currentColor" fillOpacity="0.1"/>
                <path d="M24 13v18M24 13l-6 6M24 13l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13 35h22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="font-medium text-gray-700 text-sm">Drop your CSV file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · max 10 MB</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={e => handleFile(e.target.files?.[0])} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 text-red-700
                            rounded-xl px-4 py-3 text-sm">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Format hint */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-medium">CSV format requirements</p>
            <p>· First row must be column headers</p>
            <p>· Include at least one demographic column (gender, race, age…)</p>
            <p>· Include a binary outcome column (approved, hired, selected…)</p>
          </div>

          {/* Sample link */}
          <p className="text-center text-sm text-gray-500">
            No file?{' '}
            <button onClick={loadSample}
              className="text-indigo-600 font-medium hover:text-indigo-800 underline underline-offset-2">
              Load the loan approvals sample dataset
            </button>
          </p>
        </div>
      )}

      {/* ── Mode B: Text summary ── */}
      {mode === 'text' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Don't have a CSV? Paste a plain-text description of your dataset and the bias
            patterns you've noticed. Gemini will analyze it directly.
          </p>
          <textarea
            value={summaryText}
            onChange={e => setSummaryText(e.target.value)}
            rows={7}
            placeholder={`Example:
Dataset: 500 job applications. Columns: age, gender, education, experience, hired.
Findings: Female applicants have a 38% hire rate vs 61% for males.
Older applicants (50+) have a 22% hire rate vs 55% for those under 35.`}
            className="w-full text-sm border border-gray-200 rounded-xl p-4 resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                       placeholder:text-gray-400 leading-relaxed"
          />

          {textError && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 text-red-700
                            rounded-xl px-4 py-3 text-sm">
              <span>⚠</span><span>{textError}</span>
            </div>
          )}

          <button
            onClick={handleTextSubmit}
            disabled={summaryText.trim().length < 10}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm
                       hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze with Gemini →
          </button>
        </div>
      )}
    </div>
  );
}
