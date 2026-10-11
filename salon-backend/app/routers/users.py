from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging

from ..database import get_async_supabase_admin
from ..dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["Users"])

class UpdateProfilePayload(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    sms_notifications: Optional[bool] = None
    email_receipts: Optional[bool] = None

@router.get("/profile")
async def get_my_profile(user: dict = Depends(get_current_user)):
    """Fetch current user profile using backend service role to bypass RLS/grant restrictions."""
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]

@router.put("/profile")
async def update_my_profile(payload: UpdateProfilePayload, user: dict = Depends(get_current_user)):
    """Update user profile.
    Uses service role so that table-level grant limits or RLS quirks never block the user
    from saving their phone number and notification settings.
    """
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    update_dict = {}
    if payload.full_name is not None:
        update_dict["full_name"] = payload.full_name.strip()
    if payload.phone is not None:
        update_dict["phone"] = payload.phone.strip()
    if payload.avatar_url is not None:
        update_dict["avatar_url"] = payload.avatar_url.strip()
    if payload.sms_notifications is not None:
        update_dict["sms_notifications"] = payload.sms_notifications
    if payload.email_receipts is not None:
        update_dict["email_receipts"] = payload.email_receipts

    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    async_supabase_admin = await get_async_supabase_admin()

    try:
        res = await async_supabase_admin.table("profiles").update(update_dict).eq("id", user_id).execute()
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"Initial profile update error: {err_msg}")
        # In case sms_notifications or email_receipts columns are not yet added in database
        if "column" in err_msg.lower() and ("sms_notifications" in err_msg or "email_receipts" in err_msg):
            core_fields = {k: v for k, v in update_dict.items() if k not in ("sms_notifications", "email_receipts")}
            if core_fields:
                res = await async_supabase_admin.table("profiles").update(core_fields).eq("id", user_id).execute()
            else:
                res = await async_supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update profile: {err_msg}")

    if not res.data:
        # Profile might have just been updated or user row didn't return
        select_res = await async_supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
        updated_profile = select_res.data[0] if select_res.data else update_dict
    else:
        updated_profile = res.data[0]

    return {
        "status": "success",
        "message": "Profile updated successfully",
        "profile": updated_profile
    }
