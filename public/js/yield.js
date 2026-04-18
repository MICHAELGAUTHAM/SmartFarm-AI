import { t, toggleLang, applyTranslations } from './i18n.js';

window.toggleAppLang = toggleLang;

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    
    document.addEventListener('langchange', () => {
        if (!document.getElementById('outputPanel').classList.contains('hidden')) {
            // Update translation
            updateRiskTranslation();
        }
    });
});

let currentRiskState = 'moderate'; // ideal, moderate, extreme

window.predictYield = function() {
    const crop = document.getElementById('inputCrop').value;
    const landSize = parseFloat(document.getElementById('inputLand').value) || 1;
    const soilQuality = parseFloat(document.getElementById('inputSoil').value) || 5;
    const weather = document.getElementById('inputWeather').value;
    
    // Base Yield Metrics (per acre in Kg)
    const baseMetrics = {
        'rice': { yield: 2500, price: 23 },
        'tomato': { yield: 8000, price: 15 },
        'cotton': { yield: 900, price: 70 }
    };

    const target = baseMetrics[crop] || baseMetrics['rice'];
    
    // ML Math Logic (Mocked Rule-Based)
    let yieldMultiplier = 1.0;
    
    // Soil logic (1-10) -> 5 is normal (1x)
    yieldMultiplier *= (soilQuality / 5);
    
    // Weather Logic
    if (weather === 'ideal') {
        yieldMultiplier *= 1.2;
        currentRiskState = 'low';
    } else if (weather === 'moderate') {
        yieldMultiplier *= 0.9;
        currentRiskState = 'moderate';
    } else {
        yieldMultiplier *= 0.4;
        currentRiskState = 'high';
    }

    const calculatedYield = Math.round(target.yield * landSize * yieldMultiplier);
    // Base 40% operating cost assumption
    const revenue = calculatedYield * target.price;
    const estimatedProfit = Math.round(revenue * 0.6); 

    // Update DOM
    document.getElementById('outputPanel').classList.remove('hidden');
    
    animateValue('resYield', 0, calculatedYield, 800);
    animateValue('resProfit', 0, estimatedProfit, 800, '₹ ');
    
    updateRiskTranslation();
}

function updateRiskTranslation() {
    const riskElem = document.getElementById('resRisk');
    const descElem = document.getElementById('resRiskDesc');
    const iconElem = document.getElementById('riskIcon');
    const lang = localStorage.getItem('sf_lang') || 'en';

    if (currentRiskState === 'low') {
        riskElem.innerText = t('sim_low') + (lang === 'en' ? ' Risk' : ' ஆபத்து');
        riskElem.className = 'text-2xl font-black text-emerald-500 uppercase';
        iconElem.className = 'w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl flex-shrink-0';
        iconElem.innerText = '🛡️';
        descElem.innerText = lang === 'en' ? 'Optimal conditions detected. High probability of maximum yield.' : 'சிறந்த நிலை. அதிக மகசூலுக்கான வாய்ப்பு.';
    } else if (currentRiskState === 'moderate') {
        riskElem.innerText = t('sim_medium') + (lang === 'en' ? ' Risk' : ' ஆபத்து');
        riskElem.className = 'text-2xl font-black text-amber-500 uppercase';
        iconElem.className = 'w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl flex-shrink-0';
        iconElem.innerText = '⚖️';
        descElem.innerText = lang === 'en' ? 'Due to moderate weather, expect slight variations in final yield.' : 'மிதமான வானிலையால், மகசூலில் சில மாற்றங்கள் ஏற்படலாம்.';
    } else {
        riskElem.innerText = t('sim_high') + (lang === 'en' ? ' Risk' : ' ஆபத்து');
        riskElem.className = 'text-2xl font-black text-rose-500 uppercase';
        iconElem.className = 'w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-2xl flex-shrink-0';
        iconElem.innerText = '⚠️';
        descElem.innerText = lang === 'en' ? 'Extreme weather predicted! Apply mitigations immediately.' : 'கடுமையான வானிலை! உடனடியாக முன்னெச்சரிக்கை நடவடிக்கைகளை எடுக்கவும்.';
    }
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
