"""Command interpreter — translates JSON commands into pyautogui actions.

Adapted from Open-Interface's interpreter.py with robust parameter handling.
"""

from __future__ import annotations

import logging
import time

import pyautogui

logger = logging.getLogger(__name__)

# Safety: prevent pyautogui from raising FailSafeException when moving to corner
pyautogui.FAILSAFE = True
# Set a small pause between pyautogui calls for reliability
pyautogui.PAUSE = 0.15


class Interpreter:
    """Executes desktop automation commands using pyautogui."""

    def __init__(self) -> None:
        self._warmed_up = False

    def _warmup(self) -> None:
        """First pyautogui call sometimes doesn't register. Do a no-op."""
        if not self._warmed_up:
            try:
                pyautogui.press("shift")  # harmless key tap
            except Exception:
                pass
            self._warmed_up = True

    def process_command(self, command: dict) -> dict:
        """Execute a single command and return a result dict.

        Args:
            command: {"action": str, "parameters": dict}

        Returns:
            {"status": "success"} or {"status": "error", "error": "..."}
        """
        action = command.get("action", "")
        params = command.get("parameters", {})

        logger.info("Executing: %s  params=%s", action, params)

        try:
            self._warmup()
            self._execute(action, params)
            return {"status": "success"}
        except Exception as e:
            logger.error("Error executing %s: %s", action, e)
            return {"status": "error", "error": str(e)}

    def _execute(self, action: str, params: dict) -> None:
        if action == "screenshot":
            # Screenshot is handled separately in the connection layer
            return

        if action == "sleep":
            seconds = float(params.get("seconds", params.get("secs", 1)))
            seconds = min(max(seconds, 0.1), 10.0)
            time.sleep(seconds)
            return

        if action == "click":
            x = int(params["x"])
            y = int(params["y"])
            # Clamp to screen bounds
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            pyautogui.click(x, y)
            return

        if action == "double_click":
            x = int(params["x"])
            y = int(params["y"])
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            pyautogui.click(x, y, clicks=2, interval=0.1)
            return

        if action == "triple_click":
            x = int(params["x"])
            y = int(params["y"])
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            pyautogui.click(x, y, clicks=3, interval=0.1)
            return

        if action == "right_click":
            x = int(params["x"])
            y = int(params["y"])
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            pyautogui.rightClick(x, y)
            return

        if action == "write":
            # LLM may use "text", "string", or "message" for the text param
            text = params.get("text") or params.get("string") or params.get("message") or ""
            interval = float(params.get("interval", 0.05))
            # Ensure interval is reasonable
            interval = max(0.01, min(interval, 0.3))
            pyautogui.write(str(text), interval=interval)
            return

        if action == "press":
            key = params.get("key", "")
            if isinstance(key, list):
                for k in key:
                    pyautogui.press(str(k))
            else:
                presses = int(params.get("presses", 1))
                presses = max(1, min(presses, 50))  # safety limit
                interval = float(params.get("interval", 0.1))
                pyautogui.press(str(key), presses=presses, interval=interval)
            return

        if action == "hotkey":
            keys = params.get("keys", [])
            if isinstance(keys, list) and keys:
                pyautogui.hotkey(*[str(k) for k in keys])
            return

        if action == "scroll":
            clicks = int(params.get("clicks", 0))
            x = params.get("x")
            y = params.get("y")
            if x is not None and y is not None:
                pyautogui.scroll(clicks, int(x), int(y))
            else:
                pyautogui.scroll(clicks)
            return

        if action == "move_to":
            x = int(params["x"])
            y = int(params["y"])
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            pyautogui.moveTo(x, y, duration=0.2)
            return

        if action == "drag_to":
            x = int(params["x"])
            y = int(params["y"])
            sw, sh = pyautogui.size()
            x = max(0, min(x, sw - 1))
            y = max(0, min(y, sh - 1))
            duration = float(params.get("duration", 0.5))
            duration = max(0.2, min(duration, 5.0))
            pyautogui.dragTo(x, y, duration=duration)
            return

        if action == "kill":
            raise SystemExit("Kill command received")

        logger.warning("Unknown action: %s", action)
