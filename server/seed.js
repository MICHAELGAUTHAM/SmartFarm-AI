import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'smartfarm.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- SCHEMA ---
db.exec(`
DROP TABLE IF EXISTS market_prices;
DROP TABLE IF EXISTS crop_phases;
DROP TABLE IF EXISTS crop_soils;
DROP TABLE IF EXISTS crops;
DROP TABLE IF EXISTS districts;
DROP TABLE IF EXISTS subsidies;
DROP TABLE IF EXISTS soil_labs;
DROP TABLE IF EXISTS export_steps;

CREATE TABLE districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  name_ta TEXT,
  avg_temp_jan REAL, avg_temp_apr REAL, avg_temp_jul REAL, avg_temp_oct REAL,
  rain_jan REAL, rain_apr REAL, rain_jul REAL, rain_oct REAL,
  zone TEXT
);

CREATE TABLE crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  name_ta TEXT,
  icon TEXT,
  duration INTEGER,
  base_yield REAL,
  category TEXT,
  water_req TEXT,
  season TEXT,
  min_temp REAL, max_temp REAL,
  description TEXT
);

CREATE TABLE crop_soils (
  crop_id INTEGER REFERENCES crops(id),
  soil_type TEXT,
  suitability REAL DEFAULT 1.0,
  PRIMARY KEY (crop_id, soil_type)
);

CREATE TABLE crop_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_id INTEGER REFERENCES crops(id),
  phase_order INTEGER,
  title TEXT, title_ta TEXT,
  day_label TEXT,
  description TEXT
);

CREATE TABLE market_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER REFERENCES districts(id),
  commodity TEXT,
  modal_price REAL,
  high_price REAL,
  trend TEXT,
  unit TEXT DEFAULT 'per quintal',
  updated_at TEXT DEFAULT (date('now'))
);

CREATE TABLE subsidies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, name_ta TEXT,
  ministry TEXT,
  benefit TEXT,
  eligibility TEXT,
  how_to_apply TEXT,
  amount TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE soil_labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER REFERENCES districts(id),
  lab_name TEXT,
  address TEXT,
  phone TEXT,
  type TEXT
);

CREATE TABLE export_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_order INTEGER,
  title TEXT,
  description TEXT,
  agency TEXT,
  est_cost TEXT
);
`);

