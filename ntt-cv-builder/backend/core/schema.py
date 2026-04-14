"""
Canonical CV Pydantic v2 schema.
All agents read/write this single source of truth.
"""
from __future__ import annotations
from datetime import date
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ConversationStage(str, Enum):
    GREETING = "greeting"
    CHOOSE_PATH = "choose_path"          # upload or fresh
    COLLECTING = "collecting"            # gathering info
    ENRICHING = "enriching"              # RAG enrichment (auto)
    VALIDATING = "validating"            # gap filling
    TEMPLATE_PICK = "template_pick"
    PREVIEWING = "previewing"
    GENERATING = "generating"
    DONE = "done"


# ── CV Data Schema ──────────────────────────────────────────

class DateRange(BaseModel):
    start: Optional[str] = None          # "2020-01" or "Jan 2020"
    end: Optional[str] = None            # None → "Present"
    is_current: bool = False


class WorkExperience(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    date_range: Optional[DateRange] = None
    bullets: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)


class Education(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    location: Optional[str] = None
    date_range: Optional[DateRange] = None
    grade: Optional[str] = None
    highlights: List[str] = Field(default_factory=list)


class Certification(BaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    credential_id: Optional[str] = None


class CVData(BaseModel):
    """Canonical CV schema. Populated incrementally by agents."""
    # Personal
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None

    # Professional
    headline: Optional[str] = None          # e.g. "Senior Software Engineer"
    professional_summary: Optional[str] = None

    # Core sections
    work_experience: List[WorkExperience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[Certification] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    awards: List[str] = Field(default_factory=list)

    # Meta
    target_role: Optional[str] = None
    target_industry: Optional[str] = None
    selected_template: str = "professional"   # persisted through API calls

    def completion_pct(self) -> int:
        """Return 0-100 completeness score used by Validation Agent."""
        required = [
            self.full_name, self.email, self.headline,
            self.professional_summary,
            bool(self.work_experience), bool(self.education), bool(self.skills),
        ]
        filled = sum(1 for f in required if f)
        return int((filled / len(required)) * 100)

    def missing_required_fields(self) -> List[str]:
        missing = []
        if not self.full_name: missing.append("full name")
        if not self.email: missing.append("email address")
        if not self.headline: missing.append("professional headline / job title")
        if not self.professional_summary: missing.append("professional summary")
        if not self.work_experience: missing.append("at least one work experience entry")
        if not self.education: missing.append("at least one education entry")
        if not self.skills: missing.append("skills list")
        return missing


# ── Template Config Schema ──────────────────────────────────

class TemplateConfig(BaseModel):
    """Per-template customisation options sent from the frontend UI."""
    # Section visibility (all default True → safe for existing callers)
    show_summary: bool = True
    show_experience: bool = True
    show_education: bool = True
    show_skills: bool = True
    show_certifications: bool = True
    show_languages: bool = True
    show_achievements: bool = True
    show_awards: bool = True
    # Shared style
    accent_color: Optional[str] = None        # e.g. "#008B6E"
    # Modern
    show_skill_bars: bool = True
    # Minimal
    font_size_pt: int = 10
    compact_spacing: bool = False
    # Executive
    sidebar_dark: bool = True


# ── Session Schema ──────────────────────────────────────────

class Message(BaseModel):
    role: str           # "user" | "assistant"
    content: str
    timestamp: Optional[str] = None


class CVSession(BaseModel):
    """Full session state passed to/from agents."""
    session_id: str
    stage: ConversationStage = ConversationStage.GREETING
    cv_data: CVData = Field(default_factory=CVData)
    messages: List[Message] = Field(default_factory=list)
    selected_template: str = "modern"
    generated_pdf_path: Optional[str] = None
    generated_docx_path: Optional[str] = None
    upload_processed: bool = False

    def add_message(self, role: str, content: str) -> None:
        from datetime import datetime
        self.messages.append(Message(
            role=role, content=content,
            timestamp=datetime.utcnow().isoformat()
        ))

    def recent_messages(self, n: int = 10) -> List[Message]:
        return self.messages[-n:]
