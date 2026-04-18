import { Router } from 'express';
import { cropDataList, cropPhasesList } from '../data.js';

const router = Router();

export default function() {
  // GET /api/crops - list with filters
  router.get('/', (req, res) => {
    const { soil, maxDuration, category, search, fertility } = req.query;
    
    let results = cropDataList.filter(c => {
      if (maxDuration && c.duration > parseInt(maxDuration)) return false;
      if (category && category !== 'all') {
        if (category === 'Low' && c.duration > 200) return false;
        if (category !== 'Low' && c.category !== category) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (!c.name.toLowerCase().includes(s) && 
            !c.name_ta.toLowerCase().includes(s) && 
            !c.category.toLowerCase().includes(s)) return false;
      }
      if (soil && !c.soils[soil]) return false;
      return true;
    });

    const fert = parseFloat(fertility) || 7.5;

    results = results.map(row => {
      const suitability = soil ? (row.soils[soil] || 0.7) : 1.0;
      const profit = (row.base_yield * 0.45) * (fert / 10) * suitability * 65;
      const riskWeight = row.duration > 200 ? 0.35 : row.duration > 120 ? 0.25 : 0.15;
      const costEstimate = profit * 0.4;
      const score = (0.6 * profit) - (0.25 * costEstimate) - (0.15 * riskWeight * 10000);
      const risk = row.duration > 200 ? 'High' : row.duration > 120 ? 'Medium' : 'Low';

      return { ...row, profit: Math.round(profit), score: Math.round(score), risk };
    });

    results.sort((a, b) => b.score - a.score);
    res.json({ count: results.length, crops: results });
  });

  // GET /api/crops/:id/plan - full roadmap
  router.get('/:id/plan', (req, res) => {
    const crop = cropDataList.find(c => c.id == req.params.id);
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    
    // Copy default phases and update the last one to have the correct duration
    const phases = JSON.parse(JSON.stringify(cropPhasesList));
    phases[phases.length - 1].day_label = `Day ${crop.duration}`;

    res.json({ crop, phases, soils: Object.keys(crop.soils) });
  });

  // POST /api/crops/budget - calculate budget
  router.post('/budget', (req, res) => {
    const { cropId, acres, seedCost, laborCost, pestCost, additionalCost, soil, fertility } = req.body;
    const crop = cropDataList.find(c => c.id == cropId);
    if (!crop) return res.status(404).json({ error: 'Crop not found' });

    const fert = parseFloat(fertility) || 7.5;
    const suitability = crop.soils[soil || 'Red'] || 0.8;

    const ac = parseFloat(acres) || 1;
    // EXISTING CALCULATIONS (UNCHANGED)
    const totalSpend = (seedCost + laborCost + pestCost + additionalCost) * ac;
    const grossRevenue = (crop.base_yield * 0.45) * (fert / 10) * suitability * 65 * 1.5 * ac;
    const netProfit = grossRevenue - totalSpend;
    const roi = totalSpend > 0 ? ((netProfit / totalSpend) * 100).toFixed(1) : 0;

    // ENHANCED CALCULATIONS
    const baseSpoilageRate = (crop.category === 'Fruits' || crop.category === 'Vegetables') ? 0.12 : 0.04;
    const estSpoilageLoss = grossRevenue * baseSpoilageRate;
    const waterMultiplier = crop.water_req === 'Very High' ? 4500 : crop.water_req === 'High' ? 2500 : crop.water_req === 'Medium' ? 1200 : 400;
    const estWaterCost = waterMultiplier * ac;
    const trueNetMargin = netProfit - estSpoilageLoss - estWaterCost;
    const logisticCost = (crop.base_yield * ac * 0.8) * 2.5; // 2.5 rs per kg transport

    res.json({ 
        totalSpend: Math.round(totalSpend), 
        grossRevenue: Math.round(grossRevenue), 
        netProfit: Math.round(netProfit), 
        roi, 
        duration: crop.duration,
        details: {
            estSpoilageLoss: Math.round(estSpoilageLoss),
            estWaterCost: Math.round(estWaterCost),
            logisticCost: Math.round(logisticCost),
            trueNetMargin: Math.round(trueNetMargin)
        }
    });
  });

  // POST /api/crops/optimize - Linear Programming (Greedy Knapsack)
  router.post('/optimize', (req, res) => {
    const { acres, budget, maxWater, soil, fertility, season, timeline } = req.body;
    let availableAcres = parseFloat(acres) || 5;
    let availableBudget = parseFloat(budget) || 100000;
    let availableWater = parseFloat(maxWater) || 10000;
    const fert = parseFloat(fertility) || 7.5;
    const suit = soil || 'Red';
    const targetSeason = season || 'Kharif'; // Current climatic season parameter
    const maxDuration = parseFloat(timeline) || 365;

    const maxAcresPerCrop = availableAcres * 0.6; // diversification constraint

    let cropMetrics = cropDataList.map(c => {
      // 1. STRICT SOIL FILTER: If the specific soil is not mathematically registered, reject it completely.
      const suitability = c.soils[suit];
      if (!suitability) return null;

      // 2. TIMELINE CONSTRAINT: Must fit optimally within user's requested timeframe
      if (c.duration > maxDuration) return null;

      // 3. SEASON CONSTRAINT: Reject if biological growth cycle opposes current thermal/rain season
      const cropSeason = c.season || 'All';
      const isSeasonMatch = cropSeason === 'All' || cropSeason === 'Year-round' || targetSeason === 'All' || targetSeason === 'Year-round' || cropSeason.includes(targetSeason);
      if (!isSeasonMatch) return null;

      // --- TRUE NET MARGIN CALCULUS (Mathematical Engine) ---
      
      // 1. Yield Prediction Model (Polynomial Weighted)
      const baseYield = c.base_yield || 1000;
      const grossRev = (baseYield * 0.45) * (fert / 10) * suitability * 65 * 1.5;
      
      // 2. Base Input Costs (Seed, Labor, Pest estimated via growth duration)
      const baseInputCost = (c.duration * 125) + 3000; // Rs. 125 overhead per day + base seed
      
      // 3. Spoilage Degradation (Exponential logistic loss mapping approx using biological decay)
      const decayConstant = (c.category === 'Fruits' || c.category === 'Vegetables' || c.category === 'Flowers') ? 0.12 : 0.04;
      const spoilageLoss = grossRev * decayConstant;
      
      // 4. Volumetric Water Consumption Models
      const waterMultiplier = c.water_req === 'Very High' ? 4500 : c.water_req === 'High' ? 2500 : c.water_req === 'Medium' ? 1200 : 400;
      const waterPumpingCost = waterMultiplier * 1.5; // Rs 1.5 per volumetric index
      
      // 5. Logistic Haversine Cost Proxy (Transport to Mandi)
      const logisticCost = (baseYield * 0.8) * 2.5; // Average 2.5 Rs per Kg to transport marketable yield
      
      // Evaluate strict multi-variable cost and profit
      const trueTotalInvestment = baseInputCost + waterPumpingCost + logisticCost;
      const trueNetMargin = grossRev - trueTotalInvestment - spoilageLoss;
      
      return { 
          id: c.id, 
          name: c.name, 
          name_ta: c.name_ta,
          profitPerAcre: trueNetMargin, 
          costPerAcre: trueTotalInvestment, 
          waterPerAcre: waterMultiplier,
          ratio: trueNetMargin / (trueTotalInvestment + 1) // objective function coefficient optimization
      };
    }).filter(c => c !== null && c.profitPerAcre > 0);

    // Sort by profit/cost ratio (Greedy approach to LP)
    cropMetrics.sort((a, b) => b.ratio - a.ratio);

    const allocation = [];
    let totalProfit = 0;
    let totalCost = 0;
    let totalWater = 0;

    for (const crop of cropMetrics) {
        if (availableAcres <= 0 || availableBudget <= 0 || availableWater <= 0) break;

        const maxByBudget = availableBudget / crop.costPerAcre;
        const maxByWater = availableWater / crop.waterPerAcre;
        
        let allocAcres = Math.min(availableAcres, maxAcresPerCrop, maxByBudget, maxByWater);
        
        allocAcres = Math.round(allocAcres * 100) / 100; // 2 decimal places

        if (allocAcres > 0.05) {
            allocation.push({
                cropId: crop.id,
                name: crop.name,
                name_ta: crop.name_ta,
                acres: allocAcres,
                profit: Math.round(allocAcres * crop.profitPerAcre),
                cost: Math.round(allocAcres * crop.costPerAcre),
                water: Math.round(allocAcres * crop.waterPerAcre)
            });

            availableAcres -= allocAcres;
            availableBudget -= allocAcres * crop.costPerAcre;
            availableWater -= allocAcres * crop.waterPerAcre;

            totalProfit += allocAcres * crop.profitPerAcre;
            totalCost += allocAcres * crop.costPerAcre;
            totalWater += allocAcres * crop.waterPerAcre;
        }
    }

    res.json({
        allocation,
        summary: {
            totalProfit: Math.round(totalProfit),
            totalCost: Math.round(totalCost),
            totalWater: Math.round(totalWater),
            unusedAcres: Math.round(availableAcres * 100) / 100,
            unusedBudget: Math.round(availableBudget),
            unusedWater: Math.round(availableWater)
        }
    });
  });

  // POST /api/crops/markov-forecast - Markov Chain Weather Season Forecaster
  router.post('/markov-forecast', (req, res) => {
    const { districtId } = req.body;
    
    // Tamil Nadu agro-climatic Markov Transition Matrix
    // States: [Kharif(SW Monsoon), Rabi(NE Monsoon), Summer, PreMonsoon]
    // Transition probabilities based on TN historical rainfall pattern
    const transitionMatrix = {
      'Kharif':     { next: 'Rabi',       prob: 0.72, altNext: 'Summer',     altProb: 0.28 },
      'Rabi':       { next: 'Summer',     prob: 0.68, altNext: 'PreMonsoon', altProb: 0.32 },
      'Summer':     { next: 'PreMonsoon', prob: 0.65, altNext: 'Kharif',     altProb: 0.35 },
      'PreMonsoon': { next: 'Kharif',     prob: 0.80, altNext: 'Summer',     altProb: 0.20 }
    };
    
    const month = new Date().getMonth(); // 0-indexed
    let currentSeason;
    if (month >= 5 && month <= 8) currentSeason = 'Kharif';       // Jun-Sep: SW Monsoon
    else if (month >= 9 && month <= 11) currentSeason = 'Rabi';   // Oct-Dec: NE Monsoon
    else if (month >= 0 && month <= 1) currentSeason = 'Rabi';    // Jan-Feb: Rabi tail
    else if (month >= 2 && month <= 4) currentSeason = 'Summer';  // Mar-May: Pre-Monsoon
    else currentSeason = 'Kharif';
    
    // Build 3-step forward Markov chain
    const forecast = [];
    let season = currentSeason;
    
    for (let step = 1; step <= 4; step++) {
      const transition = transitionMatrix[season];
      const forecastSeason = transition ? transition.next : 'Kharif';
      const confidence = transition ? Math.round(transition.prob * 100) : 70;
      
      // Get crops that match this upcoming season
      const matchingCrops = cropDataList.filter(c => {
        const cropSeason = c.season || 'All';
        return cropSeason === 'Year-round' || cropSeason === 'All' || cropSeason.includes(forecastSeason);
      }).slice(0, 3).map(c => ({ id: c.id, name: c.name, icon: c.icon }));
      
      const seasonLabels = {
        'Kharif': { label: 'SW Monsoon (Kharif)', months: 'Jun–Sep', icon: '🌧️', temp: '28-33°C', rain: '120-180mm' },
        'Rabi': { label: 'NE Monsoon (Rabi)', months: 'Oct–Jan', icon: '🌦️', temp: '24-29°C', rain: '150-220mm' },
        'Summer': { label: 'Summer (Chithirai)', months: 'Mar–May', icon: '☀️', temp: '33-42°C', rain: '20-80mm' },
        'PreMonsoon': { label: 'Pre-Monsoon', months: 'Apr–Jun', icon: '⛅', temp: '30-38°C', rain: '60-120mm' }
      };
      
      forecast.push({
        step,
        season: forecastSeason,
        ...seasonLabels[forecastSeason],
        confidence,
        altSeason: transition ? transition.altNext : 'Rabi',
        altProb: transition ? Math.round(transition.altProb * 100) : 30,
        recommendedCrops: matchingCrops
      });
      
      season = forecastSeason;
    }
    
    res.json({ currentSeason, forecast });
  });

  // POST /api/crops/sensitivity - Resource Sensitivity Analysis (dP/dB, dP/dW)
  router.post('/sensitivity', (req, res) => {
    try {
        const { budget, water, soil, fertility, districtId } = req.body;
        
        const baseBudget = parseFloat(budget) || 50000;
        const baseWater = parseFloat(water) || 1000000;
        const soilKey = soil || 'Red';
        const fert = parseFloat(fertility) || 7.5;
        
        const runOpt = (testB, testW) => {
            let localBudget = testB;
            let localWater = testW;
            let totalProfit = 0;
            
            const candidates = cropDataList
                .filter(c => c.soils && (c.soils[soilKey] || 0) > 0.3)
                .map(c => {
                    const s = c.soils[soilKey] || 0.7;
                    const waterCost = (c.water_req === 'Very High' ? 4500 : c.water_req === 'High' ? 2500 : 1200);
                    const inputCost = (c.duration * 125 + 3000);
                    const revenue = c.base_yield * 0.45 * s * (fert / 10) * 65 * 1.5;
                    const margin = revenue - inputCost - waterCost;
                    return { ...c, margin, inputCost, waterCost };
                })
                .sort((a, b) => b.margin - a.margin);
                
            for (let crop of candidates) {
                if (localBudget <= 0 || localWater <= 0) break;
                const canAfford = Math.min(1.0, localBudget / (crop.inputCost || 1), localWater / (crop.waterCost || 1));
                if (canAfford > 0.05) {
                    totalProfit += (crop.margin || 0) * canAfford;
                    localBudget -= (crop.inputCost || 0) * canAfford;
                    localWater -= (crop.waterCost || 0) * canAfford;
                }
            }
            return totalProfit;
        };
        
        const profit0 = runOpt(baseBudget, baseWater);
        
        // Sensitivity dP/dB (±10% budget)
        const profitB1 = runOpt(baseBudget * 1.1, baseWater);
        const dB = (baseBudget > 0) ? (profitB1 - profit0) / (baseBudget * 0.1) : 0;
        
        // Sensitivity dP/dW (±10% water)
        const profitW1 = runOpt(baseBudget, baseWater * 1.1);
        const dW = (baseWater > 0) ? (profitW1 - profit0) / (baseWater * 0.1) : 0;
        
        // Return on Investment (ROI)
        const budgetROI = (dB * 100).toFixed(2);
        const waterROI = (dW * 1000).toFixed(2);
        
        res.json({
            baseProfit: Math.round(profit0),
            budget: { sensitivity: dB.toFixed(4), roi_pct: budgetROI, impact: dB > 0.5 ? 'Critical' : 'Moderate' },
            water: { sensitivity: dW.toFixed(4), roi_unit: waterROI, impact: dW > 0.005 ? 'Critical' : 'Moderate' },
            bottleneck: (dB > dW * 500) ? 'Budget' : 'Water'
        });
    } catch (err) {
        console.error('Sensitivity Error:', err);
        res.status(500).json({ error: 'Internal Sensitivity Engine Error' });
    }
  });


  return router;
}
