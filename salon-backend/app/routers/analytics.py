from uuid import UUID
from fastapi import APIRouter, Depends
from datetime import date, timedelta

from ..dependencies import get_current_user_with_profile, require_salon_access
from ..database import supabase_admin

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/salon/{salon_id}/summary")
def get_analytics_summary(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    require_salon_access(user, salon_id, {"salon_owner"})
    today = date.today()

    # ── Build chart_data for last 7 days ─────────────────────────────────
    chart_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = str(day)

        # Fetch completed tokens for this day
        day_tokens_res = supabase_admin.table("tokens") \
            .select("id, status, created_at, services(duration_minutes)") \
            .eq("salon_id", salon_id) \
            .eq("date", day_str) \
            .execute()
        day_tokens = day_tokens_res.data or []

        completed = [t for t in day_tokens if t["status"] == "completed"]
        total = len(day_tokens)

        # Rough avg wait time: avg service duration * avg position (simplified)
        avg_duration = 0
        durations = [
            t["services"]["duration_minutes"]
            for t in completed
            if t.get("services") and t["services"].get("duration_minutes")
        ]
        if durations:
            avg_duration = sum(durations) / len(durations)

        chart_data.append({
            "name": day.strftime("%a"),
            "customers": total,
            "completed": len(completed),
            "wait_time": round(avg_duration),
        })

    # ── Today's live stats ────────────────────────────────────────────────
    today_res = supabase_admin.table("tokens") \
        .select("id, status") \
        .eq("salon_id", salon_id) \
        .eq("date", str(today)) \
        .execute()
    today_tokens = today_res.data or []

    total_today = len(today_tokens)
    completed_today = sum(1 for t in today_tokens if t["status"] == "completed")
    completion_rate = round((completed_today / total_today * 100) if total_today > 0 else 0)

    # Active workers count
    workers_res = supabase_admin.table("workers") \
        .select("id", count="exact") \
        .eq("salon_id", salon_id) \
        .eq("status", "active") \
        .execute()
    active_barbers = workers_res.count or 0

    # Avg wait time today (using avg service duration as proxy)
    services_today = supabase_admin.table("tokens") \
        .select("services(duration_minutes)") \
        .eq("salon_id", salon_id) \
        .eq("date", str(today)) \
        .eq("status", "completed") \
        .execute()
    service_durations = [
        t["services"]["duration_minutes"]
        for t in (services_today.data or [])
        if t.get("services") and t["services"].get("duration_minutes")
    ]
    avg_wait = round(sum(service_durations) / len(service_durations)) if service_durations else 0

    return {
        "total_customers_today": total_today,
        "avg_wait_time": avg_wait,
        "completion_rate": completion_rate,
        "active_barbers": active_barbers,
        "chart_data": chart_data,
    }
