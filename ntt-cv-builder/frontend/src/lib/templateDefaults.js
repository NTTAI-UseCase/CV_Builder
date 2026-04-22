/**
 * lib/templateDefaults.js
 * Single source of truth for template metadata and default config.
 * Imported by CVPreview.jsx and PreviewPanel.jsx.
 */

export const TEMPLATES = [
  { key: 'minimal',  label: 'Simple',       desc: 'Clean serif' },
  { key: 'postcard', label: 'Postcard',      desc: 'NTT profile card' },
  { key: 'executive',label: 'Professional',  desc: 'Two-column senior' },
]

export const TEMPLATE_DEFAULTS = {
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
    show_achievements: true, show_awards: true, show_projects: true,
    sidebar_dark: true,
  },
  postcard: {
    show_summary: true, show_experience: true, show_education: true,
    show_skills: true, show_certifications: true, show_languages: true,
    show_achievements: true, show_awards: false,
    show_photo: false,
  },
}
