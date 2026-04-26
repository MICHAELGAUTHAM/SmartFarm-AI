/**
 * SmartFarm AI — ML API client
 * Usage: import { predict, fetchWeather, fetchMarket } from './ml-api.js';
 *
 * Every function returns: { loading, data, error }
 * or use the callback form: predict(payload, { onLoading, onSuccess, onError })
 */

const BASE = '';   // same-origin — Express proxies to Flask automatically

// ── Internal fetch wrapper ────────────────────────────────────────────────────

async function apiCall(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });

    const json = await res.json();

    if (!res.ok || json.status === 'error') {
        throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json;   // { status: 'success', data: {...}, message: '...' }
}

// ── State helper — wires a DOM element pair to async state ───────────────────

/**
 * runWithState(fn, { loadingEl, resultEl, errorEl })
 * Shows loading → renders result or error, never silently fails.
 */
export async function runWithState(asyncFn, { loadingEl, resultEl, errorEl } = {}) {
    const show = (el, html) => { if (el) el.innerHTML = html; };
    const hide = (el) => { if (el) el.innerHTML = ''; };

    hide(resultEl);
    hide(errorEl);
    show(loadingEl, `
        <div style="display:flex;align-items:center;gap:8px;color:#8b949e;font-size:14px;">
            <div class="sf-spinner"></div> Loading…
        </div>
    `);

    try {
        const result = await asyncFn();
        hide(loadingEl);
        return result;
    } catch (err) {
        hide(loadingEl);
        show(errorEl, `
            <div style="color:#f85149;font-size:14px;padding:10px;background:rgba(248,81,73,.1);border-radius:6px;">
                ⚠️ ${err.message || 'Failed to fetch'}
            </div>
        `);
        console.error('[SmartFarm ML]', err);
        throw err;
    }
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * predict({ income, expenses, city })
 * Returns full response JSON: { status, data: { profit, risk, recommendation } }
 */
export async function predict({ income, expenses, city = 'Madurai' } = {}) {
    return apiCall('/api/v1/predict', {
        method: 'POST',
        body:   JSON.stringify({ income, expenses, city })
    });
}

/**
 * fetchWeather(city)
 * Returns: { status, data: { temperature, rainfall, humidity, risk, advisory } }
 */
export async function fetchWeather(city = 'Madurai') {
    return apiCall(`/api/v1/weather?city=${encodeURIComponent(city)}`);
}

/**
 * fetchMarket()
 * Returns: { status, data: [ { commodity, modal_price, unit, trend } ] }
 */
export async function fetchMarket() {
    return apiCall('/api/v1/market');
}

/**
 * checkAIStatus()
 * Returns Flask health JSON — useful for a status badge on UI.
 */
export async function checkAIStatus() {
    return apiCall('/api/v1/ai-status');
}

// ── Convenience: full predict + render pipeline ───────────────────────────────

/**
 * predictAndRender(formData, containerEl)
 *
 * All-in-one: calls /api/v1/predict, handles loading/error,
 * and injects a result card into containerEl.
 *
 * formData = { income, expenses, city? }
 * containerEl = a DOM element where result will be injected
 */
export async function predictAndRender(formData, containerEl) {
    if (!containerEl) return;

    containerEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;color:#8b949e;font-size:14px;padding:12px;">
            <div class="sf-spinner"></div> Running AI prediction…
        </div>`;

    try {
        const res  = await predict(formData);
        const d    = res.data;
        const low  = d.risk === 'Low';

        containerEl.innerHTML = `
            <div class="sf-result-card" style="
                background:#161b22;border:1px solid ${low ? '#238636' : '#6e2222'};
                border-radius:12px;padding:24px;animation:sf-fade-in .3s ease;
            ">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <span style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;">Prediction Result</span>
                    <span style="
                        padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;
                        background:${low ? 'rgba(35,134,54,.2)' : 'rgba(248,81,73,.15)'};
                        color:${low ? '#3fb950' : '#f85149'};
                    ">${d.risk} Risk</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #21262d;">
                    <span style="color:#8b949e;font-size:14px;">Profit</span>
                    <span style="font-weight:700;font-size:18px;color:${low ? '#3fb950' : '#f85149'};">
                        ₹${d.profit.toLocaleString('en-IN')}
                    </span>
                </div>
                <div style="margin-top:14px;font-size:13px;color:#8b949e;line-height:1.7;
                    padding:12px;background:#0d1117;border-radius:8px;border-left:3px solid ${low ? '#3fb950' : '#f85149'};">
                    ${d.recommendation}
                </div>
            </div>`;
    } catch (err) {
        containerEl.innerHTML = `
            <div style="color:#f85149;font-size:14px;padding:14px;background:rgba(248,81,73,.08);
                border:1px solid rgba(248,81,73,.25);border-radius:10px;">
                ⚠️ ${err.message}
            </div>`;
    }
}

// ── Shared spinner CSS (injected once) ────────────────────────────────────────

if (!document.getElementById('sf-ml-styles')) {
    const s = document.createElement('style');
    s.id = 'sf-ml-styles';
    s.textContent = `
        .sf-spinner {
            width:14px;height:14px;border:2px solid #30363d;border-top-color:#3fb950;
            border-radius:50%;animation:sf-spin .6s linear infinite;display:inline-block;
        }
        @keyframes sf-spin { to { transform: rotate(360deg); } }
        @keyframes sf-fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    `;
    document.head.appendChild(s);
}
