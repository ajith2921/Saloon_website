from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from datetime import date, datetime, timezone
import logging

# pyrefly: ignore [missing-import]
from ..schemas.schemas import TokenCreate, TokenReassign
# pyrefly: ignore [missing-import]
from ..dependencies import get_current_user, get_current_user_with_profile, require_salon_access
# pyrefly: ignore [missing-import]
from ..database import supabase_admin, get_async_supabase_admin
from ..limiter import limiter
from ..services.sms import send_sms_notification
from ..services.push import send_push_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tokens", tags=["Tokens"])


async def enrich_tokens_services(tokens_list: list, async_supabase_admin) -> list:
    if not tokens_list:
        return tokens_list

    # Gather service IDs that need querying
    needed_ids = set()
    for t in tokens_list:
        sids = t.get("service_ids")
        if isinstance(sids, list) and sids:
            for s in sids:
                if s:
                    needed_ids.add(str(s))
        elif t.get("service_id"):
            needed_ids.add(str(t["service_id"]))

    services_by_id = {}
    if needed_ids:
        try:
            svc_res = await async_supabase_admin.table("services").select(
                "id, name, price, duration_minutes"
            ).in_("id", list(needed_ids)).execute()
            if svc_res.data:
                for s in svc_res.data:
                    services_by_id[str(s["id"])] = s
        except Exception as e:
            logger.warning(f"Failed to fetch extra services details: {e}")

    for t in tokens_list:
        sids = t.get("service_ids")
        if isinstance(sids, list) and len(sids) > 0:
            matched = [services_by_id[str(sid)] for sid in sids if str(sid) in services_by_id]
        elif t.get("service_id") and str(t["service_id"]) in services_by_id:
            matched = [services_by_id[str(t["service_id"])]]
        elif t.get("services"):
            matched = [t["services"]]
        else:
            matched = []

        if matched:
            t["selected_services"] = matched
            t["services_summary"] = ", ".join(s.get("name", "") for s in matched if s.get("name"))
            t["total_duration"] = sum(s.get("duration_minutes", 0) for s in matched)
            t["total_price"] = sum(float(s.get("price", 0)) for s in matched)
            # Backward-compat: update primary service dictionary if multiple services
            if len(matched) > 1 and "services" in t and isinstance(t["services"], dict):
                t["services"]["name"] = t["services_summary"]
                t["services"]["duration_minutes"] = t["total_duration"]
                t["services"]["price"] = t["total_price"]
        else:
            t["selected_services"] = [t.get("services")] if t.get("services") else []
            t["services_summary"] = (t.get("services") or {}).get("name") or "Service"
            t["total_duration"] = (t.get("services") or {}).get("duration_minutes") or 30
            t["total_price"] = (t.get("services") or {}).get("price") or 0

    return tokens_list


