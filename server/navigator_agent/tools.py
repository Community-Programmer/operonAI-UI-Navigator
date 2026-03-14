"""ADK tool functions for controlling a remote desktop via the local helper."""

from __future__ import annotations

import logging

from google.adk.tools import ToolContext

from server.connections.manager import connection_manager

logger = logging.getLogger(__name__)

# ── Optional per-device action recorders (used by voice sessions) ──
_action_recorders: dict[str, list] = {}


def register_action_recorder(device_id: str) -> list:
    """Start recording actions for a device (voice session logging)."""
    _action_recorders[device_id] = []
    return _action_recorders[device_id]


def unregister_action_recorder(device_id: str) -> None:
    """Stop recording actions for a device."""
    _action_recorders.pop(device_id, None)


def drain_recorded_actions(device_id: str) -> list:
    """Return and clear all recorded actions for a device."""
    actions = _action_recorders.get(device_id, [])
    if device_id in _action_recorders:
        _action_recorders[device_id] = []
    return actions


def _clamp_coords(x: int, y: int, tool_context: ToolContext) -> tuple[int, int]:
    """Clamp coordinates to screen bounds to prevent off-screen clicks."""
    sw = tool_context.state.get("screen_width", 1920)
    sh = tool_context.state.get("screen_height", 1080)
    return max(0, min(int(x), sw - 1)), max(0, min(int(y), sh - 1))


def _get_element(element_id: int, tool_context: ToolContext) -> dict | None:
    """Look up a detected UI element by its ID. Returns the full element dict with bbox."""
    elements = tool_context.state.get("elements", [])
    for el in elements:
        if el.get("id") == element_id:
            return el
    return None


def _element_click_coords(element: dict, position: str = "center") -> tuple[int, int]:
    """Compute click coordinates from an element's bbox.

    position: "center" (default), "top", "bottom", "left", "right",
              "top-left", "top-right", "bottom-left", "bottom-right"
    """
    x1, y1, x2, y2 = element["bbox"]
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    positions = {
        "center":       (cx, cy),
        "top":          (cx, y1 + 2),
        "bottom":       (cx, y2 - 2),
        "left":         (x1 + 2, cy),
        "right":        (x2 - 2, cy),
        "top-left":     (x1 + 2, y1 + 2),
        "top-right":    (x2 - 2, y1 + 2),
        "bottom-left":  (x1 + 2, y2 - 2),
        "bottom-right": (x2 - 2, y2 - 2),
    }
    return positions.get(position, (cx, cy))


async def _send_command(tool_context: ToolContext, action: str, parameters: dict | None = None) -> dict:
    """Helper: send a command to the device and broadcast the action to dashboards."""
    device_id = tool_context.state.get("device_id", "")
    user_id = tool_context.state.get("user_id", "")

    if not device_id:
        return {"status": "error", "message": "No device_id in session state"}

    if connection_manager.interrupt_flags.get(device_id):
        return {"status": "error", "message": "Task interrupted by user"}

    command = {"action": action, "parameters": parameters or {}}
    result = await connection_manager.send_to_device(device_id, command)

    # Build a human-readable message for the dashboard
    params = parameters or {}
    if action == "click":
        msg = f"Click at ({params.get('x')}, {params.get('y')})"
    elif action == "double_click":
        msg = f"Double-click at ({params.get('x')}, {params.get('y')})"
    elif action == "right_click":
        msg = f"Right-click at ({params.get('x')}, {params.get('y')})"
    elif action == "write":
        msg = f"Type: \"{params.get('text', '')}\""
    elif action == "press":
        msg = f"Press: {params.get('key', '')}"
    elif action == "hotkey":
        msg = f"Hotkey: {'+'.join(params.get('keys', []))}"
    elif action == "scroll":
        direction = "up" if params.get("clicks", 0) > 0 else "down"
        msg = f"Scroll {direction} ({abs(params.get('clicks', 0))} clicks)"
    elif action == "move_to":
        msg = f"Move cursor to ({params.get('x')}, {params.get('y')})"
    elif action == "drag_to":
        msg = f"Drag to ({params.get('x')}, {params.get('y')})"
    else:
        msg = f"{action}: {params}"

    status = result.get("status", "unknown")
    if status != "success":
        msg += f" — {status}"

    # Broadcast the action to the user's dashboards
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "log",
        "data": {
            "action": action,
            "message": msg,
            "parameters": parameters or {},
            "result_status": status,
        },
    })

    # Record action for voice session logging (if active)
    if device_id in _action_recorders:
        _action_recorders[device_id].append({
            "action": action,
            "parameters": parameters or {},
            "reason": msg,
            "status": status,
        })

    return result


# -- Element-based click tools (primary) -----------------------------------

