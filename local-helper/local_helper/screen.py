"""Screenshot capture utilities for the local helper client."""

from __future__ import annotations

import base64
import io
import json
import logging
import urllib.request

import pyautogui
from PIL import Image

logger = logging.getLogger(__name__)

# Cached scale factor (doesn't change during a session)
_cached_scale: float | None = None


def _capture_screen() -> tuple[Image.Image, int, int, float]:
    screenshot: Image.Image = pyautogui.screenshot().convert("RGB")
    logical_w, logical_h = pyautogui.size()
    actual_w, _ = screenshot.size
    scale = actual_w / logical_w if logical_w else 1.0

    return screenshot, logical_w, logical_h, scale


def _encode_image_base64(image: Image.Image, quality: int) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def get_scale_factor() -> float:
    """Detect HiDPI / Retina scale factor (cached after first call)."""
    global _cached_scale
    if _cached_scale is not None:
        return _cached_scale
    logical_w, _ = pyautogui.size()
    screenshot = pyautogui.screenshot()
    actual_w, _ = screenshot.size
    _cached_scale = actual_w / logical_w if logical_w else 1.0
    return _cached_scale


def get_screen_size() -> tuple[int, int]:
    """Return *logical* (width, height) of the primary screen."""
    size = pyautogui.size()
    return size.width, size.height


def get_screenshot_base64(quality: int = 50) -> str:
    """Capture a screenshot and return it as a base64-encoded JPEG string."""
    screenshot, _, _, _ = _capture_screen()
    return _encode_image_base64(screenshot, quality)


# ── UI Segmentation ────────────────────────────────────────────────

def get_segmented_screenshot_via_server(
    segment_api_url: str,
    quality: int = 60,
    timeout_seconds: int = 120,
) -> tuple[str, list[dict], dict, dict]:
    """Capture screenshot and run segmentation on the server.

    Returns (annotated_base64, elements, screen_info, stats).
    """
    screenshot, logical_w, logical_h, scale = _capture_screen()
    screenshot_b64 = _encode_image_base64(screenshot, quality=quality)

    payload = {
        "image_b64": screenshot_b64,
        "logical_width": logical_w,
        "logical_height": logical_h,
        "scale_factor": scale,
        "quality": quality,
    }

    request = urllib.request.Request(
        url=segment_api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        data = json.loads(response.read().decode("utf-8"))

    return (
        data.get("screenshot", ""),
        data.get("elements", []),
        data.get("screen_info", {}),
        data.get("stats", {}),
    )
