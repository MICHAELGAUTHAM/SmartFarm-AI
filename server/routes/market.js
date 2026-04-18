import express from 'express';

export default function marketRouter() {
  const router = express.Router();
  
  // Data.gov.in Demo API Key (or can be parameterized)
  const API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
  // The official Agmarknet Resource ID on data.gov.in
  const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

  // In-memory cache to make it ultra-fast after the first load
  let memCache = { timestamp: 0, data: null };

  router.get('/pulse', async (req, res) => {
    try {
        const { district, commodity } = req.query;
        const now = Date.now();
        
        // Use cache if it's less than 2 hours old
        if (!memCache.data || (now - memCache.timestamp > 7200000)) {
            console.log("Fetching live payload from data.gov.in...");
            let url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${API_KEY}&format=json&filters[state.keyword]=Tamil Nadu&limit=800`;
            const response = await fetch(url);
            memCache.data = await response.json();
            memCache.timestamp = now;
        }
        
        const data = memCache.data;
        
        if (data && data.records && data.records.length > 0) {
            let records = data.records;
            
            // Safe filtering considering casing issues from government portals
            if (district && district !== 'all') {
                records = records.filter(r => r.district.toLowerCase() === district.toLowerCase() || r.market.toLowerCase() === district.toLowerCase());
            }
            if (commodity && commodity !== 'all') {
                records = records.filter(r => r.commodity.toLowerCase() === commodity.toLowerCase());
            }

            if(records.length > 0) {
                 res.json({ live: true, records: records });
                 return;
            }
        }
        
        // Return structured signal that no live data was found today for this combo
        res.json({ live: false, records: [] });
    } catch(e) {
        console.error("Gov API Error:", e);
        res.json({ live: false, records: [], error: e.message });
    }
  });

  return router;
}
