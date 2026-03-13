"""Tools for the voice-controlled live navigator agent.

The key difference from the standard tools is the `take_screenshot` tool,
which captures screenshots ON DEMAND (not continuously) and sends the image
to the model's visual context via the LiveRequestQueue.
"""

from __future__ import annotations

import base64
import json
import logging

from google.adk.tools import ToolContext
from google.genai import types

from server.connections.manager import connection_manager

logger = logging.getLogger(__name__)

# ── LiveRequestQueue registry ──────────────────────────────────────
# Maps device_id -> LiveRequestQueue so the take_screenshot tool can
# push images into the model's visual context during tool execution.
_live_queues: dict = {}

# Maps device_id → WebSocket so tools can send data (like screenshots)
# directly to the voice client.
_live_websockets: dict = {}


def register_live_queue(device_id: str, queue) -> None:
    """Register a LiveRequestQueue for a device so tools can send images."""
    _live_queues[device_id] = queue


def unregister_live_queue(device_id: str) -> None:
    """Remove the LiveRequestQueue registration for a device."""
    _live_queues.pop(device_id, None)


def register_live_websocket(device_id: str, ws) -> None:
    """Register a voice WebSocket for a device so tools can push screenshots."""
    _live_websockets[device_id] = ws


def unregister_live_websocket(device_id: str) -> None:
    """Remove the voice WebSocket registration for a device."""
    _live_websockets.pop(device_id, None)


def _format_elements(elements: list[dict]) -> str:
    """Format detected elements into descriptive text for the model."""
    if not elements:
        return "No UI elements detected."
    lines = []
    for el in elements:
        eid = el["id"]
        cat = el.get("category", "element")
        text = el.get("text", "")
        cx, cy = el["center_x"], el["center_y"]
        bbox = el.get("bbox", [0, 0, 0, 0])
        conf = el.get("confidence", 0)

        parts = [f"[{eid}] {cat}"]
        if text:
            parts.append(f'"{text}"')
        parts.append(
            f"bbox=[{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}] "
            f"center=({cx},{cy}) conf={conf:.0%}"
        )
        lines.append(" ".join(parts))
    return "\n".join(lines)


async def take_screenshot(tool_context: ToolContext) -> dict:
    """Capture the current screen state and analyze all UI elements.

    Takes a screenshot of the remote desktop, detects interactive UI elements
    (buttons, text fields, icons, checkboxes, etc.), and returns a detailed
    list describing what is on screen. The screenshot image is also sent to
    your visual context so you can see it.

    ALWAYS call this BEFORE performing actions and AFTER performing actions
    to verify results. Never act blind.

    Returns:
        dict with screen size, number of detected elements, and a text list
        of every element with its [ID], category, text, bounding box, and
        center coordinates.
    """
    device_id = tool_context.state.get("device_id", "")
    user_id = tool_context.state.get("user_id", "")

    if not device_id:
        return {"status": "error", "message": "No device connected"}

    if not connection_manager.is_device_connected(device_id):
        return {"status": "error", "message": "Device is not connected"}

    # Capture segmented screenshot from the device
    screenshot_result = await connection_manager.send_to_device(
        device_id,
        {"action": "screenshot", "parameters": {"segment": True}},
        timeout=60.0,
    )

    if screenshot_result.get("status") != "success":
        return {
            "status": "error",
            "message": f"Failed to capture screenshot: {screenshot_result.get('error', 'unknown')}",
        }

    data = screenshot_result.get("data", {})
    screenshot_b64 = data.get("screenshot", "")
    elements = data.get("elements", [])
    screen_info = data.get("screen_info", {})

    if not screenshot_b64:
        return {"status": "error", "message": "Empty screenshot received"}

    # Update session state with detected elements so click tools can use them
    tool_context.state["elements"] = elements
    if screen_info:
        tool_context.state["screen_width"] = screen_info.get(
            "screen_width", tool_context.state.get("screen_width", 1920)
        )
        tool_context.state["screen_height"] = screen_info.get(
            "screen_height", tool_context.state.get("screen_height", 1080)
        )

    # Send the annotated screenshot image to the model's visual context
    queue = _live_queues.get(device_id)
    if queue:
        try:
            image_data = base64.b64decode(screenshot_b64)
            image_blob = types.Blob(mime_type="image/jpeg", data=image_data)
            queue.send_realtime(image_blob)
        except Exception as e:
            logger.warning("Failed to send screenshot to model context: %s", e)

    # Broadcast the screenshot to the user's dashboard for live viewing
    connection_manager.latest_screenshots[device_id] = screenshot_b64
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "screenshot",
        "data": {"image": screenshot_b64},
    })

    # Send the screenshot to the voice WebSocket client so the UI can display it
    voice_ws = _live_websockets.get(device_id)
    if voice_ws:
        try:
            await voice_ws.send_text(json.dumps({
                "type": "screenshot",
                "image": screenshot_b64,
            }))
        except Exception as e:
            logger.warning("Failed to send screenshot to voice client: %s", e)

    # Return element descriptions as text
    element_text = _format_elements(elements)
    sw = tool_context.state.get("screen_width", 1920)
    sh = tool_context.state.get("screen_height", 1080)

    return {
        "status": "success",
        "screen_size": f"{sw}x{sh}",
        "num_elements": len(elements),
        "elements": element_text,
        "note": (
            "The annotated screenshot has been sent to your visual context. "
            "Elements are numbered [1], [2], [3]... with color-coded bounding "
            "boxes. Use click_element(N) to interact with element [N]."
        ),
    }


# ── Re-export all action tools from the standard tools module ──────
# These are shared between the standard agent and the live voice agent.
from server.navigator_agent.tools import (  # noqa: E402
    click_element,
    click_element_area,
    double_click_element,
    right_click_element,
    execute_click,
    execute_double_click,
    execute_right_click,
    execute_write,
    execute_hotkey,
    execute_press,
    execute_scroll,
    execute_move,
    execute_drag,
    execute_sleep,
)

__all__ = [
    "take_screenshot",
    "register_live_queue",
    "unregister_live_queue",
    "register_live_websocket",
    "unregister_live_websocket",
    "click_element",
    "click_element_area",
    "double_click_element",
    "right_click_element",
    "execute_click",
    "execute_double_click",
    "execute_right_click",
    "execute_write",
    "execute_hotkey",
    "execute_press",
    "execute_scroll",
    "execute_move",
    "execute_drag",
    "execute_sleep",
]
