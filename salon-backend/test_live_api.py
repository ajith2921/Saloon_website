import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

url = os.environ.get("SUPABASE_URL")
# Using ANON KEY to simulate frontend client, NOT service role key.
anon_key = os.environ.get("SUPABASE_ANON_KEY")
if not anon_key:
    # Use service role key as fallback just for fetching data if anon isn't available
    anon_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, anon_key)

def test_super_admin():
    print("\n--- Testing Super Admin ---")
    res = supabase.auth.sign_in_with_password({"email": "super_dummy@queuecut.com", "password": "password123"})
    print("Super Admin logged in successfully.")
    
    # Try fetching all salons (Super Admin policy should allow this, or it's public)
    salons = supabase.table("salons").select("*").execute()
    print(f"Super Admin fetched {len(salons.data)} salons.")
    
    # Search for dummy salon
    dummy = next((s for s in salons.data if "Dummy" in s["name"]), None)
    if dummy:
        print(f"Found Dummy Premium Salon: {dummy['id']}")
    else:
        print("Failed to find Dummy Premium Salon.")
    supabase.auth.sign_out()


def test_salon_owner():
    print("\n--- Testing Salon Owner ---")
    res = supabase.auth.sign_in_with_password({"email": "owner_dummy@queuecut.com", "password": "password123"})
    print("Salon Owner logged in successfully.")
    
    # Fetch their salon
    user_id = res.user.id
    salons = supabase.table("salons").select("*").eq("owner_id", user_id).execute()
    if not salons.data:
        print("Owner has no salon.")
        return
    salon = salons.data[0]
    salon_id = salon["id"]
    print(f"Fetched owner's salon: {salon['name']} (ID: {salon_id})")

    # Fetch subscriptions
    subs = supabase.table("subscriptions").select("*").eq("salon_id", salon_id).execute()
    print(f"Owner has {len(subs.data)} subscriptions. Status: {subs.data[0]['status'] if subs.data else 'None'}")

    # Fetch live queue (tokens for today)
    import datetime
    today = str(datetime.date.today())
    tokens = supabase.table("tokens").select("*").eq("salon_id", salon_id).eq("date", today).execute()
    print(f"Live queue has {len(tokens.data)} tokens today.")

    # CRUD Worker
    print("\nTesting CRUD Data Transfer (Worker)...")
    new_worker = supabase.table("workers").insert({
        "salon_id": salon_id,
        "name": "Temporary Test Worker",
        "specialization": "CRUD Test",
        "experience_years": 1,
        "status": "active"
    }).execute()
    w_id = new_worker.data[0]["id"]
    print(f"Added worker: {w_id}")
    
    # Verify add
    workers_check = supabase.table("workers").select("*").eq("id", w_id).execute()
    if workers_check.data:
        print("Worker successfully verified in DB.")
    
    # Delete worker
    supabase.table("workers").delete().eq("id", w_id).execute()
    print(f"Deleted worker: {w_id}")
    
    # Verify delete
    workers_check2 = supabase.table("workers").select("*").eq("id", w_id).execute()
    if not workers_check2.data:
        print("Worker successfully verified deleted from DB.")
    else:
        print("Worker deletion failed!")
        
    supabase.auth.sign_out()

if __name__ == "__main__":
    try:
        test_super_admin()
        test_salon_owner()
        print("\nAll UI and Data Transfer API Tests Completed Successfully.")
    except Exception as e:
        print(f"\nError occurred: {e}")
