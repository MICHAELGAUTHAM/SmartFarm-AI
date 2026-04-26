import stripe
import os
import logging
from flask import Blueprint, jsonify, request, session, redirect
from app import db, User

logger = logging.getLogger('SmartFarm_AI.Billing')
billing_bp = Blueprint('billing', __name__, url_prefix='/billing')

def get_stripe_key():
    return os.getenv('STRIPE_SECRET_KEY', 'sk_test_mocked_for_development')

@billing_bp.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    data = request.json or {}
    plan = data.get('plan', 'Pro')
    
    if plan not in ['Pro', 'Enterprise']:
        return jsonify({"status": "error", "message": "Invalid plan selected"}), 400
        
    stripe.api_key = get_stripe_key()
    
    try:
        # Utilizing standard B2B mockup price strings handling OS Environment constraints securely
        price_id = os.getenv(f'STRIPE_PRICE_{plan.upper()}', 'price_1MockId')
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{ 'price': price_id, 'quantity': 1 }],
            mode='subscription',
            success_url=request.host_url + f"billing/success?plan={plan}",
            cancel_url=request.host_url + "billing/cancel",
            metadata={'user_id': user_id, 'plan': plan}
        )
        logger.info(f"Stripe Checkout initiated sequentially for user {user_id}")
        return jsonify({"status": "success", "url": checkout_session.url})
    except Exception as e:
        logger.error(f"Stripe Session Generation Error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@billing_bp.route('/success', methods=['GET'])
def billing_success():
    user_id = session.get('user_id')
    target_plan = request.args.get('plan', 'Pro')
    
    if user_id:
        user = User.query.get(user_id)
        if user:
            user.plan_type = target_plan
            db.session.commit()
            logger.info(f"User {user.email} successfully upgraded to {target_plan} Tier.")
            
    return redirect('/dashboard')

@billing_bp.route('/cancel', methods=['GET'])
def billing_cancel():
    return redirect('/dashboard')
