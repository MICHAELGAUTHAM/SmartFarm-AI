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

// ── Local ML / Weather / Market  (pure localhost, no Flask) ───────────────────
import { districtsData, commoditiesData } from './data.js';

// POST /api/v1/predict
app.post('/api/v1/predict', (req, res) => {
  const { income = 0, expenses = 0, city = 'Madurai' } = req.body;

  const inc  = parseFloat(income)   || 0;
  const exp  = parseFloat(expenses) || 0;
  const profit = Math.round((inc - exp) * 100) / 100;
  const risk   = profit > 0 ? 'Low' : 'High';

  const recommendation = profit > 0
    ? 'Market conditions look stable. Consider expanding crop variety or increasing acreage.'
    : 'Expenses exceed income. Reduce input costs, explore government subsidies, or diversify crops.';

  console.log(`[predict] income=${inc} expenses=${exp} profit=${profit} risk=${risk}`);

  res.json({
    status:  'success',
    data:    { profit, risk, recommendation, income: inc, expenses: exp },
    message: 'Prediction generated successfully'
  });
});

// GET /api/v1/weather?city=Madurai
app.get('/api/v1/weather', (req, res) => {
  const city = req.query.city || 'Madurai';

  // Derive temperature from district data if available
  const district = districtsData.find(
    d => d.name.toLowerCase() === city.toLowerCase()
  );

  const month   = new Date().getMonth(); // 0–11
  const isWet   = month >= 6 && month <= 10;
  const temp    = district
    ? (isWet ? district.avg_temp_jul : district.avg_temp_apr)
    : 32;
  const rainfall = district
    ? (isWet ? district.rain_jul : district.rain_apr)
    : 15;

  const risk    = rainfall > 150 ? 'High' : rainfall > 80 ? 'Medium' : 'Low';
  const advisory = risk === 'High'
    ? 'Heavy rainfall expected. Delay sowing and ensure field drainage.'
    : risk === 'Medium'
    ? 'Moderate rainfall. Irrigation may not be needed this week.'
    : 'Dry conditions. Schedule irrigation every 3–4 days.';

  res.json({
    status:  'success',
    data:    { city, temperature: temp, rainfall, humidity: 65, risk, advisory },
    message: 'Weather data fetched'
  });
});

// GET /api/v1/market
app.get('/api/v1/market', (req, res) => {
  res.json({
    status:  'success',
    data:    commoditiesData,
    message: 'Market prices fetched'
  });
});

// GET /api/v1/ai-status
app.get('/api/v1/ai-status', (_req, res) => {
  res.json({ status: 'success', data: { mode: 'local', version: '1.0' }, message: 'healthy' });
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
