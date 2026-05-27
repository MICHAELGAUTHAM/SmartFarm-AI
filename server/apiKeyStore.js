import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (!process.env.API_SECRET_KEY) {
  console.error("CRITICAL SECURITY ERROR: API_SECRET_KEY environment variable is missing.");
  process.exit(1);
}

// Helper to hash API keys securely (HMAC-SHA256)
export const hashKey = (key) => crypto.createHmac('sha256', process.env.API_SECRET_KEY).update(key).digest('hex');

export const logSecurityEvent = (type, req, details) => {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: type,
    ip: req.ip,
    requestId: req.id || 'N/A',
    endpoint: req.originalUrl || req.url,
    ...details
  }));
};

export const apiKeyAuth = async (req, res, next) => {
  if (!supabase) {
    console.error('[RateLimit] Supabase is not configured.');
    return next(); 
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logSecurityEvent('AUTH_MISSING_HEADER', req, { message: 'Missing Authorization header' });
    return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  const hashedToken = hashKey(token);
  
  // Single RPC call handles limit checking, incrementing, and logging atomically
  const { data, error } = await supabase.rpc('check_and_log_api_usage', { 
      p_hashed_key: hashedToken,
      p_endpoint: req.originalUrl || req.url
  });

  if (error || !data) {
    logSecurityEvent('AUTH_FAILURE', req, { message: 'Invalid API Key or Database Error', error });
    return res.status(403).json({ status: 'error', message: 'Invalid API Key' });
  }

  // Data expected from RPC: { allowed: boolean, limit_val: number, remaining: number, plan_val: string }
  const { allowed, limit_val, remaining, plan_val } = data;

  // Set Rate Limit Headers
  res.setHeader('X-RateLimit-Limit', limit_val === -1 ? 'Unlimited' : limit_val);
  res.setHeader('X-RateLimit-Remaining', remaining);
  
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  res.setHeader('X-RateLimit-Reset', Math.floor(tomorrow.getTime() / 1000));

  if (!allowed) {
    logSecurityEvent('RATE_LIMIT_HIT', req, { plan: plan_val, limit: limit_val, remaining });
    return res.status(429).json({
      status: 'error',
      message: `Rate limit exceeded. Your ${plan_val} plan allows ${limit_val} requests per day.`
    });
  }

  next();
};

export const addApiKey = async (api_key, plan = 'FREE') => {
  if (supabase) {
     const hashedToken = hashKey(api_key);
     const { error } = await supabase
      .from('api_keys')
      .insert([{ 
          hashed_key: hashedToken, 
          plan, 
          requests_today: 0, 
          last_reset_date: new Date().toISOString().split('T')[0] 
      }]);
      
     if (error) console.error('[RateLimit] Error adding API key:', error);
  }
};
