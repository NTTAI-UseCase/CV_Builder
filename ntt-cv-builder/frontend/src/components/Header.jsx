/**
 * components/Header.jsx
 * Bold redesigned top navigation bar with NTT DATA logo, progress bar, and controls.
 */

function calcCompletion(cvData) {
  if (!cvData) return 0
  const checks = [
    !!cvData.full_name,
    !!cvData.email,
    !!cvData.professional_summary,
    (cvData.work_experience?.length || 0) > 0,
    (cvData.education?.length || 0) > 0,
    (cvData.skills?.length || 0) >= 3,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

function progressColor(pct) {
  if (pct === 100) return '#00c896'
  if (pct >= 60)  return '#f59e0b'
  return '#6366f1'
}

function progressLabel(pct, cvData) {
  if (pct === 0)   return 'Start building CV'
  if (pct === 100) return 'CV complete — ready to export'
  const remaining = 6 - Math.round(pct / 100 * 6)
  return `${cvData?.full_name ? cvData.full_name + ' · ' : ''}${pct}% · ${remaining} section${remaining !== 1 ? 's' : ''} remaining`
}

export default function Header({ connected, theme, onToggleTheme, onCustomise, customiseActive, cvData }) {
  const pct = calcCompletion(cvData)
  const color = progressColor(pct)

  return (
    <header style={{
      height: 64,
      background: theme === 'dark'
        ? 'linear-gradient(135deg, #050d1a 0%, #0a1628 60%, #0d1f38 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #f0f6ff 60%, #e8f0fe 100%)',
      borderBottom: theme === 'dark'
        ? '1px solid rgba(0,100,204,0.35)'
        : '1px solid rgba(0,100,204,0.18)',
      boxShadow: theme === 'dark'
        ? '0 2px 20px rgba(0,50,150,0.4)'
        : '0 2px 16px rgba(0,80,200,0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 20,
      flexShrink: 0,
      zIndex: 10,
    }}>

      {/* NTT DATA Logo */}
      <img
        src="/ntt-data.png"
        alt="NTT DATA"
        style={{ height: 34, width: 'auto', flexShrink: 0 }}
      />

      {/* Divider */}
      <div style={{
        width: 1, height: 32, flexShrink: 0,
        background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,100,204,0.2)',
      }} />

      {/* App subtitle */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: theme === 'dark' ? '#e8edf5' : '#0a1628',
          lineHeight: 1.2, letterSpacing: '0.2px',
        }}>
          SMART CV BUILDER
        </div>
        <div style={{
          fontSize: 9.5, fontWeight: 500,
          color: theme === 'dark' ? 'rgba(0,200,150,0.8)' : '#0066cc',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '1.2px', textTransform: 'uppercase',
        }}>
          AI-POWERED
        </div>
      </div>

      {/* Progress bar — flex 1 to fill space */}
      <div style={{ flex: 1, minWidth: 0, padding: '0 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 5,
        }}>
          <span style={{
            fontSize: 10.5, fontWeight: 600,
            color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,30,80,0.55)',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.3px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {progressLabel(pct, cvData)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color, marginLeft: 12, flexShrink: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {pct > 0 ? `${pct}%` : ''}
          </span>
        </div>

        {/* Track */}
        <div style={{
          height: 6, borderRadius: 4,
          background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,80,200,0.1)',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 4,
            background: pct === 0 ? 'transparent'
              : pct === 100
                ? 'linear-gradient(90deg, #00a87c, #00c896)'
                : pct >= 60
                  ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                  : 'linear-gradient(90deg, #4338ca, #6366f1)',
            transition: 'width 0.6s ease, background 0.4s ease',
            boxShadow: pct > 0 ? `0 0 8px ${color}60` : 'none',
          }} />
        </div>
      </div>

      {/* Customise gear button */}
      {onCustomise && (
        <button
          onClick={onCustomise}
          title="Customise templates"
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: customiseActive
              ? 'rgba(0,102,204,0.2)'
              : theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,102,204,0.08)',
            border: customiseActive
              ? '1px solid rgba(0,102,204,0.6)'
              : theme === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,102,204,0.2)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, transition: 'all 0.2s',
            color: customiseActive ? '#0066cc' : theme === 'dark' ? '#b0baca' : '#334155',
          }}
        >
          ⚙
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,102,204,0.08)',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,102,204,0.2)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, transition: 'all 0.2s',
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: '5px 10px', borderRadius: 8,
        background: connected
          ? theme === 'dark' ? 'rgba(0,200,150,0.1)' : 'rgba(0,168,124,0.08)'
          : theme === 'dark' ? 'rgba(244,63,94,0.1)' : 'rgba(225,29,72,0.08)',
        border: `1px solid ${connected
          ? theme === 'dark' ? 'rgba(0,200,150,0.25)' : 'rgba(0,168,124,0.25)'
          : theme === 'dark' ? 'rgba(244,63,94,0.25)' : 'rgba(225,29,72,0.25)'}`,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: connected ? '#00c896' : '#f43f5e',
          boxShadow: connected ? '0 0 6px #00c896' : '0 0 6px #f43f5e',
          animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: 10.5, fontWeight: 600,
          color: connected
            ? theme === 'dark' ? '#00c896' : '#00a87c'
            : theme === 'dark' ? '#f43f5e' : '#e11d48',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.3px',
        }}>
          {connected ? 'connected' : 'reconnecting…'}
        </span>
      </div>
    </header>
  )
}
