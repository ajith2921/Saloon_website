import dotenv from 'dotenv';
dotenv.config(); // reads local .env

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY; 

async function testLogin(email, password) {
  console.log(`\nTesting login for ${email}...`);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Auth successful!`);
      
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${data.access_token}`,
          'Accept': 'application/json'
        }
      });
      const profileData = await profileRes.json();
      if (profileData && profileData.length > 0) {
        console.log(`✅ Profile retrieved. Role: ${profileData[0].role}`);
        console.log(`   (This user will be routed correctly by ProtectedRoutes in AppRouter.jsx)`);
      } else {
        console.log(`❌ Could not retrieve profile.`);
      }

    } else {
      console.log(`❌ Auth failed: ${data.error_description || data.msg || JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error(`❌ Request failed:`, err.message);
  }
}

async function run() {
  await testLogin('customer_test@test.com', 'Password123!');
  await testLogin('owner_test@test.com', 'Password123!');
  await testLogin('super_test@test.com', 'Password123!');
}

run();
