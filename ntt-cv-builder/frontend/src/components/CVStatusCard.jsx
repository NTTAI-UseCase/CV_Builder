/**
 * components/CVStatusCard.jsx
 * Compact card shown in the chat panel showing what's been collected so far.
 * Updates in real-time as the CV data changes.
 */

const FIELDS = [
  { key: 'name',       label: 'Name',              check: cv => !!cv.full_name },
  { key: 'email',      label: 'Email',             check: cv => !!cv.email },
  { key: 'summary',    label: 'Summary',           check: cv => !!cv.professional_summary },
  { key: 'experience', label: 'Work experience',   check: cv => (cv.work_experience?.length || 0) > 0 },
  { key: 'education',  label: 'Education',         check: cv => (cv.education?.length || 0) > 0 },
  { key: 'skills',     label: 'Skills (3+)',       check: cv => (cv.skills?.length || 0) >= 3 },
]

export default function CVStatusCard({ cvData, validationData }) {
  if (!cvData) return null

  const results = FIELDS.map(f => ({ ...f, done: f.check(cvData) }))
  const doneCount = results.filter(r => r.done).length
  const pct = Math.round(doneCount / results.length * 100)

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 11,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
          textTransform: 'uppercase', color: 'var(--text3)',
        }}>
          CV Progress
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, fontWeight: 700,
          color: pct === 100 ? 'var(--teal)' : 'var(--text2)',
        }}>
          {doneCount}/{results.length} · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, borderRadius: 2,
        background: 'var(--surface3)',
        marginBottom: 8, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 2,
          background: pct === 100 ? 'var(--teal)' : 'linear-gradient(90deg, #4a90d9, var(--teal))',
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Field checklist — 2 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 12px',
      }}>
        {results.map(r => (
          <div key={r.key} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: r.done ? 'var(--text)' : 'var(--text3)',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: r.done ? 'rgba(0,200,150,0.15)' : 'var(--surface3)',
              border: `1.5px solid ${r.done ? 'var(--teal)' : 'var(--border2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: 'var(--teal)',
            }}>
              {r.done ? '✓' : ''}
            </div>
            <span style={{ fontSize: 10.5 }}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Blocking issues from validation agent */}
      {validationData?.blocking_issues?.length > 0 && (
        <div style={{
          marginTop: 8, padding: '6px 8px',
          background: 'rgba(244,63,94,0.06)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 6, fontSize: 10, color: '#fb7185',
        }}>
          ⚠ Missing: {validationData.missing_fields?.join(', ')}
        </div>
      )}

      {/* Done state */}
      {pct === 100 && (
        <div style={{
          marginTop: 8, padding: '6px 8px',
          background: 'rgba(0,200,150,0.08)',
          border: '1px solid rgba(0,200,150,0.2)',
          borderRadius: 6, fontSize: 10, color: 'var(--teal)',
          textAlign: 'center', fontWeight: 600,
        }}>
          ✓ All required sections complete
        </div>
      )}
    </div>
  )
}
