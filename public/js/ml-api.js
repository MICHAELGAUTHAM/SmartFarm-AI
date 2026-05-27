/**
 * SmartFarm AI — ML API client
 * Usage: import { predict, fetchWeather, fetchMarket } from './ml-api.js';
 *
 * Every function returns: { loading, data, error }
 * or use the callback form: predict(payload, { onLoading, onSuccess, onError })
 */

// API configuration
// For split deployment: Set BASE to your Render Web Service URL
const BASE = 'https://smartfarm-ai1.onrender.com'; 

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
 * predict({ soil_n, soil_p, soil_k, crop_id, city })
 * Returns full response JSON: { status, data: { suitability_score, risk, recommendation, fertilizer_rec, ... } }
 */
export async function predict({ soil_n, soil_p, soil_k, crop_id, city = 'Madurai' } = {}) {
    return apiCall('/api/v1/predict', {
        method: 'POST',
        body:   JSON.stringify({ soil_n, soil_p, soil_k, crop_id, city })
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
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:#8b949e;font-size:14px;padding:32px;background:#0d1117;border-radius:20px;border:1px dashed #30363d;">
            <div class="sf-spinner" style="width:24px;height:24px;"></div> 
            <span style="font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:10px;">Analyzing Precision Matrix...</span>
        </div>`;

    try {
        const res  = await predict(formData);
        const d    = res.data;
        const low  = d.risk_level === 'Low';
        const conf = d.confidence_score;

        containerEl.innerHTML = `
            <div class="sf-result-card" style="
                background:#161b22;border:1px solid ${low ? '#238636' : '#6e2222'};
                border-radius:24px;padding:28px;animation:sf-fade-in .4s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                <!-- Header: Confidence & Risk -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:36px;height:36px;border-radius:10px;background:${low ? 'rgba(35,134,54,.1)' : 'rgba(248,81,73,.1)'};display:flex;align-items:center;justify-content:center;color:${low ? '#3fb950' : '#f85149'};">
                            <svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <span style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;display:block;font-weight:800;">Risk Assessment</span>
                            <span style="color:${low ? '#3fb950' : '#f85149'};font-weight:900;font-size:14px;text-transform:uppercase;">${d.risk_level} Risk</span>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;display:block;font-weight:800;">Confidence</span>
                        <span style="color:#6366f1;font-weight:900;font-size:16px;">${conf}%</span>
                    </div>
                </div>

                <!-- Main Prediction -->
                <div style="background:rgba(255,255,255,0.03);border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:11px;color:#8b949e;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px;">Predicted Yield</span>
                    <div style="display:flex;align-items:baseline;gap:8px;">
                        <span style="font-weight:900;font-size:32px;color:#fff;">${d.predicted_yield.toLocaleString('en-IN')}</span>
                        <span style="color:#8b949e;font-size:14px;font-weight:700;">kg/acre</span>
                    </div>
                </div>

                <!-- SHAP Explainability -->
                <div style="margin-bottom:20px;">
                    <span style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;font-weight:800;display:block;margin-bottom:12px;">AI Logic (Explainability)</span>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        ${d.explainability.map(exp => `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;padding:10px 14px;border-radius:10px;border-left:3px solid ${exp.impact === 'positive' ? '#3fb950' : '#f85149'};">
                                <span style="font-size:12px;color:#c9d1d9;font-weight:600;">${exp.feature}</span>
                                <span style="font-size:11px;color:${exp.impact === 'positive' ? '#3fb950' : '#f85149'};font-weight:800;">${exp.impact === 'positive' ? '↑ High Boost' : '↓ Reduction'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Recommendation -->
                <div style="margin-top:14px;font-size:13px;color:#c9d1d9;line-height:1.6;
                    padding:16px;background:rgba(99,102,241,0.05);border-radius:16px;border:1px solid rgba(99,102,241,0.15);display:flex;gap:12px;">
                    <span style="font-size:20px;">💡</span>
                    <span>${d.recommendation}</span>
                </div>
            </div>`;
    } catch (err) {
        containerEl.innerHTML = `
            <div style="color:#f85149;font-size:14px;padding:20px;background:rgba(248,81,73,.08);
                border:1px solid rgba(248,81,73,.25);border-radius:16px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:20px;">⚠️</span>
                <div>
                    <strong style="display:block;text-transform:uppercase;font-size:10px;letter-spacing:1px;margin-bottom:4px;">Prediction Error</strong>
                    ${err.message}
                </div>
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
