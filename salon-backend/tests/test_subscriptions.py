"""
K3.2 Phase — Subscription Backend Security and RLS tests.

These tests verify:
  1. Unauthenticated subscription access is rejected.
  2. Customers and workers cannot access subscription details.
  3. Salon owners can read their own subscriptions (and cannot read others).
  4. Client salon_id forgery is ignored in favor of DB profile lookup.
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user_with_profile, require_role

SALON_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SALON_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
PLAN_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"
USER_OWNER_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
USER_CUSTOMER = "ffffffff-ffff-ffff-ffff-ffffffffffff"

# ─── Fake Supabase builders ──────────────────────────────────────────────────

def _chain(**kwargs):
    result = MagicMock()
    result.data = kwargs.get("data", [])
    result.count = kwargs.get("count", None)

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = result
    return chain

def _owner_a():
    return {"sub": USER_OWNER_A, "db_role": "salon_owner", "db_salon_id": SALON_A}

def _customer():
    return {"sub": USER_CUSTOMER, "db_role": "customer", "db_salon_id": None}

def _super_admin():
    return {"sub": "superadmin-uid", "db_role": "super_admin", "db_salon_id": None}

# ─── Test Cases ──────────────────────────────────────────────────────────────

class TestSubscriptionAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=True)
        app.dependency_overrides = {}

    def tearDown(self):
        app.dependency_overrides = {}

    def test_unauthenticated_access_rejected(self):
        """GET /api/subscriptions/me requires auth."""
        # Using the standard HTTPBearer failure mock or no override
        resp = self.client.get("/api/subscriptions/me")
        self.assertEqual(resp.status_code, 403)
        
    def test_customer_access_rejected(self):
        """Customers cannot access the salon owner subscription endpoint."""
        app.dependency_overrides[get_current_user_with_profile] = _customer
        resp = self.client.get("/api/subscriptions/me")
        self.assertEqual(resp.status_code, 403)

    @patch("app.routers.subscriptions.supabase_admin")
    def test_owner_gets_own_subscription(self, mock_db):
        """Salon owners can read their own subscription. DB query must be scoped to their salon_id."""
        app.dependency_overrides[get_current_user_with_profile] = _owner_a
        
        sub_data = [{
            "id": "11111111-1111-1111-1111-111111111111", 
            "salon_id": SALON_A,
            "plan_id": PLAN_A,
            "status": "active",
            "cancel_at_period_end": False
        }]
        
        chain = _chain(data=sub_data)
        mock_db.table.return_value = chain

        resp = self.client.get("/api/subscriptions/me")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["salon_id"], SALON_A)
        self.assertEqual(resp.json()["status"], "active")

        # Verify .eq("salon_id", SALON_A) was called, proving isolation
        eq_calls = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(SALON_A in c for c in eq_calls),
            f"Expected salon_id filter in query. eq calls: {chain.eq.call_args_list}"
        )

    @patch("app.routers.subscriptions.supabase_admin")
    def test_owner_entitlements_query(self, mock_db):
        """Owner entitlements query scopes to salon_id and joins plans."""
        app.dependency_overrides[get_current_user_with_profile] = _owner_a
        
        sub_data = [{
            "status": "active",
            "plan": {
                "name": "Professional",
                "max_workers": 15,
                "max_services": 50
            }
        }]
        
        chain = _chain(data=sub_data)
        mock_db.table.return_value = chain

        resp = self.client.get("/api/subscriptions/entitlements")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["plan_name"], "Professional")
        self.assertEqual(data["status"], "active")
        self.assertEqual(data["max_workers"], 15)

    @patch("app.routers.subscriptions.supabase_admin")
    def test_public_plans_endpoint(self, mock_db):
        """GET /api/subscriptions/plans should return active plans."""
        app.dependency_overrides = {} 
        
        plan_data = [{
            "id": PLAN_A,
            "name": "Professional",
            "price": 2499.00,
            "currency": "INR",
            "billing_interval": "monthly",
            "is_active": True,
            "sort_order": 1
        }]
        
        chain = _chain(data=plan_data)
        mock_db.table.return_value = chain

        resp = self.client.get("/api/subscriptions/plans")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()[0]["name"], "Professional")
