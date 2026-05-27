import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import stripePackage from 'stripe';

dotenv.config();
const stripe = process.env.STRIPE_SECRET_KEY ? new stripePackage(process.env.STRIPE_SECRET_KEY) : null;
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

// Stripe Webhook MUST be before express.json()
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(501).send('Stripe not configured');
  
  const { logSecurityEvent } = await import('./apiKeyStore.js');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logSecurityEvent('WEBHOOK_SIGNATURE_FAILED', req, { message: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).send('Database not configured');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Idempotency check
  const { data: processedEvent } = await supabase.from('processed_stripe_events').select('id').eq('id', event.id).single();
  if (processedEvent) {
      logSecurityEvent('WEBHOOK_DUPLICATE', req, { eventId: event.id });
      return res.json({ received: true, duplicate: true });
  }

  const PRICE_TO_PLAN = {
      [process.env.STRIPE_PRICE_PRO || 'price_pro']: 'PRO',
      [process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise']: 'ENTERPRISE'
  };

  try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const hashedKey = session.metadata?.hashed_key;
        
        if (hashedKey && session.payment_status === 'paid') {
           const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
           const priceId = lineItems.data[0]?.price?.id;
           const newPlan = PRICE_TO_PLAN[priceId] || 'PRO';

           const { error } = await supabase.from('api_keys').update({ plan: newPlan }).eq('hashed_key', hashedKey);
           if (error) throw error;
           logSecurityEvent('PLAN_UPGRADED', req, { hashedKey, plan: newPlan, eventId: event.id });
        } else {
           logSecurityEvent('WEBHOOK_UNPAID_OR_MISSING_KEY', req, { eventId: event.id, status: session.payment_status });
        }
      } 
      else if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
          const obj = event.data.object;
          const hashedKey = obj.metadata?.hashed_key || obj.lines?.data[0]?.metadata?.hashed_key;
          
          if (hashedKey) {
             const { error } = await supabase.from('api_keys').update({ plan: 'FREE' }).eq('hashed_key', hashedKey);
             if (error) throw error;
             logSecurityEvent('PLAN_DOWNGRADED', req, { hashedKey, eventId: event.id });
          }
      }

      // Record event to prevent duplicates
      await supabase.from('processed_stripe_events').insert([{ id: event.id, type: event.type }]);
  } catch (err) {
      logSecurityEvent('WEBHOOK_PROCESSING_ERROR', req, { message: err.message, eventId: event.id });
      return res.status(500).send('Internal Server Error');
  }

  res.json({received: true});
});


app.post('/api/billing/create-checkout-session', apiKeyAuth, async (req, res) => {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { hashKey } = await import('./apiKeyStore.js');
    const hashedKey = hashKey(token);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_PRO || 'price_pro', quantity: 1 }],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard.html?success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard.html?canceled=true`,
      metadata: { hashed_key: hashedKey }
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Request ID Tracking Middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Strict CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Disabled temporarily to prevent breaking PWA scripts
}));

// IP Rate Limiting for all API routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  message: { status: 'error', message: 'Too many requests from this IP.' }
});
app.use('/api/', globalLimiter);

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

// ── SaaS Precision Agri Engine ────────────────────────────────────────────────
import { districtsData, commoditiesData, cropDataList } from './data.js';
import { apiKeyAuth } from './apiKeyStore.js';

const predictSchema = z.object({
  soil_n: z.coerce.number().min(0).max(1000).optional().default(50),
  soil_p: z.coerce.number().min(0).max(1000).optional().default(50),
  soil_k: z.coerce.number().min(0).max(1000).optional().default(50),
  crop_id: z.coerce.number().int().positive().optional().default(1),
  city: z.string().trim().max(100).optional().default('Madurai')
});

// POST /api/v1/predict
app.post('/api/v1/predict', apiKeyAuth, (req, res) => {
  try {
    const validated = predictSchema.parse(req.body);
    const { soil_n, soil_p, soil_k, crop_id, city } = validated;

    const crop = cropDataList.find(c => c.id === parseInt(crop_id)) || cropDataList[0];
    const district = districtsData.find(d => d.name.toLowerCase() === city.toLowerCase()) || districtsData[0];

    // 1. Nutrient Suitability Score (NPK)
    const n_score = Math.max(0, 100 - Math.abs(crop.npk[0] - soil_n));
    const p_score = Math.max(0, 100 - Math.abs(crop.npk[1] - soil_p));
    const k_score = Math.max(0, 100 - Math.abs(crop.npk[2] - soil_k));
    const soil_score = Math.round((n_score + p_score + k_score) / 3);

    // 2. Fertilizer Recommendation (Deficit calculation)
    const fertilizer_rec = {
      nitrogen: Math.max(0, crop.npk[0] - soil_n),
      phosphorus: Math.max(0, crop.npk[1] - soil_p),
      potassium: Math.max(0, crop.npk[2] - soil_k),
      unit: 'kg/acre'
    };

    // 3. Climate Suitability
    const month = new Date().getMonth();
    const isWet = month >= 6 && month <= 10;
    const current_temp = isWet ? district.avg_temp_jul : district.avg_temp_apr;
    const temp_match = current_temp >= crop.min_temp && current_temp <= crop.max_temp;
    
    const suitability_score = Math.round(soil_score * 0.7 + (temp_match ? 30 : 10));
    const risk = suitability_score > 70 ? 'Low' : suitability_score > 40 ? 'Medium' : 'High';

    const recommendation = suitability_score > 70 
      ? `Highly suitable! Follow the fertilizer plan to achieve ${crop.base_yield} kg/acre yield.`
      : suitability_score > 40
      ? `Moderately suitable. Soil requires significant enrichment of ${fertilizer_rec.nitrogen > 20 ? 'Nitrogen' : 'Nutrients'}.`
      : `High risk. Current soil NPK (${soil_n}-${soil_p}-${soil_k}) is poorly matched for ${crop.name}. Consider Soil enrichment or change crop.`;

    res.json({
      status: 'success',
      data: {
        crop: crop.name,
        suitability_score,
        risk,
        soil_analytics: { n_score, p_score, k_score, soil_score },
        fertilizer_rec,
        climate_alert: !temp_match ? `Temperature (${current_temp}°C) is outside optimal range for this crop.` : 'Climate conditions optimal.',
        recommendation,
        market_pulse: commoditiesData.find(c => c.commodity.includes(crop.name.split(' ')[0])) || commoditiesData[0]
      },
      message: 'Precision analytics generated successfully'
    });
  } catch (err) {
    console.error('[AgriEngine Error]', err);
    if (err instanceof z.ZodError) {
       return res.status(400).json({ status: 'error', data: null, message: 'Invalid input data', details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`) });
    }
    res.status(400).json({ status: 'error', data: null, message: 'An unexpected error occurred processing analytics' });
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
