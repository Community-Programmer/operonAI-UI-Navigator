from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass

from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from server.config import MONGODB_DB_NAME, MONGODB_URI

_ITERATIONS = 120_000


@dataclass
class UserRecord:
    user_id: str
    username: str
    password_hash: str


class UserStore:
    """MongoDB-backed user credential store."""

    def __init__(self) -> None:
        self._client: MongoClient | None = None
        self._users: Collection | None = None

    def _get_collection(self) -> Collection:
        if self._users is None:
            self._client = MongoClient(MONGODB_URI)
            db = self._client[MONGODB_DB_NAME]
            self._users = db["users"]
            self._users.create_index([("username", ASCENDING)], unique=True)
            self._users.create_index([("user_id", ASCENDING)], unique=True)
        return self._users

    @staticmethod
    def hash_password(password: str) -> str:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), _ITERATIONS
        )
        return f"{salt}${digest.hex()}"

    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        try:
            salt, expected_hex = stored_hash.split("$", 1)
        except ValueError:
            return False

        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), _ITERATIONS
        )
        return hmac.compare_digest(actual.hex(), expected_hex)

    def create_user(self, username: str, password: str) -> UserRecord | None:
        users = self._get_collection()
        user_id = secrets.token_hex(16)
        doc = {
            "user_id": user_id,
            "username": username,
            "password_hash": self.hash_password(password),
        }
        try:
            users.insert_one(doc)
        except DuplicateKeyError:
            return None

        return UserRecord(
            user_id=user_id,
            username=username,
            password_hash=doc["password_hash"],
        )

    def get_user_by_username(self, username: str) -> UserRecord | None:
        users = self._get_collection()
        doc = users.find_one({"username": username})
        if not doc:
            return None

        return UserRecord(
            user_id=str(doc["user_id"]),
            username=str(doc["username"]),
            password_hash=str(doc["password_hash"]),
        )


user_store = UserStore()
