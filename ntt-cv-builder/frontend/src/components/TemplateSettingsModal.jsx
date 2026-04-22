/**
 * components/TemplateSettingsModal.jsx
 * Modal for pre-configuring CV templates before or after uploading a CV.
 * Supports the 4 built-in templates and user-created custom templates.
 * Opens from the ⚙ gear in the Header.
 */
import { useState, useEffect, useCallback } from 'react'
import { TEMPLATES, TEMPLATE_DEFAULTS } from '../lib/templateDefaults'

const SECTIONS = [
  { key: 'show_summary',        label: 'Professional Summary' },
  { key: 'show_experience',     label: 'Work Experience' },
  { key: 'show_education',      label: 'Education' },
  { key: 'show_skills',         label: 'Skills' },
  { key: 'show_certifications', label: 'Certifications' },
  { key: 'show_languages',      label: 'Languages' },
  { key: 'show_achievements',   label: 'Key Achievements' },
  { key: 'show_awards',         label: 'Awards & Recognition' },
  { key: 'show_projects',       label: 'Projects' },
]

const BASE_DESCRIPTIONS = {
  minimal:   'Clean Georgia serif, monochrome. Best for academic or content-first CVs. Adjustable font size.',
  executive: 'Premium two-column with gold accents, achievements callout, and Projects section. EB Garamond headings.',
  postcard:  'NTT-branded profile card with decorative geometry and a two-column layout.',
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 8,
      background: checked ? 'rgba(0,200,150,0.06)' : 'var(--surface3)',
      border: `1px solid ${checked ? 'rgba(0,200,150,0.2)' : 'var(--border)'}`,
      cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
    }}>
      <span style={{ fontSize: 12.5, color: checked ? 'var(--text)' : 'var(--text2)', fontWeight: checked ? 500 : 400 }}>
        {label}
      </span>
      <div onClick={onChange} style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: checked ? 'var(--teal)' : 'var(--surface2)',
        border: `1px solid ${checked ? 'var(--teal)' : 'var(--border2)'}`,
        position: 'relative', transition: 'all 0.2s', cursor: 'pointer',
      }}>
        <div style={{
          position: 'absolute', top: 2,
          left: checked ? 18 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? '#fff' : 'var(--text3)',
          transition: 'left 0.2s',
        }} />
      </div>
    </label>
  )
}

function TemplateTab({ templateKey, baseKey, config, onChange, customLabel, customDesc }) {
  // baseKey is the HTML template to use; templateKey may differ for custom templates
  const effectiveBase = baseKey || templateKey
  const builtIn = TEMPLATES.find(t => t.key === templateKey)
  const label = customLabel || builtIn?.label || templateKey
  const desc = customDesc || BASE_DESCRIPTIONS[effectiveBase] || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Template description */}
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'var(--surface3)', border: '1px solid var(--border)',
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
          {baseKey && (
            <span style={{
              fontSize: 10, color: 'var(--teal)', fontWeight: 600,
              background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.25)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              based on {TEMPLATES.find(t => t.key === baseKey)?.label || baseKey}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
      </div>

      {/* Section toggles */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '4px 0 2px' }}>
        Sections
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SECTIONS.map(({ key, label: sLabel }) =>
          config[key] !== undefined ? (
            <Toggle
              key={key}
              checked={!!config[key]}
              label={sLabel}
              onChange={() => onChange(key, !config[key])}
            />
          ) : null
        )}
      </div>

      {/* Style options */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '8px 0 2px' }}>
        Style Options
      </div>

      {effectiveBase === 'minimal' && (
        <>
          <Toggle
            checked={!!config.compact_spacing}
            label="Compact line spacing"
            onChange={() => onChange('compact_spacing', !config.compact_spacing)}
          />
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--surface3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                Base Font Size — {config.font_size_pt || 10}pt
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>9pt (compact) → 12pt (spacious)</div>
            </div>
            <input type="range" min={9} max={12} step={1}
              value={config.font_size_pt || 10}
              onChange={e => onChange('font_size_pt', Number(e.target.value))}
              style={{ width: 80, accentColor: 'var(--teal)', cursor: 'pointer' }}
            />
          </div>
        </>
      )}

      {effectiveBase === 'executive' && (
        <Toggle
          checked={config.sidebar_dark !== false}
          label="Dark sidebar (uncheck for cream/light sidebar)"
          onChange={() => onChange('sidebar_dark', !config.sidebar_dark)}
        />
      )}

      {!['minimal', 'executive', 'postcard'].includes(effectiveBase) && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 12px', borderRadius: 8, background: 'var(--surface3)', border: '1px solid var(--border)' }}>
          No additional style options for this template.
        </div>
      )}
    </div>
  )
}

function AddTemplateForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [baseKey, setBaseKey] = useState('minimal')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter a template name.'); return }
    if (trimmed.length < 2) { setError('Name must be at least 2 characters.'); return }
    // Generate a unique key
    const slug = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const key = `custom_${slug}_${Date.now()}`
    onAdd({ key, label: trimmed, desc: desc.trim() || BASE_DESCRIPTIONS[baseKey], baseKey })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: '12px 14px', borderRadius: 8,
        background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', marginBottom: 4 }}>New Template</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
          Create a custom template by starting from one of the built-in layouts. You can then adjust its sections and style options independently.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Template Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          placeholder="e.g. My Tech CV"
          maxLength={40}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${error ? '#f43f5e' : 'var(--border2)'}`,
            background: 'var(--surface3)', color: 'var(--text)',
            outline: 'none', width: '100%',
          }}
        />
        {error && <div style={{ fontSize: 11, color: '#f43f5e' }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Short Description
        </label>
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Optional description (shown in template selector)"
          maxLength={80}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--border2)',
            background: 'var(--surface3)', color: 'var(--text)',
            outline: 'none', width: '100%',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Base Layout
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TEMPLATES.map(t => (
            <label key={t.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              background: baseKey === t.key ? 'rgba(0,200,150,0.08)' : 'var(--surface3)',
              border: `1px solid ${baseKey === t.key ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="baseKey"
                value={t.key}
                checked={baseKey === t.key}
                onChange={() => setBaseKey(t.key)}
                style={{ accentColor: 'var(--teal)', marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: baseKey === t.key ? 'var(--text)' : 'var(--text2)', marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                  {BASE_DESCRIPTIONS[t.key]}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border2)', background: 'var(--surface2)',
          color: 'var(--text3)', cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button type="submit" style={{
          padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--teal)',
          background: 'rgba(0,200,150,0.12)',
          color: 'var(--teal)', cursor: 'pointer',
        }}>
          Create Template
        </button>
      </div>
    </form>
  )
}

export default function TemplateSettingsModal({ open, onClose, configs, onConfigChange, customTemplates = [], onAddTemplate, onDeleteTemplate }) {
  const [activeTab, setActiveTab] = useState('minimal')
  const [showAddForm, setShowAddForm] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reset to first tab if active tab was deleted
  useEffect(() => {
    if (!open) return
    const allKeys = [...TEMPLATES.map(t => t.key), ...customTemplates.map(t => t.key)]
    if (!allKeys.includes(activeTab)) setActiveTab('minimal')
  }, [customTemplates, activeTab, open])

  if (!open) return null

  const handleChange = (key, value) => {
    onConfigChange(activeTab, { ...configs[activeTab], [key]: value })
  }

  const handleReset = () => {
    const custom = customTemplates.find(t => t.key === activeTab)
    const baseKey = custom ? custom.baseKey : activeTab
    onConfigChange(activeTab, { ...TEMPLATE_DEFAULTS[baseKey] })
  }

  const handleAdd = (templateData) => {
    onAddTemplate?.(templateData)
    setActiveTab(templateData.key)
    setShowAddForm(false)
  }

  const handleDelete = (key) => {
    onDeleteTemplate?.(key)
    setActiveTab('minimal')
  }

  const allTabs = [...TEMPLATES, ...customTemplates]
  const activeCustom = customTemplates.find(t => t.key === activeTab)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 540, maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)',
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>⚙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Template Settings</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Customise sections and style for each template</div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--surface2)', cursor: 'pointer', fontSize: 14,
            color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Template tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 16px 0',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0, background: 'var(--surface)',
          overflowX: 'auto', flexWrap: 'nowrap',
        }}>
          {allTabs.map(t => {
            const isCustom = !!customTemplates.find(c => c.key === t.key)
            const isActive = activeTab === t.key && !showAddForm
            return (
              <div key={t.key} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={() => { setActiveTab(t.key); setShowAddForm(false) }}
                  style={{
                    padding: isCustom ? '7px 22px 7px 14px' : '7px 14px',
                    borderRadius: '8px 8px 0 0', cursor: 'pointer',
                    border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    borderBottom: isActive ? '2px solid var(--surface)' : '1px solid transparent',
                    background: isActive ? 'var(--surface)' : 'transparent',
                    color: isActive ? 'var(--teal)' : 'var(--text3)',
                    fontSize: 12, fontWeight: isActive ? 700 : 400,
                    marginBottom: isActive ? -1 : 0,
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}>
                  {t.label}
                </button>
                {isCustom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.key) }}
                    title="Delete this template"
                    style={{
                      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 9,
                      color: isActive ? 'var(--teal)' : 'var(--text3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {/* Add template button */}
          <button
            onClick={() => setShowAddForm(true)}
            title="Add new template"
            style={{
              padding: '7px 12px',
              borderRadius: '8px 8px 0 0', cursor: 'pointer',
              border: showAddForm ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: showAddForm ? '2px solid var(--surface)' : '1px solid transparent',
              background: showAddForm ? 'var(--surface)' : 'transparent',
              color: showAddForm ? 'var(--teal)' : 'var(--text3)',
              fontSize: 16, fontWeight: 400,
              marginBottom: showAddForm ? -1 : 0,
              transition: 'all 0.15s',
            }}
          >
            +
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {showAddForm ? (
            <AddTemplateForm
              onAdd={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <TemplateTab
              templateKey={activeTab}
              baseKey={activeCustom?.baseKey || null}
              customLabel={activeCustom?.label || null}
              customDesc={activeCustom?.desc || null}
              config={configs[activeTab] || TEMPLATE_DEFAULTS[activeCustom?.baseKey || activeTab]}
              onChange={handleChange}
            />
          )}
        </div>

        {/* Modal footer */}
        {!showAddForm && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            background: 'var(--surface)',
          }}>
            <button onClick={handleReset} style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
              border: '1px solid var(--border2)', background: 'var(--surface2)',
              color: 'var(--text3)', cursor: 'pointer',
            }}>
              Reset to defaults
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Settings apply to preview and exports
            </div>
            <button onClick={onClose} style={{
              padding: '6px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--teal)',
              background: 'rgba(0,200,150,0.12)',
              color: 'var(--teal)', cursor: 'pointer',
            }}>
              Done
            </button>
          </div>
        )}
      </div>
    </>
  )
}
