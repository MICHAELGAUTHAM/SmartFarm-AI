from flask import Blueprint, jsonify, request
from services.weather_service import get_weather
from services.market_service import get_market_prices

voice = Blueprint('voice', __name__, url_prefix='/api/v1')

@voice.route('/voice', methods=['POST'])
def api_voice():
    try:
        data = request.json or {}
        text = data.get('query', '').lower()
        
        # Simple string processing parsing logic paths
        if "weather" in text or "vanilai" in text or "mazhai" in text:
            weather = get_weather("Madurai")
            response = f"Madurai il {weather['temperature']} degree Celsius matrum {weather['rainfall']}mm mazhai ullathu."
        elif "market" in text or "price" in text or "vilai" in text:
            markets = get_market_prices()
            response = f"Sandhai vilai updates: Tomato vilai atigarithulladhu."
        else:
            response = "Enna udhavi thevai? Vanilai, allathu sandhai vilai patri kelungal."
            
        return jsonify({
            "status": "success", 
            "data": {
                "tamil_answer": response
            }
        }), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
