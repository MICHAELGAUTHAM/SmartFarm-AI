import os
import logging
from dotenv import load_dotenv
from flask import Flask, jsonify

# Load environmental variables gracefully from .env
load_dotenv()

# Basic log monitoring map
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SmartFarm_AI")

# Flask Instance Init explicitly mapped for Gunicorn worker interception
app = Flask(__name__)

# Global Production Error Handler
@app.errorhandler(Exception)
def handle_global_exceptions(e):
    logger.error(f"Execution Error: {str(e)}")
    return jsonify({
        "status": "error",
        "message": "Something went wrong"
    }), 500

# Basic Routing
@app.route('/', methods=['GET'])
def index():
    return "SmartFarm AI is running"

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok"
    }), 200

# (Architecture stub) To extend this deployment later, register blueprints:
# from routes.api_routes import api_bp
# app.register_blueprint(api_bp)

if __name__ == '__main__':
    logger.info("Initializing local dev server. For production use: gunicorn app:app")
    app.run(host='0.0.0.0', port=5000, debug=False)
