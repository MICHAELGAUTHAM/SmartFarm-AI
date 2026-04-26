from flask import Blueprint, jsonify, session
from app import db, User, Prediction

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/', methods=['GET'])
def admin_dashboard():
    # Assume generic Admin Authentication mechanism handled beforehand securely
    try:
        total_users = User.query.count()
        total_preds = Prediction.query.count()
        
        # Calculate revenue natively tracking active tiers cleanly
        paid_users = User.query.filter(User.plan_type.in_(['Pro', 'Enterprise'])).count()
        pro_count = User.query.filter_by(plan_type='Pro').count()
        enterprise_count = User.query.filter_by(plan_type='Enterprise').count()
        
        # Mock calculation: Pro=$50, Enterprise=$500
        monthly_revenue = (pro_count * 50) + (enterprise_count * 500)
        
        # Conversion Tracking Architecture natively tracking sequences securely
        users_with_preds = User.query.join(Prediction).distinct().count()
        activation_rate = round((users_with_preds / total_users * 100), 2) if total_users > 0 else 0
        conversion_rate = round((paid_users / users_with_preds * 100), 2) if users_with_preds > 0 else 0
        
        html_content = f"""
        <html>
            <head><title>Admin SaaS Metrics</title>
            <style>
                body {{ font-family: 'Inter', Arial, sans-serif; padding: 40px; background: #fdfdfd; }}
                h1 {{ color: #2c3e50; border-bottom: 2px solid #ccc; }}
                .stat-box {{ padding: 20px; background: white; border: 1px solid #ccc; margin-top: 10px; border-radius: 8px; width: 300px; display: inline-block; margin-right: 15px; margin-bottom:15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }}
            </style>
            </head>
            <body>
                <h1>SmartFarm Enterprise Analytics</h1>
                <h3>Growth Metrics</h3>
                <div class="stat-box">
                    <h3 style="color:#7f8c8d;">Total Platform Users</h3>
                    <h1>{total_users}</h1>
                </div>
                <div class="stat-box">
                    <h3 style="color:#7f8c8d;">ML APIs Processed</h3>
                    <h1>{total_preds}</h1>
                </div>
                <div class="stat-box">
                    <h3 style="color:#7f8c8d;">Monthly Recurring Revenue</h3>
                    <h1 style="color: #27ae60;">${monthly_revenue}</h1>
                </div>
                
                <h3>Funnel Conversion Tracking</h3>
                <div class="stat-box">
                    <h3 style="color:#7f8c8d;">Activation Rate</h3>
                    <h1>{activation_rate}%</h1>
                    <p style="font-size:12px; color:#999;">Signup &rarr; First Prediction</p>
                </div>
                <div class="stat-box">
                    <h3 style="color:#7f8c8d;">Paid Conversion</h3>
                    <h1>{conversion_rate}%</h1>
                    <p style="font-size:12px; color:#999;">Active &rarr; Upgraded</p>
                </div>
            </body>
        </html>
        """
        return html_content, 200
    except Exception as e:
        return jsonify({"status": "error", "message": "Failed generating Admin Dashboard metrics.", "trace": str(e)}), 500
