from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from ..dependencies import get_current_user
from ..database import supabase_admin

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict



@router.get("")
def get_notifications(user: dict = Depends(get_current_user)):
    """Return all notifications for the authenticated user, newest first."""
    user_id = user.get("sub")
    res = supabase_admin.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
    return {"notifications": res.data or []}


@router.put("/read-all")
def mark_all_read(user: dict = Depends(get_current_user)):
    """Mark all unread notifications as read for the authenticated user."""
    user_id = user.get("sub")
    supabase_admin.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
    return {"success": True}


@router.put("/{notification_id}/read")
def mark_one_read(notification_id: UUID, user: dict = Depends(get_current_user)):
    """Mark a single notification as read (verifying ownership)."""
    user_id = user.get("sub")
    res = supabase_admin.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return res.data[0]

@router.post("/push/subscribe", summary="Subscribe to web push notifications")
def subscribe_push(sub: PushSubscription, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    data = {
        "customer_id": user_id,
        "endpoint": sub.endpoint,
        "p256dh": sub.keys.get("p256dh", ""),
        "auth": sub.keys.get("auth", "")
    }
    
    # Upsert the subscription
    res = supabase_admin.table("push_subscriptions").upsert(
        data, on_conflict="endpoint"
    ).execute()
    
    return {"success": True, "message": "Subscribed successfully"}

@router.post("/push/unsubscribe", summary="Unsubscribe from web push notifications")
async def unsubscribe_push(request: Request, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    body = await request.json()
    endpoint = body.get("endpoint")
    if endpoint:
        supabase_admin.table("push_subscriptions").delete().eq("endpoint", endpoint).eq("customer_id", user_id).execute()
    return {"success": True, "message": "Unsubscribed successfully"}
