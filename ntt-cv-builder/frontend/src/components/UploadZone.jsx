/**
 * components/UploadZone.jsx
 * Drag-and-drop CV file upload area.
 * Accepts PDF and DOCX, shows upload progress.
 */
import { useState, useRef, useCallback } from 'react'
import { uploadCV } from '../lib/api.js'

export default function UploadZone({ sessionId, onUploadComplete, onError }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword']
    const ext = file.name.toLowerCase()
    if (!allowed.includes(file.type) && !ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.doc')) {
      onError?.('Please upload a PDF or Word (.docx) file.')
      return
    }

    setUploading(true)
    setProgress('Reading file...')

    try {
      setProgress('Extracting CV data with AI...')
      const result = await uploadCV(file, sessionId)
      setProgress('Done!')
      setTimeout(() => {
        setUploading(false)
        setProgress('')
        onUploadComplete?.(result)
      }, 600)
    } catch (e) {
      setUploading(false)
      setProgress('')
      onError?.(e.message || 'Upload failed. Please try again.')
    }
  }, [sessionId, onUploadComplete, onError])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{
        margin: 0,
        padding: '14px 16px',
        borderRadius: 10,
        border: `1.5px dashed ${dragging ? 'var(--teal)' : 'var(--border2)'}`,
        background: dragging ? 'rgba(0,200,150,0.06)' : 'var(--surface2)',
        cursor: uploading ? 'default' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: dragging ? 'rgba(0,200,150,0.15)' : 'var(--surface3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {uploading ? (
          <div style={{
            width: 16, height: 16, border: '2px solid var(--surface3)',
            borderTopColor: 'var(--teal)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        ) : '📎'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {uploading ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginBottom: 2 }}>
              {progress}
            </div>
            <div style={{
              height: 3, borderRadius: 2, background: 'var(--surface3)',
              overflow: 'hidden', marginTop: 4,
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, var(--teal), #00a8d4)',
                animation: 'shimmer 1.5s ease infinite',
                backgroundSize: '400px 100%',
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>
              Upload existing CV
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              PDF or DOCX · up to 10MB · drag & drop or click
            </div>
          </>
        )}
      </div>
    </div>
  )
}
