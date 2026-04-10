"""
CV Extraction Agent
───────────────────
Uses GPT-4o function calling to extract structured CV data
from free-text conversation or uploaded document text.
"""
import json
import logging
from typing import Any, Dict, List

from openai import AsyncOpenAI

from core.schema import CVData, WorkExperience, Education, Certification, DateRange

logger = logging.getLogger(__name__)

# JSON Schema for function calling
EXTRACT_CV_FUNCTION = {
    "name": "extract_cv_data",
    "description": "Extract structured CV information from the provided text",
    "parameters": {
        "type": "object",
        "properties": {
            "full_name": {"type": "string", "description": "Candidate's full name"},
            "email": {"type": "string", "description": "Email address"},
            "phone": {"type": "string", "description": "Phone number"},
            "location": {"type": "string", "description": "City, Country"},
            "linkedin_url": {"type": "string"},
            "github_url": {"type": "string"},
            "headline": {"type": "string", "description": "Professional title/headline"},
            "professional_summary": {"type": "string", "description": "2-4 sentence summary"},
            "target_role": {"type": "string"},
            "target_industry": {"type": "string"},
            "work_experience": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "job_title": {"type": "string"},
                        "company": {"type": "string"},
                        "location": {"type": "string"},
                        "date_range": {
                            "type": "object",
                            "properties": {
                                "start": {"type": "string"},
                                "end": {"type": "string"},
                                "is_current": {"type": "boolean"},
                            }
                        },
                        "bullets": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Achievement-focused bullet points starting with action verbs"
                        },
                        "technologies": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    }
                }
            },
            "education": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "degree": {"type": "string"},
                        "institution": {"type": "string"},
                        "location": {"type": "string"},
                        "date_range": {
                            "type": "object",
                            "properties": {
                                "start": {"type": "string"},
                                "end": {"type": "string"},
                            }
                        },
                        "grade": {"type": "string"},
                        "highlights": {"type": "array", "items": {"type": "string"}},
                    }
                }
            },
            "skills": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Technical and soft skills"
            },
            "certifications": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "issuer": {"type": "string"},
                        "date": {"type": "string"},
                        "credential_id": {"type": "string"},
                    }
                }
            },
            "languages": {"type": "array", "items": {"type": "string"}},
            "achievements": {"type": "array", "items": {"type": "string"}},
        },
        "required": []
    }
}

EXTRACTION_PROMPT = """Extract all CV/resume information from the following text.
Be thorough — capture every detail including dates, companies, technologies, and achievements.
For bullet points, rephrase them to start with strong action verbs (Led, Built, Delivered, Increased, etc.)
if they don't already.

Text to extract from:
{text}
"""


async def extract_cv_from_text(
    text: str,
    client: AsyncOpenAI,
    model: str = "gpt-4o",
) -> CVData:
    """
    Run structured extraction via function calling.
    Returns a populated CVData object.
    """
    logger.info("Starting CV extraction, text length=%d chars", len(text))
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(text=text[:15000])  # token safety
                }
            ],
            tools=[{"type": "function", "function": EXTRACT_CV_FUNCTION}],
            tool_choice={"type": "function", "function": {"name": "extract_cv_data"}},
            temperature=0,
            timeout=90,  # 90-second hard limit
        )

        tool_call = response.choices[0].message.tool_calls[0]
        extracted = json.loads(tool_call.function.arguments)
        logger.info("Extraction complete. Fields found: %s", list(extracted.keys()))
        return _dict_to_cv_data(extracted)

    except Exception as e:
        logger.error("Extraction agent error: %s", e)
        raise


_PRESENT_ALIASES = {
    "till date", "tilldate", "till now", "tillnow", "to date",
    "todate", "to present", "present", "current", "ongoing",
    "now", "today", "till today",
}


def _normalise_end(value: str) -> str:
    return "present" if value.lower().strip() in _PRESENT_ALIASES else value


def _parse_date_range(dr) -> "DateRange | None":
    """Safely parse a date_range value that may be a dict or a plain string."""
    if not dr:
        return None
    if isinstance(dr, dict):
        end = dr.get("end")
        if end:
            dr = {**dr, "end": _normalise_end(str(end))}
        return DateRange(**dr)
    if isinstance(dr, str):
        for sep in (' - ', ' – ', ' to ', ' till ', ' until ', '-'):
            if sep.lower() in dr.lower():
                parts = dr.lower().split(sep.lower(), 1)
                return DateRange(start=parts[0].strip(), end=_normalise_end(parts[1].strip()))
        return DateRange(start=dr.strip())
    return None


def _dict_to_cv_data(data: dict) -> CVData:
    """Convert raw extracted dict to validated CVData."""
    # Handle nested objects
    work_exp = []
    for w in data.get("work_experience", []):
        work_exp.append(WorkExperience(
            job_title=w.get("job_title"),
            company=w.get("company"),
            location=w.get("location"),
            date_range=_parse_date_range(w.get("date_range")),
            bullets=w.get("bullets", []),
            technologies=w.get("technologies", []),
        ))

    education = []
    for e in data.get("education", []):
        education.append(Education(
            degree=e.get("degree"),
            institution=e.get("institution"),
            location=e.get("location"),
            date_range=_parse_date_range(e.get("date_range")),
            grade=e.get("grade"),
            highlights=e.get("highlights", []),
        ))

    certs = []
    for c in data.get("certifications", []):
        certs.append(Certification(
            name=c["name"],
            issuer=c.get("issuer"),
            date=c.get("date"),
            credential_id=c.get("credential_id"),
        ))

    return CVData(
        full_name=data.get("full_name"),
        email=data.get("email"),
        phone=data.get("phone"),
        location=data.get("location"),
        linkedin_url=data.get("linkedin_url"),
        github_url=data.get("github_url"),
        website_url=data.get("website_url"),
        headline=data.get("headline"),
        professional_summary=data.get("professional_summary"),
        target_role=data.get("target_role"),
        target_industry=data.get("target_industry"),
        work_experience=work_exp,
        education=education,
        skills=data.get("skills", []),
        certifications=certs,
        languages=data.get("languages", []),
        achievements=data.get("achievements", []),
    )
