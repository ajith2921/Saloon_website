"""
Tests for Razorpay Webhooks
Verifies signature validation, idempotency, and state transitions.
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
import razorpay
import json

class TestRazorpayWebhooks(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=True)
        settings.razorpay_key_id = "test_key"
        settings.razorpay_key_secret = "test_secret"
        settings.razorpay_webhook_secret = "wh_secret"

    def tearDown(self):
        settings.razorpay_key_id = None
        settings.razorpay_key_secret = None
        settings.razorpay_webhook_secret = None

    def test_missing_signature_rejected(self):
        """12. Missing webhook signature -> rejected"""
        resp = self.client.post("/api/webhooks/razorpay", json={"event": "subscription.charged"})
        self.assertEqual(resp.status_code, 401)

    @patch("app.routers.webhooks.get_razorpay_client")
    def test_invalid_signature_rejected(self, mock_get_rzp):
        """11. Invalid webhook signature -> rejected"""
        mock_rzp_client = MagicMock()
        mock_get_rzp.return_value = mock_rzp_client
        mock_rzp_client.utility.verify_webhook_signature.side_effect = razorpay.errors.SignatureVerificationError("Invalid")
        
        resp = self.client.post(
            "/api/webhooks/razorpay", 
            json={"event": "subscription.charged"},
            headers={"x-razorpay-signature": "bad_sig"}
        )
        self.assertEqual(resp.status_code, 401)

    @patch("app.routers.webhooks.supabase_admin")
    @patch("app.routers.webhooks.get_razorpay_client")
    def test_valid_webhook_processed(self, mock_get_rzp, mock_db):
        """1. Verify valid signature processes event and safely ignores duplicate events (idempotency)."""
        mock_rzp_client = MagicMock()
        mock_get_rzp.return_value = mock_rzp_client
        # Doesn't raise an error, meaning signature is valid.
        
        # Setup DB mocks
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[{
            "id": "internal_sub_123",
            "salon_id": "salon_123"
        }])
        
        insert_chain = MagicMock()
        insert_chain.execute.return_value = MagicMock()
        
        update_chain = MagicMock()
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock()
        
        def mock_table(name):
            if name == "subscriptions":
                # First call is select (for mapping), second is update (for state transition)
                mock_t = MagicMock()
                mock_t.select.return_value = chain
                mock_t.update.return_value = update_chain
                return mock_t
            elif name == "payment_transactions":
                mock_t = MagicMock()
                mock_t.insert.return_value = insert_chain
                return mock_t
                
        mock_db.table.side_effect = mock_table

        payload = {
            "event": "subscription.charged",
            "event_id": "ev_123",
            "payload": {
                "subscription": {
                    "entity": {
                        "id": "sub_rzp_123"
                    }
                }
            }
        }
        
        resp = self.client.post(
            "/api/webhooks/razorpay", 
            json=payload,
            headers={"x-razorpay-signature": "good_sig"}
        )
        
        self.assertEqual(resp.status_code, 200)
        
        # Verify state transition happened
        update_chain.eq.assert_called_with("id", "internal_sub_123")

    @patch("app.routers.webhooks.supabase_admin")
    @patch("app.routers.webhooks.get_razorpay_client")
    def test_duplicate_webhook_idempotency(self, mock_get_rzp, mock_db):
        """13. Duplicate webhook event -> idempotent"""
        mock_rzp_client = MagicMock()
        mock_get_rzp.return_value = mock_rzp_client
        
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[{
            "id": "internal_sub_123",
            "salon_id": "salon_123"
        }])
        
        insert_chain = MagicMock()
        # Simulate Postgres Unique Violation error for provider_event_id
        insert_chain.execute.side_effect = Exception("duplicate key value violates unique constraint")
        
        def mock_table(name):
            if name == "subscriptions":
                mock_t = MagicMock()
                mock_t.select.return_value = chain
                return mock_t
            elif name == "payment_transactions":
                mock_t = MagicMock()
                mock_t.insert.return_value = insert_chain
                return mock_t
                
        mock_db.table.side_effect = mock_table

        payload = {
            "event": "subscription.charged",
            "event_id": "ev_dup_123",
            "payload": {
                "subscription": {
                    "entity": {
                        "id": "sub_rzp_123"
                    }
                }
            }
        }
        
        resp = self.client.post(
            "/api/webhooks/razorpay", 
            json=payload,
            headers={"x-razorpay-signature": "good_sig"}
        )
        
        # Should return 200 OK so provider stops retrying
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "idempotent_ok"})
