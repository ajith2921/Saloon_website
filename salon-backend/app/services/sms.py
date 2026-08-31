import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from ..config import settings

logger = logging.getLogger(__name__)

def send_sms_notification(to_phone: str, message: str) -> bool:
    """
    Sends an SMS notification using Twilio.
    Returns True if successful, False otherwise.
    """
    if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_phone_number:
        logger.warning("Twilio configuration is missing. SMS not sent.")
        return False

    if not to_phone:
        logger.warning("No phone number provided for SMS notification.")
        return False

    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message_obj = client.messages.create(
            body=message,
            from_=settings.twilio_phone_number,
            to=to_phone
        )
        logger.info(f"SMS sent successfully. SID: {message_obj.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"Twilio error: {e.msg}")
        return False
    except Exception as e:
        logger.error(f"Failed to send SMS: {str(e)}")
        return False
