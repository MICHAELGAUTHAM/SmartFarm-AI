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

// ── Health Checks ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("SmartFarm Backend Running");
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'success', data: { version: '17.3.0' }, message: 'healthy' });
});

// ── Local ML / Weather / Market  (pure localhost, no Flask) ───────────────────
import { districtsData, commoditiesData } from './data.js';

// POST /api/v1/predict
app.post('/api/v1/predict', (req, res) => {
  try {
    const { income = 0, expenses = 0, city = 'Madurai' } = req.body;
    const inc  = parseFloat(income)   || 0;
    const exp  = parseFloat(expenses) || 0;
    const profit = Math.round((inc - exp) * 100) / 100;
    const risk   = profit > 0 ? 'Low' : 'High';

    const recommendation = profit > 0
      ? 'Market conditions look stable. Consider expanding crop variety or increasing acreage.'
      : 'Expenses exceed income. Reduce input costs, explore government subsidies, or diversify crops.';

    res.json({
      status:  'success',
      data:    { profit, risk, recommendation, income: inc, expenses: exp },
      message: 'OK'
    });
  } catch (err) {
    res.status(400).json({ status: 'error', data: null, message: err.message });
  }
});

// GET /api/v1/weather?city=Madurai
app.get('/api/v1/weather', (req, res) => {
  const city = req.query.city || 'Madurai';
  const district = districtsData.find(d => d.name.toLowerCase() === city.toLowerCase());
  const month = new Date().getMonth();
  const isWet = month >= 6 && month <= 10;
  const temp = district ? (isWet ? district.avg_temp_jul : district.avg_temp_apr) : 32;
  const rainfall = district ? (isWet ? district.rain_jul : district.rain_apr) : 15;
  const risk = rainfall > 150 ? 'High' : rainfall > 80 ? 'Medium' : 'Low';
  const advisory = risk === 'High' ? 'Heavy rainfall.' : 'Stable.';

  res.json({
    status: 'success',
    data: { city, temperature: temp, rainfall, humidity: 65, risk, advisory },
    message: 'OK'
  });
});

// GET /api/v1/market
app.get('/api/v1/market', (req, res) => {
  res.json({
    status: 'success',
    data: commoditiesData,
    message: 'OK'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error Handling ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    status: "error",
    data: null,
    message: "Server error"
  });
});

app.listen(PORT, () => {
  console.log(`SmartFarm Backend Running on port ${PORT}`);
});
