"""Session logger — records the full lifecycle of every agent session.

Stores sessions in MongoDB collection ``agent_sessions`` with:
- User command / goal
- Generated plan
- Every iteration: screenshot URL, reasoning, actions, verification
- Final status and timing

Designed to be called from ``agent_loop.py`` at each phase boundary.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo import MongoClient, DESCENDING
from pymongo.collection import Collection

from server.config import MONGODB_URI, MONGODB_DB_NAME

logger = logging.getLogger(__name__)


def _get_collection() -> Collection:
    client: MongoClient = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    return db["agent_sessions"]


class SessionLogger:
    """Stateful logger for a single agent session run."""

    def __init__(
        self,
        session_id: str,
        user_id: str,
        device_id: str,
        device_name: str,
        goal: str,
        mode: str = "navigate",
    ) -> None:
        self.session_id = session_id
        self.user_id = user_id
        self.device_id = device_id
        self.device_name = device_name
        self.goal = goal
        self._col = _get_collection()
        self._started_at = datetime.now(timezone.utc)

        # Insert initial document
        self._col.insert_one({
            "session_id": session_id,
            "user_id": user_id,
            "device_id": device_id,
            "device_name": device_name,
            "goal": goal,
            "status": "running",
            "started_at": self._started_at.isoformat(),
            "ended_at": None,
            "duration_seconds": None,
            "plan": None,
            "iterations": [],
            "final_verification": None,
            "total_iterations": 0,
            "mode": mode,
        })
        logger.info("Session %s created for goal: %s", session_id, goal[:80])

    # ── Plan ────────────────────────────────────────────────────

    def record_plan(self, plan_data: dict[str, Any]) -> None:
        """Store the generated plan."""
        self._col.update_one(
            {"session_id": self.session_id},
            {"$set": {"plan": plan_data}},
        )

    # ── Iteration ───────────────────────────────────────────────

    def record_iteration(
        self,
        iteration: int,
        *,
        screenshot_url: str | None = None,
        screenshot_b64: str | None = None,
        agent_reasoning: str = "",
        actions: list[dict[str, Any]] | None = None,
        verification: dict[str, Any] | None = None,
        element_count: int = 0,
        timestamp: str | None = None,
    ) -> None:
        """Append a full iteration record."""
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        entry: dict[str, Any] = {
            "iteration": iteration,
            "timestamp": ts,
            "screenshot_url": screenshot_url,
            "screenshot_b64": screenshot_b64,
            "agent_reasoning": agent_reasoning,
            "actions": actions or [],
            "verification": verification,
            "element_count": element_count,
        }
        self._col.update_one(
            {"session_id": self.session_id},
            {
                "$push": {"iterations": entry},
                "$set": {"total_iterations": iteration + 1},
            },
        )

    # ── Finalize ────────────────────────────────────────────────

    def finalize(
        self,
        status: str,
        final_verification: dict[str, Any] | None = None,
    ) -> None:
        """Mark the session as complete with final status."""
        ended_at = datetime.now(timezone.utc)
        duration = (ended_at - self._started_at).total_seconds()
        self._col.update_one(
            {"session_id": self.session_id},
            {"$set": {
                "status": status,
                "ended_at": ended_at.isoformat(),
                "duration_seconds": round(duration, 2),
                "final_verification": final_verification,
            }},
        )
        logger.info(
            "Session %s finalized: %s (%.1fs)",
            self.session_id, status, duration,
        )


# ═══════════════════════════════════════════════════════════════
#  Query helpers (used by API endpoints)
# ═══════════════════════════════════════════════════════════════

def list_sessions(
    user_id: str,
    *,
    limit: int = 50,
    skip: int = 0,
    status: str | None = None,
    device_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return summarised session list for a user (no iteration detail)."""
    col = _get_collection()
    query: dict[str, Any] = {"user_id": user_id}
    if status:
        query["status"] = status
    if device_id:
        query["device_id"] = device_id

    projection = {
        "_id": 0,
        "session_id": 1,
        "device_id": 1,
        "device_name": 1,
        "goal": 1,
        "status": 1,
        "started_at": 1,
        "ended_at": 1,
        "duration_seconds": 1,
        "total_iterations": 1,
        "mode": 1,
        "plan.steps": {"$slice": 0},  # just count, no detail in list
    }
    cursor = (
        col.find(query, projection)
        .sort("started_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )
    results = []
    for doc in cursor:
        doc.pop("_id", None)
        results.append(doc)
    return results


def get_session_detail(session_id: str, user_id: str) -> dict[str, Any] | None:
    """Return full session detail including all iterations.

    Strips screenshot_b64 from iterations to keep the response small.
    The base64 data is served separately via the screenshot endpoint.
    """
    col = _get_collection()
    doc = col.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0},
    )
    if doc and "iterations" in doc:
        for it in doc["iterations"]:
            it.pop("screenshot_b64", None)
    return doc


def get_iteration_screenshot(
    session_id: str, user_id: str, iteration: int,
) -> str | None:
    """Return the base64 screenshot for a specific iteration."""
    col = _get_collection()
    doc = col.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0, "iterations": 1},
    )
    if not doc:
        return None
    for it in doc.get("iterations", []):
        if it.get("iteration") == iteration and it.get("screenshot_b64"):
            return it["screenshot_b64"]
    return None


def count_sessions(user_id: str) -> int:
    """Return total session count for a user."""
    col = _get_collection()
    return col.count_documents({"user_id": user_id})
