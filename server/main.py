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

from server.auth.jwt_handler import create_device_token, create_user_token, verify_token
from server.auth.user_store import user_store
from server.config import CORS_ORIGINS
from server.connections.manager import connection_manager
from server.devices.device_store import device_store
from server.models.schemas import (
    ActiveSystemsResponse,
    DeviceInfo,
    LoginRequest,
    LoginResponse,
    PairDeviceRequest,
    SegmentRequest,
    SegmentResponse,
    TokenResponse,
)
from server.navigator_agent.agent import root_agent
from server.navigator_agent.agent_loop import run_agent_loop
from server.navigator_agent.live_agent import live_agent
from server.navigator_agent.live_tools import (
    register_live_queue,
    unregister_live_queue,
    register_live_websocket,
    unregister_live_websocket,
)
from server.segmentation.service import segment_screenshot_payload

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

                asyncio.create_task(
                    run_agent_loop(
                        user_id=user_id,
                        device_id=device_id,
                        goal=goal,
                        runner=runner,
                        session_service=session_service,
                        memory_service=memory_service,
                        app_name=APP_NAME,
                    )
                )

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


# ── Entry point ─────────────────────────────────────────────────────

def main():
    import uvicorn

    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
