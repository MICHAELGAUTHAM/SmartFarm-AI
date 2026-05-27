import * as API from './utils.js';
import { formatCurrencyShort, fetchMarkovForecast, fetchSensitivity } from './utils.js';
import { t, toggleLang, applyTranslations, getLang } from './i18n.js';

// Expose language toggle globally
window.toggleAppLang = () => { toggleLang(); };

let state = {
    districts: [],
    currentDistrict: null,
    currentClimate: null,
    crops: [],
    filter: 'all',
    activeModalCropId: null,
    modalConfig: {
        acres: 1,
        seedCost: 5000,
        laborCost: 12000,
        fertCost: 8000,
        waterCost: 3000,
        addlCost: 2000
    }
};

// Slider Display Helpers
function syncDurationDisplay(val) {
    const d = parseInt(val);
    const months = Math.round(d / 30.416);
    let label;
    if (months < 1) label = 'Less than 1 month';
    else if (months === 1) label = '1 month';
    else label = `${months} months`;
    const el = document.getElementById('durationVal');
    if (el) el.innerText = `${d} Days — ${label}`;
}

function syncSoilQualityDisplay(val) {
    const v = parseFloat(val);
    const label = v <= 2 ? 'Poor' : v <= 4 ? 'Below Avg' : v <= 6 ? 'Average' : v <= 8 ? 'Good' : 'Excellent';
    const el = document.getElementById('soilVal');
    if (el) el.innerText = `${v} / 10 — ${label}`;
}

// Initialization Bootstrapper
async function bootstrap() {
    console.log('--- SmartFarm AI Bootstrap Initializing ---');
    
    // Defensive localStorage handling
    let user = null;
    try {
        user = localStorage.getItem('sf_user');
    } catch (e) {
        console.warn('LocalStorage access blocked by browser.');
    }

    if (user) {
        const userNameDisplay = document.getElementById('userNameDisplay');
        const userInitial = document.getElementById('userInitial');
        if (userNameDisplay) userNameDisplay.innerText = user;
        if (userInitial) userInitial.innerText = user.charAt(0).toUpperCase();
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            try {
                localStorage.removeItem('sf_user');
                localStorage.removeItem('sf_token');
            } catch (e) {}
            window.location.href = '/login.html';
        });
    }

    // Set default planting date
    const plantingDateInput = document.getElementById('plantingDate');
    if (plantingDateInput) plantingDateInput.valueAsDate = new Date();

    // Event Listeners
    const elements = {
        districtSelect: document.getElementById('districtSelect'),
        soilTypeSelect: document.getElementById('soilTypeSelect'),
        maxDurationInput: document.getElementById('maxDurationInput'),
        soilQuality: document.getElementById('soilQuality'),
        cropSearch: document.getElementById('cropSearch'),
        optimizerBtn: document.getElementById('runOptimizerBtn')
    };

    if (elements.districtSelect) elements.districtSelect.addEventListener('change', handleDistrictChange);
    if (elements.soilTypeSelect) elements.soilTypeSelect.addEventListener('change', handleStateChange);
    if (elements.maxDurationInput) elements.maxDurationInput.addEventListener('input', (e) => {
        syncDurationDisplay(e.target.value);
        handleStateChange();
    });
    if (elements.soilQuality) elements.soilQuality.addEventListener('input', handleSoilQualityChange);
    if (elements.cropSearch) elements.cropSearch.addEventListener('input', handleStateChange);
    if (elements.optimizerBtn) elements.optimizerBtn.addEventListener('click', showLPModal);

    // Sync slider display values on load
    syncDurationDisplay(elements.maxDurationInput?.value || 365);
    syncSoilQualityDisplay(elements.soilQuality?.value || 8);

    // Initial Data Load
    try {
        await loadDistricts();
        
        // Restore Dark Mode if saved
        if (localStorage.getItem('sf_dark') === 'true') {
            document.documentElement.classList.add('dark-matrix');
            const btn = document.getElementById('themeToggleBtn');
            if (btn) btn.innerText = '🌞 Light Mode';
        }

        await handleStateChange();
        applyTranslations();
    } catch (err) {
        console.error('Initialization Error:', err);
    }

    // Re-render when language toggled
    document.addEventListener('langchange', async () => {
        await loadDistricts();
        await handleStateChange();
    });
}

async function loadDistricts() {
    const select = document.getElementById('districtSelect');
    if (!select) return;

    try {
        state.districts = await API.fetchDistricts();
        console.log(`Loaded ${state.districts.length} districts.`);
        
        select.innerHTML = '';
        state.districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            const dName = (getLang() === 'ta' && d.name_ta) ? d.name_ta : d.name;
            opt.innerText = `${dName} (${d.zone})`;
            if (state.currentDistrict == d.id) opt.selected = true;
            select.appendChild(opt);
        });

        if (state.districts.length > 0 && !state.currentDistrict) {
            state.currentDistrict = state.districts[0].id;
        }
    } catch (err) {
        console.error('Error in loadDistricts:', err);
    }
}

async function handleDistrictChange(e) {
    state.currentDistrict = e.target.value;
    await handleStateChange();
}

async function handleSoilQualityChange(e) {
    syncSoilQualityDisplay(e.target.value);
    await handleStateChange();
}

async function handleStateChange() {
    showLoading();
    
    const params = {
        soil: document.getElementById('soilTypeSelect')?.value || 'Red',
        maxDuration: document.getElementById('maxDurationInput')?.value || 365,
        search: document.getElementById('cropSearch')?.value || '',
        fertility: document.getElementById('soilQuality')?.value || 7.5,
        category: state.filter || 'all'
    };

    try {
        const response = await API.fetchCrops(params);
        state.crops = response.crops || [];
        renderCrops();
        
        if (state.currentDistrict) {
            const climate = await API.fetchClimate(state.currentDistrict);
            if (climate) {
                state.currentClimate = climate;
                updateClimateUI(climate);
            }
        }
    } catch (err) {
        console.error('State Change Error:', err);
    }
}

function updateClimateUI(c) {
    const seasonLabel = document.getElementById('seasonLabel');
    const tempDisplay = document.getElementById('tempDisplay');
    const rainDisplay = document.getElementById('rainDisplay');

    if (seasonLabel) seasonLabel.innerText = c.currentSeason || '--';
    if (tempDisplay) tempDisplay.innerText = `${c.currentTemp || '--'}°C`;
    if (rainDisplay) rainDisplay.innerText = `${c.currentRain || '--'}mm`;
}

function showLoading() {
    const grid = document.getElementById('resultsGrid');
    const empty = document.getElementById('emptyState');
    if (grid) grid.innerHTML = `<div class="col-span-full py-20 flex justify-center"><div class="loader"></div></div>`;
    if (empty) empty.classList.add('hidden');
}

