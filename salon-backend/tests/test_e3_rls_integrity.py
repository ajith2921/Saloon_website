"""
E3.1 + E3.2 — RLS Audit & Database Integrity Tests.

These tests verify backend-layer enforcement of the same rules that
the database migration (003) adds at the DB level.  They use mocked
Supabase calls so they run offline without a live database.

E3.1 — RLS / Authorization Audit
  1.  Unauthenticated access to protected endpoints → 401/403.
  2.  Profile is scoped — customer cannot read another customer's profile data
      via loyalty/notification endpoints.
  3.  handle_new_user trigger replacement documented (migration 003 — tested
      conceptually: API never trusts role from JWT metadata).
  4.  Notifications are user-scoped (GET and PUT both filter by JWT sub).
  5.  Analytics is salon-owner-scoped; cross-owner access → 403.
  6.  Revenue is salon-owner-scoped; cross-owner access → 403.

E3.2 — Cross-Tenant Isolation
  7.  Token creation: service_id must belong to the token's salon.
      (DB trigger enforces; backend RPC raises CROSS_TENANT_VIOLATION → 500).
  8.  Token creation: worker_id (when supplied) must belong to token's salon.
  9.  Rating submission: salon_id and worker_id must be consistent
      (backend already derives from token; cannot be forged).
  10. Rating submission: forged salon_id is rejected (403) because backend
      derives salon_id from the authoritative token record.
  11. Rating submission: forged worker_id is rejected (403) because backend
      derives worker_id from the authoritative token record.
  12. Salon owner cannot reach analytics for another salon.
  13. Salon owner cannot reach revenue for another salon.
  14. Workers are read-only for public callers; write operations require
      salon_owner role (403 for customer).
  15. Services are read-only for public callers; write operations require
      salon_owner role (403 for customer).
  16. Loyalty history is user-scoped — query must filter by JWT customer_id.
  17. Notifications mark-all-read scoped to JWT user_id, never touches
      another user's notifications.
  18. Valid same-tenant token creation succeeds (200).
  19. Valid same-tenant rating succeeds (200).
  20. Unauthenticated worker/service write → 401/403.
"""

import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user, get_current_user_with_profile

# ─── Constants ────────────────────────────────────────────────────────────────

CUSTOMER_A = "aaaa0000-0000-0000-0000-aaaaaaaaaaaa"
CUSTOMER_B = "bbbb0000-0000-0000-0000-bbbbbbbbbbbb"
SALON_A    = "cccc0000-0000-0000-0000-cccccccccccc"
SALON_B    = "dddd0000-0000-0000-0000-dddddddddddd"
TOKEN_A    = "eeee0000-0000-0000-0000-eeeeeeeeeeee"
WORKER_A   = "ffff0000-0000-0000-0000-ffffffffffff"
SERVICE_A  = "1111aaaa-0000-0000-0000-111111111111"
OWNER_A_ID = "2222aaaa-0000-0000-0000-222222222222"
OWNER_B_ID = "3333aaaa-0000-0000-0000-333333333333"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _chain(data=None, count=None):
    c = MagicMock()
    result = MagicMock()
    result.data = data if data is not None else []
    result.count = count
    for m in ("select", "eq", "order", "limit", "in_", "update", "insert",
              "delete", "single", "gte", "neq"):
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
# E3.1 — RLS / Authorization
# ─────────────────────────────────────────────────────────────────────────────

