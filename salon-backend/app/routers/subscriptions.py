from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..database import supabase_admin
from ..dependencies import get_current_user_with_profile, require_role
from ..schemas.schemas import SubscriptionPlan, SalonSubscription, SubscriptionEntitlements

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])

@router.get("/plans", response_model=List[SubscriptionPlan])
def get_active_plans():
    """Retrieve all active subscription plans sorted by sort_order."""
    res = supabase_admin.table("subscription_plans") \
        .select("*") \
        .eq("is_active", True) \
        .order("sort_order") \
        .execute()
    return res.data

@router.get("/me", response_model=SalonSubscription)
def get_my_subscription(
    user: dict = Depends(require_role('salon_owner'))
):
    """Retrieve the subscription for the authenticated user's salon."""
    salon_id = user.get("db_salon_id")
    if not salon_id:
        raise HTTPException(status_code=403, detail="Salon ID not found for owner")
    
    res = supabase_admin.table("subscriptions") \
        .select("*") \
        .eq("salon_id", salon_id) \
        .in_("status", ["trialing", "active", "past_due", "cancelled"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No active subscription found")
        
    return res.data[0]

@router.get("/entitlements", response_model=SubscriptionEntitlements)
def get_my_entitlements(
    user: dict = Depends(require_role('salon_owner'))
):
    """Retrieve the limits and entitlements for the authenticated user's salon."""
    salon_id = user.get("db_salon_id")
    if not salon_id:
        raise HTTPException(status_code=403, detail="Salon ID not found for owner")
    
    # We join subscriptions and subscription_plans
    res = supabase_admin.table("subscriptions") \
        .select("status, plan:subscription_plans(name, max_workers, max_services, max_monthly_tokens, max_advertisements)") \
        .eq("salon_id", salon_id) \
        .in_("status", ["trialing", "active", "past_due"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No active subscription found")
        
    sub = res.data[0]
    plan = sub.get("plan", {})
    
    return {
        "plan_name": plan.get("name", "Unknown Plan"),
        "status": sub.get("status"),
        "max_workers": plan.get("max_workers"),
        "max_services": plan.get("max_services"),
        "max_monthly_tokens": plan.get("max_monthly_tokens"),
        "max_advertisements": plan.get("max_advertisements")
    }

@router.get("/all", response_model=List[SalonSubscription])
def get_all_subscriptions(
    user: dict = Depends(require_role('super_admin'))
):
    """Super Admin ONLY: Retrieve all subscriptions."""
    res = supabase_admin.table("subscriptions") \
        .select("*") \
        .order("created_at", desc=True) \
        .execute()
    return res.data
