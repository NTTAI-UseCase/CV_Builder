/**
 * App.jsx
 * Root component. Manages session lifecycle, routes WebSocket events
 * to the right state slices, and renders the two-panel layout.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useVoice } from './hooks/useVoice'
import { createSession } from './lib/api'
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import Header from './components/Header'
import TemplateSettingsModal from './components/TemplateSettingsModal'
import { TEMPLATE_DEFAULTS } from './lib/templateDefaults'
import { ErrorBoundary } from './main.jsx'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [cvData, setCvData] = useState(null)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [downloads, setDownloads] = useState(null)
  const [stage, setStage] = useState('greeting')
  const [isThinking, setIsThinking] = useState(false)
  const [validationData, setValidationData] = useState(null)
  const [progress, setProgress] = useState(null)
  const [theme, setTheme] = useState(() => sessionStorage.getItem('cv_theme') || 'light')
  const [customiseOpen, setCustomiseOpen] = useState(false)
  const [templateConfigs, setTemplateConfigs] = useState({ ...TEMPLATE_DEFAULTS })
  const [activeTemplate, setActiveTemplate] = useState('professional')
  const [customTemplates, setCustomTemplates] = useState([])
  const voice = useVoice()

  // Apply theme to <html> so CSS [data-theme] selector works
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      sessionStorage.setItem('cv_theme', next)
      return next
    })
  }, [])

  // Init session on mount — persist in sessionStorage so StrictMode double-mount
  // and hot-reloads reuse the same session instead of creating a new one.
  useEffect(() => {
    const existing = sessionStorage.getItem('cv_session_id')
    if (existing) {
      setSessionId(existing)
    } else {
      createSession()
        .then(id => {
          sessionStorage.setItem('cv_session_id', id)
          setSessionId(id)
        })
        .catch(err => console.error('Session init failed', err))
    }
  }, [])

  // Route WebSocket server events → state
  const handleEvent = useCallback((event) => {
    const { type, data } = event

    switch (type) {
      case 'message':
        setIsThinking(false)
        setMessages(prev => [...prev, { role: 'assistant', content: data, id: Date.now() }])
        voice.speak(data)
        break

      case 'cv_update':
        setCvData(data)
        break

      case 'stage':
        setStage(data)
        break

      case 'preview':
        setPreviewHtml(data)
        setStage('preview')
        break

      case 'downloads_ready':
        setDownloads(data)
        setStage('done')
        setIsThinking(false)
        break

      case 'progress':
        setIsThinking(false)
        setProgress(data)
        break

      case 'validation':
        setValidationData(data)
        break

      case 'error':
        setIsThinking(false)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${data}`,
          id: Date.now(),
          isError: true,
        }])
        break

      case 'ping':
        // Server keepalive ping — absorb silently (no state change needed)
        break

      default:
        break
    }
  }, [])

  const { connected, send } = useWebSocket({ sessionId, onEvent: handleEvent })

  const sendMessage = useCallback((text) => {
    if (!text.trim() || !connected) return
    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }])
    setIsThinking(true)
    setProgress(null)
    send('message', text)
  }, [connected, send])

  const handleUploadComplete = useCallback(() => {
    // The backend will send cv_update + message events over the WebSocket.
    // Just show the thinking indicator so the user knows processing is in progress.
    setIsThinking(true)
  }, [])

  const handleClearChat = useCallback(() => {
    setMessages([])
    setProgress(null)
    setIsThinking(false)
  }, [])

  const handleNewChat = useCallback(() => {
    sessionStorage.removeItem('cv_session_id')
    window.location.reload()
  }, [])

  const showPreviewPanel = previewHtml || downloads || cvData?.full_name || (cvData && stage !== 'greeting')

  const handleTemplateConfigChange = useCallback((templateKey, newConfig) => {
    setTemplateConfigs(prev => ({ ...prev, [templateKey]: newConfig }))
  }, [])

  const handleAddTemplate = useCallback(({ key, label, desc, baseKey }) => {
    setCustomTemplates(prev => [...prev, { key, label, desc, baseKey }])
    setTemplateConfigs(prev => ({ ...prev, [key]: { ...TEMPLATE_DEFAULTS[baseKey] } }))
  }, [])

  const handleDeleteTemplate = useCallback((key) => {
    setCustomTemplates(prev => prev.filter(t => t.key !== key))
    setTemplateConfigs(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setActiveTemplate(prev => (prev === key ? 'professional' : prev))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header connected={connected} theme={theme} onToggleTheme={toggleTheme}
        onCustomise={() => setCustomiseOpen(v => !v)} customiseActive={customiseOpen}
        cvData={cvData} />

      <TemplateSettingsModal
        open={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        configs={templateConfigs}
        onConfigChange={handleTemplateConfigChange}
        customTemplates={customTemplates}
        onAddTemplate={handleAddTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: showPreviewPanel ? 'var(--chat-w) 1fr' : '1fr',
        overflow: 'hidden',
        transition: 'grid-template-columns 0.4s ease',
      }}>
        <ChatPanel
          messages={messages}
          isThinking={isThinking}
          progress={progress}
          connected={connected}
          sessionId={sessionId}
          onSend={sendMessage}
          onUploadComplete={handleUploadComplete}
          onClearChat={handleClearChat}
          onNewChat={handleNewChat}
          validationData={validationData}
          stage={stage}
          voice={voice}
        />

        {showPreviewPanel && (
          <ErrorBoundary fallback={(err) => (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text3)', background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Preview panel crashed</div>
              <pre style={{ fontSize: 11, color: '#f87171', maxWidth: 400, whiteSpace: 'pre-wrap', textAlign: 'center' }}>{err.message}</pre>
            </div>
          )}>
          <PreviewPanel
            cvData={cvData}
            previewHtml={previewHtml}
            downloads={downloads}
            stage={stage}
            templateConfigs={templateConfigs}
            activeTemplate={activeTemplate}
            customTemplates={customTemplates}
            onTemplateChange={(key, cfg) => {
              setActiveTemplate(key)
              if (cfg) handleTemplateConfigChange(key, cfg)
            }}
            onConfigChange={(cfg) => handleTemplateConfigChange(activeTemplate, cfg)}
          />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
