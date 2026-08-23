"""Security tests for rating submission integrity (Phase B1)."""

import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.dependencies import get_current_user
from app.main import app

TOKEN_ID = "11111111-1111-1111-1111-111111111111"
SALON_ID = "22222222-2222-2222-2222-222222222222"
WORKER_ID = "33333333-3333-3333-3333-333333333333"
CUSTOMER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
CUSTOMER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
FORGED_SALON_ID = "99999999-9999-9999-9999-999999999999"
FORGED_WORKER_ID = "88888888-8888-8888-8888-888888888888"


class QueryResult:
    def __init__(self, data):
        self.data = data


class QueryBuilder:
    def __init__(self, table):
        self._table = table
        self._operation = "select"
        self._filters = {}
        self._insert_payload = None

    def select(self, *_args, **_kwargs):
        self._operation = "select"
        return self

    def eq(self, column, value):
        self._filters[column] = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self._operation = "insert"
        self._insert_payload = payload
        return self

    def execute(self):
        if self._operation == "select":
            return QueryResult(self._table._handle_select(self._filters))
        if self._operation == "insert":
            return QueryResult(self._table._handle_insert(self._insert_payload))
        return QueryResult([])


class FakeTable:
    def __init__(self, store, name):
        self._store = store
        self._name = name

    def select(self, *args, **kwargs):
        return QueryBuilder(self)

    def insert(self, payload):
        builder = QueryBuilder(self)
        builder._operation = "insert"
        builder._insert_payload = payload
        return builder

    def eq(self, column, value):
        return QueryBuilder(self).eq(column, value)

    def order(self, *_args, **_kwargs):
        return QueryBuilder(self)

    def _handle_select(self, filters):
        if self._name == "tokens":
            token = self._store.tokens.get(filters.get("id"))
            return [token] if token else []
        if self._name == "ratings":
            token_id = filters.get("token_id")
            if token_id is not None:
                matches = [
                    rating for rating in self._store.ratings
                    if rating.get("token_id") == token_id
                ]
                return [{"id": rating["id"]} for rating in matches]
            return list(self._store.ratings)
        return []

    def _handle_insert(self, payload):
        record = {
            **payload,
            "id": f"rating-{len(self._store.ratings) + 1}",
            "created_at": "2026-01-01T00:00:00Z",
        }
        self._store.ratings.append(record)
        self._store.last_insert = dict(payload)
        return [record]


class FakeSupabase:
    def __init__(self, tokens=None, ratings=None):
        self.tokens = tokens or {}
        self.ratings = list(ratings or [])
        self.last_insert = None

    def table(self, name):
        return FakeTable(self, name)


def _completed_token(**overrides):
    base = {
        "status": "completed",
        "customer_id": CUSTOMER_A,
        "salon_id": SALON_ID,
        "worker_id": WORKER_ID,
    }
    base.update(overrides)
    return base


class RatingsSecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.fake_supabase = FakeSupabase(
            tokens={TOKEN_ID: _completed_token()},
        )
        self.supabase_patch = patch(
            "app.routers.ratings.supabase_admin",
            self.fake_supabase,
        )
        self.supabase_patch.start()
        app.dependency_overrides[get_current_user] = lambda: {"sub": CUSTOMER_A}

    def tearDown(self):
        self.supabase_patch.stop()
        app.dependency_overrides.clear()

    def _post_rating(self, payload, user_id=CUSTOMER_A):
        app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
        return self.client.post("/api/ratings", json=payload)

    def test_a_valid_token_and_correct_client_data_succeeds(self):
        response = self._post_rating(
            {"token_id": TOKEN_ID, "rating": 5, "review": "Great cut"}
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["salon_id"], SALON_ID)
        self.assertEqual(body["worker_id"], WORKER_ID)
        self.assertEqual(body["customer_id"], CUSTOMER_A)
        self.assertEqual(body["token_id"], TOKEN_ID)
        self.assertEqual(body["rating"], 5)

    def test_b_forged_salon_id_is_not_used(self):
        response = self._post_rating(
            {
                "token_id": TOKEN_ID,
                "salon_id": FORGED_SALON_ID,
                "rating": 4,
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["salon_id"], SALON_ID)
        self.assertNotEqual(response.json()["salon_id"], FORGED_SALON_ID)
        self.assertEqual(self.fake_supabase.last_insert["salon_id"], SALON_ID)

    def test_c_forged_worker_id_is_not_used(self):
        response = self._post_rating(
            {
                "token_id": TOKEN_ID,
                "worker_id": FORGED_WORKER_ID,
                "rating": 4,
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["worker_id"], WORKER_ID)
        self.assertNotEqual(response.json()["worker_id"], FORGED_WORKER_ID)
        self.assertEqual(self.fake_supabase.last_insert["worker_id"], WORKER_ID)

    def test_d_other_customer_cannot_rate_token(self):
        response = self._post_rating(
            {"token_id": TOKEN_ID, "rating": 5},
            user_id=CUSTOMER_B,
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Invalid token for rating")
        self.assertEqual(len(self.fake_supabase.ratings), 0)

    def test_e_duplicate_rating_is_rejected(self):
        self.fake_supabase.ratings.append(
            {
                "id": "existing-rating",
                "token_id": TOKEN_ID,
                "salon_id": SALON_ID,
                "worker_id": WORKER_ID,
                "customer_id": CUSTOMER_A,
                "rating": 3,
            }
        )

        response = self._post_rating({"token_id": TOKEN_ID, "rating": 5})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Rating already submitted for this token")
        self.assertEqual(len(self.fake_supabase.ratings), 1)

    def test_f_persisted_rating_matches_token_relationship(self):
        response = self._post_rating({"token_id": TOKEN_ID, "rating": 2, "review": "OK"})

        self.assertEqual(response.status_code, 200)
        persisted = self.fake_supabase.last_insert
        self.assertEqual(persisted["customer_id"], CUSTOMER_A)
        self.assertEqual(persisted["salon_id"], SALON_ID)
        self.assertEqual(persisted["worker_id"], WORKER_ID)
        self.assertEqual(persisted["token_id"], TOKEN_ID)
        self.assertEqual(UUID(persisted["salon_id"]), UUID(SALON_ID))
        self.assertEqual(UUID(persisted["worker_id"]), UUID(WORKER_ID))


if __name__ == "__main__":
    unittest.main()
