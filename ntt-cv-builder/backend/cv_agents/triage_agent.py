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

## Required vs Optional Fields
REQUIRED — collect ALL of these before moving to template selection:
  full_name, email, phone, location, headline, professional_summary,
  work_experience (at least one entry), education (at least one entry), skills (at least 3)

OPTIONAL — ask only once, bundled together, AFTER all required fields are done:
  certifications, languages, achievements, awards, target_role

## Conversation Flow
1. GREETING: Welcome the user. Ask if they have an existing CV to upload or want to start fresh.
2. COLLECTING: Gather all REQUIRED fields in this order:
   a. Full name
   b. Email
   c. Phone number  ← ask immediately after email
   d. Location (city / country)  ← ask immediately after phone
   e. Professional headline (job title / tagline)
   f. Work experience — for each role: job title, company, dates, 2-3 key bullets
   g. Education — degree, institution, dates
   h. Skills (at least 3)
   i. Professional summary (generate a draft if the user has given enough context)
   - Do NOT ask about certifications, languages, or awards during this phase.
   - Once ALL required fields above are filled, proceed directly to step 3.
3. VALIDATING: When all required fields are complete (completion = 100%), ask ONE combined question:
   "Your CV looks great! Would you like to add any optional details — such as certifications, languages, or awards — or are you ready to choose a template?"
   - If the user says "ready", "no", "skip", or similar → move directly to TEMPLATE_PICK.
   - If they provide optional info → collect it briefly, then move to TEMPLATE_PICK without asking further optional questions.
   - Do NOT ask about certifications, languages, and awards separately — bundle them in one ask only.
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
- CRITICAL: Check "## Completion" in context. If completion is 100%, do NOT ask about optional fields one-by-one. Ask the single combined optional question (step 3) then move to template selection.
- If current stage is VALIDATING and CV data is already populated, do NOT ask for name/job or re-introduce yourself. Jump straight to confirming details or asking about template choice.
- If the user says "yes" or similar affirmative at VALIDATING stage, move to TEMPLATE_PICK and present the four template options.
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
    "todate", "to present", "present", "current", "current date",
    "ongoing", "now", "today", "till today",
}

# Fields where trailing punctuation (period, comma) should be stripped
_PLAIN_TEXT_FIELDS = {
    "full_name", "email", "phone", "location", "headline",
    "target_role", "target_industry", "linkedin_url", "github_url",
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


_ENTRY_TEXT_FIELDS = {"job_title", "company", "degree", "institution", "location"}


def _sanitise_entries(entries: list) -> list:
    """Sanitise date_range and trailing punctuation in work_experience / education dicts."""
    result = []
    for item in entries:
        if isinstance(item, dict):
            if "date_range" in item:
                item = {**item, "date_range": _sanitise_date_range(item["date_range"])}
            # Strip trailing periods/commas from text sub-fields
            item = {
                k: v.rstrip(".,;: ") if k in _ENTRY_TEXT_FIELDS and isinstance(v, str) else v
                for k, v in item.items()
            }
        result.append(item)
    return result


def _merge_structured_entries(existing: list, new_entries: list, section: str) -> list:
    """Smart merge for work_experience / education lists.

    Instead of deduplicating by str() (which fails for partial entries built
    across multiple conversation turns), we match entries by their primary key
    and merge fields in — so job_title collected in turn 1 is preserved when
    company + bullets arrive in turn 2.
    """
    title_key = "job_title" if section == "work_experience" else "degree"
    result = [dict(e) if isinstance(e, dict) else e for e in existing]

    for new_item in new_entries:
        if not isinstance(new_item, dict):
            if str(new_item) not in {str(e) for e in result}:
                result.append(new_item)
            continue

        new_title = new_item.get(title_key)
        matched_idx = None

        if new_title:
            # Match by primary key (job_title / degree)
            for i, ex in enumerate(result):
                ex_d = ex if isinstance(ex, dict) else {}
                if ex_d.get(title_key) == new_title:
                    matched_idx = i
                    break

        if matched_idx is None:
            # No title in new item OR no match found — try to patch into the most
            # recent incomplete entry (has a title but missing company/institution)
            secondary = "company" if section == "work_experience" else "institution"
            for i in range(len(result) - 1, -1, -1):
                ex_d = result[i] if isinstance(result[i], dict) else {}
                if ex_d.get(title_key) and not ex_d.get(secondary):
                    matched_idx = i
                    break

        if matched_idx is not None:
            ex_d = result[matched_idx] if isinstance(result[matched_idx], dict) else {}
            merged = dict(ex_d)
            for k, v in new_item.items():
                if v is None:
                    continue
                if isinstance(v, list) and isinstance(merged.get(k), list):
                    seen = {str(x) for x in merged[k]}
                    for x in v:
                        if str(x) not in seen:
                            merged[k].append(x)
                            seen.add(str(x))
                elif not merged.get(k):
                    merged[k] = v
            result[matched_idx] = merged
        else:
            result.append(new_item)

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
        # Strip trailing punctuation from simple text fields
        if key in _PLAIN_TEXT_FIELDS and isinstance(value, str):
            value = value.rstrip(".,;: ")
        # selected_template must always be overwritten when the user picks one
        if key == "selected_template" and isinstance(value, str) and value.strip():
            current[key] = value.strip().lower()
            continue
        # For lists, extend rather than replace
        if isinstance(current[key], list) and isinstance(value, list):
            if key in ("work_experience", "education"):
                current[key] = _merge_structured_entries(current[key], value, key)
            else:
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
