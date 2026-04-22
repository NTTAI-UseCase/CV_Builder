"""
cv_agents/orchestrator.py
Central orchestrator that:
 1. Runs the Triage Agent (direct OpenAI calls)
 2. Manages session state (CVSession)
 3. Triggers generation pipeline when ready
 4. Yields streaming events back to the WebSocket
"""
from __future__ import annotations
import asyncio
import logging
import uuid
from typing import AsyncIterator, Optional

from openai import AsyncOpenAI

from core.schema import CVData, CVSession, ConversationStage
from cv_agents.triage_agent import run_triage_agent
from cv_agents.validation_agent import validate_and_prompt
from cv_agents.extraction_agent import extract_cv_from_text
from config import get_settings

settings = get_settings()
_log = logging.getLogger(__name__)


class CVOrchestrator:
    """Manages a single user session. One instance per WebSocket connection."""

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.session = CVSession(session_id=self.session_id)
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        # Queue for pushing events from HTTP routes → WebSocket handler
        self._push_queue: asyncio.Queue = asyncio.Queue()

    async def process_message(self, user_message: str) -> AsyncIterator[dict]:
        sid = self.session_id[:8]
        _log.info("[%s] Calling triage agent (stage=%s)", sid, self.session.stage.value)
        self.session.add_message("user", user_message)
        try:
            result = await run_triage_agent(
                user_message=user_message,
                session=self.session,
                client=self.client,
                model=settings.openai_model,
            )
            self.session.cv_data = result["updated_cv_data"]
            self.session.stage = result["next_stage"]
            _log.info("[%s] Triage done → stage=%s completion=%d%%",
                      sid, self.session.stage.value, self.session.cv_data.completion_pct())

            yield {"type": "cv_update", "data": self.session.cv_data.model_dump()}
            yield {"type": "stage", "data": self.session.stage.value}

            reply = result["reply"]
            self.session.add_message("assistant", reply)
            yield {"type": "message", "data": reply}

            if self.session.stage == ConversationStage.PREVIEWING:
                _log.info("[%s] Rendering HTML preview", sid)
                async for event in self._render_preview():
                    yield event
            elif self.session.stage == ConversationStage.GENERATING:
                _log.info("[%s] Running full generation pipeline", sid)
                async for event in self._run_generation_pipeline():
                    yield event

        except Exception as e:
            _log.error("[%s] Orchestrator error: %s", sid, e, exc_info=True)
            msg = "Sorry, something went wrong on my end. Could you try rephrasing your last message?"
            self.session.add_message("assistant", msg)
            yield {"type": "message", "data": msg}

    async def process_uploaded_cv(self, text: str) -> None:
        """Process raw text extracted from an uploaded CV file.

        Events are enqueued into ``self._push_queue`` so the WebSocket
        handler can forward them to the client without blocking.
        """
        sid = self.session_id[:8]
        _log.info("[%s] process_uploaded_cv started, chars=%d", sid, len(text))
        try:
            await self._push_queue.put({"type": "progress", "data": "Reading your CV with AI… this may take up to 30 seconds."})

            _log.info("[%s] Calling OpenAI extraction agent…", sid)
            extracted_cv = await extract_cv_from_text(text, self.client, settings.openai_model)
            _log.info("[%s] Extraction done — name=%s", sid, extracted_cv.full_name)

            # Validate that this document looks like a CV
            has_name = bool(extracted_cv.full_name and extracted_cv.full_name.strip())
            has_experience = bool(extracted_cv.work_experience)
            has_education = bool(extracted_cv.education)
            if not has_name or not (has_experience or has_education):
                _log.warning(
                    "[%s] Document does not appear to be a CV (name=%s, exp=%d, edu=%d)",
                    sid, extracted_cv.full_name, len(extracted_cv.work_experience), len(extracted_cv.education),
                )
                msg = (
                    "⚠️ This document doesn't appear to be a CV or resume. "
                    "It's missing essential information such as a person's name, "
                    "work experience, or education history.\n\n"
                    "Please upload a proper CV or resume document and try again."
                )
                self.session.add_message("assistant", msg)
                await self._push_queue.put({"type": "message", "data": msg})
                return

            # Merge: only fill empty fields, extend lists
            current = self.session.cv_data.model_dump()
            new = extracted_cv.model_dump()
            for key, value in new.items():
                if isinstance(value, list) and value:
                    existing = current.get(key) or []
                    seen = {str(i) for i in existing}
                    current[key] = existing + [v for v in value if str(v) not in seen]
                elif value and not current.get(key):
                    current[key] = value
            self.session.cv_data = CVData.model_validate(current)
            self.session.upload_processed = True
            self.session.stage = ConversationStage.VALIDATING
            _log.info("[%s] CV merged, completion=%d%%", sid, self.session.cv_data.completion_pct())

            await self._push_queue.put({"type": "cv_update", "data": self.session.cv_data.model_dump()})
            await self._push_queue.put({"type": "stage", "data": ConversationStage.VALIDATING.value})

            _log.info("[%s] Calling validation agent…", sid)
            _, follow_up = await validate_and_prompt(
                self.session.cv_data, self.client, settings.openai_model
            )
            _log.info("[%s] Validation done", sid)
            msg = (
                "I've successfully parsed your CV! "
                + (follow_up or "Everything looks great — would you like to choose a template?")
            )
            self.session.add_message("assistant", msg)
            await self._push_queue.put({"type": "message", "data": msg})

        except Exception as e:
            _log.error("[%s] process_uploaded_cv error: %s", sid, e, exc_info=True)
            await self._push_queue.put({"type": "error", "data": f"Failed to process uploaded CV: {str(e)}"})

    async def _render_preview(self) -> AsyncIterator[dict]:
        """Render HTML preview only (fast path, no PDF/DOCX)."""
        sid = self.session_id[:8]
        try:
            from renderers.pdf_renderer import render_html_preview
            _log.info("[%s] Rendering HTML preview (template=%s)", sid,
                      getattr(self.session.cv_data, "selected_template", "minimal"))
            html_preview = render_html_preview(self.session.cv_data)
            _log.info("[%s] HTML preview rendered, %d bytes", sid, len(html_preview))
            yield {"type": "preview", "data": html_preview}
        except Exception as e:
            _log.error("[%s] Preview render error: %s", sid, e, exc_info=True)
            yield {"type": "error", "data": f"Preview render failed: {str(e)}"}

    async def _run_generation_pipeline(self) -> AsyncIterator[dict]:
        sid = self.session_id[:8]
        yield {"type": "progress", "data": "Rendering your CV…"}
        try:
            from renderers.pdf_renderer import render_html_preview, render_pdf
            from renderers.docx_renderer import render_docx
            import base64

            _log.info("[%s] Rendering HTML…", sid)
            html_preview = render_html_preview(self.session.cv_data)
            yield {"type": "preview", "data": html_preview}

            _log.info("[%s] Rendering PDF…", sid)
            pdf_bytes = render_pdf(self.session.cv_data)
            _log.info("[%s] PDF done (%d bytes), rendering DOCX…", sid, len(pdf_bytes))
            docx_bytes = render_docx(self.session.cv_data)
            _log.info("[%s] DOCX done (%d bytes)", sid, len(docx_bytes))

            filename = (self.session.cv_data.full_name or "cv").replace(" ", "_").lower()
            yield {
                "type": "downloads_ready",
                "data": {
                    "pdf_b64": base64.b64encode(pdf_bytes).decode(),
                    "docx_b64": base64.b64encode(docx_bytes).decode(),
                    "json": self.session.cv_data.model_dump(),
                    "filename_stem": filename,
                },
            }
            yield {
                "type": "message",
                "data": "Your CV is ready! Download your PDF, Word document, or JSON below.\n\nIf you'd like any changes, just let me know!",
            }
            self.session.stage = ConversationStage.DONE
            _log.info("[%s] Generation pipeline complete", sid)

        except Exception as e:
            _log.error("[%s] Generation pipeline error: %s", sid, e, exc_info=True)
            yield {"type": "error", "data": f"Generation failed: {str(e)}"}
