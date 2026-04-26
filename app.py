from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
log = logging.getLogger('smartfarm')

app = Flask(__name__)
CORS(app)

# ── Helpers ────────────────────────────────────────────────────────────────────

def ok(data, message='ok'):
    """Standard success envelope: { status, data, message }"""
    return jsonify({'status': 'success', 'data': data, 'message': message})

def err(message, code=400):
    """Standard error envelope."""
    return jsonify({'status': 'error', 'data': None, 'message': message}), code

# ── Core Routes ────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception:
        return jsonify({'status': 'ok', 'message': 'SmartFarm AI Flask backend running'}), 200

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/health')
def health():
    return ok({'service': 'flask', 'version': '1.0'}, 'healthy')

@app.route('/favicon.ico')
def favicon():
    return '', 204

# ── ML Prediction ──────────────────────────────────────────────────────────────

@app.route('/api/v1/predict', methods=['POST'])
def predict():
    body = request.get_json(silent=True) or {}

    try:
        income   = float(body.get('income',   0))
        expenses = float(body.get('expenses', 0))
    except (TypeError, ValueError):
        return err('income and expenses must be numbers')

    profit = round(income - expenses, 2)
    risk   = 'Low' if profit > 0 else 'High'

    recommendation = (
        'Market conditions look stable. Consider expanding crop variety.'
        if profit > 0 else
        'Expenses exceed income. Reduce costs or diversify revenue.'
    )

    result = {
        'profit':         profit,
        'risk':           risk,
        'recommendation': recommendation,
        'income':         income,
        'expenses':       expenses,
    }

    log.info(f'[predict] income={income} expenses={expenses} profit={profit} risk={risk}')
    return ok(result, 'Prediction generated successfully')

# ── Weather ───────────────────────────────────────────────────────────────────

@app.route('/api/v1/weather', methods=['GET'])
def weather():
    city = request.args.get('city', 'Madurai')
    # Mock data — swap for real API call when ready
    data = {
        'city':        city,
        'temperature': 32,
        'rainfall':    15,
        'humidity':    68,
        'risk':        'Medium',
        'advisory':    'Irrigation recommended in the next 3 days.',
    }
    log.info(f'[weather] city={city}')
    return ok(data, 'Weather data fetched')

# ── Market Prices ──────────────────────────────────────────────────────────────

@app.route('/api/v1/market-prices', methods=['GET'])
def market_prices():
    data = [
        {'commodity': 'Tomato',   'modal_price': 2800, 'unit': 'per quintal', 'trend': 'Up'},
        {'commodity': 'Onion',    'modal_price': 1500, 'unit': 'per quintal', 'trend': 'Down'},
        {'commodity': 'Rice',     'modal_price': 3200, 'unit': 'per quintal', 'trend': 'Stable'},
        {'commodity': 'Cotton',   'modal_price': 6500, 'unit': 'per quintal', 'trend': 'Up'},
        {'commodity': 'Turmeric', 'modal_price': 9000, 'unit': 'per quintal', 'trend': 'Up'},
    ]
    return ok(data, 'Market prices fetched')

# ── Global Error Handler ───────────────────────────────────────────────────────

@app.errorhandler(Exception)
def handle_error(e):
    log.error(f'Unhandled error: {e}')
    return err(str(e), 500)

# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
