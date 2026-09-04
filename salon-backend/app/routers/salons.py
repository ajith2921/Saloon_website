from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
import re

from ..limiter import limiter
from ..database import supabase_admin
from ..dependencies import get_current_user_with_profile, require_salon_access, get_current_user, evict_profile_cache

# Optional bearer: does NOT raise 403 if Authorization header is absent.
# Used by public routes that grant extra data when authenticated.
optional_bearer = HTTPBearer(auto_error=False)

def get_current_user_with_profile_from_credentials(credentials: HTTPAuthorizationCredentials) -> dict:
    """Helper to resolve profile from explicit credentials (used where auth is optional)."""
    from ..dependencies import get_current_user, get_current_user_with_profile as _gwp
    user = get_current_user(credentials)
    return _gwp(user)

# Reuse the same private-IP validation pattern from schemas
_PRIVATE_IP_RE = re.compile(
    r'^(localhost|127\.\d+\.\d+\.\d+|::1'
    r'|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+'
    r'|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+'
    r'|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)'
)

def _validate_public_url(v: Optional[str]) -> Optional[str]:
    """Validate that URLs for logos/covers use safe protocols."""
    if v is None:
        return v
    v = v.strip()
    if not v.startswith(('https://', 'http://')):
        raise ValueError('URL must use http or https')
    try:
        host = v.split('/')[2].split(':')[0].lower()
    except IndexError:
        raise ValueError('Invalid URL format')
    if _PRIVATE_IP_RE.match(host):
        raise ValueError('URL may not point to a private or loopback address')
    if len(v) > 2048:
        raise ValueError('URL exceeds maximum length')
    return v

router = APIRouter(prefix="/api/salons", tags=["Salons"])


# ──────────────────────────────────────────────────────────
# Public routes (no auth required)
# ──────────────────────────────────────────────────────────

@router.get("")
@limiter.limit("60/minute")
def get_salons(request: Request, status: Optional[str] = Query(None), limit: Optional[int] = Query(50, le=100), offset: Optional[int] = Query(0)):
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

    # Compute today's date in IST (Asia/Kolkata) directly in Python (0ms vs 500ms RPC)
    from datetime import datetime, timezone, timedelta
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist_tz).strftime("%Y-%m-%d")

    res = supabase_admin.table("tokens").select(
        "id, token_number, status, service_id, worker_id, "
        "services(name, duration_minutes), workers(name, photo_url), "
        "profiles!customer_id(full_name)"
    ).eq("salon_id", salon_id).eq("date", today).order("token_number").execute()
    return {"tokens": res.data}


@router.get("/{salon_id}/stats")
def get_salon_stats(salon_id: UUID):
    # Call the RPC function to compute basic live stats
    res = supabase_admin.rpc("get_salon_stats", {"p_salon_id": str(salon_id)}).execute()

    data = res.data if res.data else {
        "waiting": 0, "serving": 0,
        "completed_today": 0, "total_today": 0,
        "avg_rating": 0.0, "review_count": 0,
    }

    # Today's revenue: sum service prices of completed tokens today
    from datetime import date as _date
    today = str(_date.today())
    rev_res = (
        supabase_admin.table("tokens")
        .select("services(price)")
        .eq("salon_id", str(salon_id))
        .eq("status", "completed")
        .eq("date", today)
        .execute()
    )
    today_revenue = sum(
        float((t.get("services") or {}).get("price", 0))
        for t in (rev_res.data or [])
    )

    # Upcoming bookings count: unsupported by current database schema
    upcoming_bookings = 0

    data["today_revenue"] = round(today_revenue, 2)
    data["upcoming_bookings"] = upcoming_bookings
    return data


@router.get("/mine")
def get_my_salon(user: dict = Depends(get_current_user_with_profile)):
    """Returns the authenticated owner or worker's assigned salon.
    NOTE: This route MUST remain before /{salon_id} so FastAPI matches it first.
    """
    db_salon_id = user.get("db_salon_id")
    if user.get("db_role") not in ("salon_owner", "worker") or not db_salon_id:
        raise HTTPException(status_code=404, detail="No salon is linked to this account")

    res = supabase_admin.table("salons").select("*").eq("id", db_salon_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="No salon found for this account. Please register a salon first.")
    return res.data[0]


