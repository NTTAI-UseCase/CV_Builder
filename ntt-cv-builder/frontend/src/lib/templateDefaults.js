/**
 * lib/templateDefaults.js
 * Single source of truth for template metadata and default config.
 * Imported by CVPreview.jsx and PreviewPanel.jsx.
 */

export const TEMPLATES = [
  { key: 'professional', label: 'Professional', desc: 'Classic corporate' },
  { key: 'modern',       label: 'Modern',       desc: 'Bold teal accents' },
  { key: 'minimal',      label: 'Minimal',      desc: 'Clean serif' },
  { key: 'executive',    label: 'Executive',    desc: 'Two-column senior' },
]

export const TEMPLATE_DEFAULTS = {
  professional: {
    show_summary: true, show_experience: true, show_education: true,
    show_skills: true, show_certifications: true, show_languages: true,
    show_achievements: true, show_awards: true,
    accent_color: '#008B6E',
  },
  modern: {
    show_summary: true, show_experience: true, show_education: true,
    show_skills: true, show_certifications: true, show_languages: true,
    show_achievements: true, show_awards: true,
    show_skill_bars: true,
  },
  minimal: {
    show_summary: true, show_experience: true, show_education: true,
    show_skills: true, show_certifications: false, show_languages: false,
    show_achievements: false, show_awards: true,
    font_size_pt: 10,
    compact_spacing: false,
  },
  executive: {
    show_summary: true, show_experience: true, show_education: true,
    show_skills: true, show_certifications: true, show_languages: true,
    show_achievements: true, show_awards: true,
    sidebar_dark: true,
  },
}
