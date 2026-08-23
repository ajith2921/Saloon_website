from fastapi import APIRouter, Depends
from ..dependencies import get_current_user
from ..database import supabase_admin

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty"])

@router.get("/balance")
def get_loyalty_balance(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    res = supabase_admin.table("profiles").select("loyalty_points").eq("id", user_id).execute()
    points = res.data[0]["loyalty_points"] if res.data else 0
    return {"points": points}
@router.get("/history")
def get_loyalty_history(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    res = supabase_admin.table("tokens") \
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
def get_loyalty_rules():
    return {
        "earning_rules": "Earn 1 point for every ₹10 spent on completed services. Minimum 1 point per visit.",
        "rewards": [
            {"points": 100, "title": "₹20 Off"},
            {"points": 250, "title": "Free Beard Trim"},
            {"points": 500, "title": "Free Haircut"},
        ]
    }
