from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date, datetime, timezone

# pyrefly: ignore [missing-import]
from ..schemas.schemas import TokenCreate
# pyrefly: ignore [missing-import]
from ..dependencies import get_current_user, get_current_user_with_profile, require_salon_access
# pyrefly: ignore [missing-import]
from ..database import supabase_admin

router = APIRouter(prefix="/api/tokens", tags=["Tokens"])


@router.post("")
def create_token(token: TokenCreate, user: dict = Depends(get_current_user_with_profile)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    if user.get("db_role") != "customer":
        raise HTTPException(status_code=403, detail="Only customer accounts can create tokens")

    try:
        res = supabase_admin.rpc("create_queue_token", {
            "p_salon_id": str(token.salon_id),
            "p_customer_id": user_id,
            "p_service_id": str(token.service_id),
            "p_worker_id": str(token.worker_id) if token.worker_id else None,
        }).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to generate token. Please try again.")
        return res.data[0]
    except Exception as e:
        err_str = str(e)
        error_messages = {
            "SALON_NOT_FOUND": (404, "Salon not found"),
            "SALON_NOT_ACCEPTING_TOKENS": (400, "This salon is not currently accepting tokens"),
            "SERVICE_UNAVAILABLE": (400, "Selected service is unavailable at this salon"),
            "WORKER_UNAVAILABLE": (400, "Selected worker is unavailable at this salon"),
            "ACTIVE_TOKEN_EXISTS": (400, "You already have an active token at this salon for today."),
            "DAILY_TOKEN_LIMIT_REACHED": (400, "This salon has reached its daily token limit. Please try tomorrow."),
        }
        for marker, (status_code, detail) in error_messages.items():
            if marker in err_str:
                raise HTTPException(status_code=status_code, detail=detail)
        # Handle duplicate token number from concurrent requests
        if "unique" in err_str.lower() or "duplicate" in err_str.lower():
            raise HTTPException(status_code=409, detail="Queue conflict — please try again in a moment.")
        raise HTTPException(status_code=500, detail="Failed to generate token. Please try again.")


@router.get("/my")
def get_my_active_token(user: dict = Depends(get_current_user)):
    """Returns the user's active token for today (waiting, called, OR serving)."""
    user_id = user.get("sub")
    today = str(date.today())

    res = supabase_admin.table("tokens").select(
        "*, salons(name, cover_image_url), services(name, price, duration_minutes), workers(name, photo_url)"
    ).eq("customer_id", user_id).eq("date", today).in_(
        "status", ["waiting", "called", "serving"]  # include ALL active statuses
    ).order("created_at", desc=True).limit(1).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="No active token found")

    return res.data[0]  # Frontend accesses data directly (not data.token)


@router.get("/history")
def get_token_history(user: dict = Depends(get_current_user)):
    """
    Returns the customer's last 50 tokens.
    Response envelope: {"tokens": [...]}
    Each token includes nested salons, services, workers, and ratings so the
    frontend can determine whether to show the "Rate" button.
    """
    user_id = user.get("sub")
    res = supabase_admin.table("tokens").select(
        "*, salons(name), services(name, price), workers(name), ratings(id)"
    ).eq("customer_id", user_id).order("created_at", desc=True).limit(50).execute()
    return {"tokens": res.data}


@router.get("/{token_id}")
def get_single_token(token_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    res = supabase_admin.table("tokens").select(
        "*, salons(name, address), workers(name, photo_url), services(name, price, duration_minutes)"
    ).eq("id", token_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Token not found")
    token = res.data[0]
    role = user.get("db_role", "customer")
    if role == "customer":
        if token.get("customer_id") != user.get("sub"):
            raise HTTPException(status_code=403, detail="You can only view your own token")
    elif role in ("salon_owner", "worker"):
        require_salon_access(user, token["salon_id"], {"salon_owner", "worker"})
    elif role != "super_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return token


@router.put("/{token_id}/{action}")
def update_token_status(token_id: UUID, action: str, user: dict = Depends(get_current_user_with_profile)):
    valid_actions = {
        "call":     "called",
        "start":    "serving",
        "complete": "completed",
        "skip":     "skipped",
        "cancel":   "cancelled",
        "recall":   "called",    # re-call a skipped token
    }

    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action '{action}'. Valid: {', '.join(valid_actions)}")

    new_status = valid_actions[action]
    user_id    = user.get("sub")
    db_role    = user.get("db_role", "customer")
    db_salon_id = user.get("db_salon_id")

    # Fetch the token
    token_res = supabase_admin.table("tokens").select("customer_id, salon_id, status").eq("id", token_id).execute()
    if not token_res.data:
        raise HTTPException(status_code=404, detail="Token not found")

    t = token_res.data[0]

    # Authorization matrix
    if db_role == "customer":
        # Customers can only cancel their own waiting/called tokens
        if t["customer_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only cancel your own token")
        if action != "cancel":
            raise HTTPException(status_code=403, detail="Customers can only cancel tokens")
        if t["status"] not in ("waiting", "called"):
            raise HTTPException(status_code=400, detail="Can only cancel a waiting or called token")

    elif db_role in ("salon_owner", "worker"):
        require_salon_access(user, t["salon_id"], {"salon_owner", "worker"})
        # Workers cannot cancel tokens (only owners can)
        if db_role == "worker" and action == "cancel":
            raise HTTPException(status_code=403, detail="Workers cannot cancel tokens")

    elif db_role == "super_admin":
        pass  # Super admins can do anything

    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Enforce the real queue lifecycle rather than allowing arbitrary jumps.
    allowed_previous_states = {
        "call": {"waiting"},
        "start": {"called"},
        "complete": {"serving"},
        "skip": {"waiting", "called"},
        "cancel": {"waiting", "called"},
        "recall": {"skipped"},
    }
    if t["status"] not in allowed_previous_states[action]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot {action} a token that is currently {t['status']}",
        )

    update_payload = {"status": new_status}
    timestamp_fields = {
        "call": "called_at",
        "recall": "called_at",
        "start": "started_at",
        "complete": "completed_at",
        "cancel": "cancelled_at",
    }
    timestamp_field = timestamp_fields.get(action)
    if timestamp_field:
        update_payload[timestamp_field] = datetime.now(timezone.utc).isoformat()

    res = supabase_admin.table("tokens").update(update_payload).eq("id", token_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update token status")

    updated_token = res.data[0]

    # ── Award loyalty points on completion ───────────────────────────────────
    # Points = floor(service_price / 10). Runs fire-and-forget style (errors suppressed).
    if action == "complete":
        try:
            # Fetch service price via the token's service_id
            svc_res = supabase_admin.table("tokens") \
                .select("customer_id, services(price)") \
                .eq("id", token_id) \
                .execute()
            if svc_res.data:
                row = svc_res.data[0]
                customer_id = row.get("customer_id")
                price = float((row.get("services") or {}).get("price") or 0)
                points_earned = max(1, int(price // 10))  # min 1 point per visit
                if customer_id and points_earned > 0:
                    # Atomic increment using Supabase RPC would be ideal;
                    # fallback: read-then-write (acceptable for low-concurrency loyalty)
                    profile_res = supabase_admin.table("profiles") \
                        .select("loyalty_points") \
                        .eq("id", customer_id) \
                        .execute()
                    if profile_res.data:
                        current = profile_res.data[0].get("loyalty_points", 0) or 0
                        supabase_admin.table("profiles") \
                            .update({"loyalty_points": current + points_earned}) \
                            .eq("id", customer_id) \
                            .execute()
        except Exception:
            pass  # Loyalty award is best-effort; don't fail the main operation

    return updated_token
