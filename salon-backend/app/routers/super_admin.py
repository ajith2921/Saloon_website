from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from ..dependencies import require_role
from ..database import supabase_admin

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])


@router.get("/stats")
def get_platform_stats(user: dict = Depends(require_role("super_admin"))):
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

    # Tokens issued today (all salons)
    from datetime import date
    today_str = str(date.today())
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
def get_all_salons(user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons") \
        .select("*, profiles!owner_id(full_name)") \
        .order("created_at", desc=True) \
        .execute()
    salons = res.data or []
    return {"salons": _enrich_with_owner_emails(salons)}


@router.get("/salons/pending")
def get_pending_salons(user: dict = Depends(require_role("super_admin"))):
    """Returns only pending salons for the dashboard approval widget."""
    res = supabase_admin.table("salons") \
        .select("id, name, city, created_at, owner_id, profiles!owner_id(full_name)") \
        .eq("status", "pending") \
        .order("created_at", desc=True) \
        .limit(5) \
        .execute()
    salons = res.data or []
    return {"salons": _enrich_with_owner_emails(salons)}


@router.post("/salons/{salon_id}/approve")
def approve_salon(salon_id: UUID, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons").update({"status": "active"}).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    return {"status": "success", "salon": res.data[0]}


@router.post("/salons/{salon_id}/suspend")
def suspend_salon(salon_id: UUID, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("salons").update({"status": "suspended"}).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    return {"status": "success", "salon": res.data[0]}
