"""
Root conftest.py — applied to all tests in the suite.

Sets TESTING=true BEFORE any app module is imported so that:
  - The slowapi rate limiter is disabled (prevents spurious 429s in sequential tests)
  - The lazy Supabase client is never triggered (tests mock it at the point of use)
"""
import os

# Must be set before any app import occurs
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dummy",
)
os.environ.setdefault("SUPABASE_JWT_SECRET", "dummy_jwt_secret_for_tests")
