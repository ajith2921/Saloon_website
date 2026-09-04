import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
BASE_URL = "http://localhost:8000"

def get_auth_token():
    # Login as dummy user to get JWT
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("VITE_SUPABASE_ANON_KEY") or "sb_publishable_BLHv-8Ddk1i7vp9-5zTWlw_uZMW39Mb"
    supabase = create_client(url, anon_key)
    try:
        res = supabase.auth.sign_in_with_password({"email": "super_dummy@queuecut.com", "password": "password123"})
        return res.session.access_token, res.user.id
    except Exception as e:
        print("Login failed:", e)
        return None, None

def test_flows():
    token, user_id = get_auth_token()
    if not token:
        return
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch salons
    print("\n--- Fetching Salons ---")
    salons_res = requests.get(f"{BASE_URL}/api/salons")
    print("Salons status:", salons_res.status_code)
    salons = salons_res.json().get("salons", [])
    if not salons:
        print("No salons found.")
        return
    salon = salons[0]
    salon_id = salon["id"]
    print(f"Using salon: {salon['name']} (ID: {salon_id})")

    # 2. Check salon stats (this was throwing 500)
    print("\n--- Checking Salon Stats ---")
    stats_res = requests.get(f"{BASE_URL}/api/salons/{salon_id}/stats")
    print("Stats status:", stats_res.status_code)
    if stats_res.status_code == 200:
        print("Stats working:", stats_res.json())
    else:
        print("Stats error:", stats_res.text)

    # 3. Check Live Queue (this was throwing 500)
    print("\n--- Checking Live Queue ---")
    queue_res = requests.get(f"{BASE_URL}/api/salons/{salon_id}/queue/live")
    print("Queue status:", queue_res.status_code)
    if queue_res.status_code == 200:
        print("Queue working:", queue_res.json())
    else:
        print("Queue error:", queue_res.text)

    # 4. Fetch services to create a token
    print("\n--- Fetching Services ---")
    services_res = requests.get(f"{BASE_URL}/api/salons/{salon_id}/services")
    services = services_res.json().get("services", [])
    if not services:
        print("No services found.")
        return
    service_id = services[0]["id"]
    print(f"Using service: {services[0]['name']} (ID: {service_id})")

    # 5. Create Token (this was throwing 500)
    print("\n--- Creating Token ---")
    payload = {
        "salon_id": salon_id,
        "service_id": service_id,
        "guest_name": "Test Guest",
        "guest_phone": "1234567890"
    }
    create_res = requests.post(f"{BASE_URL}/api/tokens", json=payload, headers=headers)
    print("Create token status:", create_res.status_code)
    if create_res.status_code == 200:
        print("Token created successfully:", create_res.json())
    else:
        print("Token creation error:", create_res.text)

if __name__ == "__main__":
    test_flows()
