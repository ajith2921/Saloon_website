from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date

from ..database import supabase_admin
from ..dependencies import get_current_user_with_profile, require_salon_access, get_current_user

router = APIRouter(prefix="/api/salons", tags=["Salons"])


# ──────────────────────────────────────────────────────────
# Public routes (no auth required)
# ──────────────────────────────────────────────────────────

@router.get("")
def get_salons(status: Optional[str] = Query(None), limit: Optional[int] = Query(50), offset: Optional[int] = Query(0)):
    # Public discovery must never expose pending or suspended salons.
    query = supabase_admin.table("salons").select("*").eq("status", "active")
    res = query.range(offset, offset + limit - 1).execute()
    return res.data


@router.get("/{salon_id}/services")
def get_salon_services(salon_id: UUID):
    """Returns services for a salon. Response: { services: [...] }"""
    res = supabase_admin.table("services").select("id, salon_id, name, description, price, duration_minutes, status").eq("salon_id", salon_id).eq("status", "active").order("name").execute()
    return {"services": res.data}


@router.get("/{salon_id}/workers")
def get_salon_workers(salon_id: UUID):
    """Returns workers for a salon. Response: { workers: [...] }"""
    res = supabase_admin.table("workers").select("id, salon_id, name, photo_url, specialization, experience_years, status").eq("salon_id", salon_id).order("name").execute()
    return {"workers": res.data}


@router.get("/{salon_id}/queue/live")
def get_live_queue(salon_id: UUID):
    """Returns today's token list for the public live queue display.

    Deliberately omits customer_id and profile data — public callers (including
    customers viewing queue position) must never receive another customer's identity.
    See /queue/admin for the authenticated owner/worker view with customer names.
    """
    res = supabase_admin.table("tokens").select(
        "id, token_number, status, service_id, worker_id, services(name, duration_minutes), workers(name, photo_url)"
    ).eq("salon_id", salon_id).in_("status", ["waiting", "called", "serving"]).order("token_number").execute()
    return {"tokens": res.data}


@router.get("/{salon_id}/queue/admin")
def get_admin_live_queue(
    salon_id: str,
    user: dict = Depends(get_current_user_with_profile),
):
    """Returns today's full token queue for authenticated salon staff.

    Includes customer display names so the admin QueueManagement panel can
    show who is in the queue.  Authentication and salon-membership are both
    required — customers and staff of other salons are rejected.
    """
    # Allow salon_owner and worker of this salon, plus super_admin.
    require_salon_access(user, salon_id, {"salon_owner", "worker"})

    today = str(date.today())
    res = supabase_admin.table("tokens").select(
        "id, token_number, status, service_id, worker_id, "
        "services(name, duration_minutes), workers(name, photo_url), "
        "profiles!customer_id(full_name)"
    ).eq("salon_id", salon_id).eq("date", today).order("token_number").execute()
    return {"tokens": res.data}


@router.get("/{salon_id}/stats")
def get_salon_stats(salon_id: UUID):
    # Call the new RPC function to compute stats in the database
    res = supabase_admin.rpc("get_salon_stats", {"p_salon_id": str(salon_id)}).execute()
    
    if res.data:
        return res.data

    return {
        "waiting": 0,
        "serving": 0,
        "completed_today": 0,
        "total_today": 0,
        "avg_rating": 0.0,
        "review_count": 0,
    }


@router.get("/mine")
def get_my_salon(user: dict = Depends(get_current_user_with_profile)):
    """Returns the authenticated owner or worker's assigned salon."""
    db_salon_id = user.get("db_salon_id")
    if user.get("db_role") not in ("salon_owner", "worker") or not db_salon_id:
        raise HTTPException(status_code=404, detail="No salon is linked to this account")

    res = supabase_admin.table("salons").select("*").eq("id", db_salon_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="No salon found for this account. Please register a salon first.")
    return res.data[0]


@router.get("/{salon_id}")
def get_salon_by_id(salon_id: UUID):
    res = supabase_admin.table("salons").select("*, profiles!owner_id(full_name)").eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    return res.data[0]


class SalonUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    opening_time: Optional[str] = None   # "HH:MM"
    closing_time: Optional[str] = None   # "HH:MM"
    max_daily_tokens: Optional[int] = None
    avg_service_minutes: Optional[int] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.put("/{salon_id}")
def update_salon(salon_id: UUID, updates: SalonUpdate, user: dict = Depends(get_current_user_with_profile)):
    """Update salon settings. Only the salon owner (or super_admin) can update."""
    require_salon_access(user, salon_id, {"salon_owner"})

    payload = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase_admin.table("salons").update(payload).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    return res.data[0]


@router.get("/{salon_id}/customers")
def get_salon_customers(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    """Returns distinct customers who have had a token at this salon."""
    require_salon_access(user, salon_id, {"salon_owner"})

    # Call the new RPC function to fetch unique customers directly from the DB
    res = supabase_admin.rpc("get_salon_customers", {"p_salon_id": str(salon_id)}).execute()
    
    customers = res.data if res.data else []

    return {"customers": customers}
