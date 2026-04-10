/**
 * components/CVDataPanel.jsx
 * Collapsible panel showing the structured CV data as it's built.
 * Gives the user a live view of what the AI has captured.
 */
import { useState } from 'react'

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text2)', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '2px 14px 12px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  )
}

function Pill({ text, color = 'var(--teal)' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px', borderRadius: 5, margin: '2px 3px 2px 0',
      background: `${color}15`, border: `1px solid ${color}30`,
      fontSize: 10.5, color, fontWeight: 500,
    }}>
      {text}
    </span>
  )
}

export default function CVDataPanel({ cvData }) {
  if (!cvData) return null

  const { full_name, email, phone, location, linkedin_url, professional_summary, work_experience, education, skills, certifications, languages, target_role } = cvData

  const hasAnyData = full_name || professional_summary || work_experience?.length || education?.length || skills?.length

  if (!hasAnyData) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12,
      }}>
        CV data will appear here as you chat...
      </div>
    )
  }

  return (
    <div style={{ fontSize: 12, overflowY: 'auto', flex: 1 }}>

      {/* Contact */}
      {full_name && (
        <Section title="Contact" icon="👤">
          <Field label="Name" value={full_name} />
          <Field label="Email" value={email} />
          <Field label="Phone" value={phone} />
          <Field label="Location" value={location} />
          <Field label="LinkedIn" value={linkedin_url} />
          {target_role && <Field label="Target Role" value={target_role} />}
        </Section>
      )}

      {/* Summary */}
      {professional_summary && (
        <Section title="Summary" icon="📝" defaultOpen={false}>
          <p style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.55 }}>
            {professional_summary}
          </p>
        </Section>
      )}

      {/* Experience */}
      {work_experience?.length > 0 && (
        <Section title={`Experience (${work_experience.length})`} icon="💼">
          {work_experience.map((role, i) => (
            <div key={i} style={{
              padding: '8px 10px', marginBottom: 6,
              background: 'var(--surface3)', borderRadius: 7,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{role.job_title}</div>
              <div style={{ fontSize: 11, color: 'var(--teal)', marginBottom: 3 }}>{role.company}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
                {role.date_range?.start}{role.date_range?.start ? ' – ' : ''}{role.date_range?.is_current || role.date_range?.end?.toLowerCase() === 'present' ? 'Present' : (role.date_range?.end || '')}
              </div>
              {role.bullets?.length > 0 && (
                <ul style={{ marginTop: 5, paddingLeft: 14 }}>
                  {role.bullets.slice(0, 2).map((bp, j) => (
                    <li key={j} style={{ fontSize: 10.5, color: 'var(--text2)', marginBottom: 2 }}>{bp}</li>
                  ))}
                  {role.bullets.length > 2 && (
                    <li style={{ fontSize: 10.5, color: 'var(--text3)' }}>+{role.bullets.length - 2} more...</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Education */}
      {education?.length > 0 && (
        <Section title={`Education (${education.length})`} icon="🎓" defaultOpen={false}>
          {education.map((edu, i) => (
            <div key={i} style={{
              padding: '7px 10px', marginBottom: 5,
              background: 'var(--surface3)', borderRadius: 7,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{edu.degree}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{edu.institution}</div>
              {edu.date_range?.end && (
                <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>{edu.date_range.end}</div>
              )}
              {edu.grade && <div style={{ fontSize: 10.5, color: 'var(--teal)' }}>{edu.grade}</div>}
            </div>
          ))}
        </Section>
      )}

      {/* Skills */}
      {skills?.length > 0 && (
        <Section title={`Skills (${skills.length})`} icon="⚡" defaultOpen={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {skills.map((s, i) => (
              <Pill key={i} text={typeof s === 'string' ? s : s.name} color="var(--teal)" />
            ))}
          </div>
        </Section>
      )}

      {/* Certifications */}
      {certifications?.length > 0 && (
        <Section title={`Certs (${certifications.length})`} icon="🏆" defaultOpen={false}>
          {certifications.map((c, i) => (
            <div key={i} style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.issuer} {(c.date || c.date_obtained) ? `· ${c.date || c.date_obtained}` : ''}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Languages */}
      {languages?.length > 0 && (
        <Section title="Languages" icon="🌍" defaultOpen={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {languages.map((l, i) => (
              <Pill key={i} text={typeof l === 'string' ? l : `${l.language}${l.proficiency ? ' · ' + l.proficiency : ''}`} color="#8b5cf6" />
            ))}
          </div>
        </Section>
      )}

    </div>
  )
}
