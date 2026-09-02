from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.dependencies import get_current_user_with_profile, require_role
from app.database import supabase_admin
from app.schemas.schemas import BillingCheckoutRequest, BillingCheckoutResponse
from app.config import settings
import razorpay
import logging
from app.limiter import limiter

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = logging.getLogger(__name__)

# Initialize Razorpay Client lazily or handle missing keys
def get_razorpay_client():
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=503,
            detail="Payment provider is not configured on the server. Contact the platform admin."
        )
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

@router.post("/checkout", response_model=BillingCheckoutResponse)
@limiter.limit("20/minute")
def create_checkout(
    request: Request,
    payload: BillingCheckoutRequest,
    user: dict = Depends(require_role("salon_owner"))
):
    salon_id = user["db_salon_id"]
    if not salon_id:
        raise HTTPException(status_code=403, detail="Salon ownership required.")

    # 1. Prevent duplicate active subscriptions
    existing_sub = supabase_admin.table("subscriptions").select("id, status").eq("salon_id", salon_id).in_("status", ["trialing", "active", "past_due"]).execute()
    if existing_sub.data:
        raise HTTPException(status_code=400, detail="Salon already has an active subscription.")

    # 2. Retrieve authoritative plan
    plan_resp = supabase_admin.table("subscription_plans").select("*").eq("id", str(payload.plan_id)).execute()
    if not plan_resp.data:
        raise HTTPException(status_code=404, detail="Plan not found.")
    
    plan = plan_resp.data[0]
    if not plan.get("is_active"):
        raise HTTPException(status_code=400, detail="Plan is no longer active.")

    # 3. Guard: free plans don't go through Razorpay
    if plan.get("price", 0) == 0:
        raise HTTPException(status_code=400, detail="Free plans do not require payment checkout.")

    provider_plan_id = plan.get("provider_plan_id")
    if not provider_plan_id:
        logger.error(f"Plan {plan['id']} ({plan['name']}) has no provider_plan_id in the DB. Run migration 020.")
        raise HTTPException(
            status_code=400,
            detail="Plan is not yet mapped to the payment provider. Please contact support."
        )

    # 4. Billing customer lookup (reserved for future customer-level tracking)
    supabase_admin.table("billing_customers").select("id").eq("salon_id", salon_id).execute()
    
    client = get_razorpay_client()
    try:
        # 4. Create Razorpay Subscription
        sub_data = {
            "plan_id": provider_plan_id,
            "total_count": 12, # E.g., 12 billing cycles
            "customer_notify": 1,
            "notes": {
                "salon_id": salon_id
            }
        }
        
        rzp_sub = client.subscription.create(sub_data)
        
        # 5. Persist provider ID in local subscriptions (in 'trialing' state until webhook)
        new_sub = {
            "salon_id": salon_id,
            "plan_id": str(payload.plan_id),
            "status": "trialing",
            "provider_subscription_id": rzp_sub["id"]
        }
        supabase_admin.table("subscriptions").insert(new_sub).execute()
        
        return BillingCheckoutResponse(
            provider_order_id=rzp_sub["id"],
            razorpay_key_id=settings.razorpay_key_id,
            amount=int(plan["price"] * 100), # Not strictly needed for Subscription checkout frontend, but returned
            currency=plan["currency"]
        )
    except razorpay.errors.BadRequestError as e:
        logger.error(f"Razorpay bad request: {e}")
        raise HTTPException(status_code=400, detail=f"Payment provider rejected the request: {str(e)}")
    except razorpay.errors.ServerError as e:
        logger.error(f"Razorpay server error: {e}")
        raise HTTPException(status_code=503, detail="Payment provider temporarily unavailable. Please try again.")
    except Exception as e:
        logger.exception("Razorpay checkout unexpected error")
        raise HTTPException(status_code=500, detail=f"Unable to start subscription checkout: {str(e)}")
