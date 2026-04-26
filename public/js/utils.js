// API configuration
// For split deployment (Frontend on Static Site, Backend on Web Service):
// Set API_BASE to your Render Web Service URL (e.g., https://smartfarm-backend.onrender.com)
const API_BASE = 'https://smartfarm-ai1.onrender.com';
const API_URL = `${API_BASE}/api`;

export async function fetchDistricts() {
    try {
        const res = await fetch(`${API_URL}/districts`);
        return await res.json();
    } catch (err) {
        console.error('Error fetching districts:', err);
        return [];
    }
}

export async function fetchClimate(districtId) {
    if (!districtId) return null;
    try {
        const res = await fetch(`${API_URL}/districts/${districtId}/climate`);
        return await res.json();
    } catch (err) {
        console.error('Error fetching climate:', err);
        return null;
    }
}

export async function fetchCrops({ soil, maxDuration, category, search, fertility }) {
    try {
        const params = new URLSearchParams();
        if (soil) params.append('soil', soil);
        if (maxDuration) params.append('maxDuration', maxDuration);
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (fertility) params.append('fertility', fertility);

        const res = await fetch(`${API_URL}/crops?${params.toString()}`);
        return await res.json();
    } catch (err) {
        console.error('Error fetching crops:', err);
        return { count: 0, crops: [] };
    }
}

export async function fetchCropPlan(cropId) {
    try {
        const res = await fetch(`${API_URL}/crops/${cropId}/plan`);
        return await res.json();
    } catch (err) {
        console.error('Error fetching crop plan:', err);
        return null;
    }
}

export async function calculateBudget(data) {
    try {
        const res = await fetch(`${API_URL}/crops/budget`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (err) {
        console.error('Error calculating budget:', err);
        return null;
    }
}

export async function optimizeFarm(data) {
    try {
        const res = await fetch(`${API_URL}/crops/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (err) {
        console.error('Error optimizing farm:', err);
        return null;
    }
}

export async function fetchMarkovForecast(districtId) {
    try {
        const res = await fetch(`${API_URL}/crops/markov-forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ districtId })
        });
        return await res.json();
    } catch (err) { return null; }
}


export async function fetchSensitivity(data) {
    try {
        const res = await fetch(`${API_URL}/crops/sensitivity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (err) { return null; }
}

// Info API wrappers
export async function fetchMarketPrices(districtId) {
    try {
        const res = await fetch(`${API_URL}/districts/${districtId}/market-prices`);
        return await res.json();
    } catch (e) { return []; }
}

export async function fetchSubsidies() {
    try {
        const res = await fetch(`${API_URL}/info`);
        return await res.json();
    } catch (e) { return []; }
}

export async function fetchSoilLabs(districtId) {
    try {
        const res = await fetch(`${API_URL}/districts/${districtId}/soil-labs`);
        return await res.json();
    } catch (e) { return []; }
}

export async function fetchExportSteps() {
    try {
        const res = await fetch(`${API_URL}/info/export-steps`);
        return await res.json();
    } catch (e) { return []; }
}

export async function registerAlerts(data) {
    try {
        const res = await fetch(`${API_URL}/alerts/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) { return null; }
}

// Format utilities
export function formatCurrency(amount) {
    if (isNaN(amount)) return "₹--";
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// Short compact format: ₹1.2L, ₹85K, ₹500
export function formatCurrencyShort(amount) {
    if (isNaN(amount) || amount === null) return "₹--";
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
    return `${sign}₹${abs}`;
}

export function formatDate(dateStr, addDays = 0) {
    const d = new Date(dateStr);
    if (addDays) d.setDate(d.getDate() + addDays);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function getRiskColor(risk) {
    return risk === 'High' ? 'text-rose-500' : risk === 'Medium' ? 'text-amber-500' : 'text-emerald-500';
}
