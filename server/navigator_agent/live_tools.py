"""Tools for the voice-controlled live navigator agent.

The key difference from the standard tools is the `take_screenshot` tool,
which captures screenshots ON DEMAND (not continuously) and sends the image
to the model's visual context via the LiveRequestQueue.

Uses the perception layer for typed UI element detection (same as the standard
agent loop) for improved accuracy.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging

from google.adk.tools import ToolContext
from google.genai import types

from server.connections.manager import connection_manager
from server.navigator_agent.action_schema import format_ui_state_for_llm
from server.navigator_agent.perception import build_ui_state
from server.navigator_agent.tools import drain_recorded_actions
from server.storage.gcs import upload_screenshot

logger = logging.getLogger(__name__)

# ── LiveRequestQueue registry ──────────────────────────────────────
# Maps device_id -> LiveRequestQueue so the take_screenshot tool can
# push images into the model's visual context during tool execution.
_live_queues: dict = {}

# Maps device_id → WebSocket so tools can send data (like screenshots)
# directly to the voice client.
_live_websockets: dict = {}

# ── Session logger registry for voice sessions ───────────────────
_live_session_loggers: dict = {}   # device_id → SessionLogger
_live_iteration_counters: dict = {}  # device_id → int
_live_transcriptions: dict = {}    # device_id → list[{role, text}]


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


# ── Session logger helpers ───────────────────────────────────

def register_live_session_logger(device_id: str, sess_logger) -> None:
    """Register a SessionLogger for a voice session."""
    _live_session_loggers[device_id] = sess_logger
    _live_iteration_counters[device_id] = 0
    _live_transcriptions[device_id] = []


def unregister_live_session_logger(device_id: str) -> None:
    """Remove the SessionLogger registration for a device."""
    _live_session_loggers.pop(device_id, None)
    _live_iteration_counters.pop(device_id, None)
    _live_transcriptions.pop(device_id, None)


def record_live_transcription(device_id: str, role: str, text: str) -> None:
    """Buffer a transcription line for the next iteration record."""
    if device_id in _live_transcriptions:
        _live_transcriptions[device_id].append({"role": role, "text": text})


async def take_screenshot(tool_context: ToolContext) -> dict:
    """Capture the current screen state and analyze all UI elements.

    Takes a screenshot of the remote desktop, runs typed UI element detection
    (buttons, inputs, text, icons, checkboxes, dropdowns, links, tabs, menus),
    and returns a detailed element list. The screenshot image is also sent to
    your visual context so you can see it.

    ALWAYS call this BEFORE performing actions and AFTER performing actions
    to verify results. Never act blind.

    Returns:
        dict with screen size, number of detected elements, and a typed text
        list of every element with its [ID], type, text, bounding box, center
        coordinates, and confidence score.
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
    sw = tool_context.state.get("screen_width", 1920)
    sh = tool_context.state.get("screen_height", 1080)
    if screen_info:
        sw = screen_info.get("screen_width", sw)
        sh = screen_info.get("screen_height", sh)
        tool_context.state["screen_width"] = sw
        tool_context.state["screen_height"] = sh

    # Build typed UIState via the perception layer for accurate element typing
    ui_state = build_ui_state(screenshot_b64, elements, sw, sh)
    element_text = format_ui_state_for_llm(ui_state)

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

    # ── Record iteration to voice session logger (if active) ──────
    sess_logger = _live_session_loggers.get(device_id)
    if sess_logger:
        iteration = _live_iteration_counters.get(device_id, 0)

        # Collect buffered transcriptions as reasoning text
        pending_trans = _live_transcriptions.get(device_id, [])
        reasoning = "\n".join(
            f"[{t['role']}]: {t['text']}" for t in pending_trans
        ) if pending_trans else ""

        # Collect actions recorded since last screenshot
        actions = drain_recorded_actions(device_id)

        # Upload screenshot to GCS (runs in a thread to avoid blocking)
        screenshot_url = None
        try:
            screenshot_url = await asyncio.to_thread(
                upload_screenshot, sess_logger.session_id, iteration, screenshot_b64,
            )
        except Exception as e:
            logger.warning("GCS upload failed for voice session: %s", e)

        sess_logger.record_iteration(
            iteration,
            screenshot_url=screenshot_url,
            screenshot_b64=screenshot_b64,
            agent_reasoning=reasoning,
            actions=actions,
            element_count=ui_state.element_count,
        )
        _live_iteration_counters[device_id] = iteration + 1
        # Clear buffered transcriptions
        if device_id in _live_transcriptions:
            _live_transcriptions[device_id] = []

    return {
        "status": "success",
        "screen_size": f"{sw}x{sh}",
        "num_elements": ui_state.element_count,
        "elements": element_text,
        "note": (
            "The annotated screenshot has been sent to your visual context. "
            "Elements are numbered [1], [2], [3]… with typed labels (button, "
            "input, text, icon, checkbox, dropdown, link, tab, menu_item). "
            "Use click_element(N) to interact with element [N]."
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
    "register_live_session_logger",
    "unregister_live_session_logger",
    "record_live_transcription",
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
