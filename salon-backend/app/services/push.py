import os
import json
import logging
from pywebpush import webpush, WebPushException
from ..database import supabase_admin

logger = logging.getLogger(__name__)

# Try to get VAPID keys from env, or use a hardcoded dev pair for now.
# In production, these should be securely stored in the environment.
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "b40eTzY9y2h4z0yRj9xZ8yWwG7tT5bE5eD7cI5rY2hE=")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "BG9g0z-4i4b0M7v4y2h4z0yRj9xZ8yWwG7tT5bE5eD7cI5rY2hE_r_F-mY2h4z0yRj9xZ8yWwG7tT5bE5eD7cI5rY2hE=")
VAPID_CLAIMS = {
    "sub": "mailto:admin@saloon.com"
}

def send_push_notification(customer_id: str, title: str, body: str, url: str = "/"):
    """
    Looks up all push subscriptions for a customer and sends them a notification.
    """
    res = supabase_admin.table("push_subscriptions").select("*").eq("customer_id", customer_id).execute()
    subs = res.data or []
    
    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url
    })
    
    stale_endpoints = []
    
    for sub in subs:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"]
            }
        }
        
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
        except WebPushException as ex:
            logger.error(f"Web Push failed for {sub['endpoint']}: {repr(ex)}")
            # If the subscription is expired/invalid (404, 410), we should remove it
            if ex.response and ex.response.status_code in [404, 410]:
                stale_endpoints.append(sub["endpoint"])
        except Exception as ex:
            logger.error(f"Unexpected error sending push: {repr(ex)}")

    # Clean up stale subscriptions
    if stale_endpoints:
        supabase_admin.table("push_subscriptions").delete().in_("endpoint", stale_endpoints).execute()
