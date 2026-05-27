import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from xgboost import XGBRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.preprocessing import LabelEncoder

# 1. ── PRODUCTION DATA SIMULATOR (TNAU / AGMARKNET REALISM) ──────────────────
def generate_production_dataset(samples=10000):
    np.random.seed(42)
    districts = ['Thanjavur', 'Madurai', 'Coimbatore', 'Salem', 'Trichy', 'Erode', 'Vellore', 'Dharmapuri']
    crops = ['Rice', 'Maize', 'Sugarcane', 'Groundnut', 'Turmeric', 'Tomato']
    soil_types = ['Red', 'Black', 'Alluvial', 'Laterite']
    years = np.arange(2015, 2025)
    
    data = []
    for _ in range(samples):
        year = np.random.choice(years)
        district = np.random.choice(districts)
        crop = np.random.choice(crops)
        soil = np.random.choice(soil_types)
        
        # Environmental Variance
        temp = np.random.uniform(20, 42)
        rain = np.random.uniform(0, 400)
        
        # Biological Signal + Noise (Production Grade)
        base_yield = 1000
        if crop == 'Rice': base_yield = 3000 + (rain * 3 if rain < 200 else 600 - rain)
        if crop == 'Sugarcane': base_yield = 70000 + (rain * 20)
        
        dist_mult = 1.2 if district == 'Thanjavur' else 0.9 if district == 'Dharmapuri' else 1.0
        year_trend = (year - 2015) * 50 
        
        final_yield = (base_yield * dist_mult) + year_trend + np.random.normal(0, 150)
        
        data.append([year, district, crop, soil, temp, rain, final_yield])
        
    df = pd.DataFrame(data, columns=['year', 'district', 'crop', 'soil_type', 'temp', 'rain', 'yield'])
    return df

# 2. ── PRODUCTION TRAINING ENGINE ─────────────────────────────────────────────
def train_production_system():
    print("Initializing Production ML Training (Ensemble Mode)...")
    
    df = generate_production_dataset(12000)
    
    # Feature Engineering
    df['gdd'] = (df['temp'] - 10) * 120
    df['moisture_index'] = df['rain'] / (df['temp'] * 0.5 + 1)
    
    # Time-based split
    train_df = df[df['year'] <= 2022].copy()
    test_df = df[df['year'] > 2022].copy()
    
    # Label Encoders
    le_dist = LabelEncoder()
    le_crop = LabelEncoder()
    le_soil = LabelEncoder()
    
    train_df['dist_enc'] = le_dist.fit_transform(train_df['district'])
    train_df['crop_enc'] = le_crop.fit_transform(train_df['crop'])
    train_df['soil_enc'] = le_soil.fit_transform(train_df['soil_type'])
    
    def safe_transform(le, val):
        try: return le.transform([val])[0]
        except: return -1
        
    test_df['dist_enc'] = test_df['district'].apply(lambda x: safe_transform(le_dist, x))
    test_df['crop_enc'] = test_df['crop'].apply(lambda x: safe_transform(le_crop, x))
    test_df['soil_enc'] = test_df['soil_type'].apply(lambda x: safe_transform(le_soil, x))
    
    features = ['dist_enc', 'crop_enc', 'soil_enc', 'temp', 'rain', 'gdd', 'moisture_index']
    X_train, y_train = train_df[features], train_df['yield']
    X_test, y_test = test_df[features], test_df['yield']
    
    # Ensemble
    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    xgb = XGBRegressor(n_estimators=100, learning_rate=0.08, max_depth=6, random_state=42)
    
    ensemble = VotingRegressor(estimators=[('rf', rf), ('xgb', xgb)])
    ensemble.fit(X_train, y_train)
    
    # Evaluation
    preds = ensemble.predict(X_test)
    r2 = r2_score(y_test, preds)
    print(f"Production Score (R2): {r2:.4f}")
    
    # Save Artefacts
    joblib.dump(ensemble, 'ml_engine/ensemble_model.joblib')
    joblib.dump(le_dist, 'ml_engine/dist_le.joblib')
    joblib.dump(le_crop, 'ml_engine/crop_le.joblib')
    joblib.dump(le_soil, 'ml_engine/soil_le.joblib')
    
    # Save feature importance for API use (from XGB)
    xgb.fit(X_train, y_train)
    importances = dict(zip(features, xgb.feature_importances_.tolist()))
    joblib.dump(importances, 'ml_engine/feature_importances.joblib')
    
    print("Production system saved successfully.")

if __name__ == "__main__":
    train_production_system()

if __name__ == "__main__":
    train_production_system()
