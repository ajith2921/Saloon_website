from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
from ..dependencies import get_current_user, require_role
from ..database import supabase_admin

router = APIRouter(prefix="/api/advertisements", tags=["Advertisements"])


class AdCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    image_url: str = Field(..., min_length=1)
    link_url: Optional[str] = None
    status: Literal["active", "inactive"] = "active"


class AdUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None


# ── Public read ─────────────────────────────────────────────────────────────

@router.get("")
def get_active_ads():
    """Public endpoint — returns active ads for the customer app."""
    res = supabase_admin.table("advertisements") \
        .select("*") \
        .eq("status", "active") \
        .execute()
    return {"advertisements": res.data}


# ── Super admin reads ────────────────────────────────────────────────────────

@router.get("/all")
def get_all_ads(user: dict = Depends(require_role("super_admin"))):
    """Super admin: all ads regardless of status."""
    res = supabase_admin.table("advertisements") \
        .select("*") \
        .order("created_at", desc=True) \
        .execute()
    return {"advertisements": res.data}


# ── Super admin writes ───────────────────────────────────────────────────────

@router.post("")
def create_ad(ad: AdCreate, user: dict = Depends(require_role("super_admin"))):
    res = supabase_admin.table("advertisements").insert({
        "title": ad.title,
        "image_url": ad.image_url,
        "link_url": ad.link_url,
        "status": ad.status,
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create advertisement")
    return res.data[0]


@router.put("/{ad_id}")
def update_ad(ad_id: UUID, updates: AdUpdate, user: dict = Depends(require_role("super_admin"))):
    payload = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase_admin.table("advertisements").update(payload).eq("id", ad_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    return res.data[0]


@router.delete("/{ad_id}")
def delete_ad(ad_id: UUID, user: dict = Depends(require_role("super_admin"))):
    supabase_admin.table("advertisements").delete().eq("id", ad_id).execute()
    return {"success": True, "deleted_id": ad_id}
