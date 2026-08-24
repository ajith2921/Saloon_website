import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

users_response = supabase.auth.admin.list_users()
for u in users_response:
    print(f"{u.email} - {u.id}")
