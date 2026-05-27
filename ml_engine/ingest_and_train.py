import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from xgboost import XGBRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.preprocessing import LabelEncoder
from scipy import stats

def ingest_and_train():
    print("Starting Production Ingestion Pipeline...")

    # 1. LOAD RAW DATA
    df_yield = pd.read_csv('ml_engine/data/tnau_yield_raw.csv')
    df_weather = pd.read_csv('ml_engine/data/imd_weather_raw.csv')
    df_soil = pd.read_csv('ml_engine/data/soil_health_raw.csv')

    # 2. DATA CLEANING (NORMALIZATION)
    df_yield['District_Name'] = df_yield['District_Name'].str.strip().str.upper()
    df_weather['DIST'] = df_weather['DIST'].str.strip().str.upper()
    df_soil['district_id'] = df_soil['district_id'].str.strip().str.upper()

    df_yield.rename(columns={'YEAR': 'year', 'District_Name': 'district', 'Crop_Type': 'crop'}, inplace=True)
    df_weather.rename(columns={'yr': 'year', 'DIST': 'district'}, inplace=True)
    df_soil.rename(columns={'district_id': 'district'}, inplace=True)

    # 3. MERGE DATASETS
    df = pd.merge(df_yield, df_weather, on=['year', 'district'], how='inner')
    df = pd.merge(df, df_soil, on='district', how='inner')

    print(f"Dataset Merged. Rows: {len(df)}")

    # 4. OUTLIER REMOVAL
    df = df[(df['Yield_kg_ha'] > 100) & (df['Yield_kg_ha'] < 150000)]
    z_scores = stats.zscore(df['Yield_kg_ha'])
    df = df[abs(z_scores) < 3]
    
    print(f"Cleaning Complete. Rows remaining: {len(df)}")

    # 5. FEATURE ENGINEERING
    df['gdd'] = (df['avg_temp'] - 10) * 120
    df['moisture_index'] = df['annual_rain_mm'] / (df['avg_temp'] * 0.5 + 1)
    
    # 6. STRICT TIME-BASED SPLIT
    train_df = df[df['year'] <= 2021].copy()
    val_df = df[df['year'] == 2022].copy()
    test_df = df[df['year'] >= 2023].copy()
    
    print(f"Split: Train({len(train_df)}), Val({len(val_df)}), Test({len(test_df)})")

    # Encoders
    le_crop = LabelEncoder()
    le_dist = LabelEncoder()
    
    train_df['crop_enc'] = le_crop.fit_transform(train_df['crop'])
    train_df['dist_enc'] = le_dist.fit_transform(train_df['district'])
    
    def safe_map(le, val):
        try: return le.transform([val])[0]
        except: return -1

    for d in [val_df, test_df]:
        d['crop_enc'] = d['crop'].apply(lambda x: safe_map(le_crop, x))
        d['dist_enc'] = d['district'].apply(lambda x: safe_map(le_dist, x))

    features = ['year', 'dist_enc', 'crop_enc', 'annual_rain_mm', 'avg_temp', 'humidity', 'nitrogen_ppm', 'phosphorus_ppm', 'potassium_ppm', 'ph_level', 'gdd', 'moisture_index']
    
    X_train, y_train = train_df[features], train_df['Yield_kg_ha']
    X_test, y_test = test_df[features], test_df['Yield_kg_ha']

    # 7. MODEL TRAINING (ENSEMBLE)
    rf = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    xgb = XGBRegressor(n_estimators=150, learning_rate=0.05, max_depth=8, random_state=42)
    
    model = VotingRegressor(estimators=[('rf', rf), ('xgb', xgb)])
    model.fit(X_train, y_train)

    # 8. EVALUATION
    preds = model.predict(X_test)
    r2 = r2_score(y_test, preds)
    mae = mean_absolute_error(y_test, preds)
    
    print(f"PRODUCTION ACCURACY (R2): {r2:.4f}")
    print(f"MAE: {mae:.2f} kg/ha")

    # 9. SAVE ARTEFACTS
    joblib.dump(model, 'ml_engine/production_model.joblib')
    joblib.dump(le_crop, 'ml_engine/le_crop.joblib')
    joblib.dump(le_dist, 'ml_engine/le_dist.joblib')
    
    xgb.fit(X_train, y_train)
    joblib.dump(dict(zip(features, xgb.feature_importances_.tolist())), 'ml_engine/weights.joblib')

    print("Production Model Exported.")

if __name__ == "__main__":
    ingest_and_train()
