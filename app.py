from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# ── Core Routes ────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/favicon.ico')
def favicon():
    return '', 204

# ── Prediction API ─────────────────────────────────────────────────────────────

@app.route('/api/v1/predict', methods=['POST'])
def predict():
    data = request.get_json(silent=True) or {}
    income   = float(data.get('income',   0))
    expenses = float(data.get('expenses', 0))

    profit = income - expenses
    if profit > 0:
        risk           = 'Low'
        recommendation = 'Market conditions look stable. Consider expanding crop variety.'
    else:
        risk           = 'High'
        recommendation = 'Expenses exceed income. Reduce costs or diversify revenue.'

    return jsonify({
        "status": "success",
        "prediction": {
            "profit":         round(profit, 2),
            "risk":           risk,
            "recommendation": recommendation
        }
    })

# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
