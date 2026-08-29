from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from typing import Optional
from ..dependencies import require_role
from ..database import supabase_admin
from ..limiter import limiter
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])


@router.get("/stats")
@limiter.limit("30/minute")
def get_platform_stats(request: Request, user: dict = Depends(require_role("super_admin"))):
    """Real platform-wide aggregate stats from the DB."""

    # All salons breakdown
    salons_res = supabase_admin.table("salons").select("id, status").execute()
    all_salons = salons_res.data or []
    total_salons = len(all_salons)
    active_salons = sum(1 for s in all_salons if s["status"] == "active")
    pending_salons = sum(1 for s in all_salons if s["status"] == "pending")

    # Total customer profiles
    customers_res = supabase_admin.table("profiles") \
        .select("id", count="exact") \
        .eq("role", "customer") \
        .execute()
    total_customers = customers_res.count or 0

    # Tokens issued today (all salons, UTC day boundary for global metrics)
    from datetime import datetime, timezone
    today_str = datetime.now(timezone.utc).date().isoformat()
    tokens_res = supabase_admin.table("tokens") \
        .select("id", count="exact") \
        .eq("date", today_str) \
        .execute()
    total_tokens_today = tokens_res.count or 0

    # Platform revenue this month (sum of service prices for completed tokens)
    from datetime import date
    month_start = str(date.today().replace(day=1))
    completed_res = supabase_admin.table("tokens") \
        .select("services(price)") \
        .eq("status", "completed") \
        .gte("date", month_start) \
        .execute()
    platform_revenue_month = sum(
        float(t["services"]["price"])
        for t in (completed_res.data or [])
        if t.get("services") and t["services"].get("price")
    )

    return {
        "total_salons": total_salons,
        "active_salons": active_salons,
        "pending_approvals": pending_salons,
        "total_customers": total_customers,
        "total_tokens_today": total_tokens_today,
        "platform_revenue_month": round(platform_revenue_month, 2),
    }


def _enrich_with_owner_emails(salons: list) -> list:
    owner_emails = {}
    for salon in salons:
        owner_id = salon.get("owner_id")
        if not owner_id:
            continue
            
        if owner_id not in owner_emails:
            try:
                auth_user = supabase_admin.auth.admin.get_user_by_id(str(owner_id))
                owner_emails[owner_id] = auth_user.user.email if auth_user and auth_user.user else None
            except Exception:
                owner_emails[owner_id] = None
                
        if "profiles" in salon and isinstance(salon["profiles"], dict):
            salon["profiles"]["email"] = owner_emails[owner_id]
            
    return salons