@router.post("")
@limiter.limit("3/minute")
async def create_token(request: Request, token: TokenCreate, user: dict = Depends(get_current_user_with_profile)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    db_role = user.get("db_role")
    
    if db_role == "customer":
        # Customers can only create tokens for themselves, not walk-ins
        if token.guest_name is not None:
            raise HTTPException(status_code=400, detail="Customers cannot create walk-in tokens")
        customer_id = user_id
        guest_name = None
    elif db_role in ("salon_owner", "worker"):
        # Staff can only create walk-in tokens, not tokens linked to a customer account directly
        if not token.guest_name:
            raise HTTPException(status_code=400, detail="Guest name is required for walk-in tokens")
        require_salon_access(user, str(token.salon_id), {"salon_owner", "worker"})
        customer_id = None
        guest_name = token.guest_name
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions to create tokens")

    service_ids = [str(sid) for sid in (token.service_ids or [token.service_id])]
    primary_service_id = str(token.service_id or service_ids[0])

    rpc_params = {
        "p_salon_id": str(token.salon_id),
        "p_customer_id": customer_id,
        "p_service_id": primary_service_id,
        "p_worker_id": str(token.worker_id) if token.worker_id else None,
        "p_guest_name": guest_name,
        "p_guest_phone": token.guest_phone,
        "p_is_booking": token.is_booking,
        "p_scheduled_for": token.scheduled_for.isoformat() if token.scheduled_for else None,
        "p_service_ids": service_ids,
    }

    try:
        async_supabase_admin = await get_async_supabase_admin()
        try:
            res = await async_supabase_admin.rpc("create_queue_token", rpc_params).execute()
        except Exception as rpc_err:
            rpc_err_str = str(rpc_err)
            # If database has not yet received migration 037, retry with 8 parameters
            if "p_service_ids" in rpc_err_str or ("function" in rpc_err_str.lower() and "create_queue_token" in rpc_err_str.lower()):
                rpc_params_legacy = {k: v for k, v in rpc_params.items() if k != "p_service_ids"}
                res = await async_supabase_admin.rpc("create_queue_token", rpc_params_legacy).execute()
                if res.data and len(res.data) > 0 and len(service_ids) > 1:
                    try:
                        await async_supabase_admin.table("tokens").update({
                            "service_ids": service_ids
                        }).eq("id", res.data[0]["id"]).execute()
                        res.data[0]["service_ids"] = service_ids
                    except Exception:
                        pass
            else:
                raise rpc_err

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to generate token. Please try again.")

        enriched = await enrich_tokens_services(res.data, async_supabase_admin)
        return enriched[0]
    except Exception as e:
        err_str = str(e)
        error_messages = {
            "SALON_NOT_FOUND": (404, "Salon not found"),
            "SALON_NOT_ACCEPTING_TOKENS": (400, "This salon is not currently accepting tokens"),
            "SERVICE_UNAVAILABLE": (400, "Selected service is unavailable at this salon"),
            "WORKER_UNAVAILABLE": (400, "Selected worker is unavailable at this salon"),
            "ACTIVE_TOKEN_EXISTS": (400, "You already have an active token at this salon for today."),
            "CUSTOMER_ALREADY_IN_QUEUE": (400, "You already have an active token in the live queue for today."),
            "DAILY_TOKEN_LIMIT_PER_USER_REACHED": (400, "You can only generate one token per day across all salons."),
            "DAILY_TOKEN_LIMIT_REACHED": (400, "This salon has reached its daily token limit. Please try tomorrow."),
            "CUSTOMER_OR_GUEST_REQUIRED": (400, "Customer or guest name is required."),
            "SCHEDULED_TIME_REQUIRED_FOR_BOOKING": (400, "A scheduled time is required for an appointment booking."),
        }
        for marker, (status_code, detail) in error_messages.items():
            if marker in err_str:
                raise HTTPException(status_code=status_code, detail=detail)
        # Handle duplicate token number from concurrent requests
        if "unique" in err_str.lower() or "duplicate" in err_str.lower():
            raise HTTPException(status_code=409, detail="Queue conflict — please try again in a moment.")
            
        import logging
        logging.getLogger(__name__).exception("Error generating token")
        raise HTTPException(status_code=500, detail=f"Failed to generate token: {err_str}")


@router.get("/my")
async def get_my_active_token(user: dict = Depends(get_current_user)):
    """Returns the user's active token for today (waiting, called, OR serving)."""
    user_id = user.get("sub")
    today = str(date.today())

    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("tokens").select(
        "*, salons(name, cover_image_url), services(name, price, duration_minutes), workers(name, photo_url)"
    ).eq("customer_id", user_id).eq("date", today).in_(
        "status", ["waiting", "called", "serving", "scheduled"]  # include ALL active statuses
    ).order("created_at", desc=True).limit(1).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="No active token found")

    enriched = await enrich_tokens_services(res.data, async_supabase_admin)
    return enriched[0]  # Frontend accesses data directly (not data.token)


@router.get("/history")
async def get_token_history(user: dict = Depends(get_current_user)):
    """
    Returns the customer's last 50 tokens.
    Response envelope: {"tokens": [...]}
    Each token includes nested salons, services, workers, and ratings so the
    frontend can determine whether to show the "Rate" button.
    """
    user_id = user.get("sub")
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("tokens").select(
        "*, salons(name), services(name, price), workers(name), ratings(id)"
    ).eq("customer_id", user_id).order("created_at", desc=True).limit(50).execute()
    enriched = await enrich_tokens_services(res.data or [], async_supabase_admin)
    return {"tokens": enriched}


