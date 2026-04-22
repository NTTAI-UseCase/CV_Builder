/**
 * components/PreviewPanel.jsx
 * Right-hand panel. Wraps CVPreview with the full download bar
 * and handles the "generating" loading state.
 */
import { useState, useCallback } from 'react'
import CVPreview from './CVPreview'
import { downloadPDF, downloadDOCX, triggerDownload } from '../lib/api'
import { TEMPLATE_DEFAULTS } from '../lib/templateDefaults'

export default function PreviewPanel({ cvData, previewHtml, downloads, stage, templateConfigs, activeTemplate: activeTemplateProp, customTemplates, onTemplateChange, onConfigChange, onEditSection, onSectionEdit }) {
  const [dlStatus, setDlStatus] = useState({ pdf: 'idle', docx: 'idle', json: 'idle' })
  const activeTemplate = activeTemplateProp || 'minimal'
  const templateConfig = (templateConfigs || TEMPLATE_DEFAULTS)[activeTemplate] || TEMPLATE_DEFAULTS[activeTemplate]

  const handleDownload = useCallback(async (type) => {
    if (!cvData) return
    setDlStatus(s => ({ ...s, [type]: 'loading' }))
    try {
      const cvWithTemplate = { ...cvData, selected_template: activeTemplate }
      const stem = (cvData.full_name || 'cv').replace(/\s+/g, '_').toLowerCase()

      if (type === 'pdf') {
        // Prefer pre-generated base64 if available
        if (downloads?.pdf_b64) {
          const bytes = Uint8Array.from(atob(downloads.pdf_b64), c => c.charCodeAt(0))
          const blob = new Blob([bytes], { type: 'application/pdf' })
          triggerDownload(blob, `${stem}_cv.pdf`)
        } else {
          const blob = await downloadPDF(cvWithTemplate, templateConfig)
          triggerDownload(blob, `${stem}_cv.pdf`)
        }
      } else if (type === 'docx') {
        if (downloads?.docx_b64) {
          const bytes = Uint8Array.from(atob(downloads.docx_b64), c => c.charCodeAt(0))
          const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })
          triggerDownload(blob, `${stem}_cv.docx`)
        } else {
          const blob = await downloadDOCX(cvWithTemplate)
          triggerDownload(blob, `${stem}_cv.docx`)
        }
      } else if (type === 'json') {
        const payload = downloads?.json || cvData
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        triggerDownload(blob, `${stem}_cv.json`)
      }

      setDlStatus(s => ({ ...s, [type]: 'done' }))
      setTimeout(() => setDlStatus(s => ({ ...s, [type]: 'idle' })), 2500)
    } catch (e) {
      console.error('Download failed', e)
      setDlStatus(s => ({ ...s, [type]: 'error' }))
      setTimeout(() => setDlStatus(s => ({ ...s, [type]: 'idle' })), 2500)
    }
  }, [cvData, activeTemplate, templateConfig, downloads, onTemplateChange, onConfigChange])

  if (stage === 'generating') {
    return <GeneratingState />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* CV Preview (contains its own header with export + template selector) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CVPreview
          cvData={cvData}
          previewHtml={previewHtml}
          templateConfig={templateConfig}
          templateConfigs={templateConfigs}
          initialTemplate={activeTemplate}
          customTemplates={customTemplates}
          onTemplateChange={onTemplateChange}
          onConfigChange={onConfigChange}
          onEditSection={onEditSection}
          onSectionEdit={onSectionEdit}
        />
      </div>
    </div>
  )
}


function GeneratingState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 24,
      background: 'var(--bg)',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Animated rings */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            inset: i * 10,
            borderRadius: '50%',
            border: `2px solid rgba(0,200,150,${0.6 - i * 0.18})`,
            animation: `spin ${1.2 + i * 0.4}s linear infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ✨
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          Generating your CV
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
          Enriching with best-practice content…<br />
          Rendering PDF and Word document…
        </div>
      </div>
    </div>
  )
}
