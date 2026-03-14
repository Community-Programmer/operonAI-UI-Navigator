"""WebSocket client connection for the local helper."""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import time
from urllib.parse import urlparse

import websockets

from local_helper.interpreter import Interpreter
from local_helper.screen import (
    get_screenshot_base64,
    get_segmented_screenshot_via_server,
    get_screen_size,
    get_scale_factor,
)

logger = logging.getLogger(__name__)


class HelperConnection:
    """Manages the WebSocket connection to the cloud orchestrator."""

    def __init__(
        self,
        server_url: str,
        token: str,
        screenshot_interval: float = 5.0,
        on_log=None,
        on_connection_change=None,
        on_metrics=None,
    ) -> None:
        self.server_url = server_url
        self.token = token
        self.screenshot_interval = screenshot_interval
        self.interpreter = Interpreter()
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._running = False
        self._send_lock = asyncio.Lock()
        self._thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self._segmenting = False  # skip push screenshots while segmenting
        self._on_log = on_log
        self._on_connection_change = on_connection_change
        self._on_metrics = on_metrics
        self._segment_api_url = self._build_segment_api_url()

    def _build_segment_api_url(self) -> str:
        parsed = urlparse(self.server_url)
        scheme = "https" if parsed.scheme == "wss" else "http"
        netloc = parsed.netloc or parsed.path
        return f"{scheme}://{netloc}/api/segment?token={self.token}"

    def _notify_log(self, message: str) -> None:
        if self._on_log:
            try:
                self._on_log(message)
            except Exception:
                pass

    def _notify_connected(self, connected: bool) -> None:
        if self._on_connection_change:
            try:
                self._on_connection_change(connected)
            except Exception:
                pass

    def _notify_metrics(self, metrics: dict) -> None:
        if self._on_metrics:
            try:
                self._on_metrics(metrics)
            except Exception:
                pass

    async def connect(self) -> None:
        """Connect to the server and start the main loop."""
        ws_url = f"{self.server_url}/ws/device?token={self.token}"
        retry_delay = 1.0
        max_retry_delay = 30.0

        self._running = True

        while self._running:
            try:
                logger.info("Connecting to %s ...", self.server_url)
                async with websockets.connect(
                    ws_url,
                    ping_interval=30,
                    ping_timeout=60,
                    max_size=50 * 1024 * 1024,  # 50 MB
                ) as ws:
                    self._ws = ws
                    retry_delay = 1.0  # Reset on successful connect
                    logger.info("Connected to server!")
                    self._notify_connected(True)
                    self._notify_log("Connected to orchestrator")

                    # Send initial device info
                    width, height = get_screen_size()
                    scale_factor = get_scale_factor()
                    await ws.send(json.dumps({
                        "type": "init",
                        "screen_width": width,
                        "screen_height": height,
                        "scale_factor": scale_factor,
                    }))

                    # Run command listener and screenshot pusher concurrently
                    await asyncio.gather(
                        self._listen(ws),
                        self._push_screenshots(ws),
                    )

            except websockets.exceptions.ConnectionClosed as e:
                logger.warning("Connection closed: %s", e)
                self._notify_log(f"Connection closed: {e}")
            except ConnectionRefusedError:
                logger.warning("Connection refused. Server may not be running.")
                self._notify_log("Connection refused. Check server status.")
            except Exception as e:
                logger.error("Connection error: %s", e)
                self._notify_log(f"Connection error: {e}")
            finally:
                self._notify_connected(False)

            if not self._running:
                break

            logger.info("Reconnecting in %.1fs ...", retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)

    async def _listen(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Listen for commands from the server and execute them."""
        try:
            async for raw_message in ws:
                try:
                    command = json.loads(raw_message)
                except json.JSONDecodeError:
                    logger.error("Invalid JSON received: %s", raw_message[:200])
                    continue

                request_id = command.get("request_id", "")
                action = command.get("action", "")

                logger.info("Received command: %s (request_id=%s)", action, request_id)
                self._notify_log(f"Received command: {action}")

                if action == "kill":
                    logger.info("Kill command received. Shutting down.")
                    self._running = False
                    break

                if action == "screenshot":
                    # Capture and send back screenshot
                    try:
                        params = command.get("parameters", {})
                        if params.get("segment"):
                            # Run heavy segmentation in thread to avoid blocking event loop
                            self._segmenting = True
                            try:
                                loop = asyncio.get_event_loop()
                                start = time.perf_counter()
                                screenshot_b64, elements, screen_info, seg_stats = (
                                    await loop.run_in_executor(
                                        self._thread_pool,
                                        get_segmented_screenshot_via_server,
                                        self._segment_api_url,
                                        60,
                                    )
                                )
                                elapsed_ms = int((time.perf_counter() - start) * 1000)
                                merged_stats = {
                                    "rtt_ms": elapsed_ms,
                                    "segmentation_ms": seg_stats.get("latency_ms", elapsed_ms),
                                    "num_elements": seg_stats.get("num_elements", len(elements)),
                                    "avg_confidence": seg_stats.get("avg_confidence", 0.0),
                                }
                                self._notify_metrics(merged_stats)
                                self._notify_log(
                                    f"Segmented screenshot: {merged_stats['num_elements']} elements"
                                )
                            finally:
                                self._segmenting = False
                            response = {
                                "type": "response",
                                "request_id": request_id,
                                "status": "success",
                                "data": {
                                    "screenshot": screenshot_b64,
                                    "elements": elements,
                                    "screen_info": screen_info,
                                    "stats": seg_stats,
                                },
                            }
                        else:
                            screenshot_b64 = get_screenshot_base64()
                            response = {
                                "type": "response",
                                "request_id": request_id,
                                "status": "success",
                                "data": {"screenshot": screenshot_b64},
                            }
                    except Exception as e:
                        logger.error("Screenshot error: %s", e)
                        self._notify_log(f"Screenshot error: {e}")
                        response = {
                            "type": "response",
                            "request_id": request_id,
                            "status": "error",
                            "error": str(e),
                        }
                else:
                    # Execute the command via interpreter
                    result = self.interpreter.process_command(command)
                    if result.get("status") == "success":
                        self._notify_log(f"Executed: {action}")
                    else:
                        self._notify_log(f"Action failed: {action} ({result.get('error', 'unknown')})")
                    response = {
                        "type": "response",
                        "request_id": request_id,
                        **result,
                    }

                async with self._send_lock:
                    await ws.send(json.dumps(response))

        except websockets.exceptions.ConnectionClosed:
            raise  # Let the outer handler deal with reconnection

    async def _push_screenshots(
        self, ws: websockets.WebSocketClientProtocol
    ) -> None:
        """Periodically push screenshots to the server for live view."""
        try:
            while self._running:
                await asyncio.sleep(self.screenshot_interval)
                if self._segmenting:
                    continue  # Don't contend with active segmentation
                try:
                    screenshot_b64 = get_screenshot_base64(quality=40)
                    async with self._send_lock:
                        await ws.send(json.dumps({
                            "type": "screenshot_push",
                            "screenshot": screenshot_b64,
                        }))
                except websockets.exceptions.ConnectionClosed:
                    raise
                except Exception as e:
                    logger.debug("Screenshot push failed: %s", e)
        except websockets.exceptions.ConnectionClosed:
            raise

    def stop(self) -> None:
        """Signal the connection to stop and force-close the websocket."""
        self._running = False
        # Force-close the websocket so the async loop exits immediately
        if self._ws is not None:
            try:
                asyncio.get_event_loop().call_soon_threadsafe(
                    asyncio.ensure_future, self._ws.close()
                )
            except RuntimeError:
                pass  # event loop already closed
        self._notify_connected(False)
        self._notify_log("Disconnected from server")
