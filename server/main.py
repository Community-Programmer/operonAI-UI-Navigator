"""Cloud Orchestrator — FastAPI server with WebSocket + ADK agent integration."""

from __future__ import annotations

import asyncio
import base64
import logging
import uuid
import warnings
from datetime import datetime, timedelta, timezone

import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService
from google.genai import types as genai_types

# Suppress Pydantic serialization warnings (ADK internal mismatch)
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

from auth.jwt_handler import create_device_token, create_user_token, verify_token
from auth.user_store import user_store
from config import CORS_ORIGINS
from connections.manager import connection_manager
from devices.device_store import device_store
from models.schemas import (
    ActiveSystemsResponse,
    DeviceInfo,
    LoginRequest,
    LoginResponse,
    PairDeviceRequest,
    SegmentRequest,
    SegmentResponse,
    TokenResponse,
)
from navigator_agent.agent import root_agent
from navigator_agent.live_agent import live_agent
from navigator_agent.live_tools import (
    register_live_queue,
    unregister_live_queue,
    register_live_websocket,
    unregister_live_websocket,
)
from segmentation.service import segment_screenshot_payload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="UI Navigator — Cloud Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ADK session service ────────────────────────────────────────────
session_service = InMemorySessionService()
memory_service = InMemoryMemoryService()
APP_NAME = "ui_navigator"
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
    memory_service=memory_service,
)

# Runner for the live voice agent (bidi-streaming)
live_runner = Runner(
    agent=live_agent,
    app_name=APP_NAME,
    session_service=session_service,
    memory_service=memory_service,
)


def _get_current_user(token: str) -> dict:
    """Validate a user token and return payload."""
    payload = verify_token(token)
    if not payload or payload.get("type") != "user":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ── REST endpoints ──────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=LoginResponse)
async def register(req: LoginRequest):
    username = req.username.strip()
    password = req.password
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    created = await asyncio.to_thread(user_store.create_user, username, password)
    if created is None:
        raise HTTPException(status_code=400, detail="Username already exists")
    token = create_user_token(created.user_id)
    return LoginResponse(token=token, user_id=created.user_id)


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    username = req.username.strip()
    password = req.password
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = await asyncio.to_thread(user_store.get_user_by_username, username)
    if user is None or not user_store.verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_user_token(user.user_id)
    return LoginResponse(token=token, user_id=user.user_id)


@app.post("/api/devices/token", response_model=TokenResponse)
async def generate_device_token(req: PairDeviceRequest, token: str = Query(...)):
    payload = _get_current_user(token)
    device_name = req.device_name.strip()
    session_minutes = int(req.session_minutes)
    if len(device_name) < 2:
        raise HTTPException(status_code=400, detail="Device name must be at least 2 characters")
    if session_minutes < 15 or session_minutes > 1440:
        raise HTTPException(status_code=400, detail="session_minutes must be between 15 and 1440")

    device_id = str(uuid.uuid4())[:8]
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=session_minutes)

    await asyncio.to_thread(
        device_store.upsert_pairing,
        payload["sub"],
        device_id,
        device_name,
        session_minutes,
        expires_at.isoformat(),
    )

    device_token = create_device_token(
        payload["sub"],
        device_id,
        device_name,
        session_minutes,
    )
    return TokenResponse(
        device_token=device_token,
        device_id=device_id,
        device_name=device_name,
        session_minutes=session_minutes,
        expires_at=expires_at.isoformat(),
    )


@app.get("/api/devices", response_model=list[DeviceInfo])
async def list_devices(token: str = Query(...)):
    payload = _get_current_user(token)
    user_id = payload["sub"]

    pairings = await asyncio.to_thread(device_store.list_user_pairings, user_id)
    online = {
        d["device_id"]: d for d in connection_manager.get_user_devices(user_id)
    }

    merged: list[DeviceInfo] = []
    seen: set[str] = set()
    for pair in pairings:
        od = online.get(pair.device_id, {})
        merged.append(
            DeviceInfo(
                device_id=pair.device_id,
                user_id=user_id,
                device_name=pair.device_name,
                online=bool(od.get("online", False)),
                screen_width=int(od.get("screen_width", 0)),
                screen_height=int(od.get("screen_height", 0)),
                session_minutes=pair.session_minutes,
                session_expires_at=pair.expires_at,
                last_seen_at=str(od.get("last_seen_at", pair.updated_at)),
            )
        )
        seen.add(pair.device_id)

    for device_id, od in online.items():
        if device_id in seen:
            continue
        merged.append(
            DeviceInfo(
                device_id=device_id,
                user_id=user_id,
                device_name=str(od.get("device_name", "Unnamed Device")),
                online=bool(od.get("online", False)),
                screen_width=int(od.get("screen_width", 0)),
                screen_height=int(od.get("screen_height", 0)),
                session_minutes=int(od.get("session_minutes", 60)),
                session_expires_at=str(od.get("session_expires_at", "")),
                last_seen_at=str(od.get("last_seen_at", "")),
            )
        )

    return merged


