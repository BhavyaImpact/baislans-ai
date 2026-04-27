'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analyzeRoute = require('./routes/analyze');

// 1. Validate Gemini API key
if (!process.env.GEMINI_API_KEY) {
  console.error('\n❌ FATAL: GEMINI_API_KEY is not set.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 2. THE FIX: ONE SINGLE CORS SETUP
const origins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://baislansai.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] ❌ Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 3. Middlewares
app.use(express.json({ limit: '1mb' }));

// 4. Logger
app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${elapsed}ms)`);
    return originalEnd(...args);
  };
  next();
});

// 5. Rate Limiter (15 req/min)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' }
});

// 6. Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: NODE_ENV, geminiKeyLoaded: true });
});

app.use('/api/analyze', analyzeLimiter, analyzeRoute);

// 7. Error Handlers
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  res.status(err.message.includes('CORS') ? 403 : 500).json({ error: err.message });
});

// 8. Start
app.listen(PORT, () => {
  console.log('\n============================================');
  console.log('  🔍  BiasLens AI Backend');
  console.log('============================================');
  console.log(`  URL:         http://localhost:${PORT}`);
  console.log(`  CORS ✅:     ${origins.join(', ')}`);
  console.log(`  Gemini:      ✅ Loaded`);
  console.log('============================================\n');
});
