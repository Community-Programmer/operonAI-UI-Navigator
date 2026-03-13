from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection

from server.config import MONGODB_DB_NAME, MONGODB_URI


@dataclass
class DevicePairing:
    user_id: str
    device_id: str
    device_name: str
    session_minutes: int
    expires_at: str
    updated_at: str


class DeviceStore:
    def __init__(self) -> None:
        self._client: MongoClient | None = None
        self._pairings: Collection | None = None

    def _collection(self) -> Collection:
        if self._pairings is None:
            self._client = MongoClient(MONGODB_URI)
            db = self._client[MONGODB_DB_NAME]
            self._pairings = db["device_pairings"]
            self._pairings.create_index([("user_id", ASCENDING), ("device_id", ASCENDING)], unique=True)
            self._pairings.create_index([("user_id", ASCENDING)])
        return self._pairings

    def upsert_pairing(
        self,
        user_id: str,
        device_id: str,
        device_name: str,
        session_minutes: int,
        expires_at: str,
    ) -> DevicePairing:
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "user_id": user_id,
            "device_id": device_id,
            "device_name": device_name,
            "session_minutes": session_minutes,
            "expires_at": expires_at,
            "updated_at": now_iso,
        }
        col = self._collection()
        col.update_one(
            {"user_id": user_id, "device_id": device_id},
            {"$set": doc},
            upsert=True,
        )
        return DevicePairing(**doc)

    def list_user_pairings(self, user_id: str) -> list[DevicePairing]:
        col = self._collection()
        out: list[DevicePairing] = []
        for doc in col.find({"user_id": user_id}):
            out.append(
                DevicePairing(
                    user_id=str(doc.get("user_id", "")),
                    device_id=str(doc.get("device_id", "")),
                    device_name=str(doc.get("device_name", "Unnamed Device")),
                    session_minutes=int(doc.get("session_minutes", 60)),
                    expires_at=str(doc.get("expires_at", "")),
                    updated_at=str(doc.get("updated_at", "")),
                )
            )
        return out


device_store = DeviceStore()
