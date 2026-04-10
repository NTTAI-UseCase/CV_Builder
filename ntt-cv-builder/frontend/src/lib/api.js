/**
 * lib/api.js
 * HTTP API calls to the FastAPI backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/** Create a new session ID from the server */
export async function createSession() {
  const res = await fetch(`${API_BASE}/session/new`)
  if (!res.ok) throw new Error('Failed to create session')
  const data = await res.json()
  return data.session_id
}

/** Upload a CV file (PDF or DOCX) */
export async function uploadCV(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

/** Download a PDF from cv data with optional template config */
export async function downloadPDF(cvData, templateConfig = {}) {
  const res = await fetch(`${API_BASE}/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cv: cvData, config: templateConfig }),
  })
  if (!res.ok) throw new Error('PDF generation failed')
  return res.blob()
}

/** Download a DOCX from cv data */
export async function downloadDOCX(cvData) {
  const res = await fetch(`${API_BASE}/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cvData),
  })
  if (!res.ok) throw new Error('DOCX generation failed')
  const blob = await res.blob()
  return blob
}

/** Get HTML preview of the CV with optional template config */
export async function getPreview(cvData, templateConfig = {}) {
  const res = await fetch(`${API_BASE}/export/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cv: cvData, config: templateConfig }),
  })
  if (!res.ok) throw new Error('Preview failed')
  const data = await res.json()
  return data.html
}

/** Trigger a file download in the browser */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
