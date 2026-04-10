"""
routers/chat.py
WebSocket endpoint for real-time CV building conversation.
Each WebSocket connection = one CV session.

Protocol (JSON events over WebSocket):
  Client → Server: {"type": "message", "data": "user text"}
  Server → Client: {"type": "token"|"message"|"cv_update"|"preview"|"downloads_ready"|"progress"|"error"|"validation", "data": ...}
"""
from __future__ import annotations
import asyncio
import json
import uuid
import structlog

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from cv_agents.orchestrator import CVOrchestrator

router = APIRouter()
log = structlog.get_logger()

# In-memory session store (use Redis for multi-process deployments)
sessions: dict[str, CVOrchestrator] = {}


@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await websocket.accept()
    log.info("WebSocket connected", session_id=session_id)

    # Get or create orchestrator for this session
    is_new_session = session_id not in sessions
    if is_new_session:
        sessions[session_id] = CVOrchestrator(session_id=session_id)

    orchestrator = sessions[session_id]

    if is_new_session:
        welcome = (
            "👋 Welcome to **NTT Data Smart CV Builder**!\n\n"
            "I'll help you create a professional, polished CV through a quick conversation.\n\n"
            "To get started — do you have an existing CV you'd like to upload and improve, "
            "or would you prefer to build one from scratch?"
        )
        # Record in session history so the triage agent knows it was already sent
        orchestrator.session.add_message("assistant", welcome)
        await websocket.send_json({"type": "message", "data": welcome})
        await websocket.send_json({"type": "stage", "data": "greeting"})
    else:
        # Reconnect: restore frontend state without re-greeting
        await websocket.send_json({"type": "stage", "data": orchestrator.session.stage.value})
        if orchestrator.session.cv_data:
            await websocket.send_json({"type": "cv_update", "data": orchestrator.session.cv_data.model_dump()})

    async def _receive_loop():
        """Handle messages sent by the client over the WebSocket."""
        try:
            while True:
                raw = await websocket.receive_text()
                event = json.loads(raw)

                if event.get("type") == "message":
                    user_text = event.get("data", "").strip()
                    if not user_text:
                        continue
                    log.info("User message", session_id=session_id, msg=user_text[:80])
                    async for server_event in orchestrator.process_message(user_text):
                        await websocket.send_json(server_event)

                elif event.get("type") in ("ping", "pong"):
                    # Respond to client pings; silently absorb pongs
                    if event.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            raise
        except Exception as e:
            log.error("Receive loop error", session_id=session_id, error=str(e))
            raise

    async def _push_loop():
        """Drain events enqueued by HTTP routes (e.g. file upload) and forward to client."""
        try:
            while True:
                server_event = await orchestrator._push_queue.get()
                await websocket.send_json(server_event)
        except WebSocketDisconnect:
            raise
        except Exception as e:
            log.error("Push loop error", session_id=session_id, error=str(e))
            raise

    async def _keepalive_loop():
        """Send a server-side ping every 20 s to prevent proxy idle-timeout disconnections.
        The Vite dev-server WS proxy (and many load balancers) close connections after
        ~30 s of silence; uploading a CV triggers a long OpenAI call with no traffic."""
        try:
            while True:
                await asyncio.sleep(20)
                await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            raise
        except Exception:
            raise  # Any send failure means the socket is gone

    try:
        receive_task   = asyncio.create_task(_receive_loop())
        push_task      = asyncio.create_task(_push_loop())
        keepalive_task = asyncio.create_task(_keepalive_loop())

        done, pending = await asyncio.wait(
            {receive_task, push_task, keepalive_task},
            return_when=asyncio.FIRST_EXCEPTION,
        )

        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, WebSocketDisconnect, Exception):
                pass

        # Re-raise only unexpected errors (not normal disconnect)
        for task in done:
            try:
                exc = task.exception()
            except asyncio.CancelledError:
                continue
            if exc and not isinstance(exc, WebSocketDisconnect):
                raise exc

    except WebSocketDisconnect:
        log.info("WebSocket disconnected", session_id=session_id)
    except Exception as e:
        log.error("WebSocket error", session_id=session_id, error=str(e))
        try:
            await websocket.send_json({"type": "error", "data": str(e)})
        except Exception:
            pass


@router.get("/session/new")
async def new_session():
    """Create a new session ID. Call before opening WebSocket."""
    return {"session_id": str(uuid.uuid4())}
