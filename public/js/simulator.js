import { t, toggleLang, applyTranslations } from './i18n.js';

// Bind functions to window so they work from HTML inline handlers when script is type="module"
window.toggleAppLang = toggleLang;
window.setInputMode = setInputMode;
window.showInputPage = showInputPage;
window.runSimulation = runSimulation;

let chartInstance = null;
let currentMode = 'monthly';

function setInputMode(mode) {
    currentMode = mode;
    const btnM = document.getElementById('btnMonthlyMode');
    const btnS = document.getElementById('btnSeasonalMode');
    const grpM = document.getElementById('monthlyGroup');
    const grpS = document.getElementById('seasonalGroup');

    if (mode === 'monthly') {
        btnM.className = "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm bg-white text-fuchsia-600 border border-slate-200";
        btnS.className = "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200/50";
        grpM.classList.remove('hidden');
        grpS.classList.add('hidden');
    } else {
        btnS.className = "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm bg-white text-fuchsia-600 border border-slate-200";
        btnM.className = "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200/50";
        grpS.classList.remove('hidden');
        grpM.classList.add('hidden');
    }
}

function showInputPage() {
    document.getElementById('outputPage').classList.add('hidden');
    document.getElementById('inputPage').classList.remove('hidden');
}

function runSimulation() {
    // 1. Gather Inputs
    let income = 0;
    let expenses = 0;

    if (currentMode === 'seasonal') {
        const seasonalIncome = parseFloat(document.getElementById('inputSeasonalIncome').value) || 0;
        const seasonalExpenses = parseFloat(document.getElementById('inputSeasonalExpenses').value) || 0;
        const duration = parseFloat(document.getElementById('inputDuration').value) || 1;
        
        income = seasonalIncome / duration;
        expenses = seasonalExpenses / duration;
    } else {
        income = parseFloat(document.getElementById('inputIncome').value) || 0;
        expenses = parseFloat(document.getElementById('inputExpenses').value) || 0;
    }

    const steps = parseInt(document.getElementById('inputSteps').value) || 0;
    const sleep = parseFloat(document.getElementById('inputSleep').value) || 0;
    const food = document.getElementById('inputFood').value;

    // 2. Logic Implementation
    const savings = income - expenses;
    const improved_savings = savings * 1.2;

    // Financial Score: Higher savings → higher score
    let saveRatio = income > 0 ? (savings / income) : 0;
    let finScoreRaw = saveRatio * 200; // 50% ratio = 100 score
    if (finScoreRaw < 0) finScoreRaw = 0;
    if (finScoreRaw > 100) finScoreRaw = 100;
    const financialScore = Math.round(finScoreRaw);

    // Health Risk (Advanced Farmer-Specific Logic)
    let healthScore = 0;
    
    // Assign food scores
    if (food === "Healthy") healthScore += 30;
    else if (food === "Average") healthScore += 15;
    // Poor = +0
    
    // Assign steps scores (max 40)
    if (steps > 10000) healthScore += 40;
    else if (steps > 5000) healthScore += 30;
    else if (steps > 3000) healthScore += 15;
    
    // Assign sleep scores (max 30)
    if (sleep >= 7 && sleep <= 9) healthScore += 30;
    else if (sleep >= 6) healthScore += 15;
    
    let healthRisk = "Medium";
    
    // Farmer-specific overriding logic
    if (food === "Healthy" && steps > 5000) {
        // Reduce health risk significantly
        healthRisk = "Low";
        healthScore = Math.min(100, healthScore + 20);
    } else if (food === "Poor" && sleep < 6) {
        // Increase disease risk sharply
        healthRisk = "High";
        healthScore = Math.max(0, healthScore - 30);
    } else if (food === "Average") {
        // Moderate health stability
        healthRisk = "Medium";
    } else {
        // Fallback for edge cases
        if (healthScore >= 75) healthRisk = "Low";
        else if (healthScore >= 45) healthRisk = "Medium";
        else healthRisk = "High";
    }

    // Loan Probability
    const loanRejectionProb = Math.max(0, 100 - financialScore);
    const loanApprovalProb = Math.min(100, Math.round(financialScore * 1.2)); // Improved lifestyle -> better approval

    // Smart Score
    const smartScore = Math.round((financialScore * 0.6) + (healthScore * 0.4));

    // Calculate 6 months trajectory
    let currentSavings6m = 0;
    let improvedSavings6m = 0;
    const months = ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'];
    const currentData = [];
    const improvedData = [];

    for (let i = 1; i <= 6; i++) {
        currentSavings6m += savings;
        improvedSavings6m += improved_savings;
        currentData.push(currentSavings6m);
        improvedData.push(improvedSavings6m);
    }

    // Update DOM
    
    // Animate numbers
    animateValue('smartScore', 0, smartScore, 1000);
    animateValue('financialScore', 0, financialScore, 1000);
    
    const translatedHealthRisk = healthRisk === 'High' ? t('sim_high') : (healthRisk === 'Medium' ? t('sim_medium') : t('sim_low'));

    const hrElem = document.getElementById('healthRisk');
    hrElem.innerText = translatedHealthRisk;
    hrElem.className = 'text-3xl font-black uppercase ' + 
        (healthRisk === 'High' ? 'text-rose-600' : (healthRisk === 'Medium' ? 'text-amber-500' : 'text-emerald-500'));

    document.getElementById('currentSavings').innerText = "₹" + currentSavings6m.toLocaleString();
    document.getElementById('currentLoanRejection').innerText = loanRejectionProb + "%";
    
    const currHRElem = document.getElementById('currentHealthRiskLabel');
    currHRElem.innerText = translatedHealthRisk;
    currHRElem.className = 'font-black text-lg ' + 
        (healthRisk === 'High' ? 'text-rose-600' : (healthRisk === 'Medium' ? 'text-amber-500' : 'text-emerald-600'));

    document.getElementById('improvedSavings').innerText = "₹" + Math.round(improvedSavings6m).toLocaleString();
    document.getElementById('improvedLoanApproval').innerText = Math.min(100, loanApprovalProb + 20) + "%";

    // Insight message logic
    const insightMsg = document.getElementById('insightMessage');
    if (healthRisk === 'High' || financialScore < 40) {
        insightMsg.className = 'w-full md:w-auto px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 flex items-center gap-2';
        insightMsg.innerHTML = `<span>${t('sim_msg_high')}</span>`;
    } else if (healthRisk === 'Medium' || financialScore < 70) {
        insightMsg.className = 'w-full md:w-auto px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-2';
        insightMsg.innerHTML = `<span>${t('sim_msg_med')}</span>`;
    } else {
        insightMsg.className = 'w-full md:w-auto px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2';
        insightMsg.innerHTML = `<span>${t('sim_msg_low')}</span>`;
    }

    // Update Chart
    const ctx = document.getElementById('predictionChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Smooth appearance using chart.js animation
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: t('sim_chart_curr'),
                    data: currentData,
                    borderColor: '#f43f5e', // rose-500
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#f43f5e',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: t('sim_chart_impr'),
                    data: improvedData,
                    borderColor: '#10b981', // emerald-500
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            weight: 'bold',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
                    bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.03)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
                        color: '#64748b'
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
                        color: '#64748b'
                    }
                }
            }
        }
    });

    // Toggle Pages
    document.getElementById('inputPage').classList.add('hidden');
    document.getElementById('outputPage').classList.remove('hidden');
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Number animation helper function
function animateValue(id, start, end, duration) {
    if (start === end) return;
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing function: easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = Math.floor(ease * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    
    // Subscribe to langchange event so strings dynamically refresh if chart is visible
    document.addEventListener('langchange', () => {
        // Only run simulation again if output page is visible, to refresh chart labels
        if (!document.getElementById('outputPage').classList.contains('hidden')) {
            runSimulation();
        }
    });

    const inputs = document.querySelectorAll('#inputPage input, #inputPage select');
    inputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runSimulation();
            }
        });
    });
});
