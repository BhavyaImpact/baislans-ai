/**
 * backend/routes/analyze.js
 * ==========================
 * POST /api/analyze
 *
 * Receives a plain-text dataset summary, optionally returns a cached result,
 * otherwise calls Gemini and caches the new response.
 *
 * Request body:   { summary: string }
 * Response body:  { explanation: string, warning?: string, cached?: boolean }
 *             or  { error: string }
 *
 * Changes vs original:
 *  [FIX #3]  Returns { warning } when input was truncated
 *  [FIX #4]  Hides raw internal errors from client; logs full detail server-side
 *  [FIX #5]  In-memory cache keyed by SHA-256 hash of the summary input
 *  [FIX #8]  Per-request logging with execution time in ms
 */

'use strict';

const express  = require('express');
const crypto   = require('crypto');   // built-in Node module — no install needed
const router   = express.Router();
const { generateBiasExplanation } = require('../utils/gemini');

// ── [FIX #5] In-memory response cache ────────────────────────────────────────
// Simple Map used as a key→value store.
// Key:   SHA-256 hex hash of the raw (pre-truncation) summary string
// Value: { explanation: string, cachedAt: number }
//
// Why hash instead of raw string?
//   Memory-safe: the Map stores a 64-char hex key instead of 8000-char strings.
//   Collision-proof: SHA-256 is effectively collision-free for our use case.
//
// Limits:
//   • TTL_MS — entries expire after 10 minutes to avoid stale results
//   • MAX_CACHE_SIZE — evicts oldest entry to cap memory at ~100 entries
//
const cache = new Map();
const TTL_MS        = 10 * 60 * 1000;  // 10 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Compute a short, stable cache key from any string input.
 * @param  {string} input
 * @returns {string} 64-char hex digest
 */
function hashInput(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Retrieve a cache entry only if it exists AND hasn't expired.
 * Automatically deletes stale entries on access (lazy expiry).
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const isExpired = Date.now() - entry.cachedAt > TTL_MS;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  return entry.explanation;
}

/**
 * Store a result in the cache.
 * Evicts the oldest entry if the cache is at capacity.
 */
function setInCache(key, explanation) {
  // Evict oldest when at capacity (Map preserves insertion order)
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
    console.log(`[Cache] Evicted oldest entry (size limit: ${MAX_CACHE_SIZE})`);
  }
  cache.set(key, { explanation, cachedAt: Date.now() });
}

// ── Route handler ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // [FIX #8] Record start time for execution logging
  const startTime = Date.now();

  // [FIX #8] Log every incoming request with IP and timestamp
  console.log(`[POST /api/analyze] Request from ${req.ip} at ${new Date().toISOString()}`);

  try {
    const { summary } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({
        error: 'Request body must include a "summary" string.',
      });
    }

    const trimmed = summary.trim();
    if (trimmed.length < 10) {
      return res.status(400).json({
        error: 'Summary is too short. Please provide a meaningful dataset summary.',
      });
    }

    // ── [FIX #3] Truncation with client warning ───────────────────────────────
    // Hard cap at 8000 chars to stay well within Gemini's input token limit.
    // If the input was cut, we tell the client so they can surface a notice.
    const MAX_CHARS   = 8000;
    const wasTruncated = trimmed.length > MAX_CHARS;
    const processedSummary = wasTruncated ? trimmed.slice(0, MAX_CHARS) : trimmed;

    if (wasTruncated) {
      console.log(`[POST /api/analyze] Input truncated: ${trimmed.length} → ${MAX_CHARS} chars`);
    }

    // ── [FIX #5] Cache lookup ─────────────────────────────────────────────────
    // Hash the RAW (pre-truncation) summary so two identical large inputs
    // both hit the same cache entry even if they were both truncated.
    const cacheKey = hashInput(trimmed);
    const cached   = getFromCache(cacheKey);

    if (cached) {
      const elapsed = Date.now() - startTime;
      // [FIX #8] Log cache hit and response time
      console.log(`[POST /api/analyze] Cache HIT — responded in ${elapsed}ms`);

      return res.status(200).json({
        explanation: cached,
        cached: true,                                          // tell client it's from cache
        ...(wasTruncated && { warning: 'Input truncated due to size limits' }),
      });
    }

    // ── Call Gemini ───────────────────────────────────────────────────────────
    console.log(`[POST /api/analyze] Cache MISS — calling Gemini (${processedSummary.length} chars)…`);
    const explanation = await generateBiasExplanation(processedSummary);

    // Store the fresh result for future identical requests
    setInCache(cacheKey, explanation);

    // [FIX #8] Log successful response and total execution time
    const elapsed = Date.now() - startTime;
    console.log(`[POST /api/analyze] Success — Gemini returned ${explanation.length} chars in ${elapsed}ms`);

    return res.status(200).json({
      explanation,
      cached: false,
      ...(wasTruncated && { warning: 'Input truncated due to size limits' }),
    });

  } catch (err) {
    const elapsed = Date.now() - startTime;

    // ── [FIX #4] Safe error handling ─────────────────────────────────────────
    // Full stack trace goes to the server log. The client only sees a generic
    // message — raw internal errors can leak model names, SDK paths, API details.
    console.error(`[POST /api/analyze] ERROR after ${elapsed}ms:`, err);

    // Distinguish a bad API key (config problem) from a transient failure
    const isKeyError = err.message &&
      (err.message.includes('API_KEY') || err.message.includes('API key'));

    if (isKeyError) {
      return res.status(401).json({
        error: 'Invalid or missing Gemini API key. Check your .env file.',
      });
    }

    // Generic safe message — no raw err.message exposed to client
    return res.status(500).json({
      error: 'AI analysis failed. Please try again.',  // [FIX #4] sanitised message
    });
  }
});

module.exports = router;
