from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os

app = FastAPI(title="SmartFarm B2B ML API", version="4.0.0")

# Load Production Artefacts
try:
    model = joblib.load('ml_engine/production_model.joblib')
    le_crop = joblib.load('ml_engine/le_crop.joblib')
    le_dist = joblib.load('ml_engine/le_dist.joblib')
    weights = joblib.load('ml_engine/weights.joblib')
except Exception as e:
    print(f"⚠️ Error loading production models: {e}")

class ProductionInput(BaseModel):
    year: int = 2024
    district: str
    crop: str
    rain: float
    temp: float
    humidity: float = 75.0
    n: float = 140.0
    p: float = 45.0
    k: float = 180.0
    ph: float = 6.5

@app.post("/api/v1/predict")
async def predict_production(data: ProductionInput):
    try:
        # 1. Cleaning & Encoding
        dist_raw = data.district.strip().upper()
        crop_raw = data.crop.strip()
        
        try:
            d_enc = le_dist.transform([dist_raw])[0]
            c_enc = le_crop.transform([crop_raw])[0]
        except:
            d_enc, c_enc = -1, -1

        # 2. Features
        gdd = (data.temp - 10) * 120
        mi = data.rain / (data.temp * 0.5 + 1)
        
        feature_names = ['year', 'dist_enc', 'crop_enc', 'annual_rain_mm', 'avg_temp', 'humidity', 'nitrogen_ppm', 'phosphorus_ppm', 'potassium_ppm', 'ph_level', 'gdd', 'moisture_index']
        input_data = [[data.year, d_enc, c_enc, data.rain, data.temp, data.humidity, data.n, data.p, data.k, data.ph, gdd, mi]]
        df_input = pd.DataFrame(input_data, columns=feature_names)

        # 3. Predict & Confidence
        # (In VotingRegressor, we can't easily get individual estimators without accessing .estimators_)
        preds = [est.predict(df_input)[0] for est in model.estimators_]
        avg_pred = np.mean(preds)
        std_dev = np.std(preds)
        confidence = max(0, min(100, 100 - (std_dev / (avg_pred + 1) * 1000)))

        # 4. Insights from Weights
        top_factors = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:3]
        factors = [{"factor": f[0].replace('_enc',''), "weight": round(f[1], 3)} for f in top_factors]

        # 5. Risk & Recommendation
        risk = "Low" if confidence > 85 else "Medium" if confidence > 60 else "High"
        
        return {
            "status": "success",
            "data": {
                "predicted_yield": round(avg_pred, 2),
                "unit": "kg/ha",
                "confidence": round(confidence, 2),
                "risk_level": risk,
                "top_factors": factors,
                "recommendation": "Optimal yield forecast. Maintain current nutrient balance." if avg_pred > 3000 else "Sub-optimal yield. Increase Nitrogen levels."
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
