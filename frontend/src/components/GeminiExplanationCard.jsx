/**
 * GeminiExplanationCard.jsx
 * --------------------------
 * Replaces AIExplanation.jsx entirely.
 *
 * Key changes vs old component:
 *  ✅  Parses AI text into 3 distinct sections: BIAS FOUND / WHY HARMFUL / HOW TO FIX
 *  ✅  Each section rendered as its own labelled card with icon + colour
 *  ✅  Fixes extracted from "HOW TO FIX IT:" and shown as a numbered action list
 *  ✅  NO hardcoded fallback data — if AI hasn't responded yet, sections show skeletons
 *  ✅  Badge updated to "Gemini 1.5 Flash"
 *  ✅  Error state is self-contained and clearly explains what happened
 *
 * Props:
 *   explanation  — string | ''   (raw Gemini response)
 *   isLoading    — boolean
 *   error        — string | ''
 */

import React from 'react';

// ── Section parser ────────────────────────────────────────────────────────────
// Splits the AI response into the 3 expected labelled sections.
// Returns null for a section if it isn't present in the text.
function parseSections(text) {
  if (!text) return { biasFound: null, whyHarmful: null, howToFix: null };

  // Each section runs until the next section header (or end of string)
  function extract(startMarker, endMarkers) {
    const idx = text.indexOf(startMarker);
    if (idx === -1) return null;
    let end = text.length;
    endMarkers.forEach(m => {
      const i = text.indexOf(m, idx + startMarker.length);
      if (i !== -1 && i < end) end = i;
    });
    return text.slice(idx + startMarker.length, end).trim();
  }

  const biasFound  = extract('BIAS FOUND:',       ['WHY IT\'S HARMFUL:', 'WHY ITS HARMFUL:', 'HOW TO FIX']);
  const whyHarmful = extract('WHY IT\'S HARMFUL:', ['HOW TO FIX', 'BIAS FOUND:'])
                  || extract('WHY ITS HARMFUL:',   ['HOW TO FIX', 'BIAS FOUND:']);
  const howToFix   = extract('HOW TO FIX IT:',     ['BIAS FOUND:', 'WHY IT\'S HARMFUL:'])
                  || extract('HOW TO FIX:',         ['BIAS FOUND:', 'WHY IT\'S HARMFUL:']);

  return { biasFound, whyHarmful, howToFix };
}

// Parses the "HOW TO FIX" section into an array of action steps.
function parseFixSteps(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(l => l.replace(/^[\d\.\-\*\s]+/, '').trim())
    .filter(l => l.length > 15)
    .slice(0, 7);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-3/4"/>
      <div className="h-3 bg-gray-200 rounded w-full"/>
      <div className="h-3 bg-gray-200 rounded w-5/6"/>
    </div>
  );
}

function SectionCard({ icon, label, pillClass, content, isLoading }) {
  return (
    <div className="section-card p-5 space-y-3 fade-in">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className={`section-pill ${pillClass}`}>{label}</span>
      </div>
      {isLoading || !content
        ? <SectionSkeleton />
        : <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
      }
    </div>
  );
}

function FixStepList({ steps, isLoading }) {
  return (
    <div className="section-card p-5 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🛠️</span>
        <span className="section-pill bg-green-100 text-green-700">How to fix it</span>
      </div>

      {isLoading || steps.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0"/>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-full"/>
                <div className="h-3 bg-gray-200 rounded w-4/5"/>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white
                               flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LoadingHeader() {
  return (
    <div className="flex items-center gap-2">
      <div className="loading-dot"/>
      <div className="loading-dot"/>
      <div className="loading-dot"/>
      <span className="text-sm text-gray-400 ml-1">Gemini is analyzing your dataset…</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GeminiExplanationCard({ explanation, isLoading, error }) {
  const sections = parseSections(explanation);
  const fixSteps = parseFixSteps(sections.howToFix);

  return (
    <div className="space-y-4">
      {/* ── Header bar ── */}
      <div className="flex items-center gap-2.5">
        {/* Gemini-colored icon */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: 'linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335)' }}>
          <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/>
          </svg>
        </div>
        <div>
          <span className="text-sm font-semibold text-gray-800">Gemini Analysis</span>
          <span className="ml-2 text-xs bg-blue-50 text-blue-600 border border-blue-100
                           px-2 py-0.5 rounded-full font-medium">
            gemini-1.5-flash
          </span>
        </div>
        {isLoading && (
          <span className="ml-auto text-xs text-gray-400 animate-pulse">Thinking…</span>
        )}
        {!isLoading && explanation && !error && (
          <span className="ml-auto text-xs text-green-600 font-medium">✓ Analysis complete</span>
        )}
      </div>

      {/* ── Loading state (before first response) ── */}
      {isLoading && !explanation && <LoadingHeader />}

      {/* ── Error state ── */}
      {error && (
        <div className="section-card p-4 bg-red-50 border-red-200">
          <div className="flex gap-3 items-start">
            <span className="text-red-500 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-700">AI analysis unavailable</p>
              <p className="text-sm text-red-600 mt-0.5 leading-relaxed">{error}</p>
              <p className="text-xs text-red-500 mt-2">
                Check that your backend is running and the GEMINI_API_KEY is set in .env
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Three parsed section cards ── */}
      {!error && (
        <>
          <SectionCard
            icon="🔍"
            label="Bias found"
            pillClass="bg-red-100 text-red-700"
            content={sections.biasFound}
            isLoading={isLoading}
          />
          <SectionCard
            icon="⚠️"
            label="Why it's harmful"
            pillClass="bg-amber-100 text-amber-700"
            content={sections.whyHarmful}
            isLoading={isLoading}
          />
          <FixStepList
            steps={fixSteps}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
