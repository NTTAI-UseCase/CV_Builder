"""
routers/shortlist.py
CV skill-shortlisting endpoint.

POST /api/shortlist
  Body: { cv: CVData, skills: [str] }
  Returns: { results: [SkillMatch], recommendation: str }

Uses GPT-4o to inspect the CV text against each requested skill and returns
a structured table (matched, evidence snippets, years estimate, notes) plus
an overall fitment recommendation.
"""
from __future__ import annotations
import json
import textwrap
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI

from core.schema import CVData
from config import get_settings

router = APIRouter()
log = structlog.get_logger()
settings = get_settings()
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client

SYSTEM_PROMPT = textwrap.dedent("""
    You are an expert technical recruiter that inspects a candidate's resume and
    determines whether requested skills are present and how strongly.

    For EACH skill in the provided list, return a JSON object with these exact fields:
      - skill:                    the canonical skill name as provided
      - matched:                  true | false
      - evidence:                 list of 1-3 short verbatim quote snippets from the resume
                                  (empty list if not matched)
      - years_experience_estimate: integer or null (estimate from dates/context if possible)
      - notes:                    one concise sentence — context, proficiency signal, or gap

    Return your response as valid JSON with this structure:
    {
      "results": [ { ...one object per skill... } ],
      "recommendation": "2-4 sentence overall fitment summary and hiring recommendation"
    }

    Rules:
    - Use ONLY the provided resume text. Do not infer skills that are not mentioned.
    - evidence snippets must be direct quotes or very close paraphrases from the resume.
    - years_experience_estimate should be null if dates are ambiguous or skill is unmatched.
    - Be conservative: partial or indirect mentions should set matched=false with a note.
    - The recommendation must reference the strongest matched skills and clearly flag gaps.
""").strip()


def _cv_to_text(cv: CVData) -> str:
    """Convert a CVData object to a plain-text representation for the LLM."""
    lines: list[str] = []

    if cv.full_name:
        lines.append(f"Name: {cv.full_name}")
    if cv.headline:
        lines.append(f"Headline: {cv.headline}")
    if cv.email:
        lines.append(f"Email: {cv.email}")
    if cv.location:
        lines.append(f"Location: {cv.location}")

    if cv.professional_summary:
        lines += ["", "PROFESSIONAL SUMMARY", cv.professional_summary]

    if cv.work_experience:
        lines += ["", "WORK EXPERIENCE"]
        for w in cv.work_experience:
            dr = w.date_range
            dates = ""
            if dr:
                start = dr.start or ""
                end = "Present" if dr.is_current else (dr.end or "")
                dates = f" ({start} – {end})" if start or end else ""
            lines.append(f"  {w.job_title or 'Role'} at {w.company or 'Company'}{dates}")
            if w.location:
                lines.append(f"  Location: {w.location}")
            for b in (w.bullets or []):
                lines.append(f"    • {b}")
            if w.technologies:
                lines.append(f"    Technologies: {', '.join(w.technologies)}")

    if cv.education:
        lines += ["", "EDUCATION"]
        for e in cv.education:
            dr = e.date_range
            year = dr.end if dr else None
            lines.append(f"  {e.degree or 'Degree'} — {e.institution or 'Institution'}" +
                         (f" ({year})" if year else ""))
            if e.grade:
                lines.append(f"  Grade: {e.grade}")

    if cv.skills:
        lines += ["", "SKILLS"]
        lines.append("  " + ", ".join(cv.skills))

    if cv.certifications:
        lines += ["", "CERTIFICATIONS"]
        for c in cv.certifications:
            issuer = f" ({c.issuer})" if c.issuer else ""
            date = f" — {c.date}" if c.date else ""
            lines.append(f"  {c.name}{issuer}{date}")

    if cv.languages:
        lines += ["", "LANGUAGES"]
        lines.append("  " + ", ".join(cv.languages))

    if cv.achievements:
        lines += ["", "ACHIEVEMENTS"]
        for a in cv.achievements:
            lines.append(f"  • {a}")

    if cv.awards:
        lines += ["", "AWARDS"]
        for a in cv.awards:
            lines.append(f"  • {a}")

    return "\n".join(lines)


class SkillMatch(BaseModel):
    skill: str
    matched: bool
    evidence: List[str]
    years_experience_estimate: Optional[int] = None
    notes: str


class ShortlistResult(BaseModel):
    results: List[SkillMatch]
    recommendation: str


class ShortlistRequest(BaseModel):
    cv: CVData
    skills: List[str]


@router.post("/shortlist", response_model=ShortlistResult)
async def shortlist_cv(req: ShortlistRequest):
    if not req.skills:
        raise HTTPException(status_code=422, detail="At least one skill is required.")
    if len(req.skills) > 40:
        raise HTTPException(status_code=422, detail="Maximum 40 skills per request.")

    cv_text = _cv_to_text(req.cv)
    skills_list = "\n".join(f"- {s.strip()}" for s in req.skills if s.strip())

    user_message = (
        f"RESUME TEXT:\n{cv_text}\n\n"
        f"SKILLS TO EVALUATE:\n{skills_list}"
    )

    try:
        response = await _get_client().chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            temperature=0.1,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        return ShortlistResult.model_validate(data)

    except json.JSONDecodeError as e:
        log.error("Shortlist JSON parse failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to parse skill analysis response.")
    except Exception as e:
        log.error("Shortlist call failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Skill analysis failed: {e}")
