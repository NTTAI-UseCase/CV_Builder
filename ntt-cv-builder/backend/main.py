"""
main.py — NTT Data Smart CV Builder
FastAPI application entry point.

Start with:
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import logging
import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import truststore

from config import get_settings
from routers import chat, upload, export
from routers import shortlist

settings = get_settings()

truststore.inject_into_ssl()

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.getLevelName(settings.log_level),
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
)
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.log_level)
    )
)
log = structlog.get_logger()


# ── Lifespan: seed RAG on startup ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting NTT Data Smart CV Builder...")
    try:
        from rag.ingestion import seed_knowledge_base
        seed_knowledge_base()
        log.info("RAG knowledge base ready")
    except Exception as e:
        log.warning("RAG seed failed (non-fatal)", error=str(e))
    yield
    log.info("Shutting down...")


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="NTT Data Smart CV Builder",
    description="AI-powered CV builder using OpenAI Agents SDK + RAG",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(shortlist.router, prefix="/api", tags=["shortlist"])

# ── Health check ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Serve React frontend (production) ─────────────────────────
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = os.path.join(frontend_dist, "index.html")
        return FileResponse(index)
