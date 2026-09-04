from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Literal
from uuid import UUID
import re
from datetime import datetime

# Allowlist of safe URL protocols. Reject localhost/private IP ranges.
_PRIVATE_IP_RE = re.compile(
    r'^(localhost|127\.\d+\.\d+\.\d+|::1'
    r'|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+'
    r'|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+'
    r'|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)'
)

def _validate_photo_url(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if not v.startswith('https://'):
        raise ValueError('photo_url must use HTTPS')
    # Extract host
    try:
        host = v.split('/')[2].split(':')[0].lower()
    except IndexError:
        raise ValueError('Invalid URL format')
    if _PRIVATE_IP_RE.match(host):
        raise ValueError('photo_url may not point to a private or loopback address')
    if len(v) > 2048:
        raise ValueError('photo_url exceeds maximum length')
    return v


class TokenCreate(BaseModel):
    salon_id: UUID
    service_id: UUID
    worker_id: Optional[UUID] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    is_booking: Optional[bool] = False
    scheduled_for: Optional[datetime] = None

class TokenReassign(BaseModel):
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

    @field_validator('photo_url')
    @classmethod
    def validate_photo_url(cls, v):
        return _validate_photo_url(v)


class WorkerProvisionAccount(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=6, max_length=100)

class WorkerUpdate(BaseModel):
    user_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    specialization: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    status: Optional[Literal["active", "inactive", "on_break"]] = None
    photo_url: Optional[str] = None

    @field_validator('photo_url')
    @classmethod
    def validate_photo_url(cls, v):
        return _validate_photo_url(v)


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
