import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

users_response = supabase.auth.admin.list_users()

for u in users_response:
    print(f"Updating user {u.email} ({u.id})")
    
    # 1. Update password and confirm email
    supabase.auth.admin.update_user_by_id(u.id, {
        "password": "password123",
        "email_confirm": True
    })
    print(f"  -> Set password to password123 and confirmed email")
