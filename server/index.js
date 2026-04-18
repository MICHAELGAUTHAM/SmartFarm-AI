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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚜 SmartFarm AI Server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health\n`);
  console.log(`   Powered by pure JS algorithms (Node-gyp dependencies removed)`);
});