@router.get("/salons")
@limiter.limit("30/minute")
def get_all_salons(request: Request, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons") \
        .select("*, profiles!owner_id(full_name)") \
        .order("created_at", desc=True) \
        .execute()
    salons = res.data or []
    return {"salons": _enrich_with_owner_emails(salons)}


@router.get("/salons/pending")
@limiter.limit("30/minute")
def get_pending_salons(request: Request, user: dict = Depends(require_role("super_admin"))):
    """Returns only pending salons for the dashboard approval widget."""
    res = supabase_admin.table("salons") \
        .select("id, name, city, created_at, owner_id, profiles!owner_id(full_name)") \
        .eq("status", "pending") \
        .order("created_at", desc=True) \
        .limit(5) \
        .execute()
    salons = res.data or []
    return {"salons": _enrich_with_owner_emails(salons)}


def _log_audit(actor_id: str, action: str, target_id: str, target_type: str, metadata: dict = None):
    """Safely log audit entries without crashing core operations if audit table permissions are restricted."""
    try:
        supabase_admin.table("super_admin_audit_logs").insert({
            "actor_id": actor_id,
            "action": action,
            "target_id": str(target_id),
            "target_type": target_type,
            "metadata": metadata or {}
        }).execute()
    except Exception as e:
        logger.warning(f"Audit log recording skipped: {e}")


@router.post("/salons/{salon_id}/approve")
@limiter.limit("20/minute")
def approve_salon(request: Request, salon_id: UUID, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons").update({"status": "active"}).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    actor_id = user.get("sub")
    _log_audit(actor_id, "APPROVE_SALON", str(salon_id), "salon")
    return {"status": "success", "salon": res.data[0]}


@router.post("/salons/{salon_id}/suspend")
@limiter.limit("20/minute")
def suspend_salon(request: Request, salon_id: UUID, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons").update({"status": "suspended"}).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    actor_id = user.get("sub")
    _log_audit(actor_id, "SUSPEND_SALON", str(salon_id), "salon")
    return {"status": "success", "salon": res.data[0]}


@router.post("/salons/{salon_id}/reactivate")
@limiter.limit("20/minute")
def reactivate_salon(request: Request, salon_id: UUID, user: dict = Depends(require_role("super_admin"))):
    """Reactivate a previously suspended salon."""
    res = supabase_admin.table("salons").update({"status": "active"}).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    actor_id = user.get("sub")
    _log_audit(actor_id, "REACTIVATE_SALON", str(salon_id), "salon")
    return {"status": "success", "salon": res.data[0]}


@router.get("/audit-logs")
@limiter.limit("30/minute")
def get_audit_logs(
    request: Request,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: dict = Depends(require_role("super_admin")),
):
    """Returns immutable audit log of all Super Admin actions."""
    try:
        res = supabase_admin.table("super_admin_audit_logs") \
            .select("*, profiles!actor_id(full_name)") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
        return {"logs": res.data or []}
    except Exception as e:
        logger.warning(f"Failed to query audit logs: {e}")
        return {"logs": []}


@router.get("/users")
@limiter.limit("30/minute")
def get_all_users(
    request: Request,
    role: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: dict = Depends(require_role("super_admin")),
):
    """Returns platform users. Optionally filter by role. Never returns passwords or tokens."""
    query = supabase_admin.table("profiles").select(
        "id, full_name, phone, role, loyalty_points, created_at"
    )
    if role:
        query = query.eq("role", role)
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"users": res.data or []}


from pydantic import BaseModel

class GrantSubscriptionRequest(BaseModel):
    plan_id: UUID

@router.post("/salons/{salon_id}/grant-subscription")
@limiter.limit("20/minute")
def grant_subscription(
    request: Request, 
    salon_id: UUID, 
    payload: GrantSubscriptionRequest, 
    user: dict = Depends(require_role("super_admin"))
):
    """Bypass billing and manually assign an active subscription to a salon."""
    # 1. Mark any existing subscriptions for this salon as cancelled
    supabase_admin.table("subscriptions").update({"status": "cancelled"}).eq("salon_id", str(salon_id)).neq("status", "cancelled").execute()
    
    # 2. Insert new active subscription
    new_sub = {
        "salon_id": str(salon_id),
        "plan_id": str(payload.plan_id),
        "status": "active",
        "provider_subscription_id": f"sa_granted_{uuid4().hex[:16]}"
    }
    res = supabase_admin.table("subscriptions").insert(new_sub).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to grant subscription")
        
    actor_id = user.get("sub")
    _log_audit(actor_id, "GRANT_SUBSCRIPTION", str(salon_id), "salon", {"plan_id": str(payload.plan_id)})
    
    return {"status": "success", "subscription": res.data[0]}


class UpdateTokenLimitRequest(BaseModel):
    new_limit: int

@router.post("/salons/{salon_id}/update-token-limit")
@limiter.limit("20/minute")
def update_token_limit(
    request: Request, 
    salon_id: UUID, 
    payload: UpdateTokenLimitRequest, 
    user: dict = Depends(require_role("super_admin"))
):
    """Manually override the max_daily_tokens for a salon."""
    if payload.new_limit < 1:
        raise HTTPException(status_code=400, detail="Token limit must be at least 1")
        
    res = supabase_admin.table("salons").update({"max_daily_tokens": payload.new_limit}).eq("id", str(salon_id)).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
        
    actor_id = user.get("sub")
    _log_audit(actor_id, "UPDATE_TOKEN_LIMIT", str(salon_id), "salon", {"new_limit": payload.new_limit})
    
    return {"status": "success", "salon": res.data[0]}


