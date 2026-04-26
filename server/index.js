import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
import cropsRouter from './routes/crops.js';
import districtsRouter from './routes/districts.js';
import infoRouter from './routes/info.js';
import alertsRouter from './routes/alerts.js';
import marketRouter from './routes/market.js';
import visionRouter from './routes/vision.js';

import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', authRouter());
app.use('/api/crops', cropsRouter());
app.use('/api/districts', districtsRouter());
app.use('/api/info', infoRouter());
app.use('/api/alerts', alertsRouter());
app.use('/api/market', marketRouter());
app.use('/api/vision', visionRouter());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', using: 'in-memory-js-db', version: '17.3.0' });
});

// ── Flask ML Backend Proxy ─────────────────────────────────────────────────────
const FLASK_API = process.env.FLASK_API_URL || 'https://smartfarm-ai-1a8r.onrender.com';

/**
 * Generic proxy helper — forwards to Flask, logs timing, handles failures.
 * @param {string} path   Flask path (e.g. '/api/v1/predict')
 * @param {object} opts   fetch options
 * @param {object} res    Express response object
 */
async function flaskProxy(path, opts, res) {
  const url   = `${FLASK_API}${path}`;
  const start = Date.now();
  try {
    const r    = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const ms   = Date.now() - start;
    console.log(`[proxy] ${opts.method || 'GET'} ${path} → ${r.status} (${ms}ms)`);
    return res.status(r.status).json(data);
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[proxy] FAILED ${opts.method || 'GET'} ${path} (${ms}ms):`, err.message);
    return res.status(502).json({
      status:  'error',
      data:    null,
      message: `Flask backend unreachable: ${err.message}`
    });
  }
}

// POST /api/v1/predict  ── ML prediction
app.post('/api/v1/predict', (req, res) =>
  flaskProxy('/api/v1/predict', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req.body)
  }, res)
);

// GET /api/v1/weather  ── weather data
app.get('/api/v1/weather', (req, res) => {
  const city = req.query.city || 'Madurai';
  flaskProxy(`/api/v1/weather?city=${encodeURIComponent(city)}`, {}, res);
});

// GET /api/v1/market  ── market prices
app.get('/api/v1/market', (req, res) =>
  flaskProxy('/api/v1/market-prices', {}, res)
);

// GET /api/v1/ai-status  ── health bridge to Flask
app.get('/api/v1/ai-status', (req, res) =>
  flaskProxy('/health', {}, res)
);


// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚜 SmartFarm AI Server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health\n`);
  console.log(`   Powered by pure JS algorithms (Node-gyp dependencies removed)`);
});
