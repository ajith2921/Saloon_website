from uuid import UUID
from fastapi import APIRouter, Depends
from datetime import date, timedelta

from ..dependencies import get_current_user_with_profile, require_salon_access
from ..database import supabase_admin
from ..config import settings

router = APIRouter(prefix="/api/revenue", tags=["Revenue"])


@router.get("/salon/{salon_id}")
def get_revenue(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    """
    Revenue is derived from completed tokens × service price.
    Platform fee is deducted per token (configurable in settings).
    """
    require_salon_access(user, salon_id, {"salon_owner"})
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    month_start = today.replace(day=1)

    # Fetch all completed tokens with their service prices
    completed_res = supabase_admin.table("tokens") \
        .select("id, date, created_at, services(name, price)") \
        .eq("salon_id", salon_id) \
        .eq("status", "completed") \
        .gte("date", str(month_start)) \
        .order("created_at", desc=True) \
        .execute()

    all_completed = completed_res.data or []

    def token_amount(t):
        return float(t.get("services", {}).get("price", 0) if t.get("services") else 0)

    today_str = str(today)
    week_str = str(week_start)

    today_revenue = sum(token_amount(t) for t in all_completed if t.get("date") == today_str)
    week_revenue = sum(token_amount(t) for t in all_completed if t.get("date", "") >= week_str)
    month_revenue = sum(token_amount(t) for t in all_completed)

    # Platform fee total this month
    platform_fees = len(all_completed) * settings.platform_fee_per_token

    # Build transaction list from recent tokens (up to 20)
    transactions = []
    for t in all_completed[:20]:
        transactions.append({
            "id": t["id"],
            "date": t.get("created_at"),
            "amount": token_amount(t),
            "service": t["services"]["name"] if t.get("services") else "Unknown",
            "status": "completed",
        })

    return {
        "today_revenue": round(today_revenue, 2),
        "week_revenue": round(week_revenue, 2),
        "month_revenue": round(month_revenue, 2),
        "platform_fees": round(platform_fees, 2),
        "transactions": transactions,
    }
