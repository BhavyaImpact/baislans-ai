/**
 * backend/server.js
 * ==================
 * Entry point for the BiasLens AI Express backend.
 *
 * Changes vs original:
 *  [FIX #6]  Rate limiting via express-rate-limit (15 req/min per IP)
 *  [FIX #7]  Dynamic CORS — reads allowed origins from environment variables
 *  [FIX #8]  Global request/response logging middleware with timing
 *  [FIX #9]  Gemini API key validation at startup — halts if key is absent
 *  [FIX #10] Modular structure preserved; server.js is purely wiring/config
 */

'use strict';

require('dotenv').config(); // Must be FIRST — loads .env before anything else reads process.env

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');  // [FIX #6]
const analyzeRoute = require('./routes/analyze');

// ── [FIX #9] Validate Gemini API key at startup ───────────────────────────────
// Fail fast: if the key is missing, every request will fail anyway.
// Better to log a clear error and exit than to boot a broken server silently.
if (!process.env.GEMINI_API_KEY) {
  console.error('\n❌  FATAL: GEMINI_API_KEY is not set in your .env file.');
  console.error('   1. Copy .env.example to .env');
  console.error('   2. Add your key: GEMINI_API_KEY=AIzaSy...');
  console.error('   3. Get a free key at https://aistudio.google.com/app/apikey\n');
  process.exit(1); // Stop the server — nothing works without this key
}

const app  = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Correct Middleware Setup ────────────────────────────────────────────────
// This handles the security "permission slip" for Netlify
app.use(cors({
  origin: 'https://baislansai.netlify.app', 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// This allows the server to read your CSV data
app.use(express.json()); 
// ─────────────────────────────────────────────────────────────────────────────

// Rest of your code (app.use('/api/analyze', analyzeRoute); etc.)
// Now your routes follow
app.use('/api/analyze', analyzeRoute);

// ── [FIX #7] Dynamic CORS configuration ──────────────────────────────────────
// Reads allowed origins from environment variables so production and dev
// environments can each specify their own frontend URLs without code changes.
//
// How to configure:
//   Single origin:    FRONTEND_URL=https://biaslens.example.com
//   Multiple origins: FRONTEND_URLS=https://biaslens.com,https://www.biaslens.com
//   Dev fallback:     If neither is set, allows localhost:3000 + localhost:5173 only
//
function buildAllowedOrigins() {
  const origins = [];

  // Multi-origin support (comma-separated list)
  if (process.env.FRONTEND_URLS) {
    const parsed = process.env.FRONTEND_URLS
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);
    origins.push(...parsed);
  }

  // Single-origin support
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL.trim());
  }

  // Always allow localhost in development — never in production
  if (NODE_ENV !== 'production') {
    origins.push('http://localhost:3000'); // Vite with custom port
    origins.push('http://localhost:5173'); // Vite default port
  }

  return [...new Set(origins)]; // deduplicate
}

const allowedOrigins = buildAllowedOrigins();
console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// ── [FIX #6] Rate limiting ────────────────────────────────────────────────────
// Caps each IP at 15 requests per minute.
// Why 15? Generous enough for legitimate hackathon demos (user explores, re-uploads),
// but low enough to prevent a script from hammering the Gemini API.
//
// Applied ONLY to /api/analyze — not to health check or 404s.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1-minute rolling window
  max: 15,                  // max requests per window per IP
  standardHeaders: true,    // send RateLimit-* headers in responses
  legacyHeaders: false,     // disable deprecated X-RateLimit-* headers

  // [FIX #4] Safe error message — no internal detail exposed
  message: {
    error: 'Too many requests. Please wait a moment and try again.',
  },

  handler: (req, res, next, options) => {
    console.warn(`[RateLimit] IP ${req.ip} exceeded limit at ${new Date().toISOString()}`);
    res.status(429).json(options.message);
  },
});

// ── Parse JSON bodies ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── [FIX #8] Global request/response logging middleware ──────────────────────
// Logs method, path, status code, and total execution time for every request.
// Simple and lightweight — no third-party logger needed for a hackathon.
app.use((req, res, next) => {
  const start = Date.now();

  // Intercept res.end to log after the response is sent
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${elapsed}ms) from ${req.ip}`);
    return originalEnd(...args);
  };

  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
// Useful for uptime monitors and quick manual verification.
// Does NOT expose raw key material — only confirms whether the key is loaded.
app.get('/api/health', (req, res) => {
  res.json({
    status:          'ok',
    service:         'BiasLens AI Backend',
    environment:     NODE_ENV,
    geminiKeyLoaded: true,  // we already exited above if it was missing [FIX #9]
    timestamp:       new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
// Rate limiter applied only to the Gemini-backed endpoint
app.use('/api/analyze', analyzeLimiter, analyzeRoute);  // [FIX #6]

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches anything Express itself throws (e.g. CORS errors, JSON parse errors).
// [FIX #4] Only logs internally — client gets a safe generic message.
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);

  // Handle CORS errors specifically
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'CORS: request origin not allowed.' });
  }

  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n============================================');
  console.log('  🔍  BiasLens AI Backend');
  console.log('============================================');
  console.log(`  URL:         http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/api/health`);
  console.log(`  Environment: ${NODE_ENV}`);
  console.log(`  Gemini key:  ✅ loaded (gemini-1.5-flash)`);   // [FIX #1] model name
  console.log(`  Rate limit:  15 req/min per IP`);              // [FIX #6]
  console.log(`  Cache:       in-memory, TTL 10min`);           // [FIX #5]
  console.log('============================================\n');
});