@router.get("/{salon_id}")
def get_salon_by_id(salon_id: UUID, credentials: HTTPAuthorizationCredentials = Depends(optional_bearer)):
    """Returns salon details.
    - Public / anonymous callers: only active salons are returned.
    - Authenticated salon owners (of THIS salon) and super admins: any status is returned.
    """
    # Try to resolve the caller's role without hard-failing on missing/invalid token
    caller_role = None
    caller_salon_id = None
    if credentials:
        try:
            user = get_current_user_with_profile_from_credentials(credentials)
            caller_role = user.get("db_role")
            caller_salon_id = user.get("db_salon_id")
        except Exception:
            pass  # Anonymous or invalid token — treat as public

    # Determine whether to apply the active-only filter
    is_owner_of_this_salon = (
        caller_role == "salon_owner" and str(caller_salon_id) == str(salon_id)
    )
    is_super_admin = caller_role == "super_admin"

    query = supabase_admin.table("salons").select("*, profiles!owner_id(full_name)").eq("id", salon_id)
    if not (is_owner_of_this_salon or is_super_admin):
        query = query.eq("status", "active")

    res = query.execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found or not yet active.")
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
    timezone: Optional[str] = None  # IANA timezone name e.g. 'Asia/Kolkata'

    @field_validator('logo_url', 'cover_image_url')
    @classmethod
    def validate_image_urls(cls, v):
        return _validate_public_url(v)


class SalonCreate(SalonUpdate):
    """Schema for creating a new salon. Extends SalonUpdate with required fields."""
    name: str
    address: str
    city: str
    phone: str


@router.put("/{salon_id}")
@limiter.limit("20/minute")
def update_salon(request: Request, salon_id: UUID, updates: SalonUpdate, user: dict = Depends(get_current_user_with_profile)):
    """Update salon settings. Only the salon owner (or super_admin) can update."""
    require_salon_access(user, salon_id, {"salon_owner"})

    payload = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase_admin.table("salons").update(payload).eq("id", salon_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Salon not found")
    return res.data[0]


@router.post("")
@limiter.limit("20/minute")
def create_salon(request: Request, data: SalonCreate, user: dict = Depends(get_current_user_with_profile)):
    """Create a new salon and link it to the user. Upgrades a customer to salon_owner."""
    db_role = user.get("db_role")
    
    if db_role not in ("customer", "salon_owner", "super_admin"):
        raise HTTPException(status_code=403, detail="Workers cannot create a salon")
    
    # Check if they already have a salon (usually 1 per owner)
    if user.get("db_salon_id"):
        raise HTTPException(status_code=400, detail="User already has a salon linked")

    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    payload["owner_id"] = user.get("sub") or user.get("id")
    
    # New salons start as pending if created by a customer/owner.
    # Super admins can theoretically bypass this later via approve endpoint.
    payload["status"] = "pending"

    # Insert into salons
    res = supabase_admin.table("salons").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create salon")
    
    new_salon = res.data[0]
    
    # Upgrade role to salon_owner if they are currently just a customer
    if db_role == "customer":
        supabase_admin.table("profiles").update({"role": "salon_owner"}).eq("id", payload["owner_id"]).execute()
    
    # Evict the cache so the next request gets the new role and salon_id immediately
    evict_profile_cache(payload["owner_id"])
    
    return new_salon



@router.get("/{salon_id}/customers")
def get_salon_customers(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    """Returns distinct customers who have had a token at this salon."""
    require_salon_access(user, salon_id, {"salon_owner"})

    # Call the new RPC function to fetch unique customers directly from the DB
    res = supabase_admin.rpc("get_salon_customers", {"p_salon_id": str(salon_id)}).execute()
    
    customers = res.data if res.data else []

    return {"customers": customers}