def _element_not_found_error(element_id: int, tool_context: ToolContext, fallback_tool: str) -> dict:
    """Build a helpful error when an element ID is not found."""
    available = tool_context.state.get("elements", [])
    hints = []
    for e in available[:15]:
        text = e.get("text", "")
        label = f"[{e['id']}] {e.get('category', '?')}"
        if text:
            label += f' "{text[:20]}"'
        bbox = e.get("bbox", [])
        if bbox:
            label += f" bbox={bbox}"
        hints.append(label)
    hint_str = "; ".join(hints)
    return {
        "status": "error",
        "message": (
            f"Element [{element_id}] not found in current detections. "
            f"Available: {hint_str}. "
            f"Use {fallback_tool} with pixel coordinates as fallback."
        ),
    }


async def click_element(element_id: int, tool_context: ToolContext) -> dict:
    """Click on a detected UI element by its numbered ID shown in the screenshot.

    The screenshot has numbered bounding boxes [1], [2], [3]… around detected UI elements.
    This clicks the CENTER of the element's bounding box. This is the PREFERRED way to click.

    Args:
        element_id: The element number shown in the annotated screenshot (e.g. 1, 2, 3).

    Returns:
        dict: status with clicked coordinates.  bbox field shows the element's
              full bounding region [x1, y1, x2, y2] in screen pixels.
    """
    el = _get_element(element_id, tool_context)
    if el is None:
        return _element_not_found_error(element_id, tool_context, "execute_click(x, y)")

    x, y = _element_click_coords(el, "center")
    x, y = _clamp_coords(x, y, tool_context)
    result = await _send_command(tool_context, "click", {"x": x, "y": y})
    result["clicked_at"] = {"x": x, "y": y, "element_id": element_id}
    result["element_bbox"] = el["bbox"]
    return result


async def click_element_area(
    element_id: int,
    position: str,
    tool_context: ToolContext,
) -> dict:
    """Click a specific area within a detected UI element's bounding box.

    Use this when clicking the center of the element isn't right — for example,
    to click the left side of a text field, the right edge of a toolbar, or
    a specific corner of a panel.

    Args:
        element_id: The element number shown in the annotated screenshot.
        position: Where within the bounding box to click. One of:
            "center", "top", "bottom", "left", "right",
            "top-left", "top-right", "bottom-left", "bottom-right".

    Returns:
        dict: status with clicked coordinates and bbox.
    """
    el = _get_element(element_id, tool_context)
    if el is None:
        return _element_not_found_error(element_id, tool_context, "execute_click(x, y)")

    x, y = _element_click_coords(el, position)
    x, y = _clamp_coords(x, y, tool_context)
    result = await _send_command(tool_context, "click", {"x": x, "y": y})
    result["clicked_at"] = {"x": x, "y": y, "element_id": element_id, "position": position}
    result["element_bbox"] = el["bbox"]
    return result


async def double_click_element(element_id: int, tool_context: ToolContext) -> dict:
    """Double-click on a detected UI element by its numbered ID.

    Use this to open files, select words, or perform double-click actions
    on elements shown in the annotated screenshot.

    Args:
        element_id: The element number shown in the annotated screenshot.

    Returns:
        dict: status with clicked coordinates and bbox.
    """
    el = _get_element(element_id, tool_context)
    if el is None:
        return _element_not_found_error(element_id, tool_context, "execute_double_click(x, y)")

    x, y = _element_click_coords(el, "center")
    x, y = _clamp_coords(x, y, tool_context)
    result = await _send_command(tool_context, "double_click", {"x": x, "y": y})
    result["clicked_at"] = {"x": x, "y": y, "element_id": element_id}
    result["element_bbox"] = el["bbox"]
    return result


async def right_click_element(element_id: int, tool_context: ToolContext) -> dict:
    """Right-click on a detected UI element by its numbered ID.

    Use this to open context menus on elements shown in the annotated screenshot.

    Args:
        element_id: The element number shown in the annotated screenshot.

    Returns:
        dict: status with clicked coordinates and bbox.
    """
    el = _get_element(element_id, tool_context)
    if el is None:
        return _element_not_found_error(element_id, tool_context, "execute_right_click(x, y)")

    x, y = _element_click_coords(el, "center")
    x, y = _clamp_coords(x, y, tool_context)
    result = await _send_command(tool_context, "right_click", {"x": x, "y": y})
    result["clicked_at"] = {"x": x, "y": y, "element_id": element_id}
    result["element_bbox"] = el["bbox"]
    return result


# -- Pixel-coordinate tools (fallback) ------------------------------------

async def execute_click(x: int, y: int, tool_context: ToolContext) -> dict:
    """Click at the specified screen coordinates (logical pixels).

    Use this only when you need precision clicking and no detected element
    covers the target. Prefer click_element for most UI interactions.

    Args:
        x: The x-coordinate (horizontal position from left edge) in logical pixels.
        y: The y-coordinate (vertical position from top edge) in logical pixels.

    Returns:
        dict: status indicating success or error.
    """
    x, y = _clamp_coords(x, y, tool_context)
    return await _send_command(tool_context, "click", {"x": x, "y": y})