@router.get("/{token_id}")
async def get_single_token(token_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("tokens").select(
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
    enriched = await enrich_tokens_services([token], async_supabase_admin)
    return enriched[0]


@router.put("/{token_id}/{action}")
@limiter.limit("30/minute")
async def update_token_status(request: Request, token_id: UUID, action: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user_with_profile)):
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
    async_supabase_admin = await get_async_supabase_admin()
    token_res = await async_supabase_admin.table("tokens").select("customer_id, salon_id, status, guest_name, guest_phone, salons(name)").eq("id", token_id).execute()
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
        if t["status"] not in ("waiting", "called", "scheduled"):
            raise HTTPException(status_code=400, detail="Can only cancel a waiting, called, or scheduled token")

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
        "call": {"waiting", "scheduled"},
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

    res = await async_supabase_admin.table("tokens").update(update_payload).eq("id", token_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update token status")

    updated_token = res.data[0]

    # Trigger SMS notification if action is call
    sms_status = None
    sms_phone = None
    sms_message = None

    if action == "call":
        salon_name = t.get("salons", {}).get("name", "the salon")
        
        phone_number = t.get("guest_phone")
        first_name = (t.get("guest_name") or "Customer").split(" ")[0]
        
        # If it's a registered customer and we don't have guest_phone, fetch from profiles safely
        sms_opt_in = True
        if t.get("customer_id"):
            try:
                profile_res = await async_supabase_admin.table("profiles").select("*").eq("id", t["customer_id"]).execute()
                if profile_res.data:
                    prof = profile_res.data[0]
                    if not phone_number:
                        phone_number = prof.get("phone")
                    full_name = prof.get("full_name")
                    if full_name:
                        first_name = full_name.split(" ")[0]
                    if prof.get("sms_notifications") is False:
                        sms_opt_in = False
            except Exception as e:
                logger.warning(f"Could not read profile for customer {t.get('customer_id')}: {e}")
        
        if not sms_opt_in:
            sms_status = "opted_out"
            sms_phone = phone_number
            sms_message = "Customer has disabled SMS notifications in their profile settings. No SMS was sent."
        elif phone_number and str(phone_number).strip():
            phone_number = str(phone_number).strip()
            sms_status = "sent"
            sms_phone = phone_number
            sms_message = f"SMS notification queued for {phone_number}"
            message = f"Hi {first_name}, it's your turn at {salon_name}! Please head to the counter."
            background_tasks.add_task(send_sms_notification, phone_number, message)
        else:
            sms_status = "no_phone"
            sms_phone = None
            sms_message = "Customer has not provided a phone number. No SMS notification was sent."

        if t.get("customer_id"):
            try:
                push_title = "It's your turn!"
                push_body = f"Please head to the counter at {salon_name}."
                background_tasks.add_task(send_push_notification, t["customer_id"], push_title, push_body, f"/my-token")
            except Exception as e:
                logger.warning(f"Could not queue push notification: {e}")

    updated_token["sms_status"] = sms_status
    updated_token["sms_phone"] = sms_phone
    updated_token["sms_message"] = sms_message

    return updated_token


@router.put("/{token_id}/reassign")
@limiter.limit("20/minute")
async def reassign_token(request: Request, token_id: UUID, payload: TokenReassign, user: dict = Depends(get_current_user_with_profile)):
    db_role = user.get("db_role")
    
    if db_role not in ("salon_owner", "worker"):
        raise HTTPException(status_code=403, detail="Only salon staff can reassign tokens")

    # Fetch token
    async_supabase_admin = await get_async_supabase_admin()
    token_res = await async_supabase_admin.table("tokens").select("salon_id, status").eq("id", token_id).execute()
    if not token_res.data:
        raise HTTPException(status_code=404, detail="Token not found")
        
    t = token_res.data[0]
    
    # Require access to this salon
    require_salon_access(user, t["salon_id"], {"salon_owner", "worker"})
    
    # Can only reassign tokens that are waiting or called (not serving or completed)
    if t["status"] not in ("waiting", "called"):
        raise HTTPException(status_code=400, detail="Can only reassign tokens that are waiting or called")
        
    # Verify the new worker belongs to the same salon
    if payload.worker_id is not None:
        worker_res = await async_supabase_admin.table("workers").select("id").eq("id", payload.worker_id).eq("salon_id", t["salon_id"]).eq("status", "active").execute()
        if not worker_res.data:
            raise HTTPException(status_code=400, detail="Worker not found or not active at this salon")
            
    res = await async_supabase_admin.table("tokens").update({"worker_id": str(payload.worker_id) if payload.worker_id else None}).eq("id", token_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to reassign token")
        
    return res.data[0]
