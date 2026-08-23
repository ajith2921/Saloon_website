"""
E1 — Token History API contract tests.

Verifies:
  1. GET /api/tokens/history returns {"tokens": [...]} envelope (not a bare list).
  2. Each token in the list contains the fields History.jsx depends on:
       id, token_number, status, created_at
       salons  -> {name}
       services -> {name, price}
       ratings  -> [{id}, ...]   (for the "Rate" button)
  3. The endpoint is scoped to the authenticated customer (customer_id filter).
  4. Anonymous access is rejected (401).
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user, get_current_user_with_profile

CUSTOMER_ID = "11111111-1111-1111-1111-111111111111"
TOKEN_ID    = "22222222-2222-2222-2222-222222222222"

FAKE_TOKEN = {
    "id": TOKEN_ID,
    "token_number": 7,
    "status": "completed",
    "created_at": "2026-08-01T10:00:00+00:00",
    "customer_id": CUSTOMER_ID,
    "salon_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "salons": {"name": "Ajith Men's Salon"},
    "services": {"name": "Haircut", "price": 150},
    "workers": {"name": "Arun"},
    "ratings": [],           # empty → "Rate" button should appear
}

FAKE_TOKEN_RATED = {
    **FAKE_TOKEN,
    "id": "33333333-3333-3333-3333-333333333333",
    "ratings": [{"id": "44444444-4444-4444-4444-444444444444"}],  # already rated
}


def _fake_customer():
    return {"sub": CUSTOMER_ID, "db_role": "customer"}


def _chain(data):
    c = MagicMock()
    result = MagicMock()
    result.data = data
    c.select.return_value = c
    c.eq.return_value     = c
    c.order.return_value  = c
    c.limit.return_value  = c
    c.execute.return_value = result
    return c


class TestTokenHistoryEnvelope(unittest.TestCase):
    """The /history endpoint must return {"tokens": [...]} not a bare list."""

    def setUp(self):
        app.dependency_overrides[get_current_user] = lambda: _fake_customer()
        app.dependency_overrides[get_current_user_with_profile] = lambda: _fake_customer()
        self.client = TestClient(app, raise_server_exceptions=True)

    def tearDown(self):
        app.dependency_overrides = {}

    @patch("app.routers.tokens.supabase_admin")
    def test_history_returns_tokens_envelope(self, mock_db):
        """Response must be a JSON object with a 'tokens' key."""
        chain = _chain([FAKE_TOKEN])
        mock_db.table.return_value = chain

        resp = self.client.get("/api/tokens/history")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsInstance(body, dict, "Response must be a JSON object, not a bare list")
        self.assertIn("tokens", body, "Response must contain a 'tokens' key")
        self.assertIsInstance(body["tokens"], list, "'tokens' value must be a list")

    @patch("app.routers.tokens.supabase_admin")
    def test_history_tokens_contain_required_fields(self, mock_db):
        """Each token must carry the fields History.jsx reads."""
        chain = _chain([FAKE_TOKEN])
        mock_db.table.return_value = chain

        resp = self.client.get("/api/tokens/history")
        self.assertEqual(resp.status_code, 200)

        tokens = resp.json()["tokens"]
        self.assertEqual(len(tokens), 1)
        t = tokens[0]

        # Fields directly accessed by History.jsx
        self.assertIn("id",           t, "Missing 'id'")
        self.assertIn("token_number", t, "Missing 'token_number'")
        self.assertIn("status",       t, "Missing 'status'")
        self.assertIn("created_at",   t, "Missing 'created_at'")

        # Nested joins
        self.assertIsNotNone(t.get("salons"),   "Missing 'salons' join")
        self.assertIn("name", t["salons"],      "'salons' must contain 'name'")

        self.assertIsNotNone(t.get("services"), "Missing 'services' join")
        self.assertIn("name",  t["services"],   "'services' must contain 'name'")
        self.assertIn("price", t["services"],   "'services' must contain 'price'")

        # ratings join — required for "Rate" button logic
        self.assertIn("ratings", t, "Missing 'ratings' join (needed for Rate button)")
        self.assertIsInstance(t["ratings"], list)

    @patch("app.routers.tokens.supabase_admin")
    def test_history_scoped_to_customer(self, mock_db):
        """
        The query must filter by customer_id == authenticated user's sub.
        Verify that .eq("customer_id", CUSTOMER_ID) was called.
        """
        chain = _chain([FAKE_TOKEN])
        mock_db.table.return_value = chain

        self.client.get("/api/tokens/history")

        eq_calls = chain.eq.call_args_list
        customer_filter_found = any(
            CUSTOMER_ID in str(c) for c in eq_calls
        )
        self.assertTrue(
            customer_filter_found,
            f"Expected eq('customer_id', '{CUSTOMER_ID}') in query. Got: {eq_calls}"
        )

    @patch("app.routers.tokens.supabase_admin")
    def test_history_empty_list_still_uses_envelope(self, mock_db):
        """Even when there are no tokens the envelope must be present."""
        chain = _chain([])
        mock_db.table.return_value = chain

        resp = self.client.get("/api/tokens/history")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("tokens", body)
        self.assertEqual(body["tokens"], [])

    @patch("app.routers.tokens.supabase_admin")
    def test_history_includes_ratings_for_rate_button_logic(self, mock_db):
        """
        History.jsx shows the Rate button only when token.ratings?.length == 0.
        Both already-rated and un-rated tokens must be present and distinguishable.
        """
        chain = _chain([FAKE_TOKEN, FAKE_TOKEN_RATED])
        mock_db.table.return_value = chain

        resp = self.client.get("/api/tokens/history")
        tokens = resp.json()["tokens"]

        unrated = [t for t in tokens if len(t.get("ratings", [])) == 0]
        rated   = [t for t in tokens if len(t.get("ratings", [])) > 0]
        self.assertEqual(len(unrated), 1, "Expected 1 un-rated token")
        self.assertEqual(len(rated),   1, "Expected 1 already-rated token")


class TestTokenHistoryAuth(unittest.TestCase):
    """Anonymous callers must be rejected."""

    def setUp(self):
        app.dependency_overrides = {}
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides = {}

    def test_history_requires_auth(self):
        resp = self.client.get("/api/tokens/history")
        self.assertIn(resp.status_code, [401, 403],
                      f"Expected 401/403 without auth, got {resp.status_code}")


if __name__ == "__main__":
    unittest.main()
