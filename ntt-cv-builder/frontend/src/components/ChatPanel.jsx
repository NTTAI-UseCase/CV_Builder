/**
 * components/ChatPanel.jsx
 * The left-hand chat interface.
 * Renders the conversation history and handles user input.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import UploadZone from './UploadZone.jsx'
import CVStatusCard from './CVStatusCard.jsx'

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--teal)',
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div style={{
        margin: '6px 12px',
        padding: '8px 12px',
        borderRadius: 8,
        background: msg.type === 'error'
          ? 'rgba(244,63,94,0.1)'
          : msg.type === 'progress'
          ? 'rgba(0,200,150,0.08)'
          : 'var(--surface3)',
        border: `1px solid ${
          msg.type === 'error' ? 'rgba(244,63,94,0.25)' :
          msg.type === 'progress' ? 'rgba(0,200,150,0.2)' :
          'var(--border)'}`,
        fontSize: 12,
        color: msg.type === 'error' ? '#fb7185' :
               msg.type === 'progress' ? 'var(--teal)' : 'var(--text2)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {msg.type === 'progress' && (
          <div style={{
            width: 12, height: 12, border: '1.5px solid var(--surface3)',
            borderTopColor: 'var(--teal)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', flexShrink: 0,
          }} />
        )}
        {msg.type === 'error' && <span>⚠</span>}
        <span>{msg.content}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10,
      padding: '4px 12px',
      animation: 'fadeUp 0.3s ease both',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'rgba(99,102,241,0.2)' : 'rgba(0,200,150,0.15)',
        border: `1.5px solid ${isUser ? 'rgba(99,102,241,0.4)' : 'rgba(0,200,150,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12,
      }}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '82%',
        padding: '10px 13px',
        borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
        background: isUser ? 'var(--user-msg)' : 'var(--ai-msg)',
        border: `1px solid ${isUser ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
        fontSize: 13.5,
        color: 'var(--text)',
        lineHeight: 1.55,
      }}>
        {msg.typing ? (
          <TypingIndicator />
        ) : isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        ) : (
          <div className="md-content">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

function StageChip({ stage }) {
  const stages = {
    greeting:    { label: 'Getting started', color: '#6366f1' },
    collecting:  { label: 'Collecting info', color: '#f59e0b' },
    validating:  { label: 'Validating', color: '#f59e0b' },
    template:    { label: 'Choose template', color: '#0ea5e9' },
    preview:     { label: 'Preview ready', color: '#00c896' },
    generating:  { label: 'Generating CV...', color: '#00c896' },
    done:        { label: 'CV complete ✓', color: '#00c896' },
  }
  const s = stages[stage] || stages.greeting
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 20,
      background: `${s.color}15`,
      border: `1px solid ${s.color}40`,
      fontSize: 10.5, fontWeight: 600,
      color: s.color,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '0.3px',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`,
        animation: stage === 'generating' ? 'pulse 1s ease infinite' : 'none',
      }} />
      {s.label}
    </div>
  )
}


export default function ChatPanel({
  messages,
  stage,
  sessionId,
  connected,
  onSend,
  onUploadComplete,
  onClearChat,
  onNewChat,
  isThinking,
  voice,
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const [uploadError, setUploadError] = useState('')

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // When mic stops, move transcript into the input box
  useEffect(() => {
    if (voice && !voice.isListening && voice.transcript) {
      setInput(voice.transcript)
      voice.clearTranscript()
      textareaRef.current?.focus()
    }
  }, [voice?.isListening, voice?.transcript])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !connected || isThinking) return
    onSend(text)
    setInput('')
    textareaRef.current?.focus()
  }, [input, connected, isThinking, onSend])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleUploadComplete = (result) => {
    setUploadError('')
    onUploadComplete?.(result)
  }

  // Quick reply chips shown in greeting stage
  const quickReplies = stage === 'greeting' ? [
    'I want to start fresh',
    "I'll upload my CV",
    "Let's get started!",
  ] : []

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      width: 'var(--chat-w)',
      minWidth: 'var(--chat-w)',
      maxWidth: 'var(--chat-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
    }}>

      {/* Upload zone + action buttons */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ padding: '8px 12px 0' }}>
          <UploadZone
            sessionId={sessionId}
            onUploadComplete={handleUploadComplete}
            onError={setUploadError}
          />
        </div>
        {uploadError && (
          <div style={{ margin: '-4px 12px 4px', fontSize: 11, color: '#fb7185', padding: '4px 8px' }}>
            ⚠ {uploadError}
          </div>
        )}
        {/* Chat action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px' }}>
          <button
            onClick={onClearChat}
            title="Clear chat messages (keeps CV data)"
            style={{
              flex: 1, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--text2)', cursor: 'pointer',
            }}
          >
            🗑 Clear Chat
          </button>
          <button
            onClick={onNewChat}
            title="Start a completely new session"
            style={{
              flex: 1, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--text2)', cursor: 'pointer',
            }}
          >
            ＋ New Chat
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

      {/* Messages */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'scroll',
        overflowX: 'hidden',
        padding: '12px 0 8px',
        scrollbarWidth: 'auto',
        scrollbarColor: 'var(--scrollbar-thumb) var(--surface3)',
      }}>
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {isThinking && (
          <div style={{ padding: '4px 12px', display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(0,200,150,0.15)',
              border: '1.5px solid rgba(0,200,150,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}>🤖</div>
            <div style={{
              padding: '10px 13px', borderRadius: '4px 14px 14px 14px',
              background: 'var(--ai-msg)', border: '1px solid var(--border)',
            }}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {/* Quick replies */}
        {quickReplies.length > 0 && !isThinking && (
          <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickReplies.map(r => (
              <button
                key={r}
                onClick={() => { onSend(r) }}
                style={{
                  padding: '6px 13px', borderRadius: 20,
                  border: '1px solid var(--border2)',
                  background: 'var(--surface2)',
                  color: 'var(--text2)', fontSize: 12.5,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, padding: '10px 12px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--surface2)',
          border: `1px solid ${connected ? 'var(--border2)' : 'var(--border)'}`,
          borderRadius: 12, padding: '8px 8px 8px 14px',
          transition: 'border-color 0.2s',
        }}
          onFocus={() => {}}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              voice?.isListening
                ? '🎤 Listening…'
                : connected ? 'Type or speak your message… (Enter to send)' : 'Connecting…'
            }
            disabled={!connected || isThinking}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13.5, lineHeight: 1.5,
              resize: 'none', minHeight: 24, maxHeight: 120,
              fontFamily: 'inherit',
              overflowY: 'auto',
            }}
          />

          {/* Mic button */}
          {voice?.inputSupported && (
            <button
              onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
              disabled={!connected || isThinking}
              title={voice.isListening ? 'Stop recording' : 'Speak your message'}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: voice.isListening ? 'rgba(244,63,94,0.15)' : 'var(--surface3)',
                border: `1px solid ${voice.isListening ? 'rgba(244,63,94,0.5)' : 'var(--border)'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                animation: voice.isListening ? 'pulse 1s ease infinite' : 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={voice.isListening ? '#f43f5e' : 'var(--text2)'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!connected || isThinking || !input.trim()}
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: input.trim() && connected && !isThinking
                ? 'var(--teal)' : 'var(--surface3)',
              border: 'none', cursor: input.trim() && connected && !isThinking ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: 'white',
              transition: 'all 0.2s',
              transform: input.trim() && !isThinking ? 'scale(1)' : 'scale(0.92)',
            }}
          >
            {isThinking ? (
              <div style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : '↑'}
          </button>
        </div>

        {/* Hint bar */}
        <div style={{
          marginTop: 6, fontSize: 10.5, color: 'var(--text3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span>Shift+Enter for new line</span>

          {/* Auto-speak toggle */}
          {voice?.outputSupported && (
            <button
              onClick={voice.toggleAutoSpeak}
              title={voice.autoSpeak ? 'Mute AI replies' : 'Read AI replies aloud'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: voice.autoSpeak ? 'var(--teal)' : 'var(--text3)',
                fontSize: 10.5, fontFamily: 'inherit',
                transition: 'color 0.2s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {voice.autoSpeak ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </>
                )}
              </svg>
              {voice.autoSpeak ? 'Voice on' : 'Voice off'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
