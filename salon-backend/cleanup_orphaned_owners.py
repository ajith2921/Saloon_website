import asyncio
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Missing Supabase credentials")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async def main():
    print("Checking for orphaned salon_owner profiles...")
    
    # Get all salon_owners
    profiles_res = supabase.table("profiles").select("id, role, full_name").eq("role", "salon_owner").execute()
    owners = profiles_res.data
    print(f"Found {len(owners)} salon_owner profiles.")
    
    # Get all salons to map owner_ids
    salons_res = supabase.table("salons").select("id, owner_id").execute()
    salons = salons_res.data
    
    active_owner_ids = set([s.get("owner_id") for s in salons if s.get("owner_id")])
    
    orphaned_owners = [o for o in owners if o.get("id") not in active_owner_ids]
    
    print(f"Found {len(orphaned_owners)} orphaned owners (salon_owner role but no salon).")
    
    for owner in orphaned_owners:
        print(f"Downgrading {owner.get('full_name')} ({owner.get('id')}) to customer...")
        supabase.table("profiles").update({"role": "customer"}).eq("id", owner.get("id")).execute()
        
    print("Cleanup complete!")

if __name__ == "__main__":
    asyncio.run(main())
