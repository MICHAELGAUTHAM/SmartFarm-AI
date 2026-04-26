from flask import Blueprint, jsonify, request, session
from datetime import datetime, date
from services.ml_service import predict_farmer
from services.weather_service import get_weather
from services.market_service import get_market_prices
import logging

logger = logging.getLogger("SmartFarm_AI_Routes")

api = Blueprint('api', __name__, url_prefix='/api/v1')

def standard_response(status, data=None, message=""):
    return jsonify({
        "status": status,
        "data": data or {},
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

@api.route('/predict', methods=['POST'])
def api_predict():
    data = request.json or {}
    income = data.get('income', 5000)
    expenses = data.get('expenses', 2000)
    city = data.get('city', 'Madurai')

    if income is None or expenses is None:
        return standard_response("error", message="Invalid input parameters."), 400

    # Run ML prediction (always works, no DB needed)
    weather = get_weather(city)
    markets = get_market_prices()
    result = predict_farmer(income, expenses, weather, markets)

    # Resolve user identity (session or Bearer token)
    user_id = session.get('user_id')
    user = None

    try:
        from app import db, Prediction, User

        if not user_id:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                key = auth_header.split(' ')[1]
                user = User.query.filter_by(api_key=key).first()
                if user:
                    user_id = user.id

        if user_id and not user:
            user = User.query.get(user_id)

        # If authenticated, enforce rate limits and persist
        if user:
            today = date.today()
            daily_count = Prediction.query.filter(
                Prediction.user_id == user_id,
                db.func.date(Prediction.created_at) == today
            ).count()

            limit = 20
            if user.plan_type == 'Pro': limit = 200
            elif user.plan_type == 'Enterprise': limit = float('inf')

            if daily_count >= limit:
                logger.warning(f"Rate limit reached: User {user.id} ({user.plan_type})")
                return standard_response("error", message=f"Daily limit reached for {user.plan_type} plan."), 429

            pred_record = Prediction(user_id=user_id, risk_score=result['risk_score'], profit=result['profit'])
            db.session.add(pred_record)
            db.session.commit()
            logger.info(f"Prediction saved: User={user.email}, Tier={user.plan_type}")

    except Exception as e:
        # DB unavailable — still return prediction, just skip persistence
        logger.warning(f"DB write skipped (demo mode): {str(e)}")

    return standard_response("success", data=result, message="Prediction generated successfully."), 201

@api.route('/export', methods=['GET'])
def api_export():
    user_id = session.get('user_id')
    try:
        from app import Prediction
        if user_id:
            history = Prediction.query.filter_by(user_id=user_id).order_by(Prediction.created_at.desc()).all()
        else:
            history = []
        csv_data = "Prediction_ID,Risk_Score,Profit,Timestamp\n"
        for p in history:
            csv_data += f"{p.id},{p.risk_score},{p.profit},{p.created_at.isoformat()}\n"
    except Exception:
        csv_data = "Prediction_ID,Risk_Score,Profit,Timestamp\n"
    return jsonify({"status": "success", "data": {"csv_content": csv_data}, "message": "Export compiled."}), 200

@api.route('/history', methods=['GET'])
def api_history():
    user_id = session.get('user_id')
    try:
        from app import Prediction
        if user_id:
            history = Prediction.query.filter_by(user_id=user_id).order_by(Prediction.created_at.desc()).limit(10).all()
            history_list = [{"id": p.id, "risk_score": p.risk_score, "profit": p.profit, "created_at": p.created_at.isoformat()} for p in history]
        else:
            history_list = []
        return standard_response("success", data={"history": history_list}, message="History loaded."), 200
    except Exception:
        return standard_response("success", data={"history": []}, message="No history available (demo mode)."), 200

@api.route('/feedback', methods=['POST'])
def api_feedback():
    user_id = session.get('user_id')
    data = request.json or {}
    message = data.get('message', '')
    
    if not message:
        return standard_response("error", message="Feedback message cannot be empty."), 400
        
    try:
        from app import db, Feedback
        new_feedback = Feedback(user_id=user_id, message=message)
        db.session.add(new_feedback)
        db.session.commit()
        return standard_response("success", message="Feedback stored cleanly. Thank you!"), 201
    except Exception as e:
        return standard_response("error", message="System failed parsing feedback metric internally."), 500

@api.route('/profile', methods=['GET'])
def api_profile():
    user_id = session.get('user_id')
    try:
        from app import User, Prediction
        if user_id:
            user = User.query.get(user_id)
            if user:
                pred_count = Prediction.query.filter_by(user_id=user.id).count()
                payload = {"name": user.name, "email": user.email, "plan": user.plan_type, "total_predictions": pred_count}
                return standard_response("success", data=payload, message="Profile loaded."), 200
    except Exception:
        pass
    # Demo fallback for unauthenticated or DB-unavailable
    payload = {"name": "Demo User", "email": "demo@smartfarm.ai", "plan": "Free", "total_predictions": 0}
    return standard_response("success", data=payload, message="Demo profile."), 200

@api.route('/weather', methods=['GET'])
def api_weather():
    try:
        city = request.args.get('city', 'Madurai')
        weather = get_weather(city)
        return standard_response("success", data=weather, message="Weather fetch successful."), 200
    except Exception as e:
        return standard_response("error", message="Weather tracking failed natively."), 500

@api.route('/market-prices', methods=['GET'])
def api_market():
    try:
        markets = get_market_prices()
        return standard_response("success", data=markets, message="Market prices returned seamlessly."), 200
    except Exception as e:
        return standard_response("error", message="System routing market values mapped failed."), 500
