"""
schemas/cv_schema.py
Canonical CV data model using Pydantic v2.
All agents read from and write to this schema.
"""
from __future__ import annotations
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field, model_validator
from enum import Enum


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    FREELANCE = "freelance"
    INTERNSHIP = "internship"


class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


# ── Sub-models ──────────────────────────────────────────────

class ContactInfo(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None          # "London, UK"
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None


class WorkExperience(BaseModel):
    job_title: str
    company: str
    location: Optional[str] = None
    employment_type: Optional[EmploymentType] = None
    start_date: Optional[str] = None        # "2021-03" or "March 2021"
    end_date: Optional[str] = None          # None = "Present"
    is_current: bool = False
    description: Optional[str] = None      # free-text summary
    bullet_points: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class Education(BaseModel):
    degree: str                             # "BSc Computer Science"
    institution: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    grade: Optional[str] = None            # "First Class", "3.8 GPA"
    relevant_modules: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)


class Certification(BaseModel):
    name: str
    issuer: str
    date_obtained: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    url: Optional[str] = None


class Skill(BaseModel):
    name: str
    level: Optional[SkillLevel] = None
    category: Optional[str] = None         # "Programming", "Cloud", "Soft Skills"


class Project(BaseModel):
    name: str
    description: str
    url: Optional[str] = None
    technologies: list[str] = Field(default_factory=list)
    bullet_points: list[str] = Field(default_factory=list)


class Language(BaseModel):
    language: str
    proficiency: str                        # "Native", "Fluent", "B2"


# ── Root CV Model ────────────────────────────────────────────

class CVData(BaseModel):
    """
    Canonical CV schema. Every agent reads from and writes to this model.
    Required fields for a complete CV are marked with required=True in field metadata.
    """
    # Contact
    contact: ContactInfo = Field(default_factory=ContactInfo)

    # Professional summary
    professional_summary: Optional[str] = None

    # Core sections
    work_experience: list[WorkExperience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)

    # Meta
    target_role: Optional[str] = None      # "Senior Software Engineer"
    target_industry: Optional[str] = None  # "Technology"
    selected_template: str = "minimal"  # template key

    def completion_percentage(self) -> int:
        """Returns how complete the CV is as a percentage."""
        checks = [
            bool(self.contact.full_name),
            bool(self.contact.email),
            bool(self.professional_summary),
            len(self.work_experience) > 0,
            len(self.education) > 0,
            len(self.skills) >= 3,
        ]
        return int(sum(checks) / len(checks) * 100)

    def missing_required_fields(self) -> list[str]:
        """Returns a list of human-readable missing field names."""
        missing = []
        if not self.contact.full_name:
            missing.append("full name")
        if not self.contact.email:
            missing.append("email address")
        if not self.professional_summary:
            missing.append("professional summary")
        if not self.work_experience:
            missing.append("work experience (at least one role)")
        if not self.education:
            missing.append("education details")
        if len(self.skills) < 3:
            missing.append("skills (at least 3)")
        return missing


class SessionState(BaseModel):
    """Redis-persisted session state for a conversation."""
    session_id: str
    cv: CVData = Field(default_factory=CVData)
    conversation_history: list[dict] = Field(default_factory=list)
    current_stage: str = "greeting"        # greeting | collecting | validating | template | preview | done
    uploaded_file_path: Optional[str] = None
