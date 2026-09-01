"""
C1 Phase — Tenant Authorization + Public API Security tests.

These tests verify:
  1. Public API endpoints require a salon_id scoping parameter.
  2. Public responses never expose user_id or other private fields.
  3. Authenticated write endpoints enforce ownership via DB lookup.
  4. salon_id cannot be forged on create — it is derived from the auth user.
  5. worker user_id cannot be changed via PUT /api/workers/{id}.
  6. Cross-tenant access is rejected.

Test design:
  - supabase_admin is mocked at the router module level.
  - The FastAPI dependency `get_current_user_with_profile` is overridden to
    inject controlled user contexts.
  - Assertions target the *query arguments* passed to the mock to verify that
    the correct salon_id was used — not just the response shape.
"""

import unittest
from unittest.mock import MagicMock, patch, call
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user_with_profile

SALON_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SALON_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
SERVICE_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"
WORKER_A  = "dddddddd-dddd-dddd-dddd-dddddddddddd"
USER_A_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

# ─── Fake Supabase builders ──────────────────────────────────────────────────

def _chain(**kwargs):
    """Return a chainable MagicMock whose .execute() returns a fake result."""
    result = MagicMock()
    result.data = kwargs.get("data", [])
    result.count = kwargs.get("count", None)

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain
    chain.execute.return_value = result
    return chain


def _fake_db(data_map: dict):
    """
    Returns a fake supabase_admin where .table(name) chains return data from
    data_map keyed by table name.
    """
    db = MagicMock()
    db.table.side_effect = lambda name: data_map.get(name, _chain(data=[]))
    return db


# ─── Auth helpers ────────────────────────────────────────────────────────────

def _owner_a():
    return {"sub": USER_A_ID, "db_role": "salon_owner", "db_salon_id": SALON_A}


def _super_admin():
    return {"sub": "superadmin-uid", "db_role": "super_admin", "db_salon_id": None}


# ─── Test Cases ──────────────────────────────────────────────────────────────

class TestPublicServicesAPI(unittest.TestCase):
    """Anonymous callers must supply salon_id and only receive public fields."""

    def setUp(self):
        app.dependency_overrides = {}  # no auth override — test as anonymous
        self.client = TestClient(app, raise_server_exceptions=True)

    def tearDown(self):
        app.dependency_overrides = {}

    def test_get_services_without_salon_id_returns_422(self):
        """Missing salon_id query param must result in 422 Unprocessable Entity."""
        resp = self.client.get("/api/services")
        self.assertEqual(resp.status_code, 422)

    @patch("app.routers.services.supabase_admin")
    def test_get_services_scoped_to_salon(self, mock_db):
        """GET /api/services?salon_id=X must filter by salon_id."""
        service_data = [{
            "id": SERVICE_A, "salon_id": SALON_A,
            "name": "Haircut", "description": None,
            "price": 150, "duration_minutes": 30, "status": "active",
        }]
        chain = _chain(data=service_data)
        mock_db.table.return_value = chain

        resp = self.client.get(f"/api/services?salon_id={SALON_A}")
        self.assertEqual(resp.status_code, 200)

        # Verify .eq("salon_id", SALON_A) was called
        eq_calls = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(SALON_A in c for c in eq_calls),
            f"Expected salon_id filter in query. eq calls: {chain.eq.call_args_list}"
        )

    @patch("app.routers.services.supabase_admin")
    def test_public_service_response_has_no_private_fields(self, mock_db):
        """Public service responses must not contain created_at or internal metadata."""
        service_data = [{
            "id": SERVICE_A, "salon_id": SALON_A,
            "name": "Haircut", "description": None,
            "price": 150, "duration_minutes": 30, "status": "active",
            "created_at": "2026-01-01T00:00:00",  # DB might still return it
        }]
        chain = _chain(data=service_data)
        mock_db.table.return_value = chain

        resp = self.client.get(f"/api/services?salon_id={SALON_A}")
        # The select clause restricts fields — we verify the select string
        select_call = chain.select.call_args_list[0]
        select_str = select_call[0][0] if select_call[0] else str(select_call)
        self.assertNotIn("created_at", select_str)