function renderCrops() {
    const grid = document.getElementById('resultsGrid');
    const empty = document.getElementById('emptyState');
    if (!grid || !empty) return;

    grid.innerHTML = "";
    if (!state.crops || state.crops.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    const isTamil = getLang() === 'ta';
    state.crops.forEach((res, index) => {
        const card = document.createElement('div');
        card.className = "crop-card glass-card p-8 rounded-[2.5rem] flex flex-col group animate-appear relative overflow-hidden";
        
        const primaryName = isTamil ? res.name_ta : res.name;
        const secondName = isTamil ? res.name : res.name_ta;

        card.innerHTML = `
            <div class="mb-6 flex items-start gap-5">
                <div class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl group-hover:bg-emerald-50 transition-colors shadow-inner">${res.icon}</div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <h3 class="text-xl font-black text-slate-900">${primaryName} <span class="text-xs text-slate-400 font-medium ml-1">(${secondName})</span></h3>
                        ${index === 0 ? `<span class="bg-emerald-600 text-white px-3 py-1 text-[9px] rounded-xl font-black shadow-lg shadow-emerald-600/20">⭐ ${isTamil ? 'சிறந்த தேர்வு' : 'BEST CHOICE'}</span>` : ''}
                    </div>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">${res.category} • ${isTamil ? 'அடிப்படை விளைச்சல்' : 'Base Yield'}: ${res.base_yield} kg/ha</p>
                </div>
            </div>
            <div class="bg-slate-50/50 rounded-3xl p-5 mb-6 space-y-3 border border-slate-100/50">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${isTamil ? 'எதிர்பார்க்கப்படும் வருவாய்' : 'Est. Return'}</span>
                    <span class="text-xl font-black text-emerald-600">${API.formatCurrency(res.profit)}</span>
                </div>
                <div class="flex justify-between items-center border-t border-slate-100 pt-2">
                    <div class="space-y-1">
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">${isTamil ? 'ஆபத்து நிலை' : 'Risk Level'}: <span class="${API.getRiskColor(res.risk)}">${res.risk}</span></p>
                        <p class="text-[10px] text-slate-400 font-bold uppercase">AI ${isTamil ? 'மதிப்பெண்' : 'Score'}: <span class="text-slate-900">${res.score}</span></p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">${isTamil ? 'காலக்கெடு' : 'Duration'}</p>
                        <p class="text-xs font-black text-slate-800">${res.duration} ${t('duration_label')}</p>
                    </div>
                </div>
            </div>
            <button onclick="viewFullPlan(${res.id})" class="w-full mt-auto bg-slate-900 text-white font-black py-4 px-6 rounded-2xl hover:bg-emerald-600 border border-transparent hover:border-emerald-400 transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-emerald-500/30 active:scale-95 group/btn mb-2">
                <span class="text-[10px] tracking-widest uppercase transition-transform group-hover/btn:scale-105">${t('view_plan')}</span>
                <svg class="w-4 h-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
        `;
        grid.appendChild(card);
    });
}

// -----------------------------------------------------------------------------
// Filter Pills
// -----------------------------------------------------------------------------
window.setFilter = async (filter) => {
    state.filter = filter;

    // Update button active styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-slate-900', 'text-white', 'shadow-md');
        btn.classList.add('bg-white', 'text-slate-500', 'border', 'border-slate-200');
    });

    // Derive button id: 'all' → 'btn-all', 'Cash Crops' → 'btn-Cash-Crops'
    const btnId = 'btn-' + filter.replace(/ /g, '-');
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-slate-500', 'border', 'border-slate-200');
        activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-md');
    }

    await handleStateChange();
};

// Global UI Exposure
window.viewFullPlan = async (cropId) => {
    state.activeModalCropId = cropId;
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    
    try {
        const plan = await API.fetchCropPlan(cropId);
        if (!plan) return;

        // Default initial config based on crop averages
        const cropInState = (state.crops || []).find(c => c.id === cropId);
        const baseProfit = cropInState ? cropInState.profit : 50000;
        
        state.modalConfig = {
            acres: 1,
            seedCost: Math.round(baseProfit * 0.15),
            laborCost: Math.round(baseProfit * 0.25),
            fertCost: Math.round(baseProfit * 0.15),
            waterCost: Math.round(baseProfit * 0.10),
            addlCost: Math.round(baseProfit * 0.05),
            pricePerUnit: Math.round(baseProfit * 1.65) // Base Revenue Expectation
        };

        renderModal(generatePlanHTML(plan));
        recalculatePlanMaths();
    } catch (err) {
        console.error('View Plan Error:', err);
    }
};

window.recalculatePlanMaths = () => {
    const c = state.modalConfig;
    const acres = parseFloat(document.getElementById('input-acres')?.value) || 1;
    const seeds = parseFloat(document.getElementById('input-seeds')?.value) || 0;
    const labor = parseFloat(document.getElementById('input-labor')?.value) || 0;
    const fert = parseFloat(document.getElementById('input-fert')?.value) || 0;
    const water = parseFloat(document.getElementById('input-water')?.value) || 0;
    const addl = parseFloat(document.getElementById('input-addl')?.value) || 0;
    
    // Update State
    state.modalConfig = { 
        ...c, acres, seedCost: seeds, laborCost: labor, fertCost: fert, waterCost: water, addlCost: addl 
    };

    // Calculate Totals for HUD
    const totalCost = (seeds + labor + fert + water + addl) * acres;
    const grossRevenue = c.pricePerUnit * acres;
    const trueMargin = grossRevenue - totalCost;
    const roi = totalCost > 0 ? ((trueMargin / totalCost) * 100).toFixed(1) : 0;
    const spoilage = grossRevenue * 0.08;

    // Direct DOM Update for HUD
    const hudMap = {
        'hud-gross': grossRevenue,
        'hud-investment': totalCost,
        'hud-margin': trueMargin,
        'hud-spoilage': spoilage
    };
    
    Object.keys(hudMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = API.formatCurrency(hudMap[id]);
    });
    
    const roiEl = document.getElementById('hud-roi');
    if (roiEl) roiEl.innerText = `${roi}%`;

    // Refresh All 5 Charts
    const calcData = {
        gross: grossRevenue,
        cost: totalCost,
        margin: trueMargin,
        breakdown: [seeds * acres, labor * acres, fert * acres, water * acres, addl * acres],
        spoilage: spoilage
    };
    
    initPlanChartsWithData(calcData);
};

window.toggleGlobalDarkMode = () => {
    document.documentElement.classList.toggle('dark-matrix');
    const isDark = document.documentElement.classList.contains('dark-matrix');
    localStorage.setItem('sf_dark', isDark);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerText = isDark ? '🌞 Light Mode' : '🌑 Matrix Dark';
};