async def execute_double_click(x: int, y: int, tool_context: ToolContext) -> dict:
    """Double-click at the specified screen coordinates.

    Args:
        x: The x-coordinate (horizontal position) on screen.
        y: The y-coordinate (vertical position) on screen.

    Returns:
        dict: status indicating success or error.
    """
    x, y = _clamp_coords(x, y, tool_context)
    return await _send_command(tool_context, "double_click", {"x": x, "y": y})


async def execute_right_click(x: int, y: int, tool_context: ToolContext) -> dict:
    """Right-click at the specified screen coordinates.

    Args:
        x: The x-coordinate (horizontal position) on screen.
        y: The y-coordinate (vertical position) on screen.

    Returns:
        dict: status indicating success or error.
    """
    x, y = _clamp_coords(x, y, tool_context)
    return await _send_command(tool_context, "right_click", {"x": x, "y": y})


async def execute_write(text: str, tool_context: ToolContext, interval: float = 0.05) -> dict:
    """Type the given text string using the keyboard, character by character.

    IMPORTANT: Make sure the correct text field is focused/clicked BEFORE calling this.
    This does NOT press Enter -- use execute_press("enter") separately if needed.

    Args:
        text: The text string to type. Keep it short; for long text, break into chunks.
        interval: Delay between keystrokes in seconds (default 0.05).

    Returns:
        dict: status indicating success or error.
    """
    return await _send_command(tool_context, "write", {"text": text, "interval": interval})


async def execute_hotkey(keys: list[str], tool_context: ToolContext) -> dict:
    """Press a keyboard shortcut (combination of keys held simultaneously).

    Examples: ["ctrl", "c"] for copy, ["alt", "f4"] to close window,
    ["ctrl", "shift", "s"] for save-as, ["win"] for start menu.

    Args:
        keys: List of key names to press simultaneously.

    Returns:
        dict: status indicating success or error.
    """
    return await _send_command(tool_context, "hotkey", {"keys": keys})


async def execute_press(key: str, tool_context: ToolContext, presses: int = 1) -> dict:
    """Press a single key on the keyboard one or more times.

    Args:
        key: The key to press (e.g., "enter", "tab", "escape", "delete",
             "up", "down", "left", "right", "f5", "space", "backspace").
        presses: How many times to press the key (default 1).

    Returns:
        dict: status indicating success or error.
    """
    return await _send_command(tool_context, "press", {"key": key, "presses": presses})


async def execute_scroll(clicks: int, tool_context: ToolContext, x: int | None = None, y: int | None = None) -> dict:
    """Scroll the mouse wheel. Positive values scroll up, negative scroll down.

    Args:
        clicks: Number of scroll clicks. Positive = up, negative = down. Use 3-5 for normal scrolling.
        x: Optional x-coordinate to scroll at.
        y: Optional y-coordinate to scroll at.

    Returns:
        dict: status indicating success or error.
    """
    params: dict = {"clicks": clicks}
    if x is not None and y is not None:
        x, y = _clamp_coords(x, y, tool_context)
        params["x"] = x
        params["y"] = y
    return await _send_command(tool_context, "scroll", params)


async def execute_move(x: int, y: int, tool_context: ToolContext) -> dict:
    """Move the mouse cursor to the specified screen coordinates without clicking.

    Args:
        x: The x-coordinate to move to.
        y: The y-coordinate to move to.

    Returns:
        dict: status indicating success or error.
    """
    x, y = _clamp_coords(x, y, tool_context)
    return await _send_command(tool_context, "move_to", {"x": x, "y": y})


async def execute_drag(start_x: int, start_y: int, end_x: int, end_y: int, tool_context: ToolContext, duration: float = 0.5) -> dict:
    """Click and drag from one position to another.

    Args:
        start_x: Starting x-coordinate.
        start_y: Starting y-coordinate.
        end_x: Ending x-coordinate.
        end_y: Ending y-coordinate.
        duration: Time in seconds for the drag motion (default 0.5).

    Returns:
        dict: status indicating success or error.
    """
    start_x, start_y = _clamp_coords(start_x, start_y, tool_context)
    end_x, end_y = _clamp_coords(end_x, end_y, tool_context)
    await _send_command(tool_context, "move_to", {"x": start_x, "y": start_y})
    return await _send_command(tool_context, "drag_to", {"x": end_x, "y": end_y, "duration": duration})


async def execute_sleep(seconds: float, tool_context: ToolContext) -> dict:
    """Wait for a specified number of seconds. Use this after opening
    applications or web pages to give them time to load.

    Args:
        seconds: Number of seconds to wait (0.5 to 5.0).

    Returns:
        dict: status indicating success or error.
    """
    import asyncio
    seconds = min(max(seconds, 0.1), 10.0)
    await asyncio.sleep(seconds)
    return {"status": "success", "message": f"Waited {seconds} seconds"}
