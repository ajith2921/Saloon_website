"""
E2.1 + E2.2 — Token Security Tests.

E2.1 — Token History / Read Security
  1. Customer can access their own history.
  2. History is scoped to authenticated JWT sub — query MUST filter by customer_id.
  3. Unauthenticated history access → 401/403.
  4. GET /api/tokens/{id} — customer can view their own token.
  5. GET /api/tokens/{id} — customer CANNOT view another customer's token (403).
  6. Salon owner can view a token at their own salon.
  7. Salon owner CANNOT view a token at another salon (403).
  8. Live queue endpoint omits customer_id (data minimization).
  9. Admin queue endpoint requires authentication.
  10. Admin queue endpoint enforces salon membership.

E2.2 — Token Mutation Security
  11. POST /api/tokens — customer_id is sourced from JWT, not request body.
  12. PUT cancel — customer can cancel their own waiting token.
  13. PUT cancel — customer CANNOT cancel another customer's token (403).
  14. PUT call/start/complete — customer CANNOT perform owner actions (403).
  15. Salon owner can call/start/complete tokens at their own salon.
  16. Salon owner CANNOT mutate tokens at another salon (403).
  17. Invalid state transition is rejected (400).
  18. Invalid action name is rejected (400).
  19. Missing token returns 404.
  20. Unauthenticated mutation → 401/403.
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user, get_current_user_with_profile

# ─── Constants ───────────────────────────────────────────────────────────────

CUSTOMER_A = "aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa"
CUSTOMER_B = "bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb"
SALON_A    = "cccccccc-0000-0000-0000-cccccccccccc"
SALON_B    = "dddddddd-0000-0000-0000-dddddddddddd"
TOKEN_A    = "eeeeeeee-0000-0000-0000-eeeeeeeeeeee"
TOKEN_B    = "ffffffff-0000-0000-0000-ffffffffffff"
WORKER_A   = "11111111-0000-0000-0000-111111111111"
SERVICE_A  = "22222222-0000-0000-0000-222222222222"
OWNER_A_ID = "33333333-0000-0000-0000-333333333333"
OWNER_B_ID = "44444444-0000-0000-0000-444444444444"

# ─── Fake token records ───────────────────────────────────────────────────────

_TOKEN_A_WAITING = {
    "id": TOKEN_A,
    "customer_id": CUSTOMER_A,
    "salon_id": SALON_A,
    "status": "waiting",
    "token_number": 5,
    "salons": {"name": "Salon A", "address": "1 Main St"},
    "workers": {"name": "Arun", "photo_url": None},
    "services": {"name": "Haircut", "price": 150, "duration_minutes": 30},
}

_TOKEN_B_WAITING = {
    **_TOKEN_A_WAITING,
    "id": TOKEN_B,
    "customer_id": CUSTOMER_B,
    "salon_id": SALON_B,
}

_TOKEN_A_SERVING = {**_TOKEN_A_WAITING, "status": "serving"}
_TOKEN_A_COMPLETED = {**_TOKEN_A_WAITING, "status": "completed"}
_TOKEN_A_CALLED = {**_TOKEN_A_WAITING, "status": "called"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _chain(data):
    c = MagicMock()
    result = MagicMock()
    result.data = data
    for m in ("select", "eq", "order", "limit", "in_", "update", "insert", "delete", "single"):
        getattr(c, m).return_value = c
    c.execute.return_value = result
    return c


def _customer_a():
    return {"sub": CUSTOMER_A, "db_role": "customer"}


def _customer_b():
    return {"sub": CUSTOMER_B, "db_role": "customer"}


def _owner_a():
    return {"sub": OWNER_A_ID, "db_role": "salon_owner", "db_salon_id": SALON_A}


def _owner_b():
    return {"sub": OWNER_B_ID, "db_role": "salon_owner", "db_salon_id": SALON_B}


# ─────────────────────────────────────────────────────────────────────────────
# E2.1 — Read / History Security
# ─────────────────────────────────────────────────────────────────────────────

class TestHistoryReadSecurity(unittest.TestCase):
    """E2.1: History endpoint authentication and data scoping."""

    def tearDown(self):
        app.dependency_overrides = {}

    # ── Test 1 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_can_read_own_history(self, mock_db):
        """Authenticated customer receives HTTP 200 with tokens envelope."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        mock_db.table.return_value = _chain([_TOKEN_A_WAITING])
        client = TestClient(app)
        resp = client.get("/api/tokens/history")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("tokens", body)
        self.assertIsInstance(body["tokens"], list)

    # ── Test 2 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_history_query_uses_jwt_customer_id(self, mock_db):
        """The DB query MUST filter by customer_id == JWT sub. Never trust the body."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        chain = _chain([])
        mock_db.table.return_value = chain
        client = TestClient(app)
        client.get("/api/tokens/history")
        eq_args = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(CUSTOMER_A in arg for arg in eq_args),
            f"Expected eq filter with CUSTOMER_A. Got: {eq_args}",
        )

    # ── Test 3 ──
    def test_history_without_auth_returns_401_or_403(self):
        """Unauthenticated access to /history must be rejected."""
        app.dependency_overrides = {}
        client = TestClient(app)
        resp = client.get("/api/tokens/history")
        self.assertIn(resp.status_code, [401, 403])

    # ── Test 4 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_can_view_own_token(self, mock_db):
        """GET /api/tokens/{id} — customer can view their own token."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        mock_db.table.return_value = _chain([_TOKEN_A_WAITING])
        client = TestClient(app)
        resp = client.get(f"/api/tokens/{TOKEN_A}")
        self.assertEqual(resp.status_code, 200)

    # ── Test 5 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_cannot_view_another_customers_token(self, mock_db):
        """Customer A cannot view Customer B's token (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        # Return a token that belongs to CUSTOMER_B
        mock_db.table.return_value = _chain([_TOKEN_B_WAITING])
        client = TestClient(app)
        resp = client.get(f"/api/tokens/{TOKEN_B}")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 6 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_salon_owner_can_view_token_at_own_salon(self, mock_db):
        """Salon Owner A can view a token that belongs to SALON_A."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain([_TOKEN_A_WAITING])
        client = TestClient(app)
        resp = client.get(f"/api/tokens/{TOKEN_A}")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200, got {resp.status_code}: {resp.text}")

    # ── Test 7 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_salon_owner_cannot_view_token_at_other_salon(self, mock_db):
        """Salon Owner A cannot view a token that belongs to SALON_B (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        # Token belongs to SALON_B, but the authenticated owner is for SALON_A
        mock_db.table.return_value = _chain([_TOKEN_B_WAITING])
        client = TestClient(app)
        resp = client.get(f"/api/tokens/{TOKEN_B}")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 8 ──
    @patch("app.routers.salons.supabase_admin")
    def test_public_live_queue_omits_customer_id(self, mock_db):
        """The public live queue SELECT must not request customer_id."""
        mock_db.table.return_value = _chain([])
        client = TestClient(app)
        client.get(f"/api/salons/{SALON_A}/queue/live")
        select_call = mock_db.table.return_value.select.call_args_list[0]
        select_str = select_call[0][0] if select_call[0] else str(select_call)
        self.assertNotIn(
            "customer_id", select_str,
            f"customer_id must not appear in the public live queue SELECT. Got: {select_str}",
        )

    # ── Test 9 ──
    def test_admin_queue_endpoint_requires_authentication(self):
        """GET /api/salons/{id}/queue/admin must reject unauthenticated callers."""
        app.dependency_overrides = {}
        client = TestClient(app)
        resp = client.get(f"/api/salons/{SALON_A}/queue/admin")
        self.assertIn(resp.status_code, [401, 403])

    # ── Test 10 ──
    @patch("app.routers.salons.supabase_admin")
    def test_admin_queue_endpoint_enforces_salon_membership(self, mock_db):
        """Owner of SALON_B cannot access the admin queue for SALON_A (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_b()
        mock_db.table.return_value = _chain([])
        client = TestClient(app)
        # Owner B requesting SALON_A's admin queue
        resp = client.get(f"/api/salons/{SALON_A}/queue/admin")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")


# ─────────────────────────────────────────────────────────────────────────────
# E2.2 — Token Mutation Security
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenMutationSecurity(unittest.TestCase):
    """E2.2: Every token mutation must enforce ownership server-side."""

    def tearDown(self):
        app.dependency_overrides = {}

    # ── Test 11 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_token_create_customer_id_from_jwt_not_body(self, mock_db):
        """POST /api/tokens: the p_customer_id passed to the RPC must be CUSTOMER_A's JWT sub.
        Any customer_id in the body is irrelevant — the backend must ignore it."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: {
            **_customer_a(), "db_role": "customer"
        }
        rpc_result = MagicMock()
        rpc_result.data = [{"id": TOKEN_A, "token_number": 1, "status": "waiting"}]
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = rpc_result
        mock_db.rpc.return_value = rpc_chain

        client = TestClient(app)
        resp = client.post("/api/tokens", json={
            "salon_id": SALON_A,
            "service_id": SERVICE_A,
            "worker_id": None,
        })
        # Must have called create_queue_token with p_customer_id = CUSTOMER_A
        self.assertTrue(mock_db.rpc.called, "RPC must be called")
        call_args = mock_db.rpc.call_args
        rpc_params = call_args[0][1]  # second positional arg is the params dict
        self.assertEqual(rpc_params.get("p_customer_id"), CUSTOMER_A,
                         f"p_customer_id must be JWT sub ({CUSTOMER_A}). Got: {rpc_params}")

    # ── Test 12 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_can_cancel_own_waiting_token(self, mock_db):
        """Customer A can cancel their own waiting token."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        fetch_chain = _chain([{"customer_id": CUSTOMER_A, "salon_id": SALON_A, "status": "waiting"}])
        update_chain = _chain([{"id": TOKEN_A, "status": "cancelled"}])

        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                call_count["n"] += 1
                return fetch_chain if call_count["n"] == 1 else update_chain
            return _chain([])
        mock_db.table.side_effect = _table

        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/cancel")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for own cancel, got {resp.status_code}: {resp.text}")

    # ── Test 13 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_cannot_cancel_other_customers_token(self, mock_db):
        """Customer A cannot cancel Customer B's token (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        # The DB returns TOKEN_B which belongs to CUSTOMER_B
        mock_db.table.return_value = _chain([{
            "customer_id": CUSTOMER_B,
            "salon_id": SALON_B,
            "status": "waiting",
        }])
        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_B}/cancel")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 14 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_customer_cannot_call_or_start_or_complete_token(self, mock_db):
        """Customers may only cancel. call/start/complete must return 403."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        mock_db.table.return_value = _chain([{
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,
            "status": "waiting",
        }])
        client = TestClient(app)
        for action in ("call", "start", "complete", "skip"):
            resp = client.put(f"/api/tokens/{TOKEN_A}/{action}")
            self.assertEqual(resp.status_code, 403,
                             f"Expected 403 for customer action='{action}', got {resp.status_code}")

    # ── Test 15 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_owner_can_call_token_at_own_salon(self, mock_db):
        """Salon Owner A can call a waiting token at SALON_A."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        fetch_chain = _chain([{"customer_id": CUSTOMER_A, "salon_id": SALON_A, "status": "waiting"}])
        update_chain = _chain([{"id": TOKEN_A, "status": "called"}])

        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                call_count["n"] += 1
                return fetch_chain if call_count["n"] == 1 else update_chain
            return _chain([])
        mock_db.table.side_effect = _table

        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/call")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for owner call, got {resp.status_code}: {resp.text}")

    # ── Test 16 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_owner_cannot_mutate_token_at_other_salon(self, mock_db):
        """Salon Owner A cannot call/complete tokens at SALON_B (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        # Token belongs to SALON_B
        mock_db.table.return_value = _chain([{
            "customer_id": CUSTOMER_B,
            "salon_id": SALON_B,
            "status": "waiting",
        }])
        client = TestClient(app)
        for action in ("call", "start", "complete", "skip", "cancel"):
            resp = client.put(f"/api/tokens/{TOKEN_B}/{action}")
            self.assertEqual(resp.status_code, 403,
                             f"Expected 403 for owner_a action='{action}' on salon_b token, got {resp.status_code}")

    # ── Test 17 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_invalid_state_transition_rejected(self, mock_db):
        """Attempting to 'complete' a waiting token (bypassing called→serving) returns 400."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain([{
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,
            "status": "waiting",  # complete requires status == 'serving'
        }])
        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/complete")
        self.assertEqual(resp.status_code, 400,
                         f"Expected 400 for invalid transition, got {resp.status_code}: {resp.text}")

    # ── Test 18 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_invalid_action_name_rejected(self, mock_db):
        """PUT with an unknown action name must return 400."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain([{
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,
            "status": "waiting",
        }])
        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/hack")
        self.assertEqual(resp.status_code, 400,
                         f"Expected 400 for invalid action, got {resp.status_code}: {resp.text}")

    # ── Test 19 ──
    @patch("app.routers.tokens.supabase_admin")
    def test_mutation_on_nonexistent_token_returns_404(self, mock_db):
        """PUT on a token_id that doesn't exist returns 404."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain([])  # empty — token not found
        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/call")
        self.assertEqual(resp.status_code, 404,
                         f"Expected 404 for missing token, got {resp.status_code}: {resp.text}")

    # ── Test 20 ──
    def test_unauthenticated_mutation_rejected(self):
        """PUT /api/tokens/{id}/{action} without auth → 401/403."""
        app.dependency_overrides = {}
        client = TestClient(app)
        resp = client.put(f"/api/tokens/{TOKEN_A}/cancel")
        self.assertIn(resp.status_code, [401, 403],
                      f"Expected 401/403, got {resp.status_code}")


if __name__ == "__main__":
    unittest.main()