window.downloadPlanPDF = () => {
    const element = document.getElementById('modalContent');
    const opt = {
        margin:       0.2,
        filename:     `SmartFarm_Analysis_${state.activeModalCropId}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save();
    }
};

function generatePlanHTML(plan) {
    const isTamil = getLang() === 'ta';
    const c = plan.crop;
    const conf = state.modalConfig;
    const name = isTamil ? c.name_ta : c.name;
    
    return `
        <div class="animate-slide-up space-y-8 pb-20">
            <!-- Header Section -->
            <div class="flex flex-col gap-6 bg-slate-50 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div class="flex items-center gap-4 sm:gap-8 relative z-10">
                    <div class="w-16 h-16 sm:w-28 sm:h-28 shrink-0 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center text-4xl sm:text-6xl shadow-xl border border-white">
                        ${c.icon}
                    </div>
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <span class="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">${c.category}</span>
                            <span class="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-bold uppercase tracking-widest">${c.water_req} Water</span>
                        </div>
                        <h2 class="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter truncate">${name}</h2>
                        <p class="text-slate-500 font-medium text-xs sm:text-sm mt-1">${isTamil ? 'அறிவார்ந்த சாகுபடி வழிகாட்டி' : 'Precision Cultivation Roadmap'}</p>
                    </div>
                </div>
                <div class="relative z-10">
                    <button onclick="window.downloadPlanPDF()" class="w-full sm:w-auto px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        ${t('download_pdf')}
                    </button>
                </div>
            </div>

            <!-- LIVE CONFIGURATOR & HUD -->
            <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <!-- Inputs -->
                <div class="xl:col-span-4 bg-white border-2 border-slate-50 shadow-xl rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 space-y-5">
                    <h3 class="font-black text-slate-900 uppercase text-xs tracking-widest border-b border-slate-50 pb-4 flex items-center gap-2">
                        <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                        ${t('hud_live_config')}
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="relative">
                            <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">${t('hud_farm_area')}</label>
                            <input oninput="recalculatePlanMaths()" id="input-acres" type="number" value="${conf.acres}" step="0.5" min="0.5" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none focus:ring-2 ring-emerald-500/20 shadow-inner pr-14">
                            <span class="absolute right-4 bottom-3 text-[9px] font-black text-slate-300 uppercase">Acres</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('hud_seeds')}</label>
                                <input oninput="recalculatePlanMaths()" id="input-seeds" type="number" value="${conf.seedCost}" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none">
                            </div>
                            <div>
                                <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('hud_labor')}</label>
                                <input oninput="recalculatePlanMaths()" id="input-labor" type="number" value="${conf.laborCost}" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none">
                            </div>
                            <div>
                                <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('hud_fert')}</label>
                                <input oninput="recalculatePlanMaths()" id="input-fert" type="number" value="${conf.fertCost}" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none">
                            </div>
                            <div>
                                <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('hud_water')}</label>
                                <input oninput="recalculatePlanMaths()" id="input-water" type="number" value="${conf.waterCost}" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('hud_addl')}</label>
                            <input oninput="recalculatePlanMaths()" id="input-addl" type="number" value="${conf.addlCost}" class="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-black text-slate-900 text-sm outline-none">
                        </div>
                    </div>
                </div>

                <!-- HUD Status -->
                <div class="xl:col-span-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div class="bg-indigo-50 border border-indigo-100 p-5 sm:p-6 rounded-[2rem] shadow-sm">
                        <p class="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">${t('hud_gross_revenue')}</p>
                        <p id="hud-gross" class="text-xl sm:text-2xl font-black text-indigo-900 break-all">₹ 0</p>
                    </div>
                    <div class="bg-rose-50 border border-rose-100 p-5 sm:p-6 rounded-[2rem] shadow-sm">
                        <p class="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-2">${t('hud_total_investment')}</p>
                        <p id="hud-investment" class="text-xl sm:text-2xl font-black text-rose-900 break-all">₹ 0</p>
                    </div>
                    <div class="col-span-2 sm:col-span-1 bg-emerald-50 border border-emerald-100 p-5 sm:p-6 rounded-[2rem] shadow-sm">
                        <p class="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-2">${t('hud_true_margin')}</p>
                        <p id="hud-margin" class="text-2xl sm:text-3xl font-black text-emerald-900 break-all">₹ 0</p>
                    </div>
                    <div class="bg-amber-50 border border-amber-100 p-5 sm:p-6 rounded-[2rem] shadow-sm">
                        <p class="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-2">${t('hud_spoilage')}</p>
                        <p id="hud-spoilage" class="text-lg sm:text-xl font-black text-amber-900 break-all">₹ 0</p>
                    </div>
                    <div class="bg-slate-900 text-white p-5 sm:p-6 rounded-[2rem] shadow-xl">
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">${t('hud_roi')}</p>
                        <p id="hud-roi" class="text-2xl sm:text-3xl font-black text-emerald-400">0%</p>
                    </div>
                    <div class="bg-white border-2 border-slate-50 p-5 sm:p-6 rounded-[2rem] shadow-sm flex flex-col justify-center items-center">
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Stability</p>
                        <p class="text-xl sm:text-2xl font-black text-indigo-600">8.4/10</p>
                    </div>
                </div>
            </div>

            <!-- Standardized Phases -->
            <div>
                 <h3 class="text-sm sm:text-base font-black text-slate-900 uppercase tracking-widest mb-6 border-b-2 border-slate-50 pb-4">${t('crop_cycle_title')}</h3>
                 <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    ${plan.phases.map((ph, i) => `
                        <div class="bg-white border border-slate-100 p-6 sm:p-7 rounded-[2rem] shadow-sm hover:shadow-xl transition-all relative group">
                            <div class="absolute -right-2 -top-2 w-10 h-10 bg-slate-50 group-hover:bg-emerald-50 rounded-full flex items-center justify-center font-black text-slate-200 group-hover:text-emerald-200 text-xl transition-all">${i+1}</div>
                            <span class="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase mb-3 block w-fit tracking-tighter">${ph.day_label}</span>
                            <h4 class="text-base font-black text-slate-900 mb-2 leading-tight">${isTamil ? ph.title_ta : ph.title}</h4>
                            <p class="text-slate-400 text-xs font-medium leading-relaxed">${ph.description}</p>
                        </div>
                    `).join('')}
                 </div>
            </div>

            <!-- Analytics Panel -->
            <div class="bg-slate-950 rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-10 md:p-14 text-white overflow-hidden relative shadow-2xl">
                <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] -mr-40 -mt-40"></div>
                <div class="relative z-10">
                    <div class="flex items-center gap-3 mb-6 sm:mb-10 border-b border-white/5 pb-5">
                        <div class="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-base sm:text-lg font-black text-white uppercase tracking-widest">Financial Analytics</h3>
                            <p class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Live Configurator — adjust inputs above to update</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                        <div class="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-xl">
                            <h4 class="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-4 sm:mb-6">${t('modal_chart_bar')}</h4>
                            <div class="h-[200px] sm:h-[220px] w-full"><canvas id="profitChart"></canvas></div>
                        </div>
                        <div class="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-xl">
                            <h4 class="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-4 sm:mb-6">${t('modal_chart_pie')}</h4>
                            <div class="h-[200px] sm:h-[220px] w-full"><canvas id="costBreakdownChart"></canvas></div>
                        </div>
                        <div class="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-xl">
                            <h4 class="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-4 sm:mb-6">${t('modal_chart_donut')}</h4>
                            <div class="h-[200px] sm:h-[220px] w-full"><canvas id="marketChart"></canvas></div>
                        </div>
                        <div class="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-xl">
                            <h4 class="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-4 sm:mb-6">${t('modal_chart_timeline')}</h4>
                            <div class="h-[200px] sm:h-[220px] w-full"><canvas id="timelineChart"></canvas></div>
                        </div>
                        <div class="sm:col-span-2 xl:col-span-2 bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-5 sm:p-10 rounded-[1.5rem] sm:rounded-[3rem] backdrop-blur-xl">
                            <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4 sm:mb-8 text-center">Stability &amp; Resource Risk Radar</h4>
                            <div class="h-[260px] sm:h-[320px] w-full"><canvas id="radarChart"></canvas></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initPlanChartsWithData(data) {
    if (!window.Chart) return;

    const configs = [
        { 
            id: 'profitChart', type: 'bar', 
            data: { 
                labels: ['Gross Revenue', 'Total Cost', 'Net Margin'], 
                datasets: [{ 
                    label: 'Amount (₹)',
                    data: [data.gross, data.cost, data.margin], 
                    backgroundColor: ['rgba(16,185,129,0.85)', 'rgba(244,63,94,0.85)', 'rgba(99,102,241,0.85)'],
                    borderColor: ['#10b981', '#f43f5e', '#6366f1'],
                    borderWidth: 2,
                    borderRadius: 10,
                    barThickness: 36
                }] 
            },
            options: { 
                scales: { 
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.06)' },
                        ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' }, callback: (v) => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#cbd5e1', font: { size: 10, weight: 'bold' } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        },
        { 
            id: 'costBreakdownChart', type: 'pie', 
            data: { 
                labels: ['Seeds', 'Labor', 'Fert', 'Water', 'Misc'], 
                datasets: [{ 
                    data: data.breakdown, 
                    backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#0ea5e9', '#f43f5e'],
                    borderColor: 'rgba(0,0,0,0)', borderWidth: 0
                }] 
            }
        },
        { 
            id: 'marketChart', type: 'doughnut', 
            data: { 
                labels: ['Solid Plan', 'Risk Buffer'], 
                datasets: [{ 
                    data: [data.margin, data.spoilage], 
                    backgroundColor: ['#10b981', '#ffffff05'], 
                    cutout: '80%', borderWidth: 0 
                }] 
            }
        },
        { 
            id: 'timelineChart', type: 'polarArea', 
            data: { 
                labels: ['Prep', 'Sow', 'Grow', 'Maint', 'Harvest'], 
                datasets: [{ 
                    data: [15, 10, 40, 20, 15], 
                    backgroundColor: ['#10b98180', '#3b82f680', '#8b5cf680', '#fbbf2480', '#f43f5e80'],
                    borderColor: 'rgba(255,255,255,0.1)'
                }] 
            },
            options: { scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } } } }
        },
        { 
            id: 'radarChart', type: 'radar', 
            data: { 
                labels: ['Yield Potential', 'Resources', 'Climate', 'Market ROI', 'Soil Fit', 'Logistics'], 
                datasets: [{ 
                    label: 'Dynamic Matrix', 
                    data: [85, 75, 90, 80, 88, 70], 
                    borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 5, pointRadius: 0
                }] 
            },
            options: { 
                scales: { 
                    r: { 
                        grid: { color: 'rgba(255,255,255,0.08)' }, angleLines: { color: 'rgba(255,255,255,0.08)' },
                        pointLabels: { color: '#94a3b8', font: { weight: 'bold', size: 11 } },
                        ticks: { display: false, max: 100 }
                    } 
                } 
            }
        }
    ];

    configs.forEach(c => {
        const ctx = document.getElementById(c.id);
        if (ctx) {
            const chartKey = `my${c.id}`;
            if (window[chartKey]) window[chartKey].destroy();
            window[chartKey] = new Chart(ctx, {
                type: c.type,
                data: c.data,
                options: { 
                    responsive: true, maintainAspectRatio: false, ...c.options, 
                    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { weight: 'bold', size: 10 }, padding: 20 } } } 
                }
            });
        }
    });
}

