/**
 * App.jsx — BiasLens AI root orchestrator
 * =========================================
 * Manages the 4-step flow:
 *   Step 1: Upload (CSV or text summary)
 *   Step 2: Configure (preview table + attribute selector)
 *   Step 3: Results (score, disparity banner, issues)
 *   Step 4: Gemini explanation (3 parsed sections)
 *
 * Changes v2:
 *  ✅  AttributeSelector integrated into step 2 — user controls which columns are sensitive
 *  ✅  Text-summary mode — UploadSection can bypass CSV entirely
 *  ✅  Error message no longer leaks raw err.message to UI
 *  ✅  backend warning (truncation) and cached flag surfaced in ResultsDashboard
 *  ✅  AnalyzeButton disabled while request is in-flight
 *  ✅  Reset restores all state cleanly
 *  ✅  Removed dead AIExplanation import — replaced with GeminiExplanationCard
 */

import React, { useState }    from 'react';
import UploadSection           from './components/UploadSection';
import DataPreview             from './components/DataPreview';
import AttributeSelector       from './components/AttributeSelector';
import ResultsDashboard        from './components/ResultsDashboard';
import GeminiExplanationCard   from './components/GeminiExplanationCard';
import {
  analyzeDataset,
  buildDatasetSummary,
  detectSensitiveColumns,
  detectOutcomeColumn,
} from './utils/biasAnalyzer';

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ['Upload', 'Configure', 'Results', 'AI Analysis'];

