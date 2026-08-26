from fastapi import APIRouter, Request, HTTPException, Depends
from app.database import supabase_admin
from app.config import settings
import razorpay
import logging
import json
from typing import Dict, Any
from uuid import UUID

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

def get_razorpay_client():
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return None
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing signature")

    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Provider not configured")

    try:
        # 1. Verify signature
        client.utility.verify_webhook_signature(
            payload.decode("utf-8"),
            signature,
            settings.razorpay_webhook_secret
        )
    except razorpay.errors.SignatureVerificationError:
        logger.warning("Invalid Razorpay webhook signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Bad request")

    # Parse JSON from bytes after verification
    data = json.loads(payload)
    event_id = data.get("event_id", data.get("id")) # Razorpay webhooks send an event ID
    event_type = data.get("event")

    if not event_id or not event_type:
        return {"status": "ok"} # Ignore malformed safe payloads

    # 2. Check Idempotency
    # Try inserting the event ID. If it fails due to UNIQUE constraint, it's a duplicate.
    try:
        # 3. Find mapping for subscription
        # Depending on event type, the subscription ID is nested differently.
        # Generally, it's inside payload.subscription.entity.id
        sub_entity = data.get("payload", {}).get("subscription", {}).get("entity", {})
        provider_sub_id = sub_entity.get("id")
        
        if not provider_sub_id:
            # Not a subscription event we care about
            return {"status": "ok"}

        # Look up internal subscription by provider_subscription_id
        db_sub_resp = supabase_admin.table("subscriptions").select("id, salon_id").eq("provider_subscription_id", provider_sub_id).execute()
        if not db_sub_resp.data:
            # We don't know this subscription. Ignore safely.
            return {"status": "ok"}
        
        internal_sub = db_sub_resp.data[0]
        salon_id = internal_sub["salon_id"]
        sub_id = internal_sub["id"]

        # Log payment transaction (Idempotency bound)
        tx_data = {
            "salon_id": salon_id,
            "subscription_id": sub_id,
            "provider": "razorpay",
            "provider_event_id": event_id,
            "event_type": event_type,
            "status": "processed",
            "amount": 0, # Should be extracted from payment entity if relevant
            "currency": "INR"
        }
        
        # If this insert fails, it means we already processed this provider_event_id
        tx_resp = supabase_admin.table("payment_transactions").insert(tx_data).execute()

        # 4. State Machine Transition
        if event_type == "subscription.charged":
            # Upgrade to active
            supabase_admin.table("subscriptions").update({"status": "active"}).eq("id", sub_id).execute()
        elif event_type in ["subscription.halted", "invoice.payment_failed"]:
            supabase_admin.table("subscriptions").update({"status": "past_due"}).eq("id", sub_id).execute()
        elif event_type == "subscription.cancelled":
            supabase_admin.table("subscriptions").update({"status": "cancelled"}).eq("id", sub_id).execute()

    except Exception as e:
        # Check if it was an idempotency conflict
        if "duplicate key value violates unique constraint" in str(e).lower():
            return {"status": "idempotent_ok"}
        logger.error(f"Webhook processing error: {e}")
        # Return 200 so provider stops retrying if it's an unrecoverable internal logic error we want to swallow,
        # but for DB errors, maybe let it retry. Let's return 500 for non-idempotent DB errors.
        raise HTTPException(status_code=500, detail="Processing error")

    return {"status": "ok"}