window.showWeatherAdvisory = async () => {
    if (!state.currentDistrict) return;
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const climate = await API.fetchClimate(state.currentDistrict);
    renderModal(`
        <div class="p-10 animate-slide-up space-y-10">
            <h2 class="text-4xl font-black text-slate-900">AI Weather Observatory</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                ${climate.monthly.map(m => `
                    <div class="glass-card p-6 rounded-[2rem] border border-slate-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">${m.season}</p>
                        <p class="text-2xl font-black text-slate-900">${m.temp}°C</p>
                        <p class="text-[10px] font-bold text-blue-500 uppercase">${m.rain}mm Rain</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
};

window.showExportGuide = async () => {
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const steps = await API.fetchExportSteps();
    renderModal(`
        <div class="p-10 animate-slide-up space-y-8">
            <h2 class="text-4xl font-black text-slate-900">Export Protocols</h2>
            ${steps.map(s => `
                <div class="flex gap-6 items-center bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
                    <div class="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">${s.step_order}</div>
                    <div>
                        <h4 class="text-2xl font-black text-slate-900">${s.title}</h4>
                        <p class="text-slate-500">${s.description}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `);
};

window.showMarketPriceDetails = async () => {
    const districtId = state.currentDistrict;
    if (!districtId) return;
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const prices = await API.fetchMarketPrices(districtId);
    renderModal(`
        <div class="p-8 animate-slide-up">
            <h2 class="text-4xl font-black mb-10 tracking-tight">${t('modal_market_pulse')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${prices.map(p => `
                    <div class="p-6 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-2 h-2 rounded-full ${p.trend === 'Up' ? 'bg-emerald-500 animate-pulse' : p.trend === 'Down' ? 'bg-rose-500' : 'bg-slate-300'}"></div>
                            <span class="font-black text-slate-900">${p.commodity}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-xl font-black text-emerald-600 block">${API.formatCurrency(p.modal_price)}</span>
                            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${p.unit}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
};

window.showSoilHubs = async () => {
    if (!state.currentDistrict) return;
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const labs = await API.fetchSoilLabs(state.currentDistrict);
    renderModal(`
        <div class="p-8 animate-slide-up">
            <h2 class="text-4xl font-black mb-10 tracking-tight">${t('modal_soil_hubs')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${labs.map(lab => `
                    <div class="p-8 bg-white border-2 border-slate-50 rounded-[2.5rem] relative overflow-hidden group hover:border-blue-100 transition-all">
                        <h4 class="font-black text-slate-900 text-lg relative z-10 line-clamp-1">${lab.lab_name}</h4>
                        <p class="text-sm text-slate-500 mt-2">${lab.address}</p>
                        <div class="mt-6 flex justify-between items-center">
                            <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">${lab.type}</span>
                            <span class="text-xs font-black text-slate-800">${lab.phone}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
};

window.showMarkovForecast = async () => {
    if (!state.currentDistrict) return;
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const data = await API.fetchMarkovForecast(state.currentDistrict);
    renderModal(`
        <div class="p-10 animate-slide-up space-y-8">
            <h2 class="text-4xl font-black text-slate-900">Markov Projection</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                ${data.forecast.map(f => `
                    <div class="glass-card p-6 rounded-[2rem] border border-slate-100">
                        <span class="text-3xl">${f.icon}</span>
                        <h4 class="font-black mt-2">${f.label}</h4>
                        <p class="text-xs text-slate-400 font-bold uppercase">${f.confidence}% Confidence</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
};

window.showSensitivityAnalysis = async () => {
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const res = await API.fetchSensitivity({ districtId: state.currentDistrict });
    renderModal(`
        <div class="p-6 sm:p-10 animate-slide-up space-y-6 sm:space-y-10">
            <h2 class="text-2xl sm:text-4xl font-black text-slate-900">ROI Sensitivity Analysis</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div class="bg-slate-900 text-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem]">
                    <p class="text-[9px] font-black uppercase opacity-50 mb-3">Base Profit Potential</p>
                    <div class="text-2xl sm:text-3xl font-black break-all">${API.formatCurrency(res.baseProfit)}</div>
                </div>
                <div class="glass-card p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100">
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-3">Budget Elasticity (∂P/∂B)</p>
                    <div class="text-2xl sm:text-3xl font-black text-emerald-600">${res.budget.roi_pct}% ROI</div>
                    <span class="mt-3 inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase">${res.budget.impact}</span>
                </div>
                <div class="glass-card p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100">
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-3">Water Elasticity (∂P/∂W)</p>
                    <div class="text-2xl sm:text-3xl font-black text-blue-600 break-all">${res.water.roi_unit} ₹/m³</div>
                    <span class="mt-3 inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase">${res.water.impact}</span>
                </div>
            </div>
            <div class="bg-amber-50 border border-amber-100 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] flex items-start sm:items-center gap-4">
                <div class="w-12 h-12 shrink-0 bg-amber-200/50 rounded-xl flex items-center justify-center text-2xl">🧩</div>
                <div>
                    <p class="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Primary Growth Bottleneck</p>
                    <p class="text-lg sm:text-xl font-black text-amber-900">Your limiting factor is <span class="underline decoration-amber-400">${res.bottleneck}</span></p>
                    <p class="text-xs text-amber-700/70 mt-1 font-medium">Adding 1 unit of this resource yields the highest marginal profit increase.</p>
                </div>
            </div>
        </div>
    `);
};

window.showMathModels = () => {
    const soil = document.getElementById('soilTypeSelect')?.value || 'Red';
    const duration = document.getElementById('maxDurationInput')?.value || 365;
    const fertility = document.getElementById('soilQuality')?.value || 8;
    const cropCount = state.crops?.length || 0;
    const district = state.districts?.find(d => d.id == state.currentDistrict)?.name || 'Not selected';

    renderModal(`
        <div class="p-6 sm:p-10 animate-slide-up space-y-6">
            <!-- Header -->
            <div class="flex items-center gap-4 mb-2">
                <div class="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">⚡</div>
                <div>
                    <h2 class="text-2xl sm:text-3xl font-black text-slate-900">SmartFarm AI Engine</h2>
                    <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest">LP Simplex · Markov · Jacobian — All Systems Active</p>
                </div>
            </div>

            <!-- Status Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                    <p class="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Crops Analyzed</p>
                    <p class="text-2xl font-black text-emerald-900">${cropCount}</p>
                </div>
                <div class="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Soil Type</p>
                    <p class="text-lg font-black text-slate-900">${soil}</p>
                </div>
                <div class="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                    <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Timeline</p>
                    <p class="text-lg font-black text-blue-900">${duration}d</p>
                </div>
                <div class="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                    <p class="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Fertility</p>
                    <p class="text-lg font-black text-amber-900">${fertility}/10</p>
                </div>
            </div>

            <!-- District -->
            <div class="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <span class="text-xl">📍</span>
                <div>
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active District</p>
                    <p class="font-black text-slate-900">${district}</p>
                </div>
            </div>

            <!-- Engine Modules -->
            <div class="space-y-3">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Mathematical Modules — Click Formula to Expand</p>
                <div class="grid grid-cols-1 gap-3">

                    <!-- LP Optimizer -->
                    <div class="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div class="p-5 flex items-start justify-between gap-4">
                            <div class="flex items-start gap-3">
                                <span class="w-2.5 h-2.5 mt-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                                <div>
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Module 1 — Land Allocation</p>
                                    <p class="font-black text-slate-900">LP Optimizer (Simplex / Fractional Knapsack)</p>
                                    <p class="text-[10px] text-slate-400 mt-0.5">Maximizes net profit across multiple crops under resource constraints</p>
                                </div>
                            </div>
                            <button onclick="toggleFormula('lp-formula')" class="shrink-0 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">𝑓(x) Formula</button>
                        </div>
                        <div id="lp-formula" class="hidden bg-slate-950 text-emerald-300 p-5 text-[11px] font-mono leading-relaxed border-t border-slate-100">
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-3 tracking-widest">Objective Function</p>
                            <p class="text-emerald-400 font-black text-sm mb-3">Maximize: P = Σ (profit_i × acres_i)</p>
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-2 tracking-widest mt-4">Subject To Constraints</p>
                            <div class="space-y-1.5 text-slate-300">
                                <p>① <span class="text-white">Σ acres_i ≤ Total Acres</span>  <span class="text-slate-500">— Land limit</span></p>
                                <p>② <span class="text-white">Σ (cost_i × acres_i) ≤ Budget</span>  <span class="text-slate-500">— Financial limit</span></p>
                                <p>③ <span class="text-white">Σ (water_i × acres_i) ≤ Max Water</span>  <span class="text-slate-500">— Irrigation limit</span></p>
                                <p>④ <span class="text-white">acres_i ≤ 0.6 × Total Acres</span>  <span class="text-slate-500">— Diversification rule</span></p>
                            </div>
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-2 tracking-widest mt-4">Greedy Sort Key</p>
                            <p class="text-indigo-300">ratio_i = profit_i / cost_i  → Sort descending → Allocate greedily</p>
                        </div>
                    </div>

                    <!-- Markov Chain -->
                    <div class="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div class="p-5 flex items-start justify-between gap-4">
                            <div class="flex items-start gap-3">
                                <span class="w-2.5 h-2.5 mt-1.5 bg-indigo-500 rounded-full animate-pulse shrink-0"></span>
                                <div>
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Module 2 — Season Prediction</p>
                                    <p class="font-black text-slate-900">Markov Chain Weather Forecaster</p>
                                    <p class="text-[10px] text-slate-400 mt-0.5">Predicts next agricultural season using historical transition probabilities</p>
                                </div>
                            </div>
                            <button onclick="toggleFormula('markov-formula')" class="shrink-0 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">𝑓(x) Formula</button>
                        </div>
                        <div id="markov-formula" class="hidden bg-slate-950 text-indigo-300 p-5 text-[11px] font-mono leading-relaxed border-t border-slate-100">
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-3 tracking-widest">State Space (Tamil Nadu)</p>
                            <p class="text-white font-black text-xs mb-3">S = { Kharif, Rabi, Summer, Pre-Monsoon }</p>
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-2 tracking-widest mt-4">4×4 Transition Matrix (P)</p>
                            <div class="bg-slate-900 rounded-xl p-3 text-[10px] overflow-x-auto mb-3">
                                <p class="text-slate-500 mb-1">From → To        Kharif  Rabi   Summer  PreMon</p>
                                <p class="text-indigo-200">Kharif      →    0.00    0.72   0.28    0.00</p>
                                <p class="text-indigo-200">Rabi        →    0.00    0.00   0.68    0.32</p>
                                <p class="text-indigo-200">Summer      →    0.35    0.00   0.00    0.65</p>
                                <p class="text-indigo-200">Pre-Monsoon →    0.80    0.00   0.20    0.00</p>
                            </div>
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-2 tracking-widest">N-Step Prediction</p>
                            <p class="text-white">π(n) = π(0) × P<sup>n</sup></p>
                            <p class="text-slate-400 text-[10px] mt-1">Where π(0) = current state vector, n = forecast horizon (steps)</p>
                        </div>
                    </div>

                    <!-- Jacobian ROI -->
                    <div class="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div class="p-5 flex items-start justify-between gap-4">
                            <div class="flex items-start gap-3">
                                <span class="w-2.5 h-2.5 mt-1.5 bg-amber-500 rounded-full animate-pulse shrink-0"></span>
                                <div>
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Module 3 — Resource Sensitivity</p>
                                    <p class="font-black text-slate-900">Jacobian Gradient Engine (∇P)</p>
                                    <p class="text-[10px] text-slate-400 mt-0.5">Finds the dominant bottleneck resource limiting maximum profit</p>
                                </div>
                            </div>
                            <button onclick="toggleFormula('jacobian-formula')" class="shrink-0 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all">𝑓(x) Formula</button>
                        </div>
                        <div id="jacobian-formula" class="hidden bg-slate-950 text-amber-300 p-5 text-[11px] font-mono leading-relaxed border-t border-slate-100">
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-3 tracking-widest">Partial Derivatives (Finite Difference Method)</p>
                            <div class="space-y-3">
                                <div class="bg-slate-900 rounded-xl p-3">
                                    <p class="text-amber-400 font-black text-xs">∂P/∂B  =  [P(1.1·B, W) − P(B, W)] / (0.1 × B)</p>
                                    <p class="text-slate-400 text-[10px] mt-1">→ Marginal profit gain per ₹1 increase in Budget</p>
                                </div>
                                <div class="bg-slate-900 rounded-xl p-3">
                                    <p class="text-blue-400 font-black text-xs">∂P/∂W  =  [P(B, 1.1·W) − P(B, W)] / (0.1 × W)</p>
                                    <p class="text-slate-400 text-[10px] mt-1">→ Marginal profit gain per 1 m³ increase in Water</p>
                                </div>
                                <div class="bg-slate-900 rounded-xl p-3">
                                    <p class="text-emerald-400 font-black text-xs">Bottleneck = argmax { ∂P/∂B,  ∂P/∂W }</p>
                                    <p class="text-slate-400 text-[10px] mt-1">→ Whichever gradient is larger = limiting factor to invest in</p>
                                </div>
                            </div>
                            <p class="text-slate-400 text-[9px] uppercase font-black mb-1 tracking-widest mt-4">Perturbation Size</p>
                            <p class="text-white">δ = 10%  (±1 standard deviation of resource range)</p>
                        </div>
                    </div>

                </div>
            </div>

            <!-- CTA -->
            <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button onclick="closePlan(); setTimeout(showMarkovForecast, 100)" class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all">🔮 Season Forecast</button>
                <button onclick="closePlan(); setTimeout(showSensitivityAnalysis, 100)" class="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all">⚖️ ROI Analysis</button>
            </div>
        </div>
    `);
};

window.toggleFormula = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden');
};


window.showLPModal = () => {
    renderModal(`<div class="p-10 text-center"><div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">📉</div><h2 class="text-3xl font-black">LP Optimizer</h2><p class="mt-4 text-slate-500">Calculating your optimal crop matrix...</p></div>`);
};

window.closePlan = () => {
    document.getElementById('printSection')?.classList.add('hidden');
    document.body.style.overflow = 'auto';
};

function renderModal(html) {
    const mc = document.getElementById('modalContent');
    const ps = document.getElementById('printSection');
    if (mc && ps) {
        mc.innerHTML = html;
        ps.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

window.showSubsidyDetails = async () => {
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const isTa = getLang() === 'ta';
    const schemes = await API.fetchSubsidies();
    if (!schemes || schemes.length === 0) {
        renderModal(`<div class="py-20 text-center"><p class="text-slate-400">${isTa ? 'தகவல் கிடைக்கவில்லை.' : 'No subsidy data available.'}</p></div>`);
        return;
    }
    const categoryColors = {
        'Direct Benefit': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Crop Insurance':  'bg-blue-50 text-blue-700 border-blue-200',
        'Micro-Irrigation':'bg-cyan-50 text-cyan-700 border-cyan-200',
        'Soil Health':     'bg-amber-50 text-amber-700 border-amber-200',
        'Credit / Loan':   'bg-violet-50 text-violet-700 border-violet-200',
        'Utility Subsidy': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        'Input Subsidy':   'bg-orange-50 text-orange-700 border-orange-200',
        'Organic Farming': 'bg-lime-50 text-lime-700 border-lime-200',
        'Farm Machinery':  'bg-slate-100 text-slate-700 border-slate-200',
        'Solar / Renewable': 'bg-rose-50 text-rose-700 border-rose-200',
    };
    renderModal(`
        <div class="p-5 sm:p-8 animate-slide-up space-y-6">
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">🏛️</div>
                <div>
                    <h2 class="text-2xl sm:text-3xl font-black text-slate-900">
                        ${isTa ? 'அரசு மானியத் திட்டங்கள்' : 'Government Subsidy Portal'}
                    </h2>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        ${isTa ? `தமிழ்நாடு & மத்திய அரசு — ${schemes.length} செயலில் உள்ள திட்டங்கள்` : `Tamil Nadu & Central Govt — ${schemes.length} Active Schemes`}
                    </p>
                </div>
            </div>
            <div class="space-y-4">
                ${schemes.map(s => {
                    const badgeClass = categoryColors[s.category] || 'bg-slate-50 text-slate-600 border-slate-200';
                    const schemeName = isTa ? s.name_ta : s.name;
                    return `
                    <div class="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                        <div class="p-5 sm:p-6">
                            <div class="flex items-start gap-3 mb-4">
                                <span class="text-2xl shrink-0">${s.icon || '📋'}</span>
                                <div>
                                    <span class="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border rounded-lg ${badgeClass}">${s.category}</span>
                                    <h3 class="font-black text-slate-900 text-base mt-1 leading-tight">${schemeName}</h3>
                                    <p class="text-[10px] text-slate-400 font-medium mt-0.5">${isTa ? s.name : s.name_ta} · ${s.ministry}</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                    <p class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">💰 ${isTa ? 'பலன்' : 'Benefit'}</p>
                                    <p class="text-xs font-bold text-emerald-900 leading-snug">${isTa && s.benefit_ta ? s.benefit_ta : s.benefit}</p>
                                </div>
                                <div class="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <p class="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">✅ ${isTa ? 'தகுதி' : 'Eligibility'}</p>
                                    <p class="text-xs font-bold text-blue-900 leading-snug">${isTa && s.eligibility_ta ? s.eligibility_ta : s.eligibility}</p>
                                </div>
                                <div class="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                    <p class="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">📄 ${isTa ? 'தேவையான ஆவணங்கள்' : 'Documents Needed'}</p>
                                    <p class="text-xs font-bold text-amber-900 leading-snug">${isTa && s.documents_ta ? s.documents_ta : s.documents}</p>
                                </div>
                            </div>
                            <div class="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">📍 ${isTa ? 'விண்ணப்பிக்கும் இடம்' : 'Where to Apply'}</p>
                                    <p class="text-xs font-bold text-slate-800">${isTa && s.apply_office_ta ? s.apply_office_ta : s.apply_office}</p>
                                    <p class="text-[10px] text-slate-500 mt-0.5">${isTa && s.how_to_apply_ta ? s.how_to_apply_ta : s.how_to_apply}</p>
                                </div>
                                <a href="${s.apply_url}" target="_blank" rel="noopener"
                                   class="shrink-0 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all text-center">
                                    ${isTa ? 'இணையதளத்தில் விண்ணப்பிக்க →' : 'Apply Online →'}
                                </a>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <p class="text-center text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                ${isTa ? 'அரசு போர்டல்களிலிருந்து பெறப்பட்ட தகவல். விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ மூலத்தை சரிபார்க்கவும்.' : 'Data sourced from official GoI & TN Government portals. Always verify at source before applying.'}
            </p>
        </div>
    `);
};

window.showSoilTestingDetails = async () => {
    renderModal(`<div class="py-20 flex justify-center"><div class="loader"></div></div>`);
    const isTa = getLang() === 'ta';
    const labs = await API.fetchSoilLabs(state.currentDistrict);
    const districtName = state.districts?.find(d => d.id == state.currentDistrict)?.name || 'Your District';
    const districtNameTa = state.districts?.find(d => d.id == state.currentDistrict)?.name_ta || districtName;

    if (!labs || labs.length === 0) {
        renderModal(`<div class="py-20 text-center"><p class="text-slate-400">${isTa ? 'இந்த மாவட்டத்தில் ஆய்வக தகவல் இல்லை.' : 'No soil labs found for this district.'}</p></div>`);
        return;
    }

    const typeBadge = {
        'Government':             'bg-emerald-50 text-emerald-700 border-emerald-200',
        'KVK / ICAR':             'bg-blue-50 text-blue-700 border-blue-200',
        'University Lab':         'bg-indigo-50 text-indigo-700 border-indigo-200',
        'Co-operative':           'bg-amber-50 text-amber-700 border-amber-200',
        'Private (NABL Accredited)': 'bg-rose-50 text-rose-700 border-rose-200',
    };

    renderModal(`
        <div class="p-5 sm:p-8 animate-slide-up space-y-6">
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">🧪</div>
                <div>
                    <h2 class="text-2xl sm:text-3xl font-black text-slate-900">
                        ${isTa ? 'மண் பரிசோதனை மையங்கள்' : 'Soil Testing Hubs'}
                    </h2>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        ${isTa ? `${districtNameTa} மாவட்டம் — ${labs.length} ஆய்வகங்கள்` : `${districtName} District — ${labs.length} Labs Found`}
                    </p>
                </div>
            </div>

            <div class="space-y-4">
                ${labs.map(lab => {
                    const badge = typeBadge[lab.type] || 'bg-slate-100 text-slate-600 border-slate-200';
                    const labName = isTa ? lab.lab_name_ta : lab.lab_name;
                    const labType = isTa ? lab.type_ta : lab.type;
                    const services = isTa ? lab.services_ta : lab.services;
                    const cost = isTa ? lab.test_cost_ta : lab.test_cost;
                    return `
                    <div class="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                        <div class="p-5 sm:p-6 space-y-4">
                            <!-- Lab Header -->
                            <div class="flex items-start gap-3">
                                <span class="text-2xl shrink-0">${lab.icon || '🔬'}</span>
                                <div class="min-w-0">
                                    <span class="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border rounded-lg ${badge}">${labType}</span>
                                    <h3 class="font-black text-slate-900 mt-1 leading-tight text-sm sm:text-base">${labName}</h3>
                                    <p class="text-[10px] text-slate-500 mt-0.5">📍 ${lab.address}</p>
                                </div>
                            </div>

                            <!-- Info Grid -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div class="bg-slate-50 rounded-xl p-3">
                                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">📞 ${isTa ? 'தொலைபேசி' : 'Phone'}</p>
                                    <p class="text-xs font-bold text-slate-800">${lab.phone}</p>
                                </div>
                                <div class="bg-emerald-50 rounded-xl p-3">
                                    <p class="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">💰 ${isTa ? 'கட்டணம்' : 'Test Cost'}</p>
                                    <p class="text-xs font-bold text-emerald-900">${cost}</p>
                                </div>
                                <div class="bg-blue-50 rounded-xl p-3">
                                    <p class="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">⏱️ ${isTa ? 'முடிவு காலம்' : 'Turnaround'}</p>
                                    <p class="text-xs font-bold text-blue-900">${lab.turnaround}</p>
                                </div>
                                <div class="bg-amber-50 rounded-xl p-3">
                                    <p class="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">🕐 ${isTa ? 'நேரம்' : 'Timings'}</p>
                                    <p class="text-xs font-bold text-amber-900">${lab.timings}</p>
                                </div>
                            </div>

                            <!-- Services -->
                            <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                <p class="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">🔍 ${isTa ? 'சேவைகள்' : 'Services Offered'}</p>
                                <p class="text-xs font-bold text-indigo-900">${services}</p>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <div class="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                <span class="text-xl shrink-0">💡</span>
                <p class="text-xs font-bold text-amber-900">
                    ${isTa
                        ? 'மண் மாதிரி எடுக்க: 6 இஞ்சு ஆழத்தில் 5 இடங்களில் மாதிரி சேகரிக்கவும். 500கி மாதிரியை சுத்தமான பையில் ஆய்வகத்திற்கு கொண்டு செல்லவும்.'
                        : 'Soil Sampling Tip: Collect samples from 5 spots at 6-inch depth. Mix, take 500g in a clean bag and submit to the lab with your land details.'}
                </p>
            </div>
        </div>
    `);
};


bootstrap();
import { predict as mlPredict } from './ml-api.js';

window.runPrecisionPredict = async () => {
    const payload = {
        soil_n: parseInt(document.getElementById('soil_n')?.value) || 0,
        soil_p: parseInt(document.getElementById('soil_p')?.value) || 0,
        soil_k: parseInt(document.getElementById('soil_k')?.value) || 0,
        crop_id: document.getElementById('cropTargetSelect')?.value || 1,
        city: state.districts.find(d => d.id == state.currentDistrict)?.name || 'Madurai'
    };

    renderModal(`<div class="py-20 flex flex-col items-center gap-4"><div class="loader"></div><p class="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Computing Precision Matrix...</p></div>`);

    try {
        const res = await mlPredict(payload);
        if (res.status === 'success') {
            renderPrecisionReport(res.data);
        }
    } catch (err) {
        renderModal(`<div class="p-10 text-center"><p class="text-rose-500 font-bold">Analysis Failed: ${err.message}</p></div>`);
    }
};

function renderPrecisionReport(d) {
    const isHigh = d.risk === 'High';
    const score = d.suitability_score;
    
    renderModal(`
        <div class="p-6 sm:p-12 animate-slide-up space-y-10 max-w-5xl mx-auto">
            <!-- Header Card -->
            <div class="bg-slate-900 text-white rounded-[3rem] p-8 sm:p-12 relative overflow-hidden shadow-2xl">
                <div class="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <span class="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">B2B Scientific Report</span>
                        <h2 class="text-3xl sm:text-5xl font-black mt-4 tracking-tighter">Precision Analysis: <span class="text-emerald-400">${d.crop}</span></h2>
                        <p class="text-slate-400 font-medium mt-2">Generated for ${d.city} Region • ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="flex flex-col items-center gap-2">
                        <div class="w-32 h-32 rounded-full border-8 border-slate-800 flex items-center justify-center relative">
                            <svg class="w-full h-full absolute inset-0 -rotate-90">
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#1e293b" stroke-width="8"/>
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#10b981" stroke-width="8" stroke-dasharray="351.8" stroke-dashoffset="${351.8 - (351.8 * score / 100)}" stroke-linecap="round"/>
                            </svg>
                            <span class="text-3xl font-black text-white">${score}%</span>
                        </div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Suitability Score</p>
                    </div>
                </div>
            </div>

            <!-- Analytics Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- NPK Score -->
                <div class="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Soil Health Breakdown</h4>
                    <div class="space-y-4">
                        ${Object.entries(d.soil_analytics).filter(([k])=>k!=='soil_score').map(([k, v]) => `
                            <div>
                                <div class="flex justify-between text-[10px] font-bold mb-1">
                                    <span class="uppercase">${k.replace('_score','')} Balance</span>
                                    <span>${v}%</span>
                                </div>
                                <div class="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div class="h-full bg-emerald-500 rounded-full" style="width: ${v}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Fertilizer Plan -->
                <div class="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10"><svg class="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>
                    <h4 class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-6">Fertilizer Deficit (RECOM)</h4>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="text-center">
                            <p class="text-xl font-black text-emerald-900">${d.fertilizer_rec.nitrogen}</p>
                            <p class="text-[8px] font-bold text-emerald-600 uppercase">N</p>
                        </div>
                        <div class="text-center">
                            <p class="text-xl font-black text-emerald-900">${d.fertilizer_rec.phosphorus}</p>
                            <p class="text-[8px] font-bold text-emerald-600 uppercase">P</p>
                        </div>
                        <div class="text-center">
                            <p class="text-xl font-black text-emerald-900">${d.fertilizer_rec.potassium}</p>
                            <p class="text-[8px] font-bold text-emerald-600 uppercase">K</p>
                        </div>
                    </div>
                    <p class="text-[9px] text-center text-emerald-500 mt-4 font-bold uppercase tracking-widest">All units in ${d.fertilizer_rec.unit}</p>
                </div>

                <!-- Market Pulse -->
                <div class="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] shadow-sm">
                    <h4 class="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Market Pulse</h4>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-xs font-bold text-slate-600">${d.market_pulse.commodity}</span>
                        <span class="text-lg font-black text-indigo-900">₹${d.market_pulse.modal_price.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-white/50 rounded-xl flex items-center justify-between">
                        <span class="text-[9px] font-black text-slate-400 uppercase">Trend</span>
                        <span class="px-2 py-1 ${d.market_pulse.trend==='Up'?'bg-emerald-100 text-emerald-600':'bg-rose-100 text-rose-600'} rounded-lg text-[9px] font-black">${d.market_pulse.trend}</span>
                    </div>
                </div>
            </div>

            <!-- AI Insight Section -->
            <div class="bg-slate-50 border border-slate-200 p-8 rounded-[3rem] flex flex-col md:flex-row gap-8 items-center">
                <div class="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-4xl shadow-emerald-500/10">🤖</div>
                <div class="flex-1">
                    <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                        Agronomy Intelligence Agent
                        <span class="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-lg text-[8px]">${d.risk} Risk</span>
                    </h4>
                    <p class="text-slate-600 font-medium leading-relaxed italic">"${d.recommendation}"</p>
                    <div class="mt-4 flex items-center gap-4">
                         <div class="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-bold text-slate-500">Climate: ${d.climate_alert}</div>
                    </div>
                </div>
                <button onclick="window.downloadPlanPDF()" class="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex-shrink-0">
                    Export Analysis PDF
                </button>
            </div>
        </div>
    `);
}