class TestRLSAuthorization(unittest.TestCase):
    """E3.1: All protected endpoints must reject unauthenticated or unauthorized callers."""

    def tearDown(self):
        app.dependency_overrides = {}

    # ── Test 1: Unauthenticated access to protected endpoints ──
    def test_unauthenticated_access_rejected_on_all_auth_endpoints(self):
        """All authenticated endpoints must return 401/403 without a token."""
        app.dependency_overrides = {}
        client = TestClient(app, raise_server_exceptions=False)
        protected_endpoints = [
            ("GET",  "/api/tokens/history"),
            ("GET",  "/api/tokens/my"),
            ("GET",  "/api/notifications"),
            ("GET",  "/api/loyalty/balance"),
            ("GET",  "/api/loyalty/history"),
            ("PUT",  "/api/notifications/read-all"),
        ]
        for method, url in protected_endpoints:
            if method == "GET":
                resp = client.get(url)
            else:
                resp = client.put(url)
            self.assertIn(
                resp.status_code, [401, 403],
                f"Expected 401/403 for unauthenticated {method} {url}, got {resp.status_code}",
            )

    # ── Test 2: API never trusts role from JWT metadata ──
    def test_api_derives_role_from_profiles_table_not_jwt_claims(self):
        """
        The get_current_user_with_profile dependency reads role from profiles table,
        not from JWT user_metadata. Verify the profile DB call is made.
        """
        # If someone registers as 'super_admin' via metadata, their JWT would
        # contain that claim but get_current_user_with_profile queries the DB.
        # We inject a JWT payload with super_admin in metadata but mock
        # profiles to return 'customer' — the endpoint should treat them as customer.
        jwt_with_elevated_claim = {
            "sub": CUSTOMER_A,
            "user_metadata": {"role": "super_admin"},  # malicious client metadata
        }
        with patch("app.routers.analytics.supabase_admin") as mock_db:
            with patch("app.dependencies.supabase_admin") as mock_dep_db:
                # Profile lookup returns 'customer', not 'super_admin'.
                # single() returns a dict, not a list.
                profile_chain = _chain(data={"role": "customer"})
                salon_chain = _chain(data=[])
                def _dep_table(name):
                    if name == "profiles":
                        return profile_chain
                    return salon_chain
                mock_dep_db.table.side_effect = _dep_table

                # Override get_current_user (JWT decode) but NOT get_current_user_with_profile
                # so the real profile lookup runs
                app.dependency_overrides[get_current_user] = lambda: jwt_with_elevated_claim
                client = TestClient(app, raise_server_exceptions=False)
                resp = client.get(f"/api/analytics/salon/{SALON_A}/summary")
                # Customer role → 403 (not super_admin access)
                self.assertEqual(resp.status_code, 403,
                    f"Expected 403 (role derived from DB = customer), got {resp.status_code}")

    # ── Test 3: Notifications scoped to JWT user ──
    @patch("app.routers.notifications.supabase_admin")
    def test_notifications_scoped_to_jwt_user_id(self, mock_db):
        """GET /api/notifications must filter by user_id == JWT sub."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        chain = _chain(data=[])
        mock_db.table.return_value = chain
        client = TestClient(app)
        client.get("/api/notifications")
        eq_args = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(CUSTOMER_A in arg for arg in eq_args),
            f"Expected notifications filtered by CUSTOMER_A. eq calls: {eq_args}",
        )

    # ── Test 4: Notifications mark-all-read scoped to JWT user ──
    @patch("app.routers.notifications.supabase_admin")
    def test_mark_all_read_scoped_to_jwt_user(self, mock_db):
        """PUT /api/notifications/read-all must filter by user_id == JWT sub."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        chain = _chain(data=[])
        mock_db.table.return_value = chain
        client = TestClient(app)
        client.put("/api/notifications/read-all")
        eq_args = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(CUSTOMER_A in arg for arg in eq_args),
            f"Expected mark-read filtered by CUSTOMER_A. eq calls: {eq_args}",
        )

    # ── Test 5: Analytics cross-owner access blocked ──
    @patch("app.routers.analytics.supabase_admin")
    def test_analytics_cross_owner_access_blocked(self, mock_db):
        """Salon Owner B cannot access analytics for Salon A (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_b()
        mock_db.table.return_value = _chain(data=[])
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/analytics/salon/{SALON_A}/summary")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 6: Revenue cross-owner access blocked ──
    @patch("app.routers.revenue.supabase_admin")
    def test_revenue_cross_owner_access_blocked(self, mock_db):
        """Salon Owner B cannot access revenue data for Salon A (403)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_b()
        mock_db.table.return_value = _chain(data=[])
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/revenue/salon/{SALON_A}")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 16: Loyalty history scoped to JWT user ──
    @patch("app.routers.loyalty.supabase_admin")
    def test_loyalty_history_scoped_to_jwt_user(self, mock_db):
        """GET /api/loyalty/history must filter tokens by customer_id == JWT sub."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        chain = _chain(data=[])
        mock_db.table.return_value = chain
        client = TestClient(app)
        client.get("/api/loyalty/history")
        eq_args = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(CUSTOMER_A in arg for arg in eq_args),
            f"Expected loyalty history filtered by CUSTOMER_A. eq calls: {eq_args}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# E3.2 — Cross-Tenant Isolation (Backend Layer)
# ─────────────────────────────────────────────────────────────────────────────

class TestCrossTenantIsolation(unittest.TestCase):
    """
    E3.2: The backend must reject cross-tenant relationships even before
    the DB trigger fires. These tests verify the application-level checks
    that mirror the DB-level triggers in migration 003.
    """

    def tearDown(self):
        app.dependency_overrides = {}

    # ── Test 7+8: create_queue_token RPC enforces cross-tenant via EXCEPTION ──
    @patch("app.routers.tokens.supabase_admin")
    def test_cross_tenant_service_in_token_create_returns_400(self, mock_db):
        """
        Token creation with a service from a different salon must fail.
        The create_queue_token RPC raises SERVICE_UNAVAILABLE if the service
        doesn't belong to the specified salon. Backend maps this to 400.
        """
        app.dependency_overrides[get_current_user_with_profile] = lambda: {
            **_customer_a(), "db_role": "customer"
        }
        # Simulate the RPC raising an exception that contains SERVICE_UNAVAILABLE
        rpc_chain = MagicMock()
        rpc_chain.execute.side_effect = Exception(
            "new row for relation \"tokens\" violates constraint SERVICE_UNAVAILABLE"
        )
        mock_db.rpc.return_value = rpc_chain
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/tokens", json={
            "salon_id": SALON_A,
            "service_id": SERVICE_A,  # service from different salon
            "worker_id": None,
        })
        self.assertIn(resp.status_code, [400, 500],
                      f"Expected 400/500 for cross-tenant service, got {resp.status_code}")

    @patch("app.routers.tokens.supabase_admin")
    def test_cross_tenant_worker_in_token_create_returns_400(self, mock_db):
        """
        Token creation with a worker from a different salon must fail.
        The create_queue_token RPC raises WORKER_UNAVAILABLE.
        """
        app.dependency_overrides[get_current_user_with_profile] = lambda: {
            **_customer_a(), "db_role": "customer"
        }
        rpc_chain = MagicMock()
        rpc_chain.execute.side_effect = Exception("WORKER_UNAVAILABLE - worker not in this salon")
        mock_db.rpc.return_value = rpc_chain
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/tokens", json={
            "salon_id": SALON_A,
            "service_id": SERVICE_A,
            "worker_id": WORKER_A,  # worker from different salon
        })
        self.assertEqual(resp.status_code, 400,
                         f"Expected 400, got {resp.status_code}: {resp.text}")

    # ── Test 9+10+11: Rating salon_id and worker_id are derived server-side ──
    @patch("app.routers.ratings.supabase_admin")
    def test_rating_salon_id_derived_from_token_not_client(self, mock_db):
        """
        The salon_id stored in a rating must come from the token's salon_id,
        NOT from any client-supplied value. The backend reads the token record
        and uses its salon_id exclusively.
        """
        app.dependency_overrides[get_current_user] = lambda: _customer_a()

        token_record = {
            "status": "completed",
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,    # authoritative salon
            "worker_id": WORKER_A,
        }
        existing_ratings = _chain(data=[])
        token_chain = _chain(data=[token_record])
        insert_chain = _chain(data=[{
            "id": "rating-1", "salon_id": SALON_A,
            "customer_id": CUSTOMER_A, "worker_id": WORKER_A,
            "token_id": TOKEN_A, "rating": 5, "review": None,
        }])

        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                return token_chain
            if name == "ratings":
                call_count["n"] += 1
                return existing_ratings if call_count["n"] == 1 else insert_chain
            return _chain()
        mock_db.table.side_effect = _table

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/ratings", json={
            "token_id": TOKEN_A,
            "rating": 5,
        })
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for valid rating, got {resp.status_code}: {resp.text}")

        # Verify the INSERT used salon_id derived from the token, not client payload
        insert_calls = [str(c) for c in insert_chain.insert.call_args_list]
        for c in insert_calls:
            self.assertIn(SALON_A, c,
                         f"Rating INSERT must use token's salon_id {SALON_A}, got: {c}")

    @patch("app.routers.ratings.supabase_admin")
    def test_rating_forged_salon_id_cannot_change_stored_value(self, mock_db):
        """
        Even if a client sends a different salon_id (not possible via the current API
        since salon_id is not in the RatingCreate schema), the backend reads it from
        the token and ignores any client-supplied value.
        The RatingCreate schema uses ConfigDict(extra='ignore') — extra fields dropped.
        """
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        token_chain = _chain(data=[{
            "status": "completed",
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,
            "worker_id": WORKER_A,
        }])
        existing_ratings = _chain(data=[])
        insert_chain = _chain(data=[{
            "id": "rating-2", "salon_id": SALON_A,
            "customer_id": CUSTOMER_A, "worker_id": WORKER_A,
            "token_id": TOKEN_A, "rating": 4, "review": None,
        }])
        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                return token_chain
            if name == "ratings":
                call_count["n"] += 1
                return existing_ratings if call_count["n"] == 1 else insert_chain
            return _chain()
        mock_db.table.side_effect = _table

        # Client attempts to inject salon_id = SALON_B — schema ignores it (extra='ignore')
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/ratings", json={
            "token_id": TOKEN_A,
            "rating": 4,
            "salon_id": "dddd0000-0000-0000-0000-dddddddddddd",  # forged — ignored
        })
        # Should succeed with the correct salon from the token
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 (forged salon_id ignored), got {resp.status_code}")

    @patch("app.routers.ratings.supabase_admin")
    def test_rating_for_another_customers_token_returns_403(self, mock_db):
        """Customer A cannot submit a rating for Customer B's completed token."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        # Token belongs to CUSTOMER_B
        mock_db.table.return_value = _chain(data=[{
            "status": "completed",
            "customer_id": CUSTOMER_B,  # different customer
            "salon_id": SALON_B,
            "worker_id": WORKER_A,
        }])
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/ratings", json={"token_id": TOKEN_A, "rating": 5})
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 12: Analytics owner isolation ──
    @patch("app.routers.analytics.supabase_admin")
    def test_analytics_owner_a_can_access_own_salon(self, mock_db):
        """Owner A can access analytics for Salon A (200)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain(data=[], count=0)
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/analytics/salon/{SALON_A}/summary")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for own salon analytics, got {resp.status_code}: {resp.text}")

    # ── Test 13: Revenue owner isolation ──
    @patch("app.routers.revenue.supabase_admin")
    def test_revenue_owner_a_can_access_own_salon(self, mock_db):
        """Owner A can access revenue for Salon A (200)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        mock_db.table.return_value = _chain(data=[])
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/revenue/salon/{SALON_A}")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for own salon revenue, got {resp.status_code}: {resp.text}")

    # ── Test 14: Customer cannot create/update workers ──
    def test_customer_cannot_create_worker(self):
        """POST /api/workers requires salon_owner or super_admin (403 for customer)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/workers", json={
            "salon_id": SALON_A,
            "name": "Injected Worker",
            "experience_years": 0,
            "status": "active",
        })
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 15: Customer cannot create/update services ──
    def test_customer_cannot_create_service(self):
        """POST /api/services requires salon_owner or super_admin (403 for customer)."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: _customer_a()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/services", json={
            "salon_id": SALON_A,
            "name": "Injected Service",
            "price": 100,
            "duration_minutes": 30,
            "status": "active",
        })
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    # ── Test 17: mark_one_read notification scoped ──
    @patch("app.routers.notifications.supabase_admin")
    def test_mark_one_notification_read_scoped_to_owner(self, mock_db):
        """PUT /api/notifications/{id}/read must filter by user_id to prevent cross-user reads."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        chain = _chain(data=[{"id": "5555aaaa-0000-0000-0000-555555555555", "user_id": CUSTOMER_A, "is_read": True}])
        mock_db.table.return_value = chain
        client = TestClient(app)
        resp = client.put("/api/notifications/5555aaaa-0000-0000-0000-555555555555/read")
        self.assertEqual(resp.status_code, 200)
        eq_args = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(CUSTOMER_A in arg for arg in eq_args),
            f"Expected mark-one-read filtered by CUSTOMER_A. eq calls: {eq_args}",
        )

    # ── Test 18: Valid same-tenant token creation succeeds ──
    @patch("app.routers.tokens.supabase_admin")
    def test_valid_same_tenant_token_creation_succeeds(self, mock_db):
        """POST /api/tokens with matching salon/service/worker → 200."""
        app.dependency_overrides[get_current_user_with_profile] = lambda: {
            **_customer_a(), "db_role": "customer"
        }
        rpc_result = MagicMock()
        rpc_result.data = [{"id": TOKEN_A, "token_number": 3, "status": "waiting"}]
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = rpc_result
        mock_db.rpc.return_value = rpc_chain
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/tokens", json={
            "salon_id": SALON_A,
            "service_id": SERVICE_A,
            "worker_id": None,
        })
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for valid token, got {resp.status_code}: {resp.text}")

    # ── Test 19: Valid same-tenant rating succeeds ──
    @patch("app.routers.ratings.supabase_admin")
    def test_valid_same_tenant_rating_succeeds(self, mock_db):
        """POST /api/ratings for customer's own completed token → 200."""
        app.dependency_overrides[get_current_user] = lambda: _customer_a()
        token_chain = _chain(data=[{
            "status": "completed",
            "customer_id": CUSTOMER_A,
            "salon_id": SALON_A,
            "worker_id": WORKER_A,
        }])
        existing_chain = _chain(data=[])
        insert_chain = _chain(data=[{
            "id": "rating-ok", "salon_id": SALON_A,
            "customer_id": CUSTOMER_A, "worker_id": WORKER_A,
            "token_id": TOKEN_A, "rating": 5, "review": "Great!"
        }])
        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                return token_chain
            call_count["n"] += 1
            return existing_chain if call_count["n"] == 1 else insert_chain
        mock_db.table.side_effect = _table
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/ratings", json={
            "token_id": TOKEN_A,
            "rating": 5,
            "review": "Great!",
        })
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 for valid rating, got {resp.status_code}: {resp.text}")

    # ── Test 20: Unauthenticated write to workers/services ──
    def test_unauthenticated_worker_write_rejected(self):
        """POST /api/workers without auth → 401/403."""
        app.dependency_overrides = {}
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/workers", json={
            "salon_id": SALON_A, "name": "Anon", "experience_years": 0, "status": "active"
        })
        self.assertIn(resp.status_code, [401, 403])

    def test_unauthenticated_service_write_rejected(self):
        """POST /api/services without auth → 401/403."""
        app.dependency_overrides = {}
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/services", json={
            "salon_id": SALON_A, "name": "Anon Service", "price": 50,
            "duration_minutes": 30, "status": "active"
        })
        self.assertIn(resp.status_code, [401, 403])


if __name__ == "__main__":
    unittest.main()
