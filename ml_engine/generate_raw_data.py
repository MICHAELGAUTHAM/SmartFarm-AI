import pandas as pd
import numpy as np
import os

def create_raw_government_csvs():
    np.random.seed(42)
    districts = ['Thanjavur', 'MADURAI', 'Madurai ', ' Coimbatore', 'Trichy', 'Salem', 'Erode', 'Vellore']
    crops = ['Rice', 'Maize', 'Sugarcane', 'Groundnut', 'Turmeric']
    years = np.arange(2010, 2025)
    
    # 1. 🌾 TNAU Yield Dataset (Messy)
    yield_data = []
    for _ in range(5000):
        year = np.random.choice(years)
        dist = np.random.choice(districts)
        crop = np.random.choice(crops)
        # Realistic Yields with outliers (e.g. 999999 or negative)
        y = np.random.uniform(1000, 5000) if crop != 'Sugarcane' else np.random.uniform(60000, 90000)
        if np.random.random() < 0.01: y = -50 # Outlier: Error
        if np.random.random() < 0.01: y = 999999 # Outlier: Sensor error
        yield_data.append([year, dist, crop, y])
    
    df_yield = pd.DataFrame(yield_data, columns=['YEAR', 'District_Name', 'Crop_Type', 'Yield_kg_ha'])
    df_yield.to_csv('ml_engine/data/tnau_yield_raw.csv', index=False)
    
    # 2. ⛈️ IMD Weather Dataset
    weather_data = []
    for year in years:
        for dist in set([d.strip().upper() for d in districts]):
            rain = np.random.uniform(500, 1500) # Annual
            temp = np.random.uniform(25, 35)
            hum = np.random.uniform(60, 90)
            weather_data.append([year, dist, rain, temp, hum])
            
    df_weather = pd.DataFrame(weather_data, columns=['yr', 'DIST', 'annual_rain_mm', 'avg_temp', 'humidity'])
    df_weather.to_csv('ml_engine/data/imd_weather_raw.csv', index=False)
    
    # 3. 🧪 Soil Health Card Dataset
    soil_data = []
    for dist in set([d.strip().upper() for d in districts]):
        n = np.random.uniform(50, 300)
        p = np.random.uniform(10, 80)
        k = np.random.uniform(100, 400)
        ph = np.random.uniform(5.5, 8.5)
        soil_data.append([dist, n, p, k, ph])
        
    df_soil = pd.DataFrame(soil_data, columns=['district_id', 'nitrogen_ppm', 'phosphorus_ppm', 'potassium_ppm', 'ph_level'])
    df_soil.to_csv('ml_engine/data/soil_health_raw.csv', index=False)
    
    print("✅ Created 3 Raw Government CSVs in ml_engine/data/")

if __name__ == "__main__":
    create_raw_government_csvs()
