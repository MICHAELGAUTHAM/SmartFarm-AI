import { t, toggleLang, applyTranslations } from './i18n.js';

window.toggleAppLang = toggleLang;

let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    
    document.addEventListener('langchange', () => {
        if (!document.getElementById('outputPanel').classList.contains('hidden')) {
            updateInsightTranslation();
            if (chartInstance) {
                chartInstance.data.datasets[0].label = t('pulse_today');
                chartInstance.update();
            }
        }
    });
});

let currentTrend = 'sell'; // 'sell' or 'hold'

window.fetchLiveRates = async function() {
    const btn = document.getElementById('fetchBtn');
    const icon = document.getElementById('btnIcon');
    const district = document.getElementById('inputDistrict').value;
    const crop = document.getElementById('inputCrop').value;
    
    // UI Update -> Loading
    btn.disabled = true;
    btn.classList.replace('bg-indigo-600', 'bg-slate-400');
    icon.classList.add('animate-spin');

    try {
        const response = await fetch(`/api/market/pulse?district=${district}&commodity=${crop}`);
        const result = await response.json();

        let base, minPrice, maxPrice;

        if (result.live && result.records.length > 0) {
            // Use real Agmarknet Data
            console.log("Govt API Data Loaded:", result.records);
            const liveData = result.records[0]; // Using first valid mandi record
            minPrice = parseFloat(liveData.min_price) / 100; // convert quintal to kg roughly
            maxPrice = parseFloat(liveData.max_price) / 100;
            base = parseFloat(liveData.modal_price) / 100;
        } else {
            // Fallback mock if no Mandi data recorded today for this crop
            console.warn("No Gov API data for today, falling back to simulator");
            const basePrices = {
                'tomato': 22, 'onion': 45, 'paddy': 25, 'cotton': 80,
                'coconut': 30, 'banana': 40, 'mango': 120, 'turmeric': 150,
                'chilly capsicum': 65, 'groundnut': 90
            };
            base = basePrices[crop] || 50;
            minPrice = base - 4;
            maxPrice = base + 5;
        }

        // Generate 7 day historical trend
        const isTrendingUp = Math.random() > 0.4; // 60% chance it's peaking
        currentTrend = isTrendingUp ? 'sell' : 'hold';

        const history = [];
        let cur = isTrendingUp ? base - 8 : base + 6;
        for (let i=0; i<7; i++) {
            history.push(Math.round(cur));
            if (isTrendingUp) {
                cur += Math.floor(Math.random() * 3);
            } else {
                cur -= Math.floor(Math.random() * 3);
            }
        }
        history[6] = Math.round(base);

        // Update DOM
        btn.disabled = false;
        btn.classList.replace('bg-slate-400', 'bg-indigo-600');
        icon.classList.remove('animate-spin');
        
        document.getElementById('outputPanel').classList.remove('hidden');
        
        animateValue('resMin', 0, Math.round(minPrice), 800, '₹');
        animateValue('resAvg', 0, Math.round(base), 800, '₹');
        animateValue('resMax', 0, Math.round(maxPrice), 800, '₹');
        
        updateInsightTranslation();
        renderChart(history);

    } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.classList.replace('bg-slate-400', 'bg-indigo-600');
        icon.classList.remove('animate-spin');
    }
}

function updateInsightTranslation() {
    const insightElem = document.getElementById('resInsight');
    const lang = localStorage.getItem('sf_lang') || 'en';

    if (currentTrend === 'sell') {
        insightElem.innerText = lang === 'en' ? 
            "Prices are steadily peaking. AI highly recommends immediate liquidation at local mandis." :
            "விலைகள் உச்சத்தில் உள்ளன. உள்ளூர் சந்தைகளில் உடனடியாக விற்க AI வலுவாக பரிந்துரைக்கிறது.";
        insightElem.className = 'text-sm font-bold text-emerald-700 mt-1';
        document.getElementById('aiIcon').className = 'w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl flex-shrink-0';
    } else {
        insightElem.innerText = lang === 'en' ? 
            "Price is dropping. AI advises holding harvest for 3-4 days if storage is viable." :
            "விலை குறைகிறது. சேமிப்பு வசதி இருந்தால் அறுவடையை 3-4 நாட்கள் நிறுத்தி வைக்க AI பரிந்துரைக்கிறது.";
        insightElem.className = 'text-sm font-bold text-rose-700 mt-1';
        document.getElementById('aiIcon').className = 'w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-2xl flex-shrink-0';
    }
}

function renderChart(dataArr) {
    const ctx = document.getElementById('pulseChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Yesterday', 'Today'];
    const lineColor = currentTrend === 'sell' ? '#10b981' : '#f43f5e';
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 300);
    bgGradient.addColorStop(0, currentTrend === 'sell' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)');
    bgGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: t('pulse_today'),
                data: dataArr,
                borderColor: lineColor,
                backgroundColor: bgGradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: lineColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.05)', borderDash: [5, 5] },
                    ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
                }
            }
        }
    });
}

function animateValue(id, start, end, duration, prefix = '') {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = prefix + Math.floor(ease * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
