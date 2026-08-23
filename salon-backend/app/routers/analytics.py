from uuid import UUID
from fastapi import APIRouter, Depends
from datetime import date, timedelta

from ..dependencies import get_current_user_with_profile, require_salon_access
from ..database import supabase_admin

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/salon/{salon_id}/summary")
def get_analytics_summary(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    require_salon_access(user, salon_id, {"salon_owner"})

    # Call the new RPC function to compute analytics in the database
    res = supabase_admin.rpc("get_analytics_summary", {"p_salon_id": str(salon_id)}).execute()
    
    if res.data:
        return res.data
    
    return {
        "total_customers_today": 0,
        "avg_wait_time": 0,
        "completion_rate": 0,
        "active_barbers": 0,
        "chart_data": [],
    }