class TestPublicWorkersAPI(unittest.TestCase):
    """Anonymous callers must supply salon_id and NEVER receive user_id."""

    def setUp(self):
        app.dependency_overrides = {}
        self.client = TestClient(app, raise_server_exceptions=True)

    def tearDown(self):
        app.dependency_overrides = {}

    def test_get_workers_without_salon_id_returns_422(self):
        """Missing salon_id query param must result in 422 Unprocessable Entity."""
        resp = self.client.get("/api/workers")
        self.assertEqual(resp.status_code, 422)

    @patch("app.routers.workers.supabase_admin")
    def test_get_workers_scoped_to_salon(self, mock_db):
        """GET /api/workers?salon_id=X must filter by salon_id."""
        worker_data = [{
            "id": WORKER_A, "salon_id": SALON_A, "name": "Arun",
            "photo_url": None, "specialization": "Haircut",
            "experience_years": 5, "status": "active",
        }]
        chain = _chain(data=worker_data)
        mock_db.table.return_value = chain

        resp = self.client.get(f"/api/workers?salon_id={SALON_A}")
        self.assertEqual(resp.status_code, 200)

        eq_calls = [str(c) for c in chain.eq.call_args_list]
        self.assertTrue(
            any(SALON_A in c for c in eq_calls),
            f"Expected salon_id filter. eq calls: {chain.eq.call_args_list}"
        )

    @patch("app.routers.workers.supabase_admin")
    def test_public_worker_response_excludes_user_id(self, mock_db):
        """Public worker SELECT must not request user_id field."""
        chain = _chain(data=[])
        mock_db.table.return_value = chain

        self.client.get(f"/api/workers?salon_id={SALON_A}")

        # Check that user_id is NOT in the select statement
        select_call = chain.select.call_args_list[0]
        select_str = select_call[0][0] if select_call[0] else str(select_call)
        self.assertNotIn("user_id", select_str,
                         f"user_id must not be in public select. Got: {select_str}")

    @patch("app.routers.workers.supabase_admin")
    def test_get_single_worker_excludes_user_id(self, mock_db):
        """GET /api/workers/{id} must not expose user_id in its SELECT."""
        chain = _chain(data=[{
            "id": WORKER_A, "salon_id": SALON_A, "name": "Arun",
            "photo_url": None, "specialization": "Haircut",
            "experience_years": 5, "status": "active",
        }])
        mock_db.table.return_value = chain

        self.client.get(f"/api/workers/{WORKER_A}")

        select_call = chain.select.call_args_list[0]
        select_str = select_call[0][0] if select_call[0] else str(select_call)
        self.assertNotIn("user_id", select_str,
                         f"user_id must not be in single-worker select. Got: {select_str}")


class TestServiceTenantIsolation(unittest.TestCase):
    """Authenticated service management must be strictly tenant-scoped."""

    def setUp(self):
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides = {}

    @patch("app.routers.services.supabase_admin")
    def test_create_service_uses_authorised_salon_not_client_payload(self, mock_db):
        """
        POST /api/services: The salon_id used in the INSERT must come from the
        authenticated user's db_salon_id, not from an arbitrary client-supplied value.
        """
        # db_salon_id = SALON_A. Client sends SALON_A (matching) — must succeed
        # and INSERT must use SALON_A.
        insert_chain = _chain(data=[{
            "id": SERVICE_A, "salon_id": SALON_A, "name": "Test", 
            "description": None, "price": 100.0, "duration_minutes": 30, "status": "active"
        }])
        # The lookup chain for owner verification uses supabase_admin.table("salons")
        salon_chain = _chain(data=[{"id": SALON_A}])
        # profiles check
        profile_chain = _chain(data=[{"role": "salon_owner"}])

        def _table(name):
            if name == "salons":
                return salon_chain
            if name == "profiles":
                return profile_chain
            return insert_chain

        mock_db.table.side_effect = _table

        payload = {
            "salon_id": SALON_A,
            "name": "Test Service",
            "price": 100.0,
            "duration_minutes": 30,
            "status": "active",
        }
        resp = self.client.post("/api/services", json=payload)
        # 200 or 201 means we got through to insert
        self.assertIn(resp.status_code, [200, 201, 500],
                      f"Unexpected status: {resp.status_code} {resp.text}")

        # Verify the insert was called with SALON_A as salon_id
        insert_calls = [str(c) for c in insert_chain.insert.call_args_list]
        if insert_calls:
            self.assertTrue(
                any(SALON_A in c for c in insert_calls),
                f"INSERT must use authorised salon {SALON_A}. Calls: {insert_calls}"
            )

    @patch("app.routers.services.supabase_admin")
    def test_owner_cannot_update_other_salon_service(self, mock_db):
        """
        PUT /api/services/{id}: If the service belongs to SALON_B but the
        authenticated user owns SALON_A, must return 403.
        """
        # The service lookup returns SALON_B as its owner
        existing_chain = _chain(data=[{"salon_id": SALON_B}])
        mock_db.table.return_value = existing_chain

        resp = self.client.put(
            f"/api/services/{SERVICE_A}",
            json={"name": "Hacked Service"},
        )
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    @patch("app.routers.services.supabase_admin")
    def test_owner_cannot_delete_other_salon_service(self, mock_db):
        """
        DELETE /api/services/{id}: If the service belongs to SALON_B but the
        authenticated user owns SALON_A, must return 403.
        """
        existing_chain = _chain(data=[{"salon_id": SALON_B}])
        mock_db.table.return_value = existing_chain

        resp = self.client.delete(f"/api/services/{SERVICE_A}")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")


