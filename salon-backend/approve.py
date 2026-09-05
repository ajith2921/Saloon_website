import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Update all pending salons to active
res = supabase.table("salons").update({"status": "active"}).eq("status", "pending").execute()
print(f"Approved {len(res.data)} salons.")
