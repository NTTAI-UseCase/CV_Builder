"""
renderers/pdf_renderer.py
Generates PDF and HTML preview from CVData using Playwright (headless Chromium) + Jinja2.

Adapts core.schema.CVData (flat model used by agents) into the nested
structure expected by the Jinja2 templates.
"""
from __future__ import annotations
import base64
from pathlib import Path
from types import SimpleNamespace
from jinja2 import Environment, FileSystemLoader, select_autoescape
from core.schema import TemplateConfig

TEMPLATES_DIR = Path(__file__).parent / "templates"

# ── Inline-edit overlay injected into preview HTML only (never into PDF) ──────
# Only adds a hoverable pen button to each [data-section] element.
# The actual edit form is a React modal rendered in the parent window.
_EDIT_OVERLAY = """
<style>
  [data-section]{position:relative;}
  .cv-edit-btn{
    display:none;position:absolute;top:5px;right:5px;
    width:24px;height:24px;border-radius:50%;
    background:#fff;border:1.5px solid #008B6E;color:#008B6E;
    cursor:pointer;font-size:13px;align-items:center;justify-content:center;
    box-shadow:0 1px 6px rgba(0,0,0,0.2);z-index:50;
    transition:all .15s;padding:0;line-height:1;
  }
  [data-section]:hover>.cv-edit-btn{display:flex;}
  .cv-edit-btn:hover{background:#008B6E;color:#fff;transform:scale(1.12);}
</style>
<script>
(function(){
  document.querySelectorAll('[data-section]').forEach(function(el){
    var btn=document.createElement('button');
    btn.className='cv-edit-btn';
    btn.innerHTML='&#9998;';
    btn.title='Edit section';
    el.appendChild(btn);
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      window.parent.postMessage({type:'cv_section_edit',section:el.dataset.section},'*');
    });
  });
})();
</script>
"""

# NTT Data logo for watermark — resolved relative to this file so it works
# regardless of the working directory.
_LOGO_PATH = Path(__file__).parent.parent.parent / "frontend" / "public" / "ntt-data-logo.png"

def _ntt_logo_data_uri() -> str:
    """Return a base64 data URI for the NTT logo, or empty string if missing."""
    try:
        data = _LOGO_PATH.read_bytes()
        return "data:image/png;base64," + base64.b64encode(data).decode()
    except Exception:
        return ""


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


def render_html_preview(cv, config: TemplateConfig | None = None, _preview_mode: bool = True) -> str:
    """Render the CV as an HTML string for in-chat preview.

    When *_preview_mode* is True (default) the inline-edit overlay script is
    injected before </body>.  render_pdf() passes False to keep the PDF clean.
    """
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
    html = template.render(cv=adapted, show=show, config=cfg.model_dump(), ntt_logo=_ntt_logo_data_uri())
    if _preview_mode:
        html = html.replace("</body>", _EDIT_OVERLAY + "</body>", 1)
    return html


def _playwright_pdf(html_string: str) -> bytes:
    """Run async Playwright in a dedicated thread with an explicit ProactorEventLoop.

    On Windows, SelectorEventLoop (which anyio threads may inherit) cannot
    spawn subprocesses — raising NotImplementedError when Playwright tries to
    launch Chromium.  We avoid all global-policy mutation by explicitly
    constructing a ProactorEventLoop for this thread and using the async
    Playwright API directly on it.
    """
    import sys
    import asyncio
    import concurrent.futures

    def _in_thread() -> bytes:
        # Explicitly choose the right event loop type for this OS.
        # ProactorEventLoop supports subprocess creation on Windows;
        # new_event_loop() is fine on Linux/macOS.
        if sys.platform == "win32":
            loop = asyncio.ProactorEventLoop()
        else:
            loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _generate() -> bytes:
            from playwright.async_api import async_playwright
            async with async_playwright() as pw:
                browser = await pw.chromium.launch()
                try:
                    page = await browser.new_page()
                    await page.set_content(html_string, wait_until="networkidle")
                    return await page.pdf(
                        format="A4",
                        print_background=True,
                        margin={"top": "10mm", "bottom": "10mm",
                                "left": "12mm", "right": "12mm"},
                    )
                finally:
                    await browser.close()

        try:
            return loop.run_until_complete(_generate())
        finally:
            loop.close()
            asyncio.set_event_loop(None)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_in_thread).result(timeout=90)


def render_pdf(cv, config: TemplateConfig | None = None) -> bytes:
    """Render the CV as a PDF binary using Playwright (headless Chromium).

    Generates the HTML first, then delegates to ``_playwright_pdf`` which
    runs Playwright inside a dedicated thread so the calling event loop
    (uvicorn/anyio) cannot interfere.
    """
    import traceback as _tb
    html_string = render_html_preview(cv, config, _preview_mode=False)
    try:
        return _playwright_pdf(html_string)
    except Exception as exc:
        raise RuntimeError(
            f"PDF generation failed [{type(exc).__name__}]: {exc}\n{_tb.format_exc()}"
        ) from exc
