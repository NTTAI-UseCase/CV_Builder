"""
routers/upload.py
Handles CV file uploads (PDF / DOCX).
Parses the file and merges the extracted data into the active session.
"""
from __future__ import annotations
import structlog
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse

from cv_agents.document_parser import parse_uploaded_file
from config import get_settings

router = APIRouter()
log = structlog.get_logger()
settings = get_settings()


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """
    Upload an existing CV file for parsing.
    Returns extracted CV data as JSON; the frontend forwards this
    to the WebSocket session via the orchestrator.
    """
    # Validate file type
    allowed_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    }
    if file.content_type not in allowed_types and not file.filename.lower().endswith((".pdf", ".docx", ".doc")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF or DOCX file.",
        )

    # Check file size
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB.",
        )

    log.info("Processing upload", filename=file.filename, size_mb=round(size_mb, 2), session_id=session_id)

    try:
        text = parse_uploaded_file(file_bytes, file.filename)

        # Schedule CV processing as a background task so the WebSocket
        # handler can drain the push queue and forward events to the client.
        import asyncio
        from routers.chat import sessions
        if session_id in sessions:
            orchestrator = sessions[session_id]
            asyncio.create_task(orchestrator.process_uploaded_cv(text))
        else:
            log.warning("Upload arrived for unknown session", session_id=session_id)

        return JSONResponse({
            "status": "ok",
            "message": f"Successfully parsed {file.filename}",
        })

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        log.error("Upload processing failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to process the uploaded file.")
