/**
 * components/CVPreview.jsx
 * Renders the live CV HTML preview in a sandboxed iframe.
 * Shows template selector, per-template customise panel, and download buttons.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { downloadPDF, downloadDOCX, triggerDownload, getPreview } from '../lib/api.js'
import { TEMPLATES, TEMPLATE_DEFAULTS } from '../lib/templateDefaults.js'
import SectionEditModal from './SectionEditModal.jsx'
import ShortlistModal from './ShortlistModal.jsx'

// ── Per-template visual identity used in the selector cards ─────────────────
// Cards render on a forced white doc-background so fonts/colours always show.
const TEMPLATE_VISUAL_META = {
  minimal: {
    accent: '#444',
    font: "Georgia,'Times New Roman',serif",
    nameSize: 9, nameWeight: 700, nameColor: '#111',
    sublineColor: '#888',
    headerBorder: '0.5px solid #ccc',
    layout: 'single',
    sidebarBg: null,
  },
  executive: {
    accent: '#c9a84c',
    font: "'Palatino Linotype','Book Antiqua',Palatino,serif",
    nameSize: 8.5, nameWeight: 700, nameColor: '#1a2035',
    sublineColor: '#c9a84c',
    headerBorder: '1.5px solid #c9a84c',
    layout: 'sidebar',
    sidebarBg: '#1a1f2e',      // dark sidebar like executive template
  },
  postcard: {
    accent: '#1b2a5e',
    font: "'Segoe UI',Calibri,Arial,sans-serif",
    nameSize: 7.5, nameWeight: 700, nameColor: '#1b2a5e',
    sublineColor: '#4a5568',
    headerBorder: '2px solid #1b2a5e',
    layout: 'postcard',
    sidebarBg: '#1b2a5e',
  },
}

// ── Customise panel ──────────────────────────────────────────────────────────
const SECTION_TOGGLES = [
  { key: 'show_summary',        label: 'Summary' },
  { key: 'show_experience',     label: 'Experience' },
  { key: 'show_education',      label: 'Education' },
  { key: 'show_skills',         label: 'Skills' },
  { key: 'show_certifications', label: 'Certifications' },
  { key: 'show_languages',      label: 'Languages' },
  { key: 'show_achievements',   label: 'Achievements' },
  { key: 'show_projects',       label: 'Projects' },
]

function CustomisePanel({ template, config, onChange }) {
  const toggle = (key, val) => onChange(key, val)

  return (
    <div style={{
      padding: '10px 16px 12px',
      background: 'var(--surface2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center',
    }}>
      {/* Section toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Sections
        </span>
        {SECTION_TOGGLES.map(({ key, label }) =>
          config[key] !== undefined ? (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text2)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={!!config[key]}
                onChange={e => toggle(key, e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 13, height: 13, cursor: 'pointer' }}
              />
              {label}
            </label>
          ) : null
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border2)', flexShrink: 0 }} />

      {/* Template-specific controls */}
      {template === 'minimal' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text2)', userSelect: 'none' }}>
            <input type="checkbox" checked={!!config.compact_spacing}
              onChange={e => toggle('compact_spacing', e.target.checked)}
              style={{ accentColor: 'var(--teal)', cursor: 'pointer' }} />
            Compact
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            Font
            <input type="range" min={9} max={12} step={1} value={config.font_size_pt || 10}
              onChange={e => toggle('font_size_pt', Number(e.target.value))}
              style={{ width: 60, accentColor: 'var(--teal)', cursor: 'pointer' }} />
            {config.font_size_pt || 10}pt
          </label>
        </>
      )}

      {template === 'executive' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text2)', userSelect: 'none' }}>
          <input type="checkbox" checked={config.sidebar_dark !== false}
            onChange={e => toggle('sidebar_dark', e.target.checked)}
            style={{ accentColor: 'var(--teal)', cursor: 'pointer' }} />
          Dark sidebar
        </label>
      )}
    </div>
  )
}

