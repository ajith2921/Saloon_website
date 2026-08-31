from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import time
import threading
from typing import Optional, Dict, Any
from .config import settings
from .database import supabase_admin

# We use HTTPBearer to extract the JWT from the Authorization header.
security = HTTPBearer()

# ---------------------------------------------------------------------------
# In-process profile cache - eliminates 2-3 DB round-trips per request
# Stores resolved profile (role + salon_id) keyed by user_id.
# TTL of 60s: short enough to pick up role changes, long enough to matter.
# Thread-safe with a simple lock - tiny dict, negligible memory.
# ---------------------------------------------------------------------------
_profile_cache: Dict[str, Dict[str, Any]] = {}
_profile_cache_lock = threading.Lock()
_PROFILE_TTL = 60  # seconds


def _get_cached_profile(user_id: str) -> Optional[Dict[str, Any]]:
    with _profile_cache_lock:
        entry = _profile_cache.get(user_id)
        if entry and (time.monotonic() - entry["_ts"]) < _PROFILE_TTL:
            return entry
        return None


def _set_cached_profile(user_id: str, data: Dict[str, Any]) -> None:
    with _profile_cache_lock:
        _profile_cache[user_id] = {**data, "_ts": time.monotonic()}
    _evict_stale_profiles()


def _evict_stale_profiles() -> None:
    now = time.monotonic()
    with _profile_cache_lock:
        stale = [k for k, v in _profile_cache.items() if (now - v["_ts"]) >= _PROFILE_TTL]
        for k in stale:
            del _profile_cache[k]


def evict_profile_cache(user_id: str) -> None:
    """Manually evict a specific user's profile from the cache.
    Useful when a user's role or salon association is updated and needs immediate effect."""
    with _profile_cache_lock:
        if user_id in _profile_cache:
            del _profile_cache[user_id]


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        user_response = supabase_admin.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {
            "sub": user.id,
            "email": user.email,
            "role": getattr(user, "role", "authenticated"),
            "user_metadata": user.user_metadata,
            "aud": user.aud
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_with_profile(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Extends get_current_user by fetching the role from the profiles table.
    This is the source of truth for roles, not JWT user_metadata.

    Results are cached in-process for 60 seconds to avoid a DB round-trip on
    every single authenticated request (the dominant latency source on Render).

    A salon relationship is derived from the canonical tables instead of a
    non-existent profiles.salon_id column: owners are linked through
    salons.owner_id, workers through workers.user_id.
    """
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # --- Cache hit: skip all DB queries ---
    cached = _get_cached_profile(user_id)
    if cached:
        user["db_role"] = cached["db_role"]
        user["db_salon_id"] = cached["db_salon_id"]
        return user

    # --- Cache miss: resolve role + salon from DB ---
    res = supabase_admin.table("profiles").select("role").eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="User profile not found")

    db_role = res.data.get("role", "customer")
    db_salon_id = None

    if db_role == "salon_owner":
        salon_res = supabase_admin.table("salons").select("id").eq("owner_id", user_id).limit(1).execute()
        if salon_res.data:
            db_salon_id = salon_res.data[0]["id"]
    elif db_role == "worker":
        worker_res = supabase_admin.table("workers").select("salon_id").eq("user_id", user_id).limit(1).execute()
        if worker_res.data:
            db_salon_id = worker_res.data[0]["salon_id"]

    user["db_role"] = db_role
    user["db_salon_id"] = db_salon_id

    # Store resolved profile in cache for subsequent requests
    _set_cached_profile(user_id, {"db_role": db_role, "db_salon_id": db_salon_id})

    return user


def require_salon_access(user: Dict[str, Any], salon_id: str, allowed_roles: set) -> None:
    """Enforce tenant membership for a salon-scoped operation.

    The service-role database client bypasses RLS, so every sensitive backend
    operation must perform this check before reading or mutating tenant data.
    """
    role = user.get("db_role", "customer")
    if role == "super_admin":
        return
    if role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have access to this salon")
    if str(user.get("db_salon_id") or "") != str(salon_id):
        raise HTTPException(status_code=403, detail="You do not have access to this salon")


def require_role(role: str):
    """
    Dependency that enforces role-based access control by querying the profiles table.
    Usage: Depends(require_role("salon_owner"))
    Accepts a single role string or a pipe-separated list e.g. "salon_owner|worker"
    """
    allowed_roles = set(role.split("|"))

    def role_checker(user: dict = Depends(get_current_user_with_profile)):
        db_role = user.get("db_role", "customer")
        if db_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}. Your role: {db_role}",
            )
        return user

    return role_checker
