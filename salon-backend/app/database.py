from __future__ import annotations

from typing import Optional
from supabase import create_client, Client
from .config import settings

# Lazy-initialised admin client — created on first access to avoid failing
# at import time when running tests with dummy/missing env vars.
_supabase_admin: Optional[Client] = None


def get_supabase_admin() -> Client:
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_admin


# Backward-compatible proxy so existing code using `supabase_admin.table(...)` keeps working.
class _LazyClient:
    """Forwards all attribute access to the lazily-created Supabase admin client."""
    def __getattr__(self, name: str):
        return getattr(get_supabase_admin(), name)


supabase_admin: Client = _LazyClient()  # type: ignore[assignment]
