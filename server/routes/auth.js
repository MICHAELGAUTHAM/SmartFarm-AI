import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name } }
            });

            if (error) return res.status(400).json({ error: error.message });
            return res.json({
                success: true,
                token: data.session?.access_token || 'verify_email_sent',
                user: { id: data.user.id, username: username, name }
            });
        }

        // Local JSON Fallback Flow
        const users = getUsers();
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
            username,
            password, 
            name
        };
        
        users.push(newUser);
        saveUsers(users);
        
        const mockToken = Buffer.from(`${newUser.id}-${Date.now()}-sfcore`).toString('base64');
        res.json({ 
            success: true, 
            token: mockToken, 
            user: { id: newUser.id, username: newUser.username, name: newUser.name } 
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

    return router;
}
