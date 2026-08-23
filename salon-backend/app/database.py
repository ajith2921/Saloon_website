from supabase import create_client, Client
from .config import settings

# A global admin client using the service_role key to bypass RLS.
# We'll use this for backend operations that need elevated privileges.
supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key
)
