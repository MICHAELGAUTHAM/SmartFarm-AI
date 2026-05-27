import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { addApiKey } from '../apiKeyStore.js';

dotenv.config(); // Ensure variables are loaded before client creation

const router = Router();
const DB_FILE = path.join(process.cwd(), 'server', 'users.json');

// Initialize permanent JSON file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    const defaultUsers = [
        { id: 1, username: 'karthik', password: 'password123', name: 'Karthik' },
        { id: 2, username: 'admin', password: 'smartfarm', name: 'System Admin' }
    ];
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
}

// Helpers for Local JSON DB
const getUsers = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveUsers = (users) => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf-8');

// Initialize Supabase (only connects if ENV vars are provided)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function() {
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;
        
        // Supabase Cloud Flow
        if (supabase) {
            // Note: Supabase auth requires email. We're translating 'username' to email loosely for their system.
            const email = username.includes('@') ? username : `${username}@smartfarm.local`;
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) return res.status(401).json({ error: error.message });
            return res.json({
                success: true,
                token: data.session.access_token,
                user: { id: data.user.id, username: username, name: data.user.user_metadata?.name || username }
            });
        }
        
        // Local JSON Fallback Flow
        const users = getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            const mockToken = Buffer.from(`${user.id}-${Date.now()}-sfcore`).toString('base64');
            res.json({ 
                success: true, 
                token: mockToken, 
                user: { id: user.id, username: user.username, name: user.name } 
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });

    router.post('/signup', async (req, res) => {
        const { name, username, password } = req.body;
        
        if (!name || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Supabase Cloud Flow
        if (supabase) {
            const email = username.includes('@') ? username : `${username}@smartfarm.local`;
            const apiKey = crypto.randomBytes(16).toString('hex');
            addApiKey(apiKey);

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name, api_key: apiKey, plan: 'FREE' } }
            });

            if (error) return res.status(400).json({ error: error.message });
            return res.json({
                success: true,
                token: data.session?.access_token || 'verify_email_sent',
                user: { id: data.user.id, username: username, name, api_key: apiKey, plan: 'FREE' }
            });
        }

        // Local JSON Fallback Flow
        const users = getUsers();
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const apiKey = crypto.randomBytes(16).toString('hex');
        addApiKey(apiKey);

        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
            username,
            password, 
            name,
            api_key: apiKey,
            plan: 'FREE'
        };
        
        users.push(newUser);
        saveUsers(users);
        
        const mockToken = Buffer.from(`${newUser.id}-${Date.now()}-sfcore`).toString('base64');
        res.json({ 
            success: true, 
            token: mockToken, 
            user: { id: newUser.id, username: newUser.username, name: newUser.name, api_key: apiKey, plan: 'FREE' } 
        });
    });

    router.get('/verify', (req, res) => {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            res.json({ valid: true });
        } else {
            res.status(401).json({ valid: false, error: 'Unauthorized' });
        }
    });

    router.post('/rotate-key', async (req, res) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const oldToken = authHeader.split(' ')[1];
        
        const { hashKey, logSecurityEvent } = await import('../apiKeyStore.js');
        const oldHashedToken = hashKey(oldToken);
        const newToken = crypto.randomBytes(16).toString('hex');
        const newHashedToken = hashKey(newToken);
        
        if (supabase) {
            const { data } = await supabase.from('api_keys').select('*').eq('hashed_key', oldHashedToken).single();
            if (!data) {
                logSecurityEvent('KEY_ROTATION_FAILED', req, { message: 'Attempted to rotate invalid key' });
                return res.status(403).json({ error: 'Invalid API Key' });
            }
            
            // Delete old key and insert new (handles PK cascade if setup, or bypasses UPDATE constraints)
            await supabase.from('api_keys').delete().eq('hashed_key', oldHashedToken);
            await supabase.from('api_keys').insert([{
                hashed_key: newHashedToken,
                plan: data.plan,
                requests_today: data.requests_today,
                last_reset_date: data.last_reset_date
            }]);
            
            logSecurityEvent('KEY_ROTATED', req, { plan: data.plan });
            return res.json({ success: true, new_api_key: newToken });
        }
        res.status(501).json({ error: 'Rotation requires database configuration' });
    });

    router.get('/me', async (req, res) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        
        const { hashKey } = await import('../apiKeyStore.js');
        const hashedToken = hashKey(token);
        
        if (supabase) {
            const { data, error } = await supabase.from('api_keys').select('plan, requests_today, last_reset_date').eq('hashed_key', hashedToken).single();
            if (error || !data) return res.status(404).json({ error: 'API Key not found' });
            
            // Fetch recent usage logs
            const { data: logs } = await supabase.from('usage_logs').select('endpoint, created_at').eq('hashed_key', hashedToken).order('created_at', { ascending: false }).limit(10);
            
            return res.json({ 
                plan: data.plan, 
                requests_today: data.requests_today, 
                last_reset_date: data.last_reset_date,
                recent_logs: logs || []
            });
        }
        res.status(501).json({ error: 'Database not configured' });
    });

    return router;
}
