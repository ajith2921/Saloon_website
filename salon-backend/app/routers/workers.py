from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from ..database import supabase_admin
from ..dependencies import require_role, require_salon_access
from ..schemas.schemas import WorkerCreate, WorkerUpdate

router = APIRouter(prefix="/api/workers", tags=["Workers"])

# Public-safe fields — user_id is a FK to auth.users and must NEVER be exposed
# to unauthenticated callers.
_PUBLIC_FIELDS = "id, salon_id, name, photo_url, specialization, experience_years, status"


# ── Public reads (no auth) ──────────────────────────────────────────────────

@router.get("")
def get_workers(salon_id: UUID = Query(..., description="Filter workers by salon")):
    """
    List workers for a specific salon.
    Requires salon_id — callers cannot enumerate cross-tenant worker data.
    Returns only public-safe fields (no user_id, no private account information).
    """
    res = (
        supabase_admin.table("workers")
        .select(_PUBLIC_FIELDS)
        .eq("salon_id", salon_id)
        .order("name")
        .execute()
    )
    return res.data


@router.get("/{worker_id}")
def get_worker(worker_id: UUID):
    """
    Get a single worker by ID.
    Returns only public-safe fields (no user_id).
    """
    res = (
        supabase_admin.table("workers")
        .select(_PUBLIC_FIELDS)
        .eq("id", worker_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Worker not found")
    return res.data[0]


# ── Owner-only writes ───────────────────────────────────────────────────────

@router.post("")
def create_worker(
    worker: WorkerCreate,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """
    Create a new worker.
    salon_owner: salon_id is derived from the authenticated user's linked salon
                 (client-supplied salon_id is validated against user's authorised salon).
    super_admin: may supply any salon_id.
    """
    db_role = user.get("db_role")

    if db_role == "super_admin":
        target_salon = str(worker.salon_id)
    else:
        # For salon owners, derive salon from the authoritative user context.
        # The client-supplied salon_id is still validated for defence-in-depth.
        authorised_salon = user.get("db_salon_id")
        if not authorised_salon:
            raise HTTPException(
                status_code=403,
                detail="No salon linked to your account. Cannot add worker.",
            )
        require_salon_access(user, str(worker.salon_id), {"salon_owner"})
        target_salon = authorised_salon

    new_worker = {
        "salon_id": target_salon,
        # user_id is only set when explicitly provided (linking a registered account)
        "user_id": str(worker.user_id) if worker.user_id else None,
        "name": worker.name,
        "specialization": worker.specialization,
        "experience_years": worker.experience_years,
        "status": worker.status,
        "photo_url": worker.photo_url,
    }

    res = supabase_admin.table("workers").insert(new_worker).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create worker")
    return res.data[0]


@router.put("/{worker_id}")
def update_worker(
    worker_id: str,
    updates: WorkerUpdate,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """
    Update an existing worker. Ownership verified via DB lookup before update.
    user_id is stripped from the update payload — re-linking a worker to a
    different auth account is not permitted through this endpoint.
    """
    existing = (
        supabase_admin.table("workers")
        .select("salon_id")
        .eq("id", worker_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Worker not found")

    require_salon_access(user, existing.data[0]["salon_id"], {"salon_owner"})

    # Build update payload — exclude user_id to prevent account re-linking
    payload = {
        k: v
        for k, v in updates.model_dump().items()
        if v is not None and k != "user_id"
    }
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = (
        supabase_admin.table("workers")
        .update(payload)
        .eq("id", worker_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update worker")
    return res.data[0]


@router.delete("/{worker_id}")
def delete_worker(
    worker_id: str,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """Delete (hard delete) a worker. Ownership verified via DB lookup before deletion."""
    existing = (
        supabase_admin.table("workers")
        .select("salon_id")
        .eq("id", worker_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Worker not found")

    require_salon_access(user, existing.data[0]["salon_id"], {"salon_owner"})

    # Check for active tokens
    active_tokens = supabase_admin.table("tokens").select("id").eq("worker_id", worker_id).in_("status", ["waiting", "called", "serving"]).execute()
    if active_tokens.data:
        raise HTTPException(status_code=400, detail="This worker has active queue tokens and cannot be deleted.")

    supabase_admin.table("workers").delete().eq("id", worker_id).execute()
    return {"success": True, "deleted_id": worker_id}
