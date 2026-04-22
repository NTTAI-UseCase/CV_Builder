/**
 * components/ShortlistModal.jsx
 * Skill-shortlisting modal. Accepts a list of required skills, calls
 * POST /api/shortlist, and shows a structured match table + recommendation.
 */
import { useState, useEffect, useRef } from 'react'
import { shortlistCV } from '../lib/api.js'

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
}

const PANEL = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  width: '100%', maxWidth: 900,
  maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  overflow: 'hidden',
}

export default function ShortlistModal({ cvData, onClose }) {
  const [skillsText, setSkillsText] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const skills = skillsText
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)

  const handleRun = async () => {
    if (!skills.length) return
    setStatus('loading')
    setResult(null)
    setError(null)
    try {
      const data = await shortlistCV(cvData, skills)
      setResult(data)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const matchedCount = result?.results?.filter(r => r.matched).length ?? 0
  const totalCount   = result?.results?.length ?? 0

  return (
    <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={PANEL}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)', flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--teal)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🎯</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              Smart Search & Match
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {cvData?.full_name
                ? `Evaluating ${cvData.full_name}'s CV against your required skills, domain, etc.`
                : 'Evaluate the CV against a required skill set'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text3)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Skills input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)',
              letterSpacing: '0.6px', textTransform: 'uppercase', display: 'block',
              marginBottom: 6 }}>
              Required Skills / Search For
            </label>
            <textarea
              ref={textareaRef}
              value={skillsText}
              onChange={e => setSkillsText(e.target.value)}
              placeholder="Enter skills — one per line or comma-separated&#10;&#10;e.g.&#10;Python&#10;Machine Learning&#10;AWS, Docker&#10;LangChain"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border2)',
                background: 'var(--bg)', color: 'var(--text)',
                fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
                resize: 'vertical', outline: 'none',
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {skills.length} skill{skills.length !== 1 ? 's' : ''} entered
                {skills.length > 40 && (
                  <span style={{ color: '#f87171', marginLeft: 8 }}>— max 40</span>
                )}
              </span>
              <button
                onClick={handleRun}
                disabled={!skills.length || skills.length > 40 || status === 'loading'}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: skills.length && skills.length <= 40 ? 'var(--teal)' : 'var(--surface3)',
                  color: '#fff', border: 'none', cursor: skills.length ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: 600,
                  opacity: status === 'loading' ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {status === 'loading' ? 'Searching…' : '▶ Find Matches'}
              </button>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '20px', borderRadius: 10,
              background: 'var(--surface2)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 20, height: 20, border: '2px solid var(--border2)',
                borderTopColor: 'var(--teal)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Analysing CV against {skills.length} skill{skills.length !== 1 ? 's' : ''}…
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  AI is reviewing the resume text
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Results */}
          {status === 'done' && result && (
            <div>
              {/* Summary bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                background: matchedCount === totalCount
                  ? 'rgba(0,200,150,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${matchedCount === totalCount
                  ? 'rgba(0,200,150,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>
                <div style={{
                  fontSize: 28, fontWeight: 700,
                  color: matchedCount === totalCount ? 'var(--teal)' : '#f59e0b',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {matchedCount}/{totalCount}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Skills matched
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {Math.round(matchedCount / totalCount * 100)}% match rate
                  </div>
                </div>

                {/* Mini bar chart */}
                <div style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: 'var(--surface3)', overflow: 'hidden', marginLeft: 8,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.round(matchedCount / totalCount * 100)}%`,
                    background: matchedCount === totalCount ? 'var(--teal)' : '#f59e0b',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* Table */}
              <div style={{
                borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border)', marginBottom: 16,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Skill', 'Matched', 'Evidence', 'Exp. (yrs)', 'Notes'].map(h => (
                        <th key={h} style={{
                          padding: '9px 12px', textAlign: 'left',
                          fontWeight: 700, color: 'var(--text2)',
                          fontSize: 10.5, letterSpacing: '0.6px',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, i) => (
                      <tr key={i} style={{
                        background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {/* Skill */}
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                          {row.skill}
                        </td>
                        {/* Matched */}
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: row.matched ? 'rgba(0,200,150,0.12)' : 'rgba(248,113,113,0.1)',
                            color: row.matched ? 'var(--teal)' : '#f87171',
                            border: `1px solid ${row.matched ? 'rgba(0,200,150,0.3)' : 'rgba(248,113,113,0.25)'}`,
                          }}>
                            {row.matched ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                        {/* Evidence */}
                        <td style={{ padding: '9px 12px', color: 'var(--text2)', maxWidth: 280 }}>
                          {row.evidence?.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: 14 }}>
                              {row.evidence.map((e, j) => (
                                <li key={j} style={{
                                  marginBottom: 3, fontStyle: 'italic',
                                  color: 'var(--text2)', lineHeight: 1.4,
                                }}>
                                  "{e}"
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        {/* Years */}
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          {row.years_experience_estimate != null ? (
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 700, color: 'var(--teal)', fontSize: 13,
                            }}>
                              {row.years_experience_estimate}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text3)' }}>—</span>
                          )}
                        </td>
                        {/* Notes */}
                        <td style={{ padding: '9px 12px', color: 'var(--text3)', maxWidth: 220, lineHeight: 1.5 }}>
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recommendation */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--teal)',
                  letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Fitment Recommendation
                </div>
                <p style={{
                  margin: 0, fontSize: 13, color: 'var(--text)',
                  lineHeight: 1.7, whiteSpace: 'pre-wrap',
                }}>
                  {result.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface2)', flexShrink: 0,
        }}>
          {status === 'done' && (
            <button
              onClick={() => { setStatus('idle'); setResult(null); setSkillsText('') }}
              style={{
                padding: '7px 16px', borderRadius: 7, cursor: 'pointer',
                border: '1px solid var(--border2)',
                background: 'var(--surface3)', color: 'var(--text2)', fontSize: 12,
              }}
            >
              Reset
            </button>
          )}
          <button onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 7, cursor: 'pointer',
            border: '1px solid var(--border2)',
            background: 'var(--surface)', color: 'var(--text2)', fontSize: 12,
          }}>
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