@app.get("/api/systems/active", response_model=ActiveSystemsResponse)
async def active_systems(token: str = Query(...)):
    payload = _get_current_user(token)
    user_id = payload["sub"]
    systems = [
        DeviceInfo(**d) for d in connection_manager.get_user_active_systems(user_id)
    ]
    return ActiveSystemsResponse(systems=systems, online_count=len(systems))


@app.post("/api/devices/{device_id}/kill")
async def kill_device(device_id: str, token: str = Query(...)):
    payload = _get_current_user(token)
    user_id = payload["sub"]
    owner = connection_manager.get_user_for_device(device_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not your device")
    connection_manager.interrupt_flags[device_id] = True
    connection_manager.active_tasks.pop(device_id, None)
    ws = connection_manager.device_connections.get(device_id)
    if ws:
        try:
            await ws.send_json({"action": "kill"})
        except Exception:
            pass
    return {"status": "killed"}


@app.post("/api/segment", response_model=SegmentResponse)
async def segment_screenshot(payload: SegmentRequest, token: str = Query(...)):
    token_payload = verify_token(token)
    if not token_payload or token_payload.get("type") != "device":
        raise HTTPException(status_code=401, detail="Invalid or expired device token")

    if payload.quality < 30 or payload.quality > 95:
        raise HTTPException(status_code=400, detail="quality must be between 30 and 95")

    try:
        result = await asyncio.to_thread(
            segment_screenshot_payload,
            payload.image_b64,
            payload.logical_width,
            payload.logical_height,
            payload.scale_factor,
            payload.quality,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {e}") from e

    return SegmentResponse(**result)


# ── WebSocket: Device (Local Helper) ───────────────────────────────

@app.websocket("/ws/device")
async def ws_device(websocket: WebSocket, token: str = Query(...)):
    payload = verify_token(token)
    if not payload or payload.get("type") != "device":
        await websocket.close(code=4001, reason="Invalid token")
        return

    device_id = payload["device_id"]
    user_id = payload["sub"]
    device_name = payload.get("device_name", "Unnamed Device")
    session_minutes = int(payload.get("session_minutes", 60))
    session_expires_at = payload.get("session_expires_at", "")

    await websocket.accept()
    connection_manager.register_device(
        device_id,
        user_id,
        websocket,
        device_name=device_name,
        session_minutes=session_minutes,
        session_expires_at=session_expires_at,
    )

    # Notify dashboards that a device came online
    await connection_manager.broadcast_to_dashboards(user_id, {
        "type": "status",
        "data": {"device_id": device_id, "online": True},
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "response")

            if msg_type == "init":
                connection_manager.update_device_info(
                    device_id,
                    data.get("screen_width", 0),
                    data.get("screen_height", 0),
                    data.get("scale_factor", 1.0),
                )

            elif msg_type == "screenshot_push":
                screenshot = data.get("screenshot", "")
                if screenshot:
                    connection_manager.latest_screenshots[device_id] = screenshot
                    await connection_manager.broadcast_to_dashboards(user_id, {
                        "type": "screenshot",
                        "data": {"image": screenshot},
                    })

            elif msg_type == "response":
                request_id = data.get("request_id", "")
                if request_id:
                    connection_manager.resolve_device_response(request_id, data)

    except WebSocketDisconnect:
        logger.info("Device %s disconnected", device_id)
    except Exception as e:
        logger.error("Device %s error: %s", device_id, e)
    finally:
        connection_manager.unregister_device(device_id)
        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "status",
            "data": {"device_id": device_id, "online": False},
        })


# ── WebSocket: Dashboard (Web Client) ──────────────────────────────

@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket, token: str = Query(...)):
    payload = verify_token(token)
    if not payload or payload.get("type") != "user":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload["sub"]

    await websocket.accept()
    connection_manager.register_dashboard(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "navigate":
                goal = data.get("goal", "")
                device_id = data.get("device_id", "")

                if not goal or not device_id:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Missing goal or device_id"},
                    })
                    continue

                if not connection_manager.is_device_connected(device_id):
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Device is not connected"},
                    })
                    continue

                asyncio.create_task(_run_navigation(user_id, device_id, goal))

            elif msg_type == "stop":
                device_id = data.get("device_id", "")
                if device_id:
                    connection_manager.interrupt_flags[device_id] = True
                    connection_manager.active_tasks.pop(device_id, None)
                    await connection_manager.broadcast_to_dashboards(user_id, {
                        "type": "status",
                        "data": {
                            "message": "Task stopped by user",
                            "device_id": device_id,
                        },
                    })

    except WebSocketDisconnect:
        logger.info("Dashboard disconnected for user %s", user_id)
    except Exception as e:
        logger.error("Dashboard error for user %s: %s", user_id, e)
    finally:
        connection_manager.unregister_dashboard(user_id, websocket)


