/**
 * components/CVPreview.jsx
 * Renders the live CV HTML preview in a sandboxed iframe.
 * Shows template selector, per-template customise panel, and download buttons.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { downloadPDF, downloadDOCX, triggerDownload, getPreview } from '../lib/api.js'
import { TEMPLATES, TEMPLATE_DEFAULTS } from '../lib/templateDefaults.js'

// ── Customise panel ──────────────────────────────────────────────────────────
const SECTION_TOGGLES = [
  { key: 'show_summary',        label: 'Summary' },
  { key: 'show_experience',     label: 'Experience' },
  { key: 'show_education',      label: 'Education' },
  { key: 'show_skills',         label: 'Skills' },
  { key: 'show_certifications', label: 'Certifications' },
  { key: 'show_languages',      label: 'Languages' },
  { key: 'show_achievements',   label: 'Achievements' },
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
      {(template === 'professional') && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
          Accent colour
          <input type="color" value={config.accent_color || '#008B6E'}
            onChange={e => toggle('accent_color', e.target.value)}
            style={{ width: 28, height: 22, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
        </label>
      )}

      {template === 'modern' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text2)', userSelect: 'none' }}>
          <input type="checkbox" checked={!!config.show_skill_bars}
            onChange={e => toggle('show_skill_bars', e.target.checked)}
            style={{ accentColor: 'var(--teal)', cursor: 'pointer' }} />
          Skill bars
        </label>
      )}

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
          { label: 'Contact info',          done: !!(cvData?.full_name && cvData?.email) },
          { label: 'Professional summary',  done: !!cvData?.professional_summary },
          { label: 'Work experience',       done: (cvData?.work_experience?.length || 0) > 0 },
          { label: 'Education',             done: (cvData?.education?.length || 0) > 0 },
          { label: 'Skills',                done: (cvData?.skills?.length || 0) >= 3 },
        ].map(({ label, done }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: done ? 'rgba(0,200,150,0.15)' : 'var(--surface2)',
              border: `1.5px solid ${done ? 'var(--teal)' : 'var(--border2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: done ? 'var(--teal)' : 'var(--text3)',
            }}>
              {done ? '✓' : ''}
            </div>
            <span style={{ color: done ? 'var(--text)' : 'var(--text3)' }}>{label}</span>
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
export default function CVPreview({ cvData, previewHtml, templateConfig, initialTemplate, customTemplates = [], onTemplateChange, onConfigChange }) {
  const iframeRef = useRef(null)
  const allTemplates = [...TEMPLATES, ...customTemplates]
  const [activeTemplate, setActiveTemplate] = useState(initialTemplate || cvData?.selected_template || 'professional')
  const [localConfig, setLocalConfig] = useState(() => templateConfig || TEMPLATE_DEFAULTS[initialTemplate || cvData?.selected_template || 'professional'])

  // Returns the base HTML template key (for API calls) for any template key
  const getBaseKey = useCallback((key) => {
    const custom = customTemplates.find(t => t.key === key)
    return custom ? custom.baseKey : key
  }, [customTemplates])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [localHtml, setLocalHtml] = useState(previewHtml)
  const [dlStatus, setDlStatus] = useState({ pdf: 'idle', docx: 'idle' })
  const debounceRef = useRef(null)
  const autoPreviewRef = useRef(null)
  // Refs so the auto-preview effect always sees current template/config (no stale closure)
  const activeTemplateRef = useRef(activeTemplate)
  const localConfigRef = useRef(localConfig)
  useEffect(() => { activeTemplateRef.current = activeTemplate }, [activeTemplate])
  useEffect(() => { localConfigRef.current = localConfig }, [localConfig])

  const completion = cvData ? (() => {
    const checks = [
      !!cvData.full_name, !!cvData.email, !!cvData.professional_summary,
      (cvData.work_experience?.length || 0) > 0,
      (cvData.education?.length || 0) > 0,
      (cvData.skills?.length || 0) >= 3,
    ]
    return Math.round(checks.filter(Boolean).length / checks.length * 100)
  })() : 0

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

  // Sync external previewHtml (from orchestrator pipeline)
  useEffect(() => {
    if (previewHtml) setLocalHtml(previewHtml)
  }, [previewHtml])

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

  const handleTemplateChange = useCallback((key) => {
    const newCfg = TEMPLATE_DEFAULTS[getBaseKey(key)]
    setActiveTemplate(key)
    setLocalConfig(newCfg)
    onTemplateChange?.(key, newCfg)
    fetchPreview(cvData, key, newCfg)
  }, [cvData, fetchPreview, getBaseKey, onTemplateChange])

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
            {completion === 100 ? '✓ Ready to generate' : `${6 - Math.round(completion / 100 * 6)} fields remaining`}
          </div>
        </div>
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

      {/* Template selector row */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, overflowX: 'auto', alignItems: 'center',
      }}>
        {allTemplates.map(t => (
          <button key={t.key} onClick={() => handleTemplateChange(t.key)}
            style={{
              padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
              border: activeTemplate === t.key ? '1px solid var(--teal)' : '1px solid var(--border)',
              background: activeTemplate === t.key ? 'rgba(0,200,150,0.1)' : 'var(--surface2)',
              color: activeTemplate === t.key ? 'var(--teal)' : 'var(--text2)',
              fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s',
            }}>
            {t.label}
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 5 }}>{t.desc}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
      </div>


      {/* Preview area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#e8e8e8' }}>
        <iframe
          ref={iframeRef}
          title="CV Preview"
          sandbox="allow-same-origin"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: localHtml ? 'block' : 'none' }}
        />
        {!localHtml && (isEmpty ? <EmptyState /> : <WaitingState cvData={cvData} completion={completion} />)}
        {loadingPreview && <LoadingOverlay />}
      </div>
    </div>
  )
}
