"""
Triage / Conversation Agent
───────────────────────────
Entry point agent. Drives the conversation, detects user intent,
routes to specialist agents, and asks follow-up questions for missing fields.
"""
import json
import logging
from typing import Any, Dict, Optional

from openai import AsyncOpenAI

from core.schema import CVData, CVSession, ConversationStage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Alex, a friendly and professional CV writing assistant for NTT Data.
Your job is to help employees build outstanding CVs through natural conversation.

## Your Personality
- Warm, encouraging, and concise
- Ask ONE question at a time — never overwhelm with multiple questions
- Celebrate progress: acknowledge when a section is complete
- Professional but conversational (not robotic)

## Conversation Flow
1. GREETING: Welcome the user. Ask if they have an existing CV to upload or want to start fresh.
2. COLLECTING: Gather CV information section by section — personal details, work history, education, skills, achievements.
3. VALIDATING: When data looks complete, confirm and ask if they want to choose a template.
4. TEMPLATE_PICK: Present exactly these 4 templates and ask the user to choose one:
   - **Professional** — Classic single-column corporate layout with teal accents
   - **Modern** — Bold two-column layout with dark sidebar and teal skill highlights
   - **Minimal** — Clean single-column serif design, content-focused, no colour distractions
   - **Executive** — Premium two-column with gold accents, achievements callout box, serif headings
5. PREVIEWING: Tell them the preview is ready on the right panel and ask if they're happy or want changes.
6. DONE: Congratulate, provide download links.

## Rules
- Extract structured data from the user's free-text answers
- CRITICAL: Always check "## Current Stage" in the context before responding. Never restart from GREETING if the stage is already VALIDATING, TEMPLATE_PICK, or later.
- If current stage is VALIDATING and CV data is already populated, do NOT ask for name/job or re-introduce yourself. Jump straight to confirming details or asking about template choice.
- If the user says "yes" or similar affirmative at VALIDATING stage, move to TEMPLATE_PICK and present the three template options.
- For work experience, always ask for: job title, company, dates, and 2-3 key achievements
- Keep your responses SHORT (2-4 sentences max) unless presenting a list
- Never mention technical implementation details (agents, RAG, ChromaDB, etc.)

## Available CV Fields (use exact key names in extracted_data)
- full_name, email, phone, location, linkedin_url, github_url, website_url
- headline (job title / tagline), professional_summary
- work_experience: list of {job_title, company, location, date_range: {start, end}, bullets: [], technologies: []}
- education: list of {degree, institution, location, date_range: {start, end}, grade}
- skills: list of strings
- certifications: list of {name, issuer, date, credential_id}
- languages: list of strings
- achievements: list of strings (quantified impact statements, e.g. "Increased revenue by 30%")
- awards: list of strings (formal awards, honours, recognitions, prizes)
- target_role, target_industry

When user asks to add a section (awards, publications, etc.), populate the correct field above.
If a section has no exact matching field, add it to achievements or awards as appropriate.

## Output Format
Respond in JSON with two fields:
{
  "message": "Your conversational reply to the user",
  "extracted_data": { ...any CV fields you extracted from the user's message... },
  "next_stage": "current or next stage name",
  "ready_for_template": false
}

Stages: greeting, choose_path, collecting, enriching, validating, template_pick, previewing, generating, done

## Template key mapping (use these exact values in extracted_data.selected_template)
- "Professional" → "professional"
- "Modern"       → "modern"
- "Minimal"      → "minimal"
- "Executive"    → "executive"
"""


async def run_triage_agent(
    user_message: str,
    session: CVSession,
    client: AsyncOpenAI,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """
    Run the triage/conversation agent for one turn.
    Returns dict with 'reply', 'updated_cv_data', 'next_stage'.
    """

    # Build conversation context
    history = []
    for msg in session.recent_messages(n=12):
        history.append({"role": msg.role, "content": msg.content})

    # Add current CV state as context
    cv_context = f"\n\n## Current CV Data\n{session.cv_data.model_dump_json(indent=2)}"
    cv_context += f"\n\n## Completion: {session.cv_data.completion_pct()}%"
    cv_context += f"\n## Current Stage: {session.stage.value}"

    missing = session.cv_data.missing_required_fields()
    if missing:
        cv_context += f"\n## Missing Required Fields: {', '.join(missing)}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + cv_context},
        *history,
        {"role": "user", "content": user_message},
    ]

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=1000,
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        # Merge extracted CV data
        extracted = data.get("extracted_data", {})
        updated_cv = _merge_cv_data(session.cv_data, extracted)

        # Determine next stage
        next_stage_str = data.get("next_stage", session.stage.value)
        try:
            next_stage = ConversationStage(next_stage_str)
        except ValueError:
            next_stage = session.stage

        return {
            "reply": data.get("message", "I'm here to help! Could you tell me a bit about yourself?"),
            "updated_cv_data": updated_cv,
            "next_stage": next_stage,
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error from triage agent: {e}")
        return {
            "reply": "I'm here to help build your CV! Could you start by telling me your name and current job title?",
            "updated_cv_data": session.cv_data,
            "next_stage": session.stage,
        }
    except Exception as e:
        logger.error(f"Triage agent error: {e}")
        raise


_PRESENT_ALIASES = {
    "till date", "tilldate", "till now", "tillnow", "to date",
    "todate", "to present", "present", "current", "ongoing",
    "now", "today", "till today",
}


def _normalise_end(value: str) -> str:
    """Normalise any 'till date' style value to 'present'."""
    return "present" if value.lower().strip() in _PRESENT_ALIASES else value


def _sanitise_date_range(dr):
    """Convert any date_range value to a dict DateRange can accept."""
    if not dr or isinstance(dr, dict):
        if isinstance(dr, dict) and "end" in dr and dr["end"]:
            dr = {**dr, "end": _normalise_end(str(dr["end"]))}
        return dr
    if isinstance(dr, str):
        for sep in (' - ', ' – ', ' to ', ' till ', ' until ', '-'):
            if sep.lower() in dr.lower():
                parts = dr.lower().split(sep.lower(), 1)
                return {"start": parts[0].strip(), "end": _normalise_end(parts[1].strip())}
        return {"start": dr.strip()}
    return dr


def _sanitise_entries(entries: list) -> list:
    """Sanitise date_range in a list of work_experience or education dicts."""
    result = []
    for item in entries:
        if isinstance(item, dict) and "date_range" in item:
            item = {**item, "date_range": _sanitise_date_range(item["date_range"])}
        result.append(item)
    return result


def _merge_cv_data(existing: CVData, extracted: dict) -> CVData:
    """Merge newly extracted fields into existing CV data (non-destructive)."""
    if not extracted:
        return existing

    current = existing.model_dump()

    for key, value in extracted.items():
        if key not in current:
            continue
        if value is None:
            continue
        # For lists, extend rather than replace
        if isinstance(current[key], list) and isinstance(value, list):
            seen = {str(item) for item in current[key]}
            for item in value:
                if str(item) not in seen:
                    current[key].append(item)
                    seen.add(str(item))
        elif isinstance(current[key], list) and isinstance(value, dict):
            current[key].append(value)
        elif current[key] is None or current[key] == "":
            current[key] = value

    # Sanitise date_range fields before validation
    for section in ("work_experience", "education"):
        if isinstance(current.get(section), list):
            current[section] = _sanitise_entries(current[section])

    try:
        return CVData.model_validate(current)
    except Exception:
        # If the merged data still fails validation, return the existing CV
        # unchanged so the conversation can continue uninterrupted.
        logger.warning("CV data validation failed after merge — keeping existing data")
        return existing
