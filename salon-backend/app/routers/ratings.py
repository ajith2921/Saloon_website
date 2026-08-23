from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_current_user
from ..database import supabase_admin
from ..schemas.schemas import RatingCreate

router = APIRouter(prefix="/api/ratings", tags=["Ratings"])


@router.post("")
def submit_rating(rating: RatingCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token_res = supabase_admin.table("tokens").select(
        "status, customer_id, salon_id, worker_id"
    ).eq("id", str(rating.token_id)).execute()

    if not token_res.data:
        raise HTTPException(status_code=404, detail="Token not found")

    token = token_res.data[0]

    if token.get("customer_id") != user_id:
        raise HTTPException(status_code=403, detail="Invalid token for rating")

    if token.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed services")

    salon_id = token.get("salon_id")
    if not salon_id:
        raise HTTPException(status_code=400, detail="Token has no associated salon")

    worker_id = token.get("worker_id")
    if not worker_id:
        raise HTTPException(status_code=400, detail="Token has no associated worker to rate")

    existing_res = supabase_admin.table("ratings").select("id").eq(
        "token_id", str(rating.token_id)
    ).execute()
    if existing_res.data:
        raise HTTPException(status_code=400, detail="Rating already submitted for this token")

    new_rating = {
        "salon_id": str(salon_id),
        "customer_id": user_id,
        "worker_id": str(worker_id),
        "token_id": str(rating.token_id),
        "rating": rating.rating,
        "review": rating.review,
    }

    try:
        res = supabase_admin.table("ratings").insert(new_rating).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to submit rating")
        return res.data[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Rating already submitted for this token")


@router.get("/salon/{salon_id}")
def get_salon_ratings(salon_id: UUID):
    res = supabase_admin.table("ratings").select(
        "*, profiles(full_name, avatar_url), workers(name)"
    ).eq("salon_id", salon_id).order("created_at", desc=True).execute()
    return {"ratings": res.data}