// ── Empty / waiting states ───────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      color: 'var(--text3)', background: 'var(--bg)',
    }}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>📄</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)' }}>Your CV preview will appear here</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 260, textAlign: 'center', lineHeight: 1.6 }}>
        Start chatting with the AI assistant to build your CV, or upload an existing document.
      </div>
    </div>
  )
}

function WaitingState({ cvData, completion }) {
  const name = cvData?.full_name
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      color: 'var(--text3)', background: 'var(--bg)', padding: 32,
    }}>
      <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
        <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r="20" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
          <circle cx="26" cy="26" r="20" fill="none"
            stroke={completion === 100 ? '#00c896' : completion >= 60 ? '#f59e0b' : '#6366f1'}
            strokeWidth="3.5"
            strokeDasharray={`${(completion / 100) * (2 * Math.PI * 20)} ${2 * Math.PI * 20}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          color: completion === 100 ? '#00c896' : 'var(--text2)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>{completion}%</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          {name ? `Building ${name}'s CV…` : 'Building your CV…'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          Keep answering the questions in the chat.<br />
          Your preview will appear once all key sections are complete.
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Contact info',          done: !!(cvData?.full_name && cvData?.email), optional: false },
          { label: 'Professional summary',  done: !!cvData?.professional_summary,          optional: false },
          { label: 'Work experience',       done: (cvData?.work_experience?.length || 0) > 0, optional: false },
          { label: 'Education',             done: (cvData?.education?.length || 0) > 0,    optional: false },
          { label: 'Skills',                done: (cvData?.skills?.length || 0) >= 3,      optional: false },
        ].map(({ label, done, optional }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, opacity: optional ? 0.65 : 1 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: done ? 'rgba(0,200,150,0.15)' : 'var(--surface2)',
              border: `1.5px solid ${done ? 'var(--teal)' : optional ? 'var(--border)' : 'var(--border2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: done ? 'var(--teal)' : 'var(--text3)',
            }}>
              {done ? '✓' : ''}
            </div>
            <span style={{ color: done ? 'var(--text)' : 'var(--text3)', fontStyle: optional ? 'italic' : 'normal' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(7,11,20,0.55)', backdropFilter: 'blur(3px)',
      zIndex: 10,
    }}>
      <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
        <div style={{
          width: 32, height: 32, border: '2.5px solid var(--surface3)',
          borderTopColor: 'var(--teal)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 13 }}>Rendering template…</div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
// ── Section metadata for missing-banner and edit chips ──────────────────────
const CV_SECTIONS = [
  { key: 'contact',      label: 'Contact',      required: true,  prompt: 'I want to update my contact information (name, email, phone, location)', addPrompt: 'I need to add my phone number and location', done: (cv) => !!(cv?.full_name && cv?.email) },
  { key: 'summary',      label: 'Summary',      required: true,  prompt: 'I want to rewrite my professional summary', addPrompt: 'I need to add my professional summary', done: (cv) => !!cv?.professional_summary },
  { key: 'experience',   label: 'Experience',   required: true,  prompt: 'I want to update my work experience', addPrompt: 'I need to add my work experience', done: (cv) => (cv?.work_experience?.length || 0) > 0 },
  { key: 'education',    label: 'Education',    required: true,  prompt: 'I want to update my education details', addPrompt: 'I need to add my education', done: (cv) => (cv?.education?.length || 0) > 0 },
  { key: 'skills',       label: 'Skills',       required: true,  prompt: 'I want to update my skills list', addPrompt: 'I need to add my skills', done: (cv) => (cv?.skills?.length || 0) >= 3 },
  { key: 'certifications',label:'Certifications',required: false, prompt: 'I want to update my certifications', addPrompt: 'I want to add my certifications', done: (cv) => (cv?.certifications?.length || 0) > 0 },
  { key: 'languages',    label: 'Languages',    required: false, prompt: 'I want to update my languages', addPrompt: 'I want to add my languages', done: (cv) => (cv?.languages?.length || 0) > 0 },
  { key: 'achievements', label: 'Achievements', required: false, prompt: 'I want to update my achievements', addPrompt: 'I want to add my achievements', done: (cv) => (cv?.achievements?.length || 0) > 0 },
]

export default function CVPreview({ cvData, previewHtml, templateConfig, templateConfigs, initialTemplate, customTemplates = [], onTemplateChange, onConfigChange, onEditSection, onSectionEdit }) {
  const iframeRef = useRef(null)
  const allTemplates = [...TEMPLATES, ...customTemplates]
  const [activeTemplate, setActiveTemplate] = useState(initialTemplate || cvData?.selected_template || 'minimal')
  const [localConfig, setLocalConfig] = useState(() => templateConfig || TEMPLATE_DEFAULTS[initialTemplate || cvData?.selected_template || 'minimal'])
  // Track previous initialTemplate so we can detect external changes (e.g. voice selection)
  const prevInitialTemplateRef = useRef(initialTemplate)

  // Returns the base HTML template key (for API calls) for any template key
  const getBaseKey = useCallback((key) => {
    const custom = customTemplates.find(t => t.key === key)
    return custom ? custom.baseKey : key
  }, [customTemplates])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [localHtml, setLocalHtml] = useState(previewHtml)
  const [editingSection, setEditingSection] = useState(null)
  const [shortlistOpen, setShortlistOpen] = useState(false)
  const [dlStatus, setDlStatus] = useState({ pdf: 'idle', docx: 'idle' })
  const debounceRef = useRef(null)
  const autoPreviewRef = useRef(null)
  // Refs so the auto-preview effect always sees current template/config (no stale closure)
  const activeTemplateRef = useRef(activeTemplate)
  const localConfigRef = useRef(localConfig)
  useEffect(() => { activeTemplateRef.current = activeTemplate }, [activeTemplate])
  useEffect(() => { localConfigRef.current = localConfig }, [localConfig])

  // Required fields — matches backend completion_pct().
  const { completion, missingCount } = cvData ? (() => {
    const checks = [
      !!cvData.full_name,
      !!cvData.email,
      !!cvData.professional_summary,
      (cvData.work_experience?.length || 0) > 0,
      (cvData.education?.length || 0) > 0,
      (cvData.skills?.length || 0) >= 3,
    ]
    const passed = checks.filter(Boolean).length
    return { completion: Math.round(passed / checks.length * 100), missingCount: checks.length - passed }
  })() : { completion: 0, missingCount: 6 }

  // ── fetchPreview must be declared BEFORE any useEffect that references it ──
  const fetchPreview = useCallback(async (cvDataArg, template, cfg) => {
    if (!cvDataArg) return
    setLoadingPreview(true)
    try {
      const html = await getPreview({ ...cvDataArg, selected_template: getBaseKey(template) }, cfg)
      setLocalHtml(html)
    } catch (e) {
      console.error('Preview fetch failed', e)
    } finally {
      setLoadingPreview(false)
    }
  }, [getBaseKey])

  // Sync external previewHtml — null means a new upload cleared it, so reset localHtml too
  useEffect(() => {
    setLocalHtml(previewHtml ?? null)
  }, [previewHtml])

  // Sync template when parent forces a change from outside (e.g. AI voice selection)
  useEffect(() => {
    if (initialTemplate && initialTemplate !== prevInitialTemplateRef.current) {
      prevInitialTemplateRef.current = initialTemplate
      // Only switch if it differs from our current local selection
      setActiveTemplate(initialTemplate)
      const newCfg = TEMPLATE_DEFAULTS[getBaseKey(initialTemplate)]
      setLocalConfig(newCfg)
      if (cvData) fetchPreview(cvData, initialTemplate, newCfg)
    }
  }, [initialTemplate, cvData, fetchPreview, getBaseKey])

  // Auto-render live preview as CV data fills in during conversation.
  // Uses refs for template/config so a manual template switch is never overridden.
  useEffect(() => {
    if (!cvData?.full_name) return
    clearTimeout(autoPreviewRef.current)
    autoPreviewRef.current = setTimeout(() => {
      fetchPreview(cvData, activeTemplateRef.current, localConfigRef.current)
    }, 1200)
    return () => clearTimeout(autoPreviewRef.current)
  }, [cvData, fetchPreview])

  // Sync config from modal (when user changes settings while preview is visible)
  useEffect(() => {
    if (templateConfig) {
      setLocalConfig(templateConfig)
      if (cvData) fetchPreview(cvData, activeTemplate, templateConfig)
    }
  }, [templateConfig]) // eslint-disable-line react-hooks/exhaustive-deps

  // Write HTML into iframe whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !localHtml) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc) return
      doc.open(); doc.write(localHtml); doc.close()
    } catch (e) {
      console.error('iframe write failed', e)
    }
  }, [localHtml])

  // Pen click in iframe → open the React edit modal
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type !== 'cv_section_edit') return
      setEditingSection(e.data.section)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleTemplateChange = useCallback((key) => {
    const baseKey = getBaseKey(key)
    // Prefer previously saved config for this template over bare defaults
    const newCfg = templateConfigs?.[key] ?? templateConfigs?.[baseKey] ?? TEMPLATE_DEFAULTS[baseKey]
    setActiveTemplate(key)
    setLocalConfig(newCfg)
    onTemplateChange?.(key)   // notify parent of key change only; parent already holds saved config
    fetchPreview(cvData, key, newCfg)
  }, [cvData, fetchPreview, getBaseKey, onTemplateChange, templateConfigs])

  const handleConfigChange = useCallback((key, value) => {
    const newCfg = { ...localConfig, [key]: value }
    setLocalConfig(newCfg)
    onConfigChange?.(newCfg)
    // Debounce API call by 350ms (important for sliders/color pickers)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPreview(cvData, activeTemplate, newCfg)
    }, 350)
  }, [localConfig, cvData, activeTemplate, fetchPreview, onConfigChange])

  const handleDownload = useCallback(async (type) => {
    if (!cvData) return
    setDlStatus(s => ({ ...s, [type]: 'loading' }))
    try {
      const cvWithTemplate = { ...cvData, selected_template: getBaseKey(activeTemplate) }
      const name = (cvData.full_name || 'cv').replace(/\s+/g, '_').toLowerCase()
      if (type === 'pdf') {
        const blob = await downloadPDF(cvWithTemplate, localConfig)
        triggerDownload(blob, `${name}_cv.pdf`)
      } else if (type === 'docx') {
        const blob = await downloadDOCX(cvWithTemplate)
        triggerDownload(blob, `${name}_cv.docx`)
      } else if (type === 'json') {
        const blob = new Blob([JSON.stringify(cvData, null, 2)], { type: 'application/json' })
        triggerDownload(blob, `${name}_cv.json`)
      }
      setDlStatus(s => ({ ...s, [type]: 'done' }))
      setTimeout(() => setDlStatus(s => ({ ...s, [type]: 'idle' })), 2000)
    } catch (e) {
      console.error('Download failed', e)
      setDlStatus(s => ({ ...s, [type]: 'idle' }))
    }
  }, [cvData, activeTemplate, localConfig, getBaseKey])

  const isEmpty = !cvData?.full_name && !localHtml

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>

      {/* Header bar */}
      <div style={{
        height: 'var(--header-h)', display: 'flex', alignItems: 'center',
        gap: 12, padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {cvData?.full_name || 'Your CV Preview'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
            {completion === 100 ? '✓ Ready to generate' : `${missingCount} field${missingCount !== 1 ? 's' : ''} remaining`}
          </div>
        </div>
        {/* Shortlist button — always shown once a CV exists */}
        {cvData?.full_name && (
          <button
            onClick={() => setShortlistOpen(true)}
            title="Skillset Filter — check this CV against a skill set"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 7,
              border: '1px solid var(--teal)',
              background: 'rgba(0,139,110,0.08)',
              color: 'var(--teal)',
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            🎯 Smart Search
          </button>
        )}

        {/* Download buttons */}
        {cvData && localHtml && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", marginRight: 2 }}>Export:</span>
            {[{ type: 'pdf', label: 'PDF', icon: '📄' }, { type: 'docx', label: 'DOCX', icon: '📝' }, { type: 'json', label: 'JSON', icon: '{ }' }].map(({ type, label, icon }) => (
              <button key={type} onClick={() => handleDownload(type)} disabled={dlStatus[type] === 'loading'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 7,
                  border: '1px solid var(--border2)',
                  background: dlStatus[type] === 'done' ? 'rgba(0,200,150,0.15)' : 'var(--surface2)',
                  color: dlStatus[type] === 'done' ? 'var(--teal)' : 'var(--text2)',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  opacity: dlStatus[type] === 'loading' ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                {dlStatus[type] === 'loading' ? '…' : dlStatus[type] === 'done' ? '✓' : label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Missing-sections banner (shown when completion < 100% and CV has started) ── */}
      {cvData?.full_name && completion < 100 && (() => {
        const missing = CV_SECTIONS.filter(s => s.required && !s.done(cvData))
        if (!missing.length) return null
        return (
          <div style={{
            padding: '6px 16px', background: 'rgba(245,158,11,0.08)',
            borderBottom: '1px solid rgba(245,158,11,0.22)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 10.5, color: '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono',monospace" }}>
              Still needed:
            </span>
            {missing.map(s => (
              <button key={s.key} onClick={() => onEditSection?.(s.addPrompt)}
                title={`Add ${s.label}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 9px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
                  color: '#f59e0b', fontSize: 11, fontWeight: 600,
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 10 }}>+</span> {s.label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Template selector row */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, overflowX: 'auto', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Section label watermark */}
        <div style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          fontSize: 22, fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase',
          color: 'var(--text3)', opacity: 0.18, pointerEvents: 'none', userSelect: 'none',
          fontFamily: "'JetBrains Mono', monospace",
        }}>Templates</div>
        {allTemplates.map(t => {
          const isActive = activeTemplate === t.key
          const m = TEMPLATE_VISUAL_META[t.key] || {}
          const isSidebar = m.layout === 'sidebar'
          const isPostcard = m.layout === 'postcard'
          return (
            <button key={t.key} onClick={() => handleTemplateChange(t.key)}
              title={t.label}
              style={{
                width: 100, flexShrink: 0,
                padding: 0, borderRadius: 8, cursor: 'pointer',
                border: isActive ? `2px solid ${m.accent}` : '2px solid transparent',
                background: 'transparent',
                overflow: 'hidden',
                transition: 'all 0.18s',
                outline: 'none',
                boxShadow: isActive
                  ? `0 0 0 3px ${m.accent}35, 0 2px 12px ${m.accent}25`
                  : '0 1px 4px rgba(0,0,0,0.4)',
              }}>

              {/* ── Document preview (forced white background) ── */}
              <div style={{ background: '#fff', fontFamily: m.font }}>

                {/* Header */}
                {isPostcard ? (
                  /* Postcard: light header band + geo blocks */
                  <div style={{ background: '#f4f6f9', borderBottom: `2px solid ${m.accent}`, padding: '5px 6px 4px' }}>
                    <div style={{ fontSize: m.nameSize, fontWeight: m.nameWeight, color: m.nameColor, lineHeight: 1.1 }}>Full Name</div>
                    <div style={{ fontSize: 5, color: m.sublineColor, marginTop: 1, fontStyle: 'italic' }}>Senior Manager</div>
                    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                      {['#e63946','#2a9d8f','#f4a261','#1b2a5e'].map((c, i) => (
                        <div key={i} style={{ width: i === 3 ? 4 : 4, height: i === 3 ? 8 : 4, background: c, borderRadius: 1 }} />
                      ))}
                    </div>
                  </div>
                ) : isSidebar ? (
                  /* Modern / Executive: left sidebar + main */
                  <div style={{ display: 'flex', height: 42 }}>
                    <div style={{
                      width: 30, background: m.sidebarBg, flexShrink: 0,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      padding: '4px 4px', gap: 2,
                    }}>
                      {[100, 75, 90, 60, 80].map((w, i) => (
                        <div key={i} style={{ height: 2.5, width: `${w}%`, background: m.accent, borderRadius: 1, opacity: 0.7 }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, padding: '5px 5px 4px', borderBottom: m.headerBorder }}>
                      <div style={{ fontSize: m.nameSize, fontWeight: m.nameWeight, color: m.nameColor, lineHeight: 1.2 }}>Full Name</div>
                      <div style={{ fontSize: 5.5, color: m.sublineColor, marginTop: 1 }}>Senior Manager</div>
                      <div style={{ height: 1, background: m.accent, marginTop: 3, opacity: 0.3 }} />
                    </div>
                  </div>
                ) : (
                  /* Professional / Minimal: single-column header */
                  <div style={{ padding: '6px 7px 4px', borderBottom: m.headerBorder }}>
                    <div style={{ fontSize: m.nameSize, fontWeight: m.nameWeight, color: m.nameColor, letterSpacing: '-0.2px' }}>Full Name</div>
                    <div style={{ fontSize: 6, color: m.sublineColor, marginTop: 1 }}>Senior Manager · email@nttdata.com</div>
                  </div>
                )}

                {/* Body lines */}
                <div style={{ padding: '5px 7px 6px', display: 'flex', gap: 3 }}>
                  {isSidebar && (
                    <div style={{ width: 21, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
                      <div style={{ height: 2.5, background: m.accent, borderRadius: 1, opacity: 0.5, width: '100%' }} />
                      {[85, 70, 90, 65].map((w, i) => (
                        <div key={i} style={{ height: 2, background: `${m.accent}80`, borderRadius: 1, width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ height: 3, background: `${m.accent}60`, borderRadius: 1, width: '55%' }} />
                    {[100, 78, 88, 65, 72, isSidebar ? null : 82].filter(Boolean).map((w, i) => (
                      <div key={i} style={{ height: 2, width: `${w}%`, background: '#d0d0d0', borderRadius: 1 }} />
                    ))}
                  </div>
                  {isPostcard && (
                    <div style={{ width: 22, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
                      <div style={{ height: 2.5, background: m.accent, borderRadius: 1, width: '100%' }} />
                      {[85, 70, 90, 65].map((w, i) => (
                        <div key={i} style={{ height: 2, background: `${m.accent}cc`, borderRadius: 1, width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Label strip (dark UI) ── */}
              <div style={{
                padding: '4px 6px',
                fontFamily: m.font, fontSize: 9, fontWeight: 700,
                color: isActive ? m.accent : 'var(--text2)',
                background: isActive ? `${m.accent}18` : 'var(--surface3)',
                textAlign: 'center', letterSpacing: '0.2px',
              }}>
                {t.label}
              </div>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
      </div>


      {/* Preview area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#e8e8e8' }}>
        <iframe
          ref={iframeRef}
          title="CV Preview"
          sandbox="allow-same-origin allow-scripts"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: localHtml ? 'block' : 'none' }}
        />
        {!localHtml && (isEmpty ? <EmptyState /> : <WaitingState cvData={cvData} completion={completion} />)}
        {loadingPreview && <LoadingOverlay />}
      </div>

      {/* Section edit modal — rendered over the preview */}
      {editingSection && cvData && (
        <SectionEditModal
          section={editingSection}
          cvData={cvData}
          onSave={(patch) => {
            onSectionEdit?.(patch)
            setEditingSection(null)
          }}
          onClose={() => setEditingSection(null)}
        />
      )}

      {/* ── Skill shortlist modal ── */}
      {shortlistOpen && cvData && (
        <ShortlistModal
          cvData={cvData}
          onClose={() => setShortlistOpen(false)}
        />
      )}
    </div>
  )
}
