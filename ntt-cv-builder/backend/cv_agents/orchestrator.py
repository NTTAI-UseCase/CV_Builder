"""
cv_agents/orchestrator.py
Central orchestrator that:
 1. Runs the Triage Agent (direct OpenAI calls)
 2. Manages session state (CVSession)
 3. Triggers generation pipeline when ready
 4. Yields streaming events back to the WebSocket
"""
from __future__ import annotations
import uuid
from typing import AsyncIterator, Optional

from openai import AsyncOpenAI

from core.schema import CVData, CVSession, ConversationStage
from cv_agents.triage_agent import run_triage_agent
from cv_agents.validation_agent import validate_and_prompt
from cv_agents.extraction_agent import extract_cv_from_text
from config import get_settings

settings = get_settings()


class CVOrchestrator:
    """Manages a single user session. One instance per WebSocket connection."""

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.session = CVSession(session_id=self.session_id)
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def process_message(self, user_message: str) -> AsyncIterator[dict]:
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

            yield {"type": "cv_update", "data": self.session.cv_data.model_dump()}

            reply = result["reply"]
            self.session.add_message("assistant", reply)
            yield {"type": "message", "data": reply}

            if self.session.stage == ConversationStage.GENERATING:
                async for event in self._run_generation_pipeline():
                    yield event

        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Orchestrator error: %s", e)
            msg = "Sorry, something went wrong on my end. Could you try rephrasing your last message?"
            self.session.add_message("assistant", msg)
            yield {"type": "message", "data": msg}

    async def process_uploaded_cv(self, text: str) -> AsyncIterator[dict]:
        """Process raw text extracted from an uploaded CV file."""
        try:
            extracted_cv = await extract_cv_from_text(text, self.client, settings.openai_model)

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

            yield {"type": "cv_update", "data": self.session.cv_data.model_dump()}

            _, follow_up = await validate_and_prompt(
                self.session.cv_data, self.client, settings.openai_model
            )
            msg = (
                "I've successfully parsed your CV! "
                + (follow_up or "Everything looks great — would you like to choose a template?")
            )
            self.session.add_message("assistant", msg)
            yield {"type": "message", "data": msg}

        except Exception as e:
            yield {"type": "error", "data": f"Failed to process uploaded CV: {str(e)}"}

    async def _run_generation_pipeline(self) -> AsyncIterator[dict]:
        yield {"type": "progress", "data": "Rendering your CV..."}
        try:
            from renderers.pdf_renderer import render_html_preview, render_pdf
            from renderers.docx_renderer import render_docx
            import base64

            html_preview = render_html_preview(self.session.cv_data)
            yield {"type": "preview", "data": html_preview}

            pdf_bytes = render_pdf(self.session.cv_data)
            docx_bytes = render_docx(self.session.cv_data)
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

        except Exception as e:
            yield {"type": "error", "data": f"Generation failed: {str(e)}"}
