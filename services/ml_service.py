def predict_farmer(income, expenses, weather, market):
    profit = income - expenses
    risk_score = 45.0
    
    explanation = "Stable market and typical weather patterns detected."
    recommendation = "Standard agricultural schedules mapped."
    
    # Insights mapping loops 
    if weather.get('rainfall', 0) < 20:
        risk_score += 25
        profit *= 0.85
        explanation = f"Low rainfall ({weather.get('rainfall')}mm) detected globally impacting viability arrays."
        recommendation = "Low rainfall detected -> Deploy extensive drip irrigation recommended."
        
    if weather.get('temperature', 0) > 35:
        risk_score += 15
        profit *= 0.90
        explanation = f"Dangerous temperature thresholds ({weather.get('temperature')}°C) stressing crop viability."
        recommendation = "Extreme Heat detected -> Increase hydration intervals actively."

    return {
        "risk_score": round(risk_score, 2),
        "profit": round(profit, 2),
        "explanation": explanation,
        "recommendation": recommendation,
        "suggested_crop": "Tomato",
        "profit_trend": "+12.5% vs last month" if market[0].get('trend') == 'UP' else "-5% vs last month",
        "best_selling_district": market[0].get('district', 'Madurai'),
        "risk_warning": "Warning: Potential pest vulnerabilities detected given current humidity markers." if weather.get('rainfall') > 50 else "No immediate hazards."
    }
