from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from uuid import UUID


class TokenCreate(BaseModel):
    salon_id: UUID
    service_id: UUID
    worker_id: Optional[UUID] = None


class RatingCreate(BaseModel):
    """Rating submission — salon_id and worker_id are derived server-side from the token."""

    model_config = ConfigDict(extra="ignore")

    token_id: UUID
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None


# ── Worker schemas ──────────────────────────────────────────────────────────

class WorkerCreate(BaseModel):
    salon_id: UUID
    user_id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=100)
    specialization: Optional[str] = None
    experience_years: int = Field(default=0, ge=0, le=50)
    status: Literal["active", "inactive", "on_break"] = "active"
    photo_url: Optional[str] = None


class WorkerUpdate(BaseModel):
    user_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    specialization: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    status: Optional[Literal["active", "inactive", "on_break"]] = None
    photo_url: Optional[str] = None


# ── Service schemas ─────────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    salon_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    duration_minutes: int = Field(..., gt=0, le=480)
    status: Literal["active", "inactive"] = "active"


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    duration_minutes: Optional[int] = Field(None, gt=0, le=480)
    status: Optional[Literal["active", "inactive"]] = None


# ── Subscription schemas ────────────────────────────────────────────────────

from datetime import datetime

class SubscriptionPlan(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    price: float
    currency: str
    billing_interval: str
    trial_days: Optional[int] = 0
    max_workers: Optional[int] = None
    max_services: Optional[int] = None
    max_monthly_tokens: Optional[int] = None
    max_advertisements: Optional[int] = None
    features: Optional[list] = []
    is_active: bool
    sort_order: int

class SalonSubscription(BaseModel):
    id: UUID
    salon_id: UUID
    plan_id: UUID
    status: str
    started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    cancelled_at: Optional[datetime] = None

class SubscriptionEntitlements(BaseModel):
    plan_name: str
    status: str
    max_workers: Optional[int] = None
    max_services: Optional[int] = None
    max_monthly_tokens: Optional[int] = None
    max_advertisements: Optional[int] = None

class BillingCheckoutRequest(BaseModel):
    plan_id: UUID

class BillingCheckoutResponse(BaseModel):
    provider_order_id: str
    razorpay_key_id: str
    amount: int
    currency: str
