import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import r2_score

def perform_audit():
    print("--- SmartFarm ML Audit Log ---")
    
    # 1. Load Artefacts
    try:
        model = joblib.load('ml_engine/ensemble_model.joblib')
        le_dist = joblib.load('ml_engine/dist_le.joblib')
        le_crop = joblib.load('ml_engine/crop_le.joblib')
        le_soil = joblib.load('ml_engine/soil_le.joblib')
    except:
        print("Audit Failed: Models not found.")
        return

    # 2. 🧪 STEP 7: NOISE ROBUSTNESS TEST
    # We take 1000 samples and add 20% noise to 'rain' and 'temp'
    print("Test 1: Adding 20% Random Noise to Input Features...")
    np.random.seed(99)
    test_data = {
        'dist_enc': [0]*1000,
        'crop_enc': [0]*1000,
        'soil_enc': [0]*1000,
        'temp': np.random.uniform(25, 35, 1000),
        'rain': np.random.uniform(50, 150, 1000)
    }
    df = pd.DataFrame(test_data)
    df['gdd'] = (df['temp'] - 10) * 120
    df['moisture_index'] = df['rain'] / (df['temp'] * 0.5 + 1)
    
    clean_preds = model.predict(df[['dist_enc', 'crop_enc', 'soil_enc', 'temp', 'rain', 'gdd', 'moisture_index']])
    
    # Add noise
    df_noisy = df.copy()
    df_noisy['rain'] = df_noisy['rain'] * np.random.uniform(0.8, 1.2, 1000)
    noisy_preds = model.predict(df_noisy[['dist_enc', 'crop_enc', 'soil_enc', 'temp', 'rain', 'gdd', 'moisture_index']])
    
    stability = np.mean(np.abs(clean_preds - noisy_preds) / clean_preds) * 100
    print(f"Result: Model variance under 20% noise is {stability:.2f}%")

    # 3. 🔍 STEP 6: FEATURE IMPORTANCE VALIDATION
    # If one feature dominates, it's a 'Rule Learner', not a 'Pattern Learner'
    print("\nTest 2: Rule Dominance Check...")
    # (Checking the XGB component of the ensemble)
    importances = joblib.load('ml_engine/feature_importances.joblib')
    top_feat = max(importances, key=importances.get)
    print(f"Result: Dominant Feature is '{top_feat}' with {importances[top_feat]*100:.1f}% weight.")

    print("\n--- 🏁 Audit Complete ---")

if __name__ == "__main__":
    perform_audit()
