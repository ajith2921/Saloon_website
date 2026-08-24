import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

users_to_create = [
    {"email": "admin_tester@queuecut.com", "password": "password123", "role": "salon_owner", "name": "Admin Tester"},
    {"email": "super_tester@queuecut.com", "password": "password123", "role": "super_admin", "name": "Super Tester"},
    {"email": "user_tester@queuecut.com", "password": "password123", "role": "customer", "name": "User Tester"}
]

for u in users_to_create:
    try:
        res = supabase.auth.admin.create_user({
            "email": u["email"],
            "password": u["password"],
            "email_confirm": True,
            "user_metadata": {"full_name": u["name"]}
        })
        user_id = res.user.id
        print(f"Created {u['email']} with ID {user_id}")
        
        supabase.table("profiles").upsert({
            "id": user_id,
            "full_name": u["name"],
            "role": u["role"]
        }).execute()
        print(f"Updated role for {u['email']} to {u['role']}")
    except Exception as e:
        print(f"Error creating {u['email']}: {e}")