// --- SEED DISTRICTS ---
const districtNames = ["Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode","Kallakurichi","Kancheepuram","Kanniyakumari","Karur","Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivagangai","Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirapalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore","Villupuram","Virudhunagar"];
const insertDist = db.prepare(`INSERT INTO districts (name, avg_temp_jan, avg_temp_apr, avg_temp_jul, avg_temp_oct, rain_jan, rain_apr, rain_jul, rain_oct, zone) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const zones = { Chennai:'Coastal', Chengalpattu:'Coastal', Tiruvallur:'Coastal', Kancheepuram:'Coastal', Cuddalore:'Coastal', Nagapattinam:'Coastal', Thanjavur:'Delta', Tiruvarur:'Delta', Mayiladuthurai:'Delta', Coimbatore:'Western', Erode:'Western', Tiruppur:'Western', Nilgiris:'Hill', Dindigul:'Southern', Madurai:'Southern', Theni:'Southern', Salem:'Northern', Dharmapuri:'Northern', Krishnagiri:'Northern', Namakkal:'Northern' };
for (const d of districtNames) {
  const z = zones[d] || 'Central';
  const base = 24 + Math.random()*4;
  insertDist.run(d, base, base+8, base+6, base+4, 15+Math.random()*20, 80+Math.random()*40, 100+Math.random()*60, 150+Math.random()*50, z);
}

// --- SEED CROPS ---
const cropData = [
  { name:"Rice", ta:"நெல்", icon:"🌾", dur:120, yld:3288, cat:"Grains", water:"High", season:"Kharif/Rabi", mint:22, maxt:35, desc:"Staple paddy crop of TN delta region", soils:[["Alluvial",1.2],["Black",1.0],["Red",0.8]] },
  { name:"Maize", ta:"மக்காச்சோளம்", icon:"🌽", dur:110, yld:5487, cat:"Grains", water:"Medium", season:"Kharif", mint:18, maxt:38, desc:"High-yield feed & food grain", soils:[["Red",1.1],["Black",1.0],["Alluvial",1.0]] },
  { name:"Ragi", ta:"கேழ்வரகு", icon:"🌾", dur:115, yld:2800, cat:"Millets", water:"Low", season:"Kharif", mint:20, maxt:35, desc:"Nutrient-rich finger millet", soils:[["Red",1.2],["Laterite",1.0],["Alluvial",0.9]] },
  { name:"Cumbu", ta:"கம்பு", icon:"🥖", dur:85, yld:2400, cat:"Millets", water:"Low", season:"Kharif", mint:25, maxt:40, desc:"Pearl millet, drought tolerant", soils:[["Red",1.0],["Black",1.0],["Sandy",0.9]] },
  { name:"Thenai", ta:"தினை", icon:"🌾", dur:90, yld:1200, cat:"Millets", water:"Low", season:"Kharif", mint:20, maxt:38, desc:"Foxtail millet, traditional grain", soils:[["Red",1.1],["Black",1.0]] },
  { name:"Varagu", ta:"வரகு", icon:"🌾", dur:100, yld:1500, cat:"Millets", water:"Low", season:"Kharif", mint:22, maxt:36, desc:"Kodo millet, high fiber", soils:[["Red",1.0],["Laterite",1.0],["Sandy",0.8]] },
  { name:"Samai", ta:"சாமை", icon:"🌾", dur:95, yld:1400, cat:"Millets", water:"Low", season:"Kharif", mint:20, maxt:35, desc:"Little millet, nutrition powerhouse", soils:[["Red",1.1],["Black",0.9]] },
  { name:"Black Gram", ta:"உளுந்து", icon:"🌑", dur:65, yld:750, cat:"Pulses", water:"Low", season:"Rabi", mint:20, maxt:35, desc:"Essential dal crop", soils:[["Alluvial",1.2],["Black",1.1]] },
  { name:"Green Gram", ta:"பச்சைப்பயறு", icon:"🟢", dur:60, yld:700, cat:"Pulses", water:"Low", season:"Kharif", mint:22, maxt:38, desc:"Short duration pulse", soils:[["Red",1.0],["Alluvial",1.1],["Sandy",0.8]] },
  { name:"Red Gram", ta:"துவரை", icon:"🔴", dur:150, yld:900, cat:"Pulses", water:"Low", season:"Kharif", mint:18, maxt:35, desc:"Arhar/Toor dal crop", soils:[["Red",1.1],["Black",1.2],["Alluvial",0.9]] },
  { name:"Groundnut", ta:"நிலக்கடலை", icon:"🥜", dur:105, yld:1800, cat:"Oilseeds", water:"Medium", season:"Kharif/Rabi", mint:22, maxt:36, desc:"Major oilseed of TN", soils:[["Red",1.2],["Sandy",1.0],["Alluvial",0.9]] },
  { name:"Sesame", ta:"எள்", icon:"🌰", dur:85, yld:650, cat:"Oilseeds", water:"Low", season:"Kharif", mint:25, maxt:40, desc:"Premium oilseed, gingelly", soils:[["Red",1.0],["Black",1.0],["Alluvial",1.1]] },
  { name:"Sugarcane", ta:"கரும்பு", icon:"🎋", dur:330, yld:102000, cat:"Cash Crops", water:"Very High", season:"Year-round", mint:20, maxt:40, desc:"Major cash crop, sugar industry backbone", soils:[["Alluvial",1.3],["Black",1.1],["Red",0.9]] },
  { name:"Cotton", ta:"பருத்தி", icon:"☁️", dur:170, yld:2200, cat:"Cash Crops", water:"Medium", season:"Kharif", mint:20, maxt:40, desc:"White gold of Deccan", soils:[["Black",1.3],["Red",1.0]] },
  { name:"Banana", ta:"வாழை", icon:"🍌", dur:320, yld:39691, cat:"Fruits", water:"High", season:"Year-round", mint:18, maxt:38, desc:"Year-round fruit crop", soils:[["Alluvial",1.2],["Red",1.0]] },
  { name:"Coconut", ta:"தேங்காய்", icon:"🥥", dur:365, yld:14000, cat:"Cash Crops", water:"Medium", season:"Year-round", mint:20, maxt:36, desc:"Tree of life, copra production", soils:[["Alluvial",1.1],["Red",1.0],["Sandy",1.0]] },
  { name:"Tomato", ta:"தக்காளி", icon:"🍅", dur:100, yld:25000, cat:"Vegetables", water:"Medium", season:"Rabi", mint:18, maxt:32, desc:"High-value vegetable crop", soils:[["Red",1.1],["Alluvial",1.2],["Black",1.0]] },
  { name:"Brinjal", ta:"கத்திரி", icon:"🍆", dur:120, yld:22000, cat:"Vegetables", water:"Medium", season:"Year-round", mint:18, maxt:35, desc:"Versatile vegetable crop", soils:[["Red",1.0],["Alluvial",1.1],["Black",1.0]] },
  { name:"Chilli", ta:"மிளகாய்", icon:"🌶️", dur:150, yld:3500, cat:"Spices", water:"Medium", season:"Kharif", mint:20, maxt:38, desc:"Dry & green chilli varieties", soils:[["Red",1.1],["Black",1.2],["Alluvial",1.0]] },
  { name:"Turmeric", ta:"மஞ்சள்", icon:"🟠", dur:240, yld:5488, cat:"Spices", water:"Medium", season:"Kharif", mint:20, maxt:35, desc:"Golden spice, Erode famous", soils:[["Alluvial",1.2],["Black",1.1],["Red",1.0]] },
  { name:"Jasmine", ta:"மல்லிகை", icon:"🌼", dur:365, yld:8000, cat:"Flowers", water:"Medium", season:"Year-round", mint:20, maxt:38, desc:"Madurai Malli, premium flowers", soils:[["Red",1.1],["Alluvial",1.0]] },
  { name:"Coffee", ta:"காப்பி", icon:"☕", dur:365, yld:850, cat:"Cash Crops", water:"High", season:"Year-round", mint:15, maxt:28, desc:"Nilgiris specialty coffee", soils:[["Forest",1.3],["Laterite",1.1]] },
  { name:"Tapioca", ta:"மரவள்ளிக்கிழங்கு", icon:"🥔", dur:270, yld:35000, cat:"Tubers", water:"Low", season:"Kharif", mint:20, maxt:38, desc:"Cassava, starch industry", soils:[["Red",1.2],["Sandy",1.0],["Laterite",1.0]] },
  { name:"Moringa", ta:"முருங்கை", icon:"🌿", dur:180, yld:12000, cat:"Vegetables", water:"Low", season:"Year-round", mint:22, maxt:40, desc:"Drumstick, superfood export", soils:[["Red",1.1],["Sandy",1.0],["Alluvial",1.0]] },
  { name:"Mango", ta:"மாங்காய்", icon:"🥭", dur:365, yld:8000, cat:"Fruits", water:"Low", season:"Year-round", mint:22, maxt:40, desc:"Alphonso & Banganapalli", soils:[["Red",1.1],["Alluvial",1.0],["Laterite",0.9]] },
  { name:"Onion", ta:"வெங்காயம்", icon:"🧅", dur:110, yld:18000, cat:"Vegetables", water:"Medium", season:"Rabi", mint:18, maxt:30, desc:"Small onion specialty of TN", soils:[["Red",1.1],["Alluvial",1.2],["Black",1.0]] },
  { name:"Pepper", ta:"மிளகு", icon:"⚫", dur:365, yld:500, cat:"Spices", water:"High", season:"Year-round", mint:15, maxt:30, desc:"King of spices", soils:[["Forest",1.2],["Laterite",1.1],["Red",0.8]] },
  { name:"Cardamom", ta:"ஏலக்காய்", icon:"💚", dur:365, yld:200, cat:"Spices", water:"High", season:"Year-round", mint:10, maxt:28, desc:"Queen of spices, Theni hills", soils:[["Forest",1.3],["Laterite",1.0]] },
  { name:"Papaya", ta:"பப்பாளி", icon:"🍈", dur:300, yld:40000, cat:"Fruits", water:"Medium", season:"Year-round", mint:20, maxt:38, desc:"Tropical fruit, papain extract", soils:[["Alluvial",1.2],["Red",1.0],["Sandy",0.9]] },
  { name:"Sunflower", ta:"சூரியகாந்தி", icon:"🌻", dur:95, yld:1500, cat:"Oilseeds", water:"Low", season:"Rabi", mint:18, maxt:35, desc:"Edible oil crop", soils:[["Black",1.2],["Red",1.0],["Alluvial",1.0]] },
  { name:"Ladies Finger", ta:"வெண்டை", icon:"🥒", dur:55, yld:12000, cat:"Vegetables", water:"Medium", season:"Year-round", mint:22, maxt:38, desc:"Okra, quick harvest cycle", soils:[["Red",1.0],["Alluvial",1.1],["Black",1.0]] },
  { name:"Drumstick", ta:"முருங்கை", icon:"🥢", dur:180, yld:15000, cat:"Vegetables", water:"Low", season:"Year-round", mint:22, maxt:40, desc:"High-demand year-round vegetable", soils:[["Red",1.1],["Sandy",1.0],["Alluvial",1.0]] },
];

const insertCrop = db.prepare(`INSERT INTO crops (name,name_ta,icon,duration,base_yield,category,water_req,season,min_temp,max_temp,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const insertSoil = db.prepare(`INSERT INTO crop_soils (crop_id,soil_type,suitability) VALUES (?,?,?)`);
const insertPhase = db.prepare(`INSERT INTO crop_phases (crop_id,phase_order,title,title_ta,day_label,description) VALUES (?,?,?,?,?,?)`);

const defaultPhases = [
  { t:"Soil Preparation", ta:"நிலம் தயாரித்தல்", d:"Day -15", desc:"Summer ploughing (கோடை உழவு) to break hardpan & kill dormant pests. Apply 5 tons FYM/acre. Level the field for uniform water distribution." },
  { t:"Seed Treatment", ta:"விதை நேர்த்தி", d:"Day 0", desc:"Saltwater float test for viability. Treat with Trichoderma viride @4g/kg. Bio-inoculant coating with Azospirillum for nitrogen fixation." },
  { t:"Sowing & Spacing", ta:"விதைப்பு", d:"Week 1", desc:"Maintain category-specific spacing for optimal sunlight. Sow at 2-3x seed depth. Use raised bed method in waterlogged areas." },
  { t:"Nutrient Management", ta:"உர மேலாண்மை", d:"Week 3-10", desc:"Apply Jeevamrutham (ஜீவாமிர்தம்) weekly. Foliar spray Panchagavya (பஞ்சகவ்யா) at flowering stage. Split NPK application." },
  { t:"Pest & Disease Control", ta:"பயிர் பாதுகாப்பு", d:"Continuous", desc:"IPM approach: 3% Neem Oil (வேப்ப எண்ணெய்) preventive spray. Install pheromone & sticky traps. Scout weekly for early detection." },
  { t:"Harvest & Post-Harvest", ta:"அறுவடை", d:"Final", desc:"Harvest at physiological maturity. Dry to <12% moisture. Grade & pack in clean gunny bags with dried neem leaves for storage." }
];

const seedTx = db.transaction(() => {
  for (const c of cropData) {
    const info = insertCrop.run(c.name, c.ta, c.icon, c.dur, c.yld, c.cat, c.water, c.season, c.mint, c.maxt, c.desc);
    const cropId = info.lastInsertRowid;
    for (const [soil, suit] of c.soils) insertSoil.run(cropId, soil, suit);
    for (let i = 0; i < defaultPhases.length; i++) {
      const p = defaultPhases[i];
      const dayLabel = i === defaultPhases.length - 1 ? `Day ${c.dur}` : p.d;
      insertPhase.run(cropId, i + 1, p.t, p.ta, dayLabel, p.desc);
    }
  }
});
seedTx();

// --- SEED MARKET PRICES ---
const distRows = db.prepare(`SELECT id, name FROM districts`).all();
const commodities = [
  { n:"Rice (Samba)", h:2550, l:2350, t:"Up", u:"per quintal" },
  { n:"Rice (Ponni)", h:2800, l:2600, t:"Up", u:"per quintal" },
  { n:"Turmeric (Finger)", h:16800, l:15200, t:"Down", u:"per quintal" },
  { n:"Small Onion", h:7500, l:5500, t:"Up", u:"per quintal" },
  { n:"Banana (G9)", h:850, l:600, t:"Stable", u:"per bunch" },
  { n:"Cotton (MCU5)", h:9200, l:8500, t:"Down", u:"per quintal" },
  { n:"Maize", h:2350, l:2150, t:"Up", u:"per quintal" },
  { n:"Tomato", h:4500, l:2500, t:"Up", u:"per quintal" },
  { n:"Coconut", h:2000, l:1400, t:"Stable", u:"per 100 nuts" },
  { n:"Black Gram", h:9400, l:8500, t:"Up", u:"per quintal" },
  { n:"Sunflower", h:5200, l:4800, t:"Down", u:"per quintal" },
  { n:"Groundnut", h:6200, l:5800, t:"Up", u:"per quintal" },
  { n:"Chilli (Dry)", h:18000, l:15000, t:"Up", u:"per quintal" },
  { n:"Sugarcane", h:3200, l:2900, t:"Stable", u:"per ton" },
  { n:"Tapioca", h:1200, l:900, t:"Down", u:"per quintal" },
];
const insertMkt = db.prepare(`INSERT INTO market_prices (district_id,commodity,modal_price,high_price,trend,unit) VALUES (?,?,?,?,?,?)`);
const mktTx = db.transaction(() => {
  for (const d of distRows) {
    for (const c of commodities) {
      const variance = 0.9 + Math.random() * 0.2;
      insertMkt.run(d.id, c.n, Math.round(c.l * variance), Math.round(c.h * variance), c.t, c.u);
    }
  }
});
mktTx();

// --- SEED SUBSIDIES ---
const subsidyData = [
  { name:"PM-KISAN", ta:"பிரதம மந்திரி கிசான்", ministry:"Central Govt", benefit:"₹6,000/year in 3 installments", elig:"All landholding farmers with <2 hectares", how:"Apply via pmkisan.gov.in or local e-Sevai", amount:"₹6,000/year" },
  { name:"PMFBY Crop Insurance", ta:"பயிர் காப்பீடு", ministry:"Central Govt", benefit:"Crop loss coverage at subsidized premium", elig:"All farmers growing notified crops", how:"Apply through bank or CSC within sowing window", amount:"Varies by crop" },
  { name:"Soil Health Card", ta:"மண் சுகாதார அட்டை", ministry:"Dept of Agriculture", benefit:"Free soil testing & nutrient recommendations", elig:"All farmers", how:"Visit nearest Soil Testing Lab or Agri office", amount:"Free" },
  { name:"Drip/Sprinkler Subsidy", ta:"சொட்டு நீர் மானியம்", ministry:"TN State Govt", benefit:"75-100% subsidy on micro-irrigation", elig:"Small & marginal farmers", how:"Apply at District Agri office with land documents", amount:"Up to ₹1,00,000" },
  { name:"NFSM Pulses", ta:"தேசிய உணவுப் பாதுகாப்பு", ministry:"Central Govt", benefit:"Seed, INM/IPM demos, farm tools subsidy", elig:"Farmers in NFSM-designated districts", how:"Through District Agriculture Officer", amount:"Varies" },
  { name:"TN Uzhavar Pathukappu", ta:"உழவர் பாதுகாப்புத் திட்டம்", ministry:"TN State Govt", benefit:"Free insurance coverage for farmers", elig:"All registered TN farmers aged 18-65", how:"Register at Village Admin office", amount:"₹1 Lakh life cover" },
  { name:"Free Electricity for Agriculture", ta:"இலவச மின்சாரம்", ministry:"TNEB", benefit:"Free electricity for farm pumpsets", elig:"Farmers with registered agricultural connections", how:"Apply at TNEB section office", amount:"Free units" },
  { name:"KCC (Kisan Credit Card)", ta:"கிசான் கடன் அட்டை", ministry:"Banks/RBI", benefit:"Low-interest crop loans up to ₹3 Lakhs", elig:"All farmers, tenants, sharecroppers", how:"Apply at any nationalized bank branch", amount:"Up to ₹3,00,000 @ 4% p.a." },
];
const insertSub = db.prepare(`INSERT INTO subsidies (name,name_ta,ministry,benefit,eligibility,how_to_apply,amount) VALUES (?,?,?,?,?,?,?)`);
for (const s of subsidyData) insertSub.run(s.name, s.ta, s.ministry, s.benefit, s.elig, s.how, s.amount);

// --- SEED SOIL LABS ---
const insertLab = db.prepare(`INSERT INTO soil_labs (district_id,lab_name,address,phone,type) VALUES (?,?,?,?,?)`);
for (const d of distRows) {
  insertLab.run(d.id, `District Soil Testing Lab - ${d.name}`, `Department of Agriculture, Collectorate Complex, ${d.name}`, `04XX-2XXXXX`, 'Government');
  insertLab.run(d.id, `KVK Soil Lab - ${d.name}`, `Krishi Vigyan Kendra, ${d.name} District`, `04XX-3XXXXX`, 'KVK');
}

// --- SEED EXPORT STEPS ---
const exportData = [
  { o:1, t:"APEDA Registration", d:"Register with Agricultural & Processed Food Products Export Development Authority. Online at apeda.gov.in", a:"APEDA", c:"₹5,000 + GST" },
  { o:2, t:"RCMC Certificate", d:"Obtain Registration-cum-Membership Certificate valid for 5 years", a:"APEDA/EPC", c:"₹5,000-15,000" },
  { o:3, t:"FSSAI License", d:"Food Safety & Standards Authority license mandatory for food exports", a:"FSSAI", c:"₹7,500/year" },
  { o:4, t:"Phytosanitary Certificate", d:"Plant Quarantine certificate from nearest PQ station for pest-free declaration", a:"DPPQS", c:"₹500-2,000" },
  { o:5, t:"Fumigation Certificate", d:"Methyl Bromide treatment certificate for grain/spice exports", a:"Approved Agency", c:"₹3,000-8,000" },
  { o:6, t:"Quality Testing", d:"Get products tested at NABL-accredited labs for export quality standards", a:"EIA/NABL Labs", c:"₹2,000-10,000" },
  { o:7, t:"Customs & Shipping", d:"File Shipping Bill, arrange CHA, book container, obtain Bill of Lading", a:"Customs/CHA", c:"Variable" },
];
const insertExp = db.prepare(`INSERT INTO export_steps (step_order,title,description,agency,est_cost) VALUES (?,?,?,?,?)`);
for (const e of exportData) insertExp.run(e.o, e.t, e.d, e.a, e.c);

console.log('✅ Database seeded successfully!');
console.log(`   Districts: ${distRows.length}`);
console.log(`   Crops: ${cropData.length}`);
console.log(`   Market prices: ${distRows.length * commodities.length}`);
console.log(`   Subsidies: ${subsidyData.length}`);
db.close();
