import uuid
import random
from datetime import datetime, timedelta
import asyncio
from app.database import supabase_admin
from gotrue.errors import AuthApiError

async def run_seed():
    print("Starting Dummy Data Seeding...")
    try:
        # 1. Create Auth Users
        def create_or_get_user(email, full_name, phone, role='customer'):
            try:
                print(f"Creating user {email}...")
                resp = supabase_admin.auth.admin.create_user({
                    "email": email,
                    "password": "password123",
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": full_name,
                        "phone": phone
                    }
                })
                user = resp.user
            except Exception as e:
                err_msg = str(e).lower()
                if 'already registered' in err_msg or 'already exists' in err_msg or 'authapierror' in err_msg or 'already been registered' in err_msg:
                    # Fetch user
                    users_resp = supabase_admin.auth.admin.list_users()
                    user = next((u for u in users_resp if u.email == email), None)
                    if not user:
                        print(f"Failed to find existing user {email}.")
                        return None
                else:
                    raise e
            
            # Update role (trigger creates customer by default)
            supabase_admin.table('profiles').update({'role': role}).eq('id', user.id).execute()
            return user

        super_admin = create_or_get_user('superadmin_dummy@queuecut.com', 'Dummy Super Admin', '+10000000001', 'super_admin')
        owner = create_or_get_user('owner_dummy@queuecut.com', 'Dummy Owner', '+10000000002', 'salon_owner')
        customer1 = create_or_get_user('customer1_dummy@queuecut.com', 'Dummy Customer 1', '+10000000003', 'customer')
        customer2 = create_or_get_user('customer2_dummy@queuecut.com', 'Dummy Customer 2', '+10000000004', 'customer')

        if not owner:
            print("Failed to get/create owner. Aborting.")
            return

        # 2. Create Salon
        print("Creating Salon...")
        salon_data = {
            "owner_id": owner.id,
            "name": "Elite Cuts Dummy",
            "address": "Downtown Virtual",
            "city": "Testville",
            "status": "active",
            "max_daily_tokens": 100,
            "avg_service_minutes": 20
        }
        
        # Check if salon exists
        existing_salon = supabase_admin.table('salons').select('*').eq('name', 'Elite Cuts Dummy').execute().data
        if existing_salon:
            salon = existing_salon[0]
        else:
            salon_resp = supabase_admin.table('salons').insert(salon_data).execute()
            salon = salon_resp.data[0]
            
        salon_id = salon['id']

        # 3. Create Services
        print("Creating Services...")
        services_data = [
            {"salon_id": salon_id, "name": "Classic Haircut", "price": 25.0, "duration_minutes": 30, "status": "active"},
            {"salon_id": salon_id, "name": "Beard Trim", "price": 15.0, "duration_minutes": 15, "status": "active"},
            {"salon_id": salon_id, "name": "Hair Styling", "price": 35.0, "duration_minutes": 45, "status": "active"}
        ]
        # Avoid duplicate services if running multiple times
        existing_services = supabase_admin.table('services').select('id, name').eq('salon_id', salon_id).execute().data
        existing_names = [s['name'] for s in existing_services]
        
        for srv in services_data:
            if srv['name'] not in existing_names:
                supabase_admin.table('services').insert(srv).execute()

        services = supabase_admin.table('services').select('*').eq('salon_id', salon_id).execute().data

        # 4. Create Workers
        print("Creating Workers...")
        workers_data = [
            {"salon_id": salon_id, "name": "Dummy Barber John", "experience_years": 5, "status": "active", "specialization": "Fades"},
            {"salon_id": salon_id, "name": "Dummy Stylist Sarah", "experience_years": 3, "status": "active", "specialization": "Coloring"}
        ]
        existing_workers = supabase_admin.table('workers').select('id, name').eq('salon_id', salon_id).execute().data
        existing_worker_names = [w['name'] for w in existing_workers]

        for wrk in workers_data:
            if wrk['name'] not in existing_worker_names:
                supabase_admin.table('workers').insert(wrk).execute()

        workers = supabase_admin.table('workers').select('*').eq('salon_id', salon_id).execute().data

        # 5. Create Subscription
        print("Creating Subscription...")
        plans = supabase_admin.table('subscription_plans').select('*').eq('name', 'Premium (Monthly)').execute().data
        if plans:
            plan = plans[0]
            sub_data = {
                "salon_id": salon_id,
                "plan_id": plan['id'],
                "status": "active",
                "current_period_start": datetime.utcnow().isoformat(),
                "current_period_end": (datetime.utcnow() + timedelta(days=30)).isoformat()
            }
            # Check if sub exists
            subs = supabase_admin.table('subscriptions').select('*').eq('salon_id', salon_id).execute().data
            if not subs:
                supabase_admin.table('subscriptions').insert(sub_data).execute()

        # 6. Create Tokens
        print("Creating Tokens...")
        today = datetime.utcnow().date().isoformat()
        
        try:
            # Token 1: Waiting
            supabase_admin.table('tokens').insert({
                'salon_id': salon_id,
                'customer_id': customer1.id,
                'service_id': services[0]['id'],
                'worker_id': workers[0]['id'],
                'status': 'waiting',
                'date': today,
                'token_number': 1
            }).execute()
            
            # Token 2: Waiting
            supabase_admin.table('tokens').insert({
                'salon_id': salon_id,
                'customer_id': customer2.id,
                'service_id': services[1]['id'],
                'worker_id': workers[1]['id'],
                'status': 'waiting',
                'date': today,
                'token_number': 2
            }).execute()
        except Exception as e:
            print("Tokens might already exist for today or an error occurred:", e)

        print("Seeding Complete!")

    except Exception as e:
        print("Error during seeding:", e)

if __name__ == "__main__":
    asyncio.run(run_seed())
