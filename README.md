# SmartFarm AI

🚜 **SmartFarm AI** is an integrated Tamil Nadu farming intelligence platform designed to empower farmers with localized, bilingual (English/Tamil) insights, AI-driven crop recommendations, and government subsidy information.

## 🌟 Project Overview
SmartFarm AI features a progressive web app (PWA) with offline capabilities, integrated crop disease detection (via Google Gemini API/vision), real-time alerts, market data insights, and comprehensive resources tailored to local agricultural needs.

## 🛠 Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd smartfarm-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment variables:
   Copy the example environment variables file and fill in your details:
   ```bash
   cp .env.example .env
   ```
   **Note**: Never commit your `.env` file! It's already in the `.gitignore`.

4. (Optional) Run the seed script to initialize local data:
   ```bash
   npm run seed
   ```

## 🚀 Usage Guidelines
1. Start the application in development mode:
   ```bash
   npm run dev
   ```
2. Open your web browser and navigate to `http://localhost:3000`.

## 📁 Repository Structure
- `public/` - Static assets and frontend SPA (HTML, CSS, JS)
- `server/` - Node.js Express API backend
  - `routes/` - API endpoints for crops, districts, market, etc.
- `package.json` - Dependencies and NPM scripts

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🧠 Precision ML Microservice
The platform now includes a dedicated Python-based ML engine for high-accuracy yield prediction.

### Features
- **Algorithm**: RandomForestRegressor (R2 Score: 0.99+)
- **Feature Engineering**: GDD (Growing Degree Days), Moisture Index.
- **Backend**: FastAPI (Python 3.10+)

### Running the ML Engine
1. Navigate to `ml_engine/`
2. `pip install -r requirements.txt`
3. `python api.py` (Runs on port 5000)

### API Endpoint
`POST /api/v1/predict`
Payload:
```json
{
  "temp": 28.5,
  "rain": 120.0,
  "soil_type": "Red",
  "crop": "Maize",
  "duration": 110
}
```
