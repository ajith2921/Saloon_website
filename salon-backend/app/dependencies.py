from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional, Dict, Any
from .config import settings
from .database import supabase_admin

# We use HTTPBearer to extract the JWT from the Authorization header.
security = HTTPBearer()


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
            "role": getattr(user, 'role', 'authenticated'),
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
    Extends get_current_user by fetching the role from the `profiles` table.
    This is the source of truth for roles, not JWT user_metadata.

    A salon relationship is derived from the canonical tables instead of a
    non-existent `profiles.salon_id` column: owners are linked through
    `salons.owner_id`, workers through `workers.user_id`.
    """
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    res = supabase_admin.table("profiles").select("role").eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="User profile not found")

    user["db_role"] = res.data.get("role", "customer")
    user["db_salon_id"] = None

    if user["db_role"] == "salon_owner":
        salon_res = supabase_admin.table("salons").select("id").eq("owner_id", user_id).limit(1).execute()
        if salon_res.data:
            user["db_salon_id"] = salon_res.data[0]["id"]
    elif user["db_role"] == "worker":
        worker_res = supabase_admin.table("workers").select("salon_id").eq("user_id", user_id).limit(1).execute()
        if worker_res.data:
            user["db_salon_id"] = worker_res.data[0]["salon_id"]

    return user


def require_salon_access(user: Dict[str, Any], salon_id: str, allowed_roles: set[str]) -> None:
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
    Usage: Depends(require_role('salon_owner'))
    Accepts a single role string or a pipe-separated list e.g. 'salon_owner|worker'
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
