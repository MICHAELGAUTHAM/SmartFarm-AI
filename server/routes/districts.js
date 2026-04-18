import { Router } from 'express';
import { districtsData, commoditiesData } from '../data.js';

const router = Router();

export default function() {
  router.get('/', (req, res) => {
    res.json(districtsData.sort((a,b) => a.name.localeCompare(b.name)));
  });

  router.get('/:id/climate', (req, res) => {
    const d = districtsData.find(x => x.id == req.params.id);
    if (!d) return res.status(404).json({ error: 'District not found' });

    const seasons = ["Tai (தை)","Maasi (மாசி)","Panguni (பங்குனி)","Chithirai (சித்திரை)","Vaikasi (வைகாசி)","Aani (ஆனி)","Aadi (ஆடி)","Avani (ஆவணி)","Purattasi (புரட்டாசி)","Aippasi (ஐப்பசி)","Karthigai (கார்த்திகை)","Margazhi (மார்கழி)"];
    const month = new Date().getMonth();
    const temps = [d.avg_temp_jan, d.avg_temp_jan+2, d.avg_temp_jan+4, d.avg_temp_apr, d.avg_temp_apr+2, d.avg_temp_apr-1, d.avg_temp_jul, d.avg_temp_jul-1, d.avg_temp_jul-2, d.avg_temp_oct, d.avg_temp_oct-2, d.avg_temp_jan+1];
    const rains = [d.rain_jan, d.rain_jan+7, d.rain_jan+30, d.rain_apr, d.rain_apr+20, d.rain_apr-5, d.rain_jul, d.rain_jul+20, d.rain_jul+30, d.rain_oct, d.rain_oct-30, d.rain_jan+10];

    res.json({
      district: d.name, zone: d.zone,
      currentSeason: seasons[month],
      currentTemp: Math.round(temps[month] * 10) / 10,
      currentRain: Math.round(rains[month]),
      monthly: seasons.map((s, i) => ({ season: s, temp: Math.round(temps[i] * 10) / 10, rain: Math.round(rains[i]) }))
    });
  });

  router.get('/:id/market-prices', (req, res) => {
    // Return all commodities but slightly randomized to simulate different districts
    const factor = 1 + (parseInt(req.params.id) % 10 - 5) / 100; // variance +/- 5%
    const districtPrices = commoditiesData.map(c => ({
      commodity: c.commodity,
      modal_price: Math.round(c.modal_price * factor),
      high_price: Math.round(c.high_price * factor),
      trend: c.trend,
      unit: c.unit,
      updated_at: new Date().toISOString().split('T')[0]
    }));
    res.json(districtPrices);
  });

  router.get('/:id/soil-labs', (req, res) => {
    const d = districtsData.find(x => x.id == req.params.id);
    if (!d) return res.json([]);
    const n = d.name;
    const z = d.zone;
    res.json([
      {
        lab_name: `District Soil Testing Laboratory — ${n}`,
        lab_name_ta: `மாவட்ட மண் பரிசோதனை ஆய்வகம் — ${d.name_ta || n}`,
        address: `Department of Agriculture, Collectorate Campus, ${n} — 620001`,
        phone: `1800-425-1551 (Toll Free)`,
        type: 'Government',
        type_ta: 'அரசு ஆய்வகம்',
        services: 'Full NPK analysis, pH, EC, Organic Carbon, Micro-nutrients (12 parameters)',
        services_ta: 'NPK பகுப்பாய்வு, pH, EC, கரிமக் கார்பன், நுண்ணூட்டச் சத்துகள்',
        timings: 'Mon–Fri: 9:00 AM – 5:00 PM',
        test_cost: 'Free (Govt. Scheme)',
        test_cost_ta: 'இலவசம் (அரசு திட்டம்)',
        turnaround: '7–10 working days',
        icon: '🏛️'
      },
      {
        lab_name: `Krishi Vigyan Kendra (KVK) Soil Lab — ${n}`,
        lab_name_ta: `வேளாண் அறிவியல் மையம் (KVK) — ${d.name_ta || n}`,
        address: `KVK Centre, ICAR Campus, ${n} District — ${z} Zone`,
        phone: `04XX-2234567`,
        type: 'KVK / ICAR',
        type_ta: 'ICAR மையம்',
        services: 'Soil health + crop-specific advisory, water quality testing',
        services_ta: 'மண் நலன் + பயிர் வழிகாட்டல், நீர் தர பரிசோதனை',
        timings: 'Mon–Sat: 9:00 AM – 4:30 PM',
        test_cost: '₹100–₹300 per sample',
        test_cost_ta: 'மாதிரிக்கு ₹100–₹300',
        turnaround: '5–7 working days',
        icon: '🔬'
      },
      {
        lab_name: `Tamil Nadu Agricultural University (TNAU) Extension Lab`,
        lab_name_ta: `தமிழ்நாடு வேளாண் பல்கலைக்கழக (TNAU) ஆய்வகம்`,
        address: `TNAU Extension Centre, ${n} — Near Block Agriculture Office`,
        phone: `0422-6611200`,
        type: 'University Lab',
        type_ta: 'பல்கலைக்கழக ஆய்வகம்',
        services: 'Advanced soil profiling, bio-fertilizer compatibility, tissue testing',
        services_ta: 'மண் சுயவிவரம், உயிர் உர பொருத்தம், திசு பரிசோதனை',
        timings: 'Mon–Fri: 9:00 AM – 4:00 PM',
        test_cost: '₹200–₹500 per sample',
        test_cost_ta: 'மாதிரிக்கு ₹200–₹500',
        turnaround: '10–14 working days',
        icon: '🎓'
      },
      {
        lab_name: `Primary Agricultural Credit Society (PACS) Soil Unit — ${n}`,
        lab_name_ta: `முதன்மை வேளாண் கடன் சங்கம் மண் பரிசோதனை — ${d.name_ta || n}`,
        address: `PACS Office, Near Farmers Market, ${n} Taluk`,
        phone: `04XX-3345678`,
        type: 'Co-operative',
        type_ta: 'கூட்டுறவு மையம்',
        services: 'Basic NPK test, pH, Moisture content, Organic matter',
        services_ta: 'அடிப்படை NPK, pH, ஈரப்பதம், கரிமப் பொருள்',
        timings: 'Mon–Sat: 8:30 AM – 3:30 PM',
        test_cost: '₹50 per sample',
        test_cost_ta: 'மாதிரிக்கு ₹50',
        turnaround: '3–5 working days',
        icon: '🤝'
      },
      {
        lab_name: `Agri Input Private Testing Lab — ${n}`,
        lab_name_ta: `தனியார் வேளாண் உள்ளீடு ஆய்வகம் — ${d.name_ta || n}`,
        address: `Near Commercial Complex, Main Road, ${n}`,
        phone: `98765-43210`,
        type: 'Private (NABL Accredited)',
        type_ta: 'தனியார் (NABL அங்கீகரிக்கப்பட்டது)',
        services: 'Rapid testing (same day), Heavy metals, Pesticide residue, Export-grade certification',
        services_ta: 'விரைவு பரிசோதனை (அதே நாள்), கன உலோகங்கள், பூச்சிக்கொல்லி எச்சம், ஏற்றுமதி சான்றிதழ்',
        timings: 'Mon–Sun: 8:00 AM – 8:00 PM',
        test_cost: '₹500–₹2,000 per sample',
        test_cost_ta: 'மாதிரிக்கு ₹500–₹2,000',
        turnaround: 'Same day – 2 days',
        icon: '🏢'
      }
    ]);
  });

  return router;
}
