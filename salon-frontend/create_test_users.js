import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../salon-backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const users = [
    { email: 'customer_test@test.com', password: 'Password123!', role: 'customer' },
    { email: 'owner_test@test.com', password: 'Password123!', role: 'salon_owner' },
    { email: 'super_test@test.com', password: 'Password123!', role: 'super_admin' },
  ];

  for (const u of users) {
    console.log(`Creating ${u.email}...`);
    let userId;
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.role }
    });

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        console.log(`User ${u.email} exists, fetching...`);
        // Find existing user
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData.users.find(x => x.email === u.email);
        if (existing) {
          userId = existing.id;
        } else {
          console.error(`Could not find existing user ${u.email}`);
          continue;
        }
      } else {
        console.error(`Auth error for ${u.email}:`, authErr);
        continue;
      }
    } else {
      userId = authData.user.id;
    }

    console.log(`Setting role ${u.role} for user ${userId}...`);
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ role: u.role })
      .eq('id', userId);
    
    if (dbErr) {
      console.error(`DB error for ${u.email}:`, dbErr);
    } else {
      console.log(`Successfully configured ${u.email} as ${u.role}`);
    }
  }
}

main();
