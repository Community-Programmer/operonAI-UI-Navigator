from __future__ import annotations

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    username: str


class PairDeviceRequest(BaseModel):
    device_name: str
    session_minutes: int = 60


class TokenResponse(BaseModel):
    device_token: str
    device_id: str
    device_name: str
    session_minutes: int
    expires_at: str


class DeviceCommand(BaseModel):
    action: str
    parameters: dict = {}


class DeviceResponse(BaseModel):
    status: str  # "success" or "error"
    data: dict = {}
    error: str = ""


class DeviceInfo(BaseModel):
    device_id: str
    user_id: str
    device_name: str = "Unnamed Device"
    online: bool = False
    screen_width: int = 0
    screen_height: int = 0
    session_minutes: int = 60
    session_expires_at: str = ""
    last_seen_at: str = ""


class ActiveSystemsResponse(BaseModel):
    systems: list[DeviceInfo]
    online_count: int = 0


class NavigateRequest(BaseModel):
    goal: str
    device_id: str


class DashboardEvent(BaseModel):
    type: str  # "screenshot", "log", "status", "error", "done"
    data: dict = {}


class SegmentRequest(BaseModel):
    image_b64: str
    logical_width: int
    logical_height: int
    scale_factor: float = 1.0
    quality: int = 60


class SegmentResponse(BaseModel):
    screenshot: str
    elements: list[dict]
    screen_info: dict
    stats: dict
