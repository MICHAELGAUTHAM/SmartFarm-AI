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
// Forward /api/v1/* requests to the Flask backend on Render.
// This avoids CORS issues and keeps a single origin for the frontend.
const FLASK_API = process.env.FLASK_API_URL || 'https://smartfarm-ai-1a8r.onrender.com';

app.post('/api/v1/predict', async (req, res) => {
  try {
    const r = await fetch(`${FLASK_API}/api/v1/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'Flask backend unreachable', detail: err.message });
  }
});

app.get('/api/v1/weather', async (req, res) => {
  try {
    const city = req.query.city || 'Madurai';
    const r = await fetch(`${FLASK_API}/api/v1/weather?city=${encodeURIComponent(city)}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'Flask weather API unreachable' });
  }
});

app.get('/api/v1/market', async (req, res) => {
  try {
    const r = await fetch(`${FLASK_API}/api/v1/market-prices`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'Flask market API unreachable' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚜 SmartFarm AI Server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health\n`);
  console.log(`   Powered by pure JS algorithms (Node-gyp dependencies removed)`);
});
