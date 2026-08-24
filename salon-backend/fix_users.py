import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

users_response = supabase.auth.admin.list_users()

for u in users_response:
    print(f"Updating user {u.email} ({u.id})")
    
    # 1. Update password
    supabase.auth.admin.update_user_by_id(u.id, {"password": "password123"})
    
    # 2. Determine role
    role = "customer"
    if "admin" in u.email:
        role = "super_admin"
    elif "owner" in u.email:
        role = "salon_owner"
        
    # 3. Upsert profile
    supabase.table("profiles").upsert({
        "id": u.id,
        "full_name": u.email.split('@')[0].title(),
        "role": role
    }).execute()
    
    print(f"  -> Set password to password123, role to {role}")