# ── WebSocket: Voice Control (Bidi-streaming with Gemini Live API) ──

@app.websocket("/ws/voice")
async def ws_voice(
    websocket: WebSocket,
    token: str = Query(...),
    device_id: str = Query(...),
):
    """Real-time voice control of a device using ADK bidi-streaming.

    Audio flows bidirectionally:
      Client mic → PCM audio → LiveRequestQueue → Gemini Live API
      Gemini Live API → audio/events → WebSocket → Client speaker

    The agent takes screenshots on demand (via tool calls), not continuously.
    """
    payload = verify_token(token)
    if not payload or payload.get("type") != "user":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload["sub"]

    if not connection_manager.is_device_connected(device_id):
        await websocket.close(code=4002, reason="Device not connected")
        return

    owner = connection_manager.get_user_for_device(device_id)
    if owner != user_id:
        await websocket.close(code=4003, reason="Not your device")
        return

    await websocket.accept()

    # ── Session setup ──────────────────────────────────────────────
    info = connection_manager.device_info.get(device_id, {})
    screen_width = info.get("screen_width", 1920)
    screen_height = info.get("screen_height", 1080)
    scale_factor = info.get("scale_factor", 1.0)

    session_id = f"voice_{device_id}_{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={
            "device_id": device_id,
            "user_id": user_id,
            "screen_width": screen_width,
            "screen_height": screen_height,
            "scale_factor": scale_factor,
            "os_name": "Windows",
            "elements": [],
        },
    )

    # ── RunConfig for bidi-streaming with audio I/O ────────────────
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )

    # Create the LiveRequestQueue and register it so the take_screenshot
    # tool can push images into the model's context.
    live_request_queue = LiveRequestQueue()
    register_live_queue(device_id, live_request_queue)
    register_live_websocket(device_id, websocket)

    # ── Upstream: Client → LiveRequestQueue ────────────────────────

    async def upstream_task() -> None:
        """Receive audio/text from WebSocket and forward to LiveRequestQueue."""
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                audio_blob = genai_types.Blob(
                    mime_type="audio/pcm;rate=16000",
                    data=message["bytes"],
                )
                live_request_queue.send_realtime(audio_blob)

            elif "text" in message:
                text_data = message["text"]
                json_msg = json.loads(text_data)
                msg_type = json_msg.get("type", "")

                if msg_type == "text":
                    content = genai_types.Content(
                        parts=[genai_types.Part(text=json_msg.get("text", ""))]
                    )
                    live_request_queue.send_content(content)
                elif msg_type == "image":
                    image_data = base64.b64decode(json_msg["data"])
                    mime_type = json_msg.get("mimeType", "image/jpeg")
                    image_blob = genai_types.Blob(
                        mime_type=mime_type, data=image_data
                    )
                    live_request_queue.send_realtime(image_blob)

    # ── Downstream: run_live() → Client ────────────────────────────

    async def downstream_task() -> None:
        """Receive events from run_live() and forward JSON to WebSocket."""
        async for event in live_runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        ):
            # Forward the full ADK event as JSON (including base64 audio)
            event_json = event.model_dump_json(
                exclude_none=True, by_alias=True
            )
            await websocket.send_text(event_json)

            # Broadcast transcriptions to dashboards for live monitoring
            out_text = getattr(event.output_transcription, "text", None) if event.output_transcription else None
            in_text = getattr(event.input_transcription, "text", None) if event.input_transcription else None

            if out_text:
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "log",
                    "data": {
                        "action": "agent_voice",
                        "message": out_text,
                        "author": "voice_navigator",
                    },
                })
            if in_text:
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "log",
                    "data": {
                        "action": "user_voice",
                        "message": in_text,
                        "author": "user",
                    },
                })

    # ── Run both tasks concurrently ────────────────────────────────
    try:
        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "status",
            "data": {
                "message": "Voice control started",
                "device_id": device_id,
            },
        })

        await asyncio.gather(upstream_task(), downstream_task())

    except WebSocketDisconnect:
        logger.info("Voice client disconnected: %s", device_id)
    except Exception as e:
        logger.error("Voice session error: %s", e, exc_info=True)
    finally:
        live_request_queue.close()
        unregister_live_queue(device_id)
        unregister_live_websocket(device_id)

        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "status",
            "data": {
                "message": "Voice control ended",
                "device_id": device_id,
            },
        })


