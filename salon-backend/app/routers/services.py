from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional
from ..database import supabase_admin
from ..dependencies import require_role, require_salon_access, get_current_user_with_profile
from ..schemas.schemas import ServiceCreate, ServiceUpdate
from ..limiter import limiter

router = APIRouter(prefix="/api/services", tags=["Services"])

# Public-safe fields — never include internal timestamps or join IDs beyond salon_id
_PUBLIC_FIELDS = "id, salon_id, name, description, price, duration_minutes, status"


# ── Public reads (no auth) ──────────────────────────────────────────────────

@router.get("")
def get_services(salon_id: UUID = Query(..., description="Filter services by salon")):
    """
    List services for a specific salon.
    Requires salon_id — callers cannot enumerate cross-tenant data.
    Returns only public-safe fields (no created_at, no internal metadata).
    """
    res = (
        supabase_admin.table("services")
        .select(_PUBLIC_FIELDS)
        .eq("salon_id", salon_id)
        .eq("status", "active")
        .order("name")
        .execute()
    )
    return res.data


@router.get("/{service_id}")
def get_service(service_id: UUID):
    res = (
        supabase_admin.table("services")
        .select(_PUBLIC_FIELDS)
        .eq("id", service_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Service not found")
    return res.data[0]


# ── Owner-only writes ───────────────────────────────────────────────────────

@router.post("")
@limiter.limit("20/minute")
def create_service(
    request: Request,
    service: ServiceCreate,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """
    Create a new service.
    salon_owner: salon_id is derived from the authenticated user's linked salon
                 (client-supplied salon_id is validated against user's authorised salon).
    super_admin: may supply any salon_id.
    """
    db_role = user.get("db_role")

    if db_role == "super_admin":
        # Super admins may create services for any salon
        target_salon = str(service.salon_id)
    else:
        # For salon owners, ignore the client-supplied salon_id and use the
        # authoritative value from the user's profile/salon relationship.
        authorised_salon = user.get("db_salon_id")
        if not authorised_salon:
            raise HTTPException(
                status_code=403,
                detail="No salon linked to your account. Cannot create service.",
            )
        # Verify the client-supplied salon_id matches the authorised salon
        # (defence-in-depth: this also catches bugs where the UI sends the wrong id)
        require_salon_access(user, str(service.salon_id), {"salon_owner"})
        target_salon = authorised_salon

    new_service = {
        "salon_id": target_salon,
        "name": service.name,
        "description": service.description,
        "price": service.price,
        "duration_minutes": service.duration_minutes,
        "status": service.status,
    }

    res = supabase_admin.table("services").insert(new_service).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create service")
    return res.data[0]


@router.put("/{service_id}")
def update_service(
    service_id: str,
    updates: ServiceUpdate,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """Update an existing service. Ownership verified via DB lookup before update."""
    existing = (
        supabase_admin.table("services")
        .select("salon_id")
        .eq("id", service_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Service not found")

    require_salon_access(user, existing.data[0]["salon_id"], {"salon_owner"})

    payload = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = (
        supabase_admin.table("services")
        .update(payload)
        .eq("id", service_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update service")
    return res.data[0]


@router.delete("/{service_id}")
def delete_service(
    service_id: str,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """Delete a service. Ownership verified via DB lookup before deletion."""
    existing = (
        supabase_admin.table("services")
        .select("salon_id")
        .eq("id", service_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Service not found")

    require_salon_access(user, existing.data[0]["salon_id"], {"salon_owner"})

    supabase_admin.table("services").delete().eq("id", service_id).execute()
    return {"success": True, "deleted_id": service_id}
