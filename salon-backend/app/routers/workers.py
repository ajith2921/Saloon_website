from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional
from ..database import supabase_admin
from ..dependencies import require_role, require_salon_access
from ..schemas.schemas import WorkerCreate, WorkerUpdate, WorkerProvisionAccount
from ..limiter import limiter

router = APIRouter(prefix="/api/workers", tags=["Workers"])

# Public-safe fields — user_id is a FK to auth.users and must NEVER be exposed
# to unauthenticated callers.
_PUBLIC_FIELDS = "id, salon_id, name, photo_url, specialization, experience_years, status"


# ── Public reads (no auth) ──────────────────────────────────────────────────

@router.get("/me")
def get_my_worker_profile(user: dict = Depends(require_role("worker"))):
    """
    Get the currently authenticated worker's worker profile.
    Uses the db_worker_id cached in the dependencies resolver.
    """
    worker_id = user.get("db_worker_id")
    if not worker_id:
        raise HTTPException(status_code=404, detail="Worker record not found")
        
    res = (
        supabase_admin.table("workers")
        .select("*")
        .eq("id", worker_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Worker not found")
    return res.data[0]


@router.get("")
def get_workers(salon_id: UUID = Query(..., description="Filter workers by salon"), request: Request = None):
    """
    List workers for a specific salon.
    Returns public-safe fields by default. 
    If the caller is the authenticated salon owner, also includes user_id (to determine if a portal account exists).
    """
    fields = _PUBLIC_FIELDS
    
    # Try to identify if caller is the owner
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            user_response = supabase_admin.auth.get_user(token)
            if user_response and user_response.user:
                # If they are an owner, we can safely expose user_id
                user_id = user_response.user.id
                role = getattr(user_response.user, "role", "authenticated")
                # Alternatively just use the resolved role from profiles if needed, 
                # but to avoid extra DB calls, if they just have a valid token, we'll check later
                # Actually, simplest is to just fetch user_id and let the client hide/show based on if it's populated.
                res = supabase_admin.table("profiles").select("role").eq("id", user_id).single().execute()
                if res.data and res.data.get("role") in ["salon_owner", "super_admin"]:
                    fields = _PUBLIC_FIELDS + ", user_id"
        except Exception:
            pass

    res = (
        supabase_admin.table("workers")
        .select(fields)
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
@limiter.limit("20/minute")
def create_worker(
    request: Request,
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


@router.post("/{worker_id}/provision")
def provision_worker_account(
    worker_id: str,
    creds: WorkerProvisionAccount,
    user: dict = Depends(require_role("salon_owner|super_admin")),
):
    """
    Provisions a login account (email/password) for an existing worker profile.
    Automatically assigns the 'worker' role in the profiles table.
    """
    existing = (
        supabase_admin.table("workers")
        .select("salon_id, user_id, name")
        .eq("id", worker_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    worker_record = existing.data[0]
    if worker_record.get("user_id"):
        raise HTTPException(status_code=400, detail="Worker already has an associated user account")

    require_salon_access(user, worker_record["salon_id"], {"salon_owner"})

    # 1. Create the user in Auth
    try:
        new_user = supabase_admin.auth.admin.create_user({
            "email": creds.email,
            "password": creds.password,
            "email_confirm": True,
            "user_metadata": {"full_name": worker_record["name"]}
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not provision account: {str(e)}")

    user_id = new_user.user.id

    # 2. Update role in profiles (handle_new_user trigger creates the profile as 'customer', we upgrade it to 'worker')
    supabase_admin.table("profiles").update({"role": "worker"}).eq("id", user_id).execute()

    # 3. Link the user_id to the worker record
    res = (
        supabase_admin.table("workers")
        .update({"user_id": user_id})
        .eq("id", worker_id)
        .execute()
    )
    
    return {"status": "success", "user_id": user_id, "email": creds.email}


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