function StepIndicator({ step }) {
  return (
    <nav className="flex items-center gap-2 mb-7 flex-wrap" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const status = step > n ? 'done' : step === n ? 'active' : 'pending';
        const cls = {
          done:    'bg-green-100 text-green-700 border-green-200',
          active:  'bg-indigo-600 text-white border-indigo-600',
          pending: 'bg-gray-100 text-gray-400 border-gray-200',
        }[status];
        return (
          <React.Fragment key={label}>
            <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${cls}`}>
              {status === 'done' ? '✓ ' : `${n} · `}{label}
            </span>
            {i < STEPS.length - 1 && <span className="text-gray-300 text-xs">›</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ title }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {title}
    </p>
  );
}

// ── Analyze button ────────────────────────────────────────────────────────────
function AnalyzeButton({ onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99]
                 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
    >
      {loading
        ? <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
            Analyzing…
          </span>
        : 'Analyze Bias →'}
    </button>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  // ── Navigation state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Data state ───────────────────────────────────────────────────────────────
  const [csvData,   setCsvData]   = useState([]);
  const [headers,   setHeaders]   = useState([]);
  const [filename,  setFilename]  = useState('');
  const [textMode,  setTextMode]  = useState(false);  // true when user pasted a summary
  const [rawSummary, setRawSummary] = useState('');   // for text-mode bypass

  // ── Attribute selection (step 2) ─────────────────────────────────────────────
  const autoDetected     = headers.length > 0 ? detectSensitiveColumns(headers) : [];
  const outcomeColumn    = headers.length > 0 ? detectOutcomeColumn(headers)    : null;
  const [selectedAttrs, setSelectedAttrs] = useState([]);

  // ── Analysis results ─────────────────────────────────────────────────────────
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing,    setIsAnalyzing]    = useState(false);

  // ── Gemini API state ─────────────────────────────────────────────────────────
  const [aiText,      setAiText]      = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [apiWarning,  setApiWarning]  = useState('');
  const [fromCache,   setFromCache]   = useState(false);

  // ── Handler: CSV loaded ───────────────────────────────────────────────────────
  function onFileLoaded(data, cols, name) {
    setCsvData(data);
    setHeaders(cols);
    setFilename(name);
    setTextMode(false);
    setRawSummary('');
    // Pre-check auto-detected sensitive columns
    setSelectedAttrs(detectSensitiveColumns(cols));
    clearResults();
    setStep(2);
  }

  // ── Handler: text summary pasted ─────────────────────────────────────────────
  // Bypass CSV entirely — send directly to Gemini
  async function onSummarySubmit(summaryText) {
    setTextMode(true);
    setRawSummary(summaryText);
    clearResults();
    setStep(3);
    await runGeminiCall(summaryText);
    setStep(4);
  }

  // ── Handler: run full analysis (CSV mode) ────────────────────────────────────
  async function onAnalyze() {
    if (selectedAttrs.length === 0) return;
    setIsAnalyzing(true);
    clearResults();
    setStep(3);

    // Small delay so spinner renders before heavy computation
    await new Promise(r => setTimeout(r, 300));
    const result = analyzeDataset(csvData, headers, selectedAttrs);
    setAnalysisResult(result);
    setIsAnalyzing(false);
    setStep(4);  // jump straight to results

    // Kick off Gemini in background (results are already visible)
    const summary = buildDatasetSummary(result, headers);
    await runGeminiCall(summary);
  }

  // ── Gemini API call ───────────────────────────────────────────────────────────
  async function runGeminiCall(summary) {
    setAiLoading(true);
    setAiError('');
    setAiText('');
    setApiWarning('');
    setFromCache(false);

    try {
      const { explanation, warning, cached } = await callBackendAPI(summary);
      setAiText(explanation);
      if (warning)  setApiWarning(warning);
      if (cached)   setFromCache(true);
    } catch (err) {
      // Do NOT expose raw err.message — it may contain internal backend paths
      console.error('[App] Gemini API error:', err);
      setAiError(
        'The AI explanation could not be generated. ' +
        'Check that the backend is running on port 5000 and GEMINI_API_KEY is configured.'
      );
    } finally {
      setAiLoading(false);
    }
  }

  // ── Reset everything ─────────────────────────────────────────────────────────
  function clearResults() {
    setAnalysisResult(null);
    setAiText('');
    setAiError('');
    setApiWarning('');
    setFromCache(false);
  }

  function onReset() {
    setCsvData([]); setHeaders([]); setFilename('');
    setTextMode(false); setRawSummary('');
    setSelectedAttrs([]);
    clearResults();
    setStep(1);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">

        {/* ── Header ── */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">BiasLens AI</h1>
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100
                                 px-2 py-0.5 rounded-full font-semibold">
                  Google Solution Challenge
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Detect algorithmic bias in datasets · Powered by Gemini 1.5 Flash
              </p>
            </div>
          </div>
        </header>

        {/* ── Step indicator ── */}
        <StepIndicator step={step} />

        {/* ══════════════════════════════════════
            STEP 1 — Upload
        ══════════════════════════════════════ */}
        {step === 1 && (
          <section className="space-y-3">
            <SectionLabel title="1. Add your dataset" />
            <UploadSection
              onFileLoaded={onFileLoaded}
              onSummarySubmit={onSummarySubmit}
            />
          </section>
        )}

        {/* ══════════════════════════════════════
            STEP 2 — Configure (CSV mode only)
        ══════════════════════════════════════ */}
        {step === 2 && !textMode && (
          <section className="space-y-5">
            {/* Data preview */}
            <div>
              <SectionLabel title="2a. Data preview" />
              <DataPreview
                data={csvData}
                headers={headers}
                filename={filename}
                selectedColumns={selectedAttrs}
                outcomeColumn={outcomeColumn}
              />
            </div>

            {/* Attribute selector */}
            <div>
              <SectionLabel title="2b. Select sensitive attributes" />
              <AttributeSelector
                allColumns={headers}
                autoDetected={autoDetected}
                outcomeColumn={outcomeColumn}
                selected={selectedAttrs}
                onChange={setSelectedAttrs}
              />
            </div>

            {/* Action row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <button onClick={onReset}
                className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
                ← Upload different file
              </button>
              <div className="flex-1 max-w-xs">
                <AnalyzeButton
                  onClick={onAnalyze}
                  disabled={selectedAttrs.length === 0}
                  loading={isAnalyzing}
                />
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════
            STEP 3 — Analyzing spinner (brief)
        ══════════════════════════════════════ */}
        {step === 3 && isAnalyzing && (
          <section className="text-center py-16">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600
                            rounded-full animate-spin mx-auto mb-4"/>
            <p className="font-semibold text-gray-700">Analyzing dataset…</p>
            <p className="text-sm text-gray-400 mt-1">Computing group outcome rates</p>
          </section>
        )}

        {/* ══════════════════════════════════════
            STEP 4 — Results + Gemini explanation
        ══════════════════════════════════════ */}
        {step === 4 && (
          <section className="space-y-8">

            {/* Statistical results (only in CSV mode) */}
            {!textMode && analysisResult && (
              <div>
                <SectionLabel title="3. Bias analysis results" />
                <ResultsDashboard
                  result={analysisResult}
                  apiWarning={apiWarning}
                  fromCache={fromCache}
                />
              </div>
            )}

            {/* Gemini explanation */}
            <div>
              <SectionLabel title={textMode ? '2. Gemini AI analysis' : '4. Gemini AI explanation'} />
              <GeminiExplanationCard
                explanation={aiText}
                isLoading={aiLoading}
                error={aiError}
              />
            </div>

            {/* Reset */}
            <div className="text-center pb-6">
              <button onClick={onReset}
                className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
                ← Analyze another dataset
              </button>
            </div>

          </section>
        )}

      </div>
    </div>
  );
}

// ── Backend API call ──────────────────────────────────────────────────────────
// POSTs to /api/analyze (proxied to Express → Gemini)
// Returns { explanation, warning?, cached? }
async function callBackendAPI(summary) {
  const res = await fetch('/api/analyze', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ summary }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Use backend's message if available, otherwise a generic one
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json(); // { explanation, warning?, cached? }
}
