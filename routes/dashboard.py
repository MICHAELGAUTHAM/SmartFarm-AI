from flask import Blueprint, jsonify, session, redirect, render_template

dashboard = Blueprint('dashboard', __name__)

@dashboard.route('/dashboard', methods=['GET'])
def render_dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
    try:
        return render_template('dashboard.html')
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
