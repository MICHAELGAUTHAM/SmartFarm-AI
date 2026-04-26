import os
import logging
from twilio.rest import Client

logger = logging.getLogger('SmartFarm_AI.Twilio')

def send_b2b_alert(phone, alert_type, message):
    try:
        account_sid = os.getenv('TWILIO_SID')
        auth_token = os.getenv('TWILIO_TOKEN')
        from_number = os.getenv('TWILIO_PHONE_NUMBER', '+1234567890')
        
        is_mock = not account_sid or "mock" in account_sid.lower()
            
        if is_mock:
            logger.info(f"SMS Simulated natively: [{alert_type.upper()}] TO: {phone} MSG: {message}")
            return True
            
        client = Client(account_sid, auth_token)
        msg_payload = f"SmartFarm SaaS Alert ({alert_type}): {message}"
        
        msg = client.messages.create(
            body=msg_payload,
            from_=from_number,
            to=phone
        )
        logger.info(f"Twilio active message dispatched cleanly. SID: {msg.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to transmit B2B Twilio Notification: {str(e)}")
        return False
