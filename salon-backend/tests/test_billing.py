"""
Tests for Billing Checkout Endpoint
Verifies RBAC, DB authority, duplicate subscription prevention, and Razorpay client logic.
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user_with_profile, require_role
from app.config import settings

SALON_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PLAN_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"
USER_OWNER_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
USER_CUSTOMER = "ffffffff-ffff-ffff-ffff-ffffffffffff"

def _chain(**kwargs):
    result = MagicMock()
    result.data = kwargs.get("data", [])
    
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.insert.return_value = chain
    chain.execute.return_value = result
    return chain

def _owner_a():
    return {"sub": USER_OWNER_A, "db_role": "salon_owner", "db_salon_id": SALON_A}

def _customer():
    return {"sub": USER_CUSTOMER, "db_role": "customer", "db_salon_id": None}


class TestBillingAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=True)
        app.dependency_overrides = {}
        # Ensure we have fake keys for the test
        settings.razorpay_key_id = "test_key"
        settings.razorpay_key_secret = "test_secret"

    def tearDown(self):
        app.dependency_overrides = {}
        settings.razorpay_key_id = None
        settings.razorpay_key_secret = None

    def test_unauthorized_checkout_fails(self):
        # 1. Customer attempts checkout -> 403
        app.dependency_overrides[get_current_user_with_profile] = _customer
        resp = self.client.post("/api/billing/checkout", json={"plan_id": PLAN_A})
        self.assertEqual(resp.status_code, 403)

    @patch("app.routers.billing.supabase_admin")
    def test_duplicate_active_subscription_prevented(self, mock_db):
        """10. Duplicate active subscription -> rejected"""
        app.dependency_overrides[get_current_user_with_profile] = _owner_a
        
        # Mock that an active subscription exists
        mock_db.table.return_value = _chain(data=[{"id": "1", "status": "active"}])
        
        resp = self.client.post("/api/billing/checkout", json={"plan_id": PLAN_A})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("active subscription", resp.json()["detail"])

    @patch("app.routers.billing.get_razorpay_client")
    @patch("app.routers.billing.supabase_admin")
    def test_valid_checkout_uses_db_plan(self, mock_db, mock_get_rzp):
        """4, 5, 6, 7. Backend strictly uses DB pricing and ignores client limits."""
        app.dependency_overrides[get_current_user_with_profile] = _owner_a
        
        # Simulate sequence of DB calls
        # Call 1: Check existing subscriptions (returns none)
        # Call 2: Check plan
        # Call 3: Check billing customers
        # Call 4: Insert subscription
        
        def mock_table(name):
            if name == "subscriptions":
                # For select, return empty to pass active check. For insert, just return empty data.
                return _chain(data=[])
            elif name == "subscription_plans":
                return _chain(data=[{
                    "id": PLAN_A,
                    "is_active": True,
                    "provider_plan_id": "plan_test_123",
                    "price": 999.00,
                    "currency": "INR"
                }])
            elif name == "billing_customers":
                return _chain(data=[])
            return _chain(data=[])
            
        mock_db.table.side_effect = mock_table
        
        mock_rzp_client = MagicMock()
        mock_get_rzp.return_value = mock_rzp_client
        mock_rzp_client.subscription.create.return_value = {"id": "sub_test_123"}
        
        # Notice we only send plan_id. The endpoint fetches the price from DB.
        resp = self.client.post("/api/billing/checkout", json={"plan_id": PLAN_A})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["provider_order_id"], "sub_test_123")
        self.assertEqual(data["amount"], 99900) # price converted to paise
        
        # Verify Razorpay was called with the DB provider_plan_id
        mock_rzp_client.subscription.create.assert_called_once()
        call_args = mock_rzp_client.subscription.create.call_args[0][0]
        self.assertEqual(call_args["plan_id"], "plan_test_123")

