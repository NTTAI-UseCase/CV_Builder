"""
renderers/pdf_renderer.py
Generates PDF and HTML preview from CVData using Playwright (headless Chromium) + Jinja2.

Adapts core.schema.CVData (flat model used by agents) into the nested
structure expected by the Jinja2 templates.
"""
from __future__ import annotations
from pathlib import Path
from types import SimpleNamespace
from jinja2 import Environment, FileSystemLoader, select_autoescape
from core.schema import TemplateConfig

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )


def _adapt(cv) -> SimpleNamespace:
    """Convert core.schema.CVData (flat) → template-friendly namespace (nested)."""

    # Contact sub-object
    contact = SimpleNamespace(
        full_name=cv.full_name,
        email=cv.email,
        phone=cv.phone,
        location=cv.location,
        linkedin_url=cv.linkedin_url,
        github_url=cv.github_url,
        website_url=getattr(cv, "website_url", None),
    )

    # Work experience — map date_range + bullets → start_date/end_date/bullet_points
    work_experience = []
    for w in (cv.work_experience or []):
        dr = getattr(w, "date_range", None)
        start = dr.start if dr else None
        end = dr.end if dr else None
        is_current = (dr.is_current if dr else False) or (end and end.lower() == "present")
        work_experience.append(SimpleNamespace(
            job_title=w.job_title,
            company=w.company,
            location=w.location,
            start_date=start,
            end_date=None if is_current else end,
            is_current=is_current,
            bullet_points=getattr(w, "bullets", []) or [],
            description=None,
            technologies=getattr(w, "technologies", []) or [],
            employment_type=None,
        ))

    # Education — map date_range → end_date
    education = []
    for e in (cv.education or []):
        dr = getattr(e, "date_range", None)
        education.append(SimpleNamespace(
            degree=e.degree,
            institution=e.institution,
            location=e.location,
            end_date=dr.end if dr else None,
            grade=getattr(e, "grade", None),
        ))

    # Skills — plain strings → objects with .name (no level)
    skills = [SimpleNamespace(name=s, level=None, category=None)
              for s in (cv.skills or []) if isinstance(s, str)]

    # Languages — plain strings → objects with .language / .proficiency
    languages = []
    for lang in (cv.languages or []):
        if isinstance(lang, str):
            languages.append(SimpleNamespace(language=lang, proficiency=""))
        else:
            languages.append(lang)

    # Certifications
    certifications = []
    for c in (cv.certifications or []):
        certifications.append(SimpleNamespace(
            name=getattr(c, "name", str(c)),
            issuer=getattr(c, "issuer", None),
            date_obtained=getattr(c, "date", None),
        ))

    return SimpleNamespace(
        contact=contact,
        professional_summary=cv.professional_summary,
        headline=getattr(cv, "headline", None),
        target_role=getattr(cv, "target_role", None),
        work_experience=work_experience,
        education=education,
        skills=skills,
        languages=languages,
        certifications=certifications,
        achievements=getattr(cv, "achievements", []) or [],
        awards=getattr(cv, "awards", []) or [],
        selected_template=getattr(cv, "selected_template", "professional"),
    )


def render_html_preview(cv, config: TemplateConfig | None = None) -> str:
    """Render the CV as an HTML string for in-chat preview."""
    adapted = _adapt(cv)
    env = _get_jinja_env()
    template_name = f"{adapted.selected_template}.html"
    if not (TEMPLATES_DIR / template_name).exists():
        template_name = "professional.html"
    template = env.get_template(template_name)
    cfg = config or TemplateConfig()
    show = {
        "summary":        cfg.show_summary,
        "experience":     cfg.show_experience,
        "education":      cfg.show_education,
        "skills":         cfg.show_skills,
        "certifications": cfg.show_certifications,
        "languages":      cfg.show_languages,
        "achievements":   cfg.show_achievements,
        "awards":         cfg.show_awards,
    }
    return template.render(cv=adapted, show=show, config=cfg.model_dump())


def render_pdf(cv, config: TemplateConfig | None = None) -> bytes:
    """Render the CV as a PDF binary using Playwright (headless Chromium)."""
    import asyncio

    async def _generate() -> bytes:
        from playwright.async_api import async_playwright
        html_string = render_html_preview(cv, config)
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html_string, wait_until="networkidle")
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "10mm", "bottom": "10mm", "left": "12mm", "right": "12mm"},
            )
            await browser.close()
        return pdf_bytes

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Inside an async context (FastAPI) — run in a thread to avoid nested loops
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _generate())
                return future.result(timeout=60)
        else:
            return loop.run_until_complete(_generate())
    except Exception as exc:
        raise RuntimeError(f"PDF generation failed: {exc}") from exc