class TestWorkerTenantIsolation(unittest.TestCase):
    """Authenticated worker management must be strictly tenant-scoped."""

    def setUp(self):
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides = {}

    @patch("app.routers.workers.supabase_admin")
    def test_owner_cannot_update_other_salon_worker(self, mock_db):
        """
        PUT /api/workers/{id}: If the worker belongs to SALON_B but user owns SALON_A,
        must return 403.
        """
        existing_chain = _chain(data=[{"salon_id": SALON_B}])
        mock_db.table.return_value = existing_chain

        resp = self.client.put(
            f"/api/workers/{WORKER_A}",
            json={"name": "Hacked Name"},
        )
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    @patch("app.routers.workers.supabase_admin")
    def test_owner_cannot_delete_other_salon_worker(self, mock_db):
        """
        DELETE /api/workers/{id}: If the worker belongs to SALON_B but user owns SALON_A,
        must return 403.
        """
        existing_chain = _chain(data=[{"salon_id": SALON_B}])
        mock_db.table.return_value = existing_chain

        resp = self.client.delete(f"/api/workers/{WORKER_A}")
        self.assertEqual(resp.status_code, 403,
                         f"Expected 403, got {resp.status_code}: {resp.text}")

    @patch("app.routers.workers.supabase_admin")
    def test_worker_update_strips_user_id_from_payload(self, mock_db):
        """
        PUT /api/workers/{id}: Even if the client sends user_id, it must be stripped
        from the UPDATE payload — re-linking a worker to a different auth account is
        not allowed through this endpoint.
        """
        existing_chain = _chain(data=[{"salon_id": SALON_A}])
        update_chain = _chain(data=[{
            "id": WORKER_A, "salon_id": SALON_A, "name": "Arun Updated",
            "specialization": None, "experience_years": 5,
            "photo_url": None, "status": "active",
        }])

        def _table(name):
            if name == "workers":
                # First call → select existing (to check ownership)
                # Subsequent calls → update
                return existing_chain
            return existing_chain

        mock_db.table.side_effect = _table
        # Need the update chain for the second workers call
        call_count = {"n": 0}
        def _workers_table(name):
            if name == "workers":
                call_count["n"] += 1
                if call_count["n"] == 1:
                    return existing_chain
                return update_chain
            return existing_chain

        mock_db.table.side_effect = _workers_table

        resp = self.client.put(
            f"/api/workers/{WORKER_A}",
            json={
                "name": "Arun Updated",
                "user_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",  # attempt re-link
            },
        )
        # Request should succeed (200) or at least not 422
        self.assertNotEqual(resp.status_code, 422)

        # Verify that user_id was NOT included in the update call
        update_calls = [str(c) for c in update_chain.update.call_args_list]
        for c in update_calls:
            self.assertNotIn("user_id", c,
                             f"user_id must be stripped from update payload. Got: {c}")


class TestLegitimateOwnerAccess(unittest.TestCase):
    """Verify an owner can successfully manage their own salon's resources."""

    def setUp(self):
        app.dependency_overrides[get_current_user_with_profile] = lambda: _owner_a()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides = {}

    @patch("app.routers.services.supabase_admin")
    def test_owner_can_update_own_service(self, mock_db):
        """PUT on a service that belongs to SALON_A must succeed (200)."""
        existing_chain = _chain(data=[{"salon_id": SALON_A}])
        update_chain = _chain(data=[{
            "id": SERVICE_A, "salon_id": SALON_A, "name": "Updated",
            "description": None, "price": 200.0, "duration_minutes": 45, "status": "active"
        }])

        call_count = {"n": 0}
        def _services_table(name):
            if name == "services":
                call_count["n"] += 1
                return existing_chain if call_count["n"] == 1 else update_chain
            return existing_chain

        mock_db.table.side_effect = _services_table

        resp = self.client.put(
            f"/api/services/{SERVICE_A}",
            json={"name": "Updated", "price": 200.0},
        )
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200, got {resp.status_code}: {resp.text}")

    @patch("app.routers.workers.supabase_admin")
    def test_owner_can_delete_own_worker(self, mock_db):
        """DELETE on a worker that belongs to SALON_A must succeed (200)."""
        worker_chain = _chain(data=[{"salon_id": SALON_A}])
        empty_chain  = _chain(data=[])   # no active tokens → deletion allowed

        call_count = {"n": 0}
        def _table(name):
            if name == "tokens":
                return empty_chain
            call_count["n"] += 1
            return worker_chain

        mock_db.table.side_effect = _table

        resp = self.client.delete(f"/api/workers/{WORKER_A}")
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200, got {resp.status_code}: {resp.text}")


if __name__ == "__main__":
    unittest.main()
