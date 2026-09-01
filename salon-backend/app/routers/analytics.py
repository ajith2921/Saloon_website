from uuid import UUID
from fastapi import APIRouter, Depends
from datetime import date, timedelta

from ..dependencies import get_current_user_with_profile, require_salon_access
from ..database import supabase_admin

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/salon/{salon_id}/summary")
def get_analytics_summary(salon_id: UUID, user: dict = Depends(get_current_user_with_profile)):
    require_salon_access(user, salon_id, {"salon_owner"})

    # Call the original RPC function to compute basic stats
    res = supabase_admin.rpc("get_analytics_summary", {"p_salon_id": str(salon_id)}).execute()
    
    data = res.data if res.data else {
        "total_customers_today": 0,
        "avg_wait_time": 0,
        "completion_rate": 0,
        "active_barbers": 0,
        "chart_data": [],
    }

    # Fetch all completed tokens in the last 7 days with their service and worker
    today = date.today()
    week_start = today - timedelta(days=6)
    
    tokens_res = supabase_admin.table("tokens") \
        .select("id, date, status, services(id, name, price), workers(id, name)") \
        .eq("salon_id", salon_id) \
        .eq("status", "completed") \
        .gte("date", str(week_start)) \
        .execute()
        
    all_tokens = tokens_res.data or []
    
    # Calculate Revenue for chart_data and Top Services/Workers
    services_counts = {}
    workers_counts = {}
    daily_revenue = {str(today - timedelta(days=i)): 0 for i in range(7)}
    
    for t in all_tokens:
        d = t.get("date")
        service = t.get("services")
        worker = t.get("workers")
        
        price = float(service.get("price", 0)) if service else 0
        if d in daily_revenue:
            daily_revenue[d] += price
            
        if service:
            s_id = service["id"]
            if s_id not in services_counts:
                services_counts[s_id] = {"name": service["name"], "count": 0, "revenue": 0}
            services_counts[s_id]["count"] += 1
            services_counts[s_id]["revenue"] += price
            
        if worker:
            w_id = worker["id"]
            if w_id not in workers_counts:
                workers_counts[w_id] = {"name": worker["name"], "count": 0, "revenue": 0}
            workers_counts[w_id]["count"] += 1
            workers_counts[w_id]["revenue"] += price

    # Attach revenue to chart_data
    if "chart_data" in data and data["chart_data"]:
        # chart_data from RPC has 'name' as day of week (e.g. 'Mon'). We need to map it carefully.
        # But we also have daily_revenue keyed by YYYY-MM-DD. 
        # For simplicity, we just inject the revenue in order.
        # Wait, the RPC generated 7 days in order. So we can just reverse daily_revenue items or sort them.
        sorted_days = sorted(daily_revenue.keys())
        for i, cd in enumerate(data["chart_data"]):
            if i < len(sorted_days):
                cd["revenue"] = daily_revenue[sorted_days[i]]
            else:
                cd["revenue"] = 0

    top_services = sorted(services_counts.values(), key=lambda x: x["count"], reverse=True)[:5]
    top_workers = sorted(workers_counts.values(), key=lambda x: x["count"], reverse=True)[:5]
    
    data["top_services"] = top_services
    data["top_workers"] = top_workers

    return data
