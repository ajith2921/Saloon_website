from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..dependencies import get_current_user
from ..database import supabase_admin, get_async_supabase_admin

class RedeemRequest(BaseModel):
    title: str
    points: int


router = APIRouter(prefix="/api/loyalty", tags=["Loyalty"])

@router.get("/balance")
async def get_loyalty_balance(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("profiles").select("loyalty_points").eq("id", user_id).execute()
    points = res.data[0]["loyalty_points"] if res.data else 0
    return {"points": points}
@router.get("/history")
async def get_loyalty_history(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("tokens") \
        .select("id, date, status, services(name, price), salons(name)") \
        .eq("customer_id", user_id) \
        .eq("status", "completed") \
        .order("date", desc=True) \
        .limit(20) \
        .execute()
    
    history = []
    for t in (res.data or []):
        price = float((t.get("services") or {}).get("price") or 0)
        points = max(1, int(price // 10))
        history.append({
            "token_id": t["id"],
            "date": t["date"],
            "salon_name": (t.get("salons") or {}).get("name", "Unknown"),
            "service_name": (t.get("services") or {}).get("name", "Unknown"),
            "points_earned": points
        })
    return {"history": history}

@router.get("/rules")
async def get_loyalty_rules():
    return {
        "earning_rules": "Earn 1 point for every ₹10 spent on completed services. Minimum 1 point per visit.",
        "rewards": [
            {"points": 100, "title": "₹20 Off"},
            {"points": 250, "title": "Free Beard Trim"},
            {"points": 500, "title": "Free Haircut"},
        ]
    }

@router.get("/rewards")
async def get_loyalty_rewards(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("loyalty_rewards") \
        .select("*") \
        .eq("customer_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return {"rewards": res.data or []}

@router.post("/redeem")
async def redeem_reward(payload: RedeemRequest, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    async_supabase_admin = await get_async_supabase_admin()
    
    # Verify rules exist for the requested reward
    rules = await get_loyalty_rules()
    valid_reward = next((r for r in rules["rewards"] if r["title"] == payload.title and r["points"] == payload.points), None)
    if not valid_reward:
        raise HTTPException(status_code=400, detail="Invalid reward selected.")
        
    # Check current balance
    profile_res = await async_supabase_admin.table("profiles").select("loyalty_points").eq("id", user_id).execute()
    current_points = profile_res.data[0]["loyalty_points"] if profile_res.data else 0
    
    if current_points < payload.points:
        raise HTTPException(status_code=400, detail="Insufficient points.")
        
    # Atomic-like update via RPC is preferred, but for now we'll do sequential since there is no rpc created yet.
    # Deduct points
    new_points = current_points - payload.points
    update_res = await async_supabase_admin.table("profiles").update({"loyalty_points": new_points}).eq("id", user_id).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to deduct points.")
        
    # Create reward entry
    reward_res = await async_supabase_admin.table("loyalty_rewards").insert({
        "customer_id": user_id,
        "reward_title": payload.title,
        "points_spent": payload.points,
        "status": "active"
    }).execute()
    
    return {"message": "Reward redeemed successfully!", "reward": reward_res.data[0] if reward_res.data else None, "new_balance": new_points}
