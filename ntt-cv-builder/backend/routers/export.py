"""
routers/export.py
On-demand export endpoints: PDF, DOCX, JSON.
Accepts a CVData JSON body and returns the rendered file.
"""
from __future__ import annotations
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from core.schema import CVData, TemplateConfig
from renderers.pdf_renderer import render_pdf, render_html_preview
from renderers.docx_renderer import render_docx

router = APIRouter()
log = structlog.get_logger()


class PreviewRequest(BaseModel):
    cv: CVData
    config: TemplateConfig = TemplateConfig()


@router.post("/export/preview")
async def export_preview(req: PreviewRequest):
    """Return an HTML string preview of the CV with template config."""
    try:
        html = render_html_preview(req.cv, req.config)
        return {"html": html}
    except Exception as e:
        log.error("Preview failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/pdf")
async def export_pdf(req: PreviewRequest):
    """Generate and return a branded PDF of the CV."""
    try:
        pdf_bytes = render_pdf(req.cv, req.config)
        filename = f"{(req.cv.full_name or 'cv').replace(' ', '_').lower()}_cv.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        log.error("PDF export failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@router.post("/export/docx")
async def export_docx(cv: CVData):
    """Generate and return an editable Word DOCX of the CV."""
    try:
        docx_bytes = render_docx(cv)
        filename = f"{(cv.full_name or 'cv').replace(' ', '_').lower()}_cv.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        log.error("DOCX export failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {str(e)}")


@router.post("/export/json")
async def export_json(cv: CVData):
    """Return the canonical CV data as JSON."""
    return cv.model_dump()
