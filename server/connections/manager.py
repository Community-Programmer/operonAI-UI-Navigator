from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for devices and dashboards."""

    def __init__(self) -> None:
        # device_id -> WebSocket
        self.device_connections: dict[str, WebSocket] = {}
        # device_id -> {user_id, screen_width, screen_height}
        self.device_info: dict[str, dict] = {}
        # user_id -> list[WebSocket]
        self.dashboard_connections: dict[str, list[WebSocket]] = {}
        # request_id -> asyncio.Future (for request-response with devices)
        self._pending_requests: dict[str, asyncio.Future] = {}
        # device_id -> latest screenshot base64
        self.latest_screenshots: dict[str, str] = {}
        # device_id -> True if a task is running
        self.active_tasks: dict[str, bool] = {}
        # device_id -> True to signal interruption
        self.interrupt_flags: dict[str, bool] = {}

    # ── Device connections ──────────────────────────────────────────

    def register_device(
        self,
        device_id: str,
        user_id: str,
        ws: WebSocket,
        device_name: str = "Unnamed Device",
        session_minutes: int = 60,
        session_expires_at: str = "",
    ) -> None:
        self.device_connections[device_id] = ws
        self.device_info[device_id] = {
            "user_id": user_id,
            "device_name": device_name,
            "session_minutes": session_minutes,
            "session_expires_at": session_expires_at,
            "screen_width": 0,
            "screen_height": 0,
            "scale_factor": 1.0,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info("Device %s registered for user %s", device_id, user_id)

    def unregister_device(self, device_id: str) -> None:
        self.device_connections.pop(device_id, None)
        info = self.device_info.pop(device_id, None)
        self.latest_screenshots.pop(device_id, None)
        self.active_tasks.pop(device_id, None)
        self.interrupt_flags.pop(device_id, None)
        user_id = info["user_id"] if info else None
        logger.info("Device %s unregistered (user=%s)", device_id, user_id)

    def update_device_info(
        self, device_id: str, screen_width: int, screen_height: int,
        scale_factor: float = 1.0,
    ) -> None:
        if device_id in self.device_info:
            self.device_info[device_id]["screen_width"] = screen_width
            self.device_info[device_id]["screen_height"] = screen_height
            self.device_info[device_id]["scale_factor"] = scale_factor
            self.device_info[device_id]["last_seen_at"] = datetime.now(timezone.utc).isoformat()

    async def send_to_device(
        self, device_id: str, command: dict, timeout: float = 30.0
    ) -> dict:
        """Send a command to a device and wait for a response."""
        ws = self.device_connections.get(device_id)
        if not ws:
            return {"status": "error", "error": "Device not connected"}

        request_id = str(uuid.uuid4())
        command["request_id"] = request_id

        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._pending_requests[request_id] = future

        try:
            await ws.send_json(command)
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            return {"status": "error", "error": "Device response timeout"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
        finally:
            self._pending_requests.pop(request_id, None)

    def resolve_device_response(self, request_id: str, response: dict) -> None:
        """Resolve a pending device request with its response."""
        future = self._pending_requests.get(request_id)
        if future and not future.done():
            future.set_result(response)

    # ── Dashboard connections ───────────────────────────────────────

    def register_dashboard(self, user_id: str, ws: WebSocket) -> None:
        if user_id not in self.dashboard_connections:
            self.dashboard_connections[user_id] = []
        self.dashboard_connections[user_id].append(ws)
        logger.info("Dashboard registered for user %s", user_id)

    def unregister_dashboard(self, user_id: str, ws: WebSocket) -> None:
        conns = self.dashboard_connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.dashboard_connections.pop(user_id, None)

    async def broadcast_to_dashboards(self, user_id: str, event: dict) -> None:
        """Send an event to all dashboard connections for a user."""
        conns = self.dashboard_connections.get(user_id, [])
        dead = []
        for ws in conns:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.remove(ws)

    # ── Helpers ─────────────────────────────────────────────────────

    def get_user_devices(self, user_id: str) -> list[dict]:
        """Return a list of device info dicts for a user."""
        devices = []
        for device_id, info in self.device_info.items():
            if info["user_id"] == user_id:
                devices.append(
                    {
                        "device_id": device_id,
                        "user_id": user_id,
                        "device_name": info.get("device_name", "Unnamed Device"),
                        "online": device_id in self.device_connections,
                        "screen_width": info["screen_width"],
                        "screen_height": info["screen_height"],
                        "session_minutes": info.get("session_minutes", 60),
                        "session_expires_at": info.get("session_expires_at", ""),
                        "last_seen_at": info.get("last_seen_at", ""),
                    }
                )
        return devices

    def get_user_active_systems(self, user_id: str) -> list[dict]:
        systems: list[dict] = []
        for device_id, info in self.device_info.items():
            if info.get("user_id") != user_id:
                continue
            if device_id not in self.device_connections:
                continue
            systems.append(
                {
                    "device_id": device_id,
                    "user_id": user_id,
                    "device_name": info.get("device_name", "Unnamed Device"),
                    "online": True,
                    "screen_width": info.get("screen_width", 0),
                    "screen_height": info.get("screen_height", 0),
                    "session_minutes": info.get("session_minutes", 60),
                    "session_expires_at": info.get("session_expires_at", ""),
                    "last_seen_at": info.get("last_seen_at", ""),
                }
            )
        return systems

    def get_user_for_device(self, device_id: str) -> str | None:
        info = self.device_info.get(device_id)
        return info["user_id"] if info else None

    def is_device_connected(self, device_id: str) -> bool:
        return device_id in self.device_connections


# Singleton instance
connection_manager = ConnectionManager()