# ── Navigation orchestration ───────────────────────────────────────


def _format_elements(elements: list[dict]) -> str:
    """Format detected elements into descriptive text for the LLM prompt."""
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
        source = el.get("source", "?")

        parts = [f"[{eid}] {cat}"]
        if text:
            parts.append(f'"{text}"')
        parts.append(
            f"bbox=[{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}] "
            f"center=({cx},{cy}) conf={conf:.0%} src={source}"
        )
        lines.append(" ".join(parts))
    return "\n".join(lines)


def _is_task_complete(text: str) -> bool:
    """Check if the agent explicitly signaled task completion.

    Only matches intentional completion signals, not incidental uses
    of the word 'done' in normal sentences.
    """
    upper = text.upper().strip()
    # Match "TASK_COMPLETE" anywhere — this is our explicit signal
    if "TASK_COMPLETE" in upper:
        return True
    return False


async def _run_navigation(user_id: str, device_id: str, goal: str) -> None:
    """Run the ADK agent to accomplish a user's navigation goal.

    Uses an explicit screenshot→action loop:
    1. Capture segmented screenshot from device (OmniParser detects UI elements)
    2. Send annotated screenshot + element list to the agent as a user message
    3. Agent responds with tool calls (click_element, type, etc.) which execute remotely
    4. Repeat until the agent says the task is done or max iterations reached
    """
    connection_manager.active_tasks[device_id] = True
    connection_manager.interrupt_flags[device_id] = False

    MAX_ITERATIONS = 30

    try:
        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "status",
            "data": {"message": f"Starting task: {goal}", "device_id": device_id},
        })

        info = connection_manager.device_info.get(device_id, {})
        screen_width = info.get("screen_width", 1920)
        screen_height = info.get("screen_height", 1080)
        scale_factor = info.get("scale_factor", 1.0)

        session_id = f"nav_{device_id}_{uuid.uuid4().hex[:8]}"
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={
                "device_id": device_id,
                "user_id": user_id,
                "screen_width": screen_width,
                "screen_height": screen_height,
                "scale_factor": scale_factor,
                "os_name": "Windows",
                "elements": [],
            },
        )

        task_done = False

        for iteration in range(MAX_ITERATIONS):
            if connection_manager.interrupt_flags.get(device_id):
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "done",
                    "data": {"message": "Task interrupted by user", "device_id": device_id},
                })
                break

            # ── Step 1: capture a segmented screenshot ────────────────
            if iteration > 0:
                await asyncio.sleep(0.5)  # Let screen settle after actions

            screenshot_b64 = ""
            elements = []

            for _attempt in range(2):
                screenshot_result = await connection_manager.send_to_device(
                    device_id,
                    {"action": "screenshot", "parameters": {"segment": True}},
                    timeout=60.0,
                )
                if screenshot_result.get("status") == "success":
                    data = screenshot_result.get("data", {})
                    screenshot_b64 = data.get("screenshot", "")
                    elements = data.get("elements", [])
                    screen_info = data.get("screen_info")
                    if screen_info:
                        screen_width = screen_info.get("screen_width", screen_width)
                        screen_height = screen_info.get("screen_height", screen_height)
                    if screenshot_b64:
                        break
                await asyncio.sleep(1.0)

            if not screenshot_b64:
                logger.warning("Failed to capture screenshot on iteration %d", iteration)
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "log",
                    "data": {"action": "warning", "message": f"Screenshot failed on iteration {iteration + 1}, retrying..."},
                })
                continue

            # Update session state with detected elements
            session = await session_service.get_session(
                app_name=APP_NAME, user_id=user_id, session_id=session_id,
            )
            if session:
                session.state["elements"] = elements
                session.state["screen_width"] = screen_width
                session.state["screen_height"] = screen_height

            connection_manager.latest_screenshots[device_id] = screenshot_b64
            await connection_manager.broadcast_to_dashboards(user_id, {
                "type": "screenshot",
                "data": {"image": screenshot_b64},
            })

            # Build compact element list for the prompt
            element_text = _format_elements(elements)
            num_elements = len(elements)

            parts: list[genai_types.Part] = []
            parts.append(
                genai_types.Part(
                    inline_data=genai_types.Blob(
                        mime_type="image/jpeg",
                        data=base64.b64decode(screenshot_b64),
                    )
                )
            )

            # ── Step 2: build the prompt for this iteration ─────────────
            if iteration == 0:
                prompt = (
                    f"GOAL: {goal}\n\n"
                    f"Screen: {screen_width}x{screen_height} pixels (Windows)\n\n"
                    f"Above is the current annotated screenshot with {num_elements} detected UI elements.\n"
                    f"Color-coded bounding boxes: green=icon, blue=button, purple=text_field, red=text, yellow=image, orange=checkbox.\n\n"
                    f"DETECTED ELEMENTS (bbox=[x1,y1,x2,y2] in screen pixels):\n{element_text}\n\n"
                    f"INSTRUCTIONS:\n"
                    f"1. Analyze the screenshot visually to understand the current UI state.\n"
                    f"2. Cross-reference with the element list above — use text labels and bbox positions to identify elements.\n"
                    f"3. If the annotated image is cluttered, rely more on the text list and your visual understanding of the raw UI underneath.\n"
                    f"4. Plan your approach: what is the first step toward the goal?\n"
                    f"5. Execute 3-5 actions, then stop and wait for the next screenshot to verify."
                )
            else:
                prompt = (
                    f"GOAL (reminder): {goal}\n\n"
                    f"Updated screenshot (step {iteration + 1}/{MAX_ITERATIONS}). {num_elements} elements detected.\n\n"
                    f"DETECTED ELEMENTS:\n{element_text}\n\n"
                    f"Analyze: What changed since your last actions? Did they work? "
                    f"Cross-reference the annotated image with the element list to verify.\n"
                    f"Continue toward the goal. If ALL steps are truly complete and verified on screen, say TASK_COMPLETE."
                )
            parts.insert(0, genai_types.Part(text=prompt))

            user_message = genai_types.Content(role="user", parts=parts)

            # ── Step 3: run the agent for one turn ──────────────────────
            agent_error = False
            try:
                async for event in runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=user_message,
                ):
                    if connection_manager.interrupt_flags.get(device_id):
                        break

                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            # Thinking / reasoning parts (from BuiltInPlanner)
                            if getattr(part, "thought", False) and part.text and part.text.strip():
                                await connection_manager.broadcast_to_dashboards(user_id, {
                                    "type": "log",
                                    "data": {
                                        "action": "thinking",
                                        "message": part.text.strip(),
                                        "author": event.author,
                                    },
                                })
                            # Regular text response
                            elif part.text and part.text.strip():
                                await connection_manager.broadcast_to_dashboards(user_id, {
                                    "type": "log",
                                    "data": {
                                        "action": "agent_response",
                                        "message": part.text.strip(),
                                        "author": event.author,
                                    },
                                })

                                # Check if the agent explicitly signaled completion
                                if _is_task_complete(part.text):
                                    task_done = True

                    if event.is_final_response():
                        break

            except Exception as agent_exc:
                logger.error("Agent error on iteration %d: %s", iteration, agent_exc)
                agent_error = True
                await connection_manager.broadcast_to_dashboards(user_id, {
                    "type": "log",
                    "data": {"action": "warning", "message": f"Agent error: {agent_exc}. Retrying..."},
                })

            if task_done or connection_manager.interrupt_flags.get(device_id):
                break

            # On agent error, wait before retrying
            if agent_error:
                await asyncio.sleep(2.0)

        # ── Final status ────────────────────────────────────────────────
        if task_done:
            await connection_manager.broadcast_to_dashboards(user_id, {
                "type": "done",
                "data": {"message": "Task completed successfully", "device_id": device_id},
            })
        elif not connection_manager.interrupt_flags.get(device_id):
            await connection_manager.broadcast_to_dashboards(user_id, {
                "type": "done",
                "data": {"message": f"Reached max iterations ({MAX_ITERATIONS})", "device_id": device_id},
            })

    except Exception as e:
        logger.error("Navigation error: %s", e, exc_info=True)
        await connection_manager.broadcast_to_dashboards(user_id, {
            "type": "error",
            "data": {
                "message": f"Navigation error: {str(e)}",
                "device_id": device_id,
            },
        })
    finally:
        # Save session to memory for future context
        try:
            session = await session_service.get_session(
                app_name=APP_NAME, user_id=user_id, session_id=session_id,
            )
            if session:
                await memory_service.add_session_to_memory(session)
        except Exception as mem_err:
            logger.warning("Failed to save session to memory: %s", mem_err)

        connection_manager.active_tasks.pop(device_id, None)
        connection_manager.interrupt_flags.pop(device_id, None)


# ── Entry point ─────────────────────────────────────────────────────

def main():
    import uvicorn

    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
