import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY; 

async function makeRequest(endpoint, method, token, body = null) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };
  if (body) headers['Content-Type'] = 'application/json';
  
  // Use REST for simple select, but the backend is a FastAPI app on Render! 
  // Wait, the frontend might talk to the FastAPI backend or Supabase directly.
  // The business logic is usually in FastAPI. Let's see...
}
