/**
 * SectionEditModal.jsx
 * React modal for inline editing of any CV section.
 * Opened when the user clicks a pen icon in the preview iframe.
 * Saves directly to cvData — no AI / chat involvement.
 */
import { useState } from 'react'

// ── Shared primitives ──────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border2)', background: 'var(--surface3)',
  color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const taStyle = {
  ...inputStyle,
  resize: 'vertical', lineHeight: 1.6,
}

function Field({ label, value, onChange, multiline, rows = 3, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
            placeholder={placeholder} style={taStyle} />
        : <input value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} style={inputStyle} />
      }
    </label>
  )
}

function SaveBar({ onSave, onClose, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
      <button onClick={onClose}
        style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12.5, cursor: 'pointer' }}>
        Cancel
      </button>
      <button onClick={onSave} disabled={disabled}
        style={{ padding: '7px 22px', borderRadius: 7, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        ✓ Save
      </button>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
}

// ── Section-specific forms ──────────────────────────────────────────────────

function ContactForm({ cvData, onSave, onClose }) {
  const [f, setF] = useState({
    full_name:    cvData.full_name    || '',
    headline:     cvData.headline     || '',
    email:        cvData.email        || '',
    phone:        cvData.phone        || '',
    location:     cvData.location     || '',
    linkedin_url: cvData.linkedin_url || '',
    github_url:   cvData.github_url   || '',
    website_url:  cvData.website_url  || '',
  })
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Full Name"  value={f.full_name}    onChange={set('full_name')} />
        <Field label="Headline"   value={f.headline}     onChange={set('headline')} placeholder="e.g. Senior Software Engineer" />
        <Field label="Email"      value={f.email}        onChange={set('email')} />
        <Field label="Phone"      value={f.phone}        onChange={set('phone')} />
        <Field label="Location"   value={f.location}     onChange={set('location')} placeholder="City, Country" />
        <Field label="LinkedIn"   value={f.linkedin_url} onChange={set('linkedin_url')} />
        <Field label="GitHub"     value={f.github_url}   onChange={set('github_url')} />
        <Field label="Website"    value={f.website_url}  onChange={set('website_url')} />
      </div>
      <SaveBar onSave={() => onSave(f)} onClose={onClose} />
    </div>
  )
}

function SummaryForm({ cvData, onSave, onClose }) {
  const [text, setText] = useState(cvData.professional_summary || '')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Professional Summary" value={text} onChange={setText} multiline rows={7} />
      <SaveBar onSave={() => onSave({ professional_summary: text })} onClose={onClose} />
    </div>
  )
}

function ExperienceForm({ cvData, onSave, onClose }) {
  const initRoles = (cvData.work_experience || []).map(r => ({
    job_title:  r.job_title  || '',
    company:    r.company    || '',
    location:   r.location   || '',
    start:      r.date_range?.start || '',
    end:        r.date_range?.end   || '',
    is_current: r.date_range?.is_current || (r.date_range?.end?.toLowerCase() === 'present') || false,
    bullets:    (r.bullets || []).join('\n'),
    technologies: (r.technologies || []).join(', '),
  }))
  const [roles, setRoles] = useState(initRoles.length ? initRoles : [emptyRole()])

  function emptyRole() {
    return { job_title: '', company: '', location: '', start: '', end: '', is_current: false, bullets: '', technologies: '' }
  }
  const upd = (i, k) => (v) => setRoles(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const add = () => setRoles(rs => [...rs, emptyRole()])
  const remove = (i) => setRoles(rs => rs.filter((_, j) => j !== i))

  const save = () => {
    const work_experience = roles
      .filter(r => r.job_title.trim() || r.company.trim())
      .map(r => ({
        job_title:  r.job_title.trim(),
        company:    r.company.trim(),
        location:   r.location.trim(),
        date_range: { start: r.start.trim(), end: r.is_current ? 'present' : r.end.trim(), is_current: r.is_current },
        bullets:    r.bullets.split('\n').map(b => b.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean),
        technologies: r.technologies.split(',').map(t => t.trim()).filter(Boolean),
      }))
    onSave({ work_experience })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {roles.map((role, i) => (
        <div key={i} style={{ border: '1px solid var(--border2)', borderRadius: 8, padding: 14, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            {roles.length > 1 && (
              <button onClick={() => remove(i)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Job Title"  value={role.job_title} onChange={upd(i, 'job_title')} />
            <Field label="Company"    value={role.company}   onChange={upd(i, 'company')} />
            <Field label="Location"   value={role.location}  onChange={upd(i, 'location')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Field label="Start Date" value={role.start} onChange={upd(i, 'start')} placeholder="e.g. Jan 2020" />
            </div>
            {!role.is_current
              ? <Field label="End Date" value={role.end} onChange={upd(i, 'end')} placeholder="e.g. Dec 2023" />
              : <div />
            }
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', marginTop: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={role.is_current} onChange={e => upd(i, 'is_current')(e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
              Currently working here
            </label>
          </div>
          <Field label="Key Responsibilities (one per line)" value={role.bullets}
            onChange={upd(i, 'bullets')} multiline rows={4}
            placeholder="• Led a team of 5 engineers&#10;• Designed the system architecture" />
          <div style={{ marginTop: 10 }}>
            <Field label="Technologies (comma-separated)" value={role.technologies}
              onChange={upd(i, 'technologies')} placeholder="Python, React, AWS" />
          </div>
        </div>
      ))}
      <button onClick={add}
        style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 7, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
        + Add another role
      </button>
      <SaveBar onSave={save} onClose={onClose} />
    </div>
  )
}

function EducationForm({ cvData, onSave, onClose }) {
  const initEntries = (cvData.education || []).map(e => ({
    degree:      e.degree      || '',
    institution: e.institution || '',
    location:    e.location    || '',
    end:         e.date_range?.end || '',
    grade:       e.grade       || '',
  }))
  const [entries, setEntries] = useState(initEntries.length ? initEntries : [emptyEdu()])

  function emptyEdu() {
    return { degree: '', institution: '', location: '', end: '', grade: '' }
  }
  const upd = (i, k) => (v) => setEntries(es => es.map((e, j) => j === i ? { ...e, [k]: v } : e))
  const add = () => setEntries(es => [...es, emptyEdu()])
  const remove = (i) => setEntries(es => es.filter((_, j) => j !== i))

  const save = () => {
    const education = entries
      .filter(e => e.degree.trim() || e.institution.trim())
      .map(e => ({
        degree:      e.degree.trim(),
        institution: e.institution.trim(),
        location:    e.location.trim(),
        date_range:  { end: e.end.trim() },
        grade:       e.grade.trim() || null,
      }))
    onSave({ education })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {entries.map((edu, i) => (
        <div key={i} style={{ border: '1px solid var(--border2)', borderRadius: 8, padding: 14, position: 'relative' }}>
          {entries.length > 1 && (
            <button onClick={() => remove(i)}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Degree / Qualification" value={edu.degree}      onChange={upd(i, 'degree')} />
            <Field label="Institution"            value={edu.institution} onChange={upd(i, 'institution')} />
            <Field label="Location"               value={edu.location}    onChange={upd(i, 'location')} />
            <Field label="Year / End Date"        value={edu.end}         onChange={upd(i, 'end')} placeholder="e.g. 2018" />
            <Field label="Grade / Result"         value={edu.grade}       onChange={upd(i, 'grade')} placeholder="e.g. First Class" />
          </div>
        </div>
      ))}
      <button onClick={add}
        style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 7, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
        + Add another entry
      </button>
      <SaveBar onSave={save} onClose={onClose} />
    </div>
  )
}

function SkillsForm({ cvData, onSave, onClose }) {
  const [text, setText] = useState((cvData.skills || []).join(', '))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Skills (comma-separated)" value={text} onChange={setText} multiline rows={5}
        placeholder="Python, React, SQL, Machine Learning, …" />
      <SaveBar onSave={() => onSave({ skills: text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) })} onClose={onClose} />
    </div>
  )
}

function CertificationsForm({ cvData, onSave, onClose }) {
  const initCerts = (cvData.certifications || []).map(c => ({
    name:   c.name   || (typeof c === 'string' ? c : ''),
    issuer: c.issuer || '',
    date:   c.date   || '',
  }))
  const [certs, setCerts] = useState(initCerts.length ? initCerts : [{ name: '', issuer: '', date: '' }])
  const upd = (i, k) => (v) => setCerts(cs => cs.map((c, j) => j === i ? { ...c, [k]: v } : c))
  const add = () => setCerts(cs => [...cs, { name: '', issuer: '', date: '' }])
  const remove = (i) => setCerts(cs => cs.filter((_, j) => j !== i))
  const save = () => onSave({
    certifications: certs.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), issuer: c.issuer.trim() || null, date: c.date.trim() || null }))
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {certs.map((cert, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <Field label={i === 0 ? 'Certification Name' : ''} value={cert.name}   onChange={upd(i, 'name')} />
          <Field label={i === 0 ? 'Issuer'             : ''} value={cert.issuer} onChange={upd(i, 'issuer')} placeholder="e.g. AWS, Google" />
          <Field label={i === 0 ? 'Date'               : ''} value={cert.date}   onChange={upd(i, 'date')}   placeholder="e.g. 2023" />
          {certs.length > 1 && (
            <button onClick={() => remove(i)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, paddingBottom: 2 }}>✕</button>
          )}
        </div>
      ))}
      <button onClick={add}
        style={{ alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 7, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
        + Add certification
      </button>
      <SaveBar onSave={save} onClose={onClose} />
    </div>
  )
}

function ListTextForm({ label, hint, initialLines, fieldKey, onSave, onClose }) {
  const [text, setText] = useState(initialLines.join('\n'))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hint && <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>{hint}</p>}
      <Field label={label} value={text} onChange={setText} multiline rows={6} />
      <SaveBar
        onSave={() => onSave({ [fieldKey]: text.split('\n').map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) })}
        onClose={onClose}
      />
    </div>
  )
}

function LanguagesForm({ cvData, onSave, onClose }) {
  const lines = (cvData.languages || []).map(l => typeof l === 'string' ? l : l.language || '')
  const [text, setText] = useState(lines.join(', '))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Languages (comma-separated)" value={text} onChange={setText}
        placeholder="English, Tamil, Hindi, …" />
      <SaveBar
        onSave={() => onSave({ languages: text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) })}
        onClose={onClose}
      />
    </div>
  )
}

// ── Section labels ──────────────────────────────────────────────────────────
const SECTION_LABELS = {
  contact:        'Contact Information',
  summary:        'Professional Summary',
  experience:     'Work Experience',
  education:      'Education',
  skills:         'Skills',
  certifications: 'Certifications',
  languages:      'Languages',
  achievements:   'Achievements',
  awards:         'Awards & Recognition',
}

// ── Main modal ──────────────────────────────────────────────────────────────
export default function SectionEditModal({ section, cvData, onSave, onClose }) {
  const renderForm = () => {
    const props = { cvData, onSave, onClose }
    switch (section) {
      case 'contact':        return <ContactForm {...props} />
      case 'summary':        return <SummaryForm {...props} />
      case 'experience':     return <ExperienceForm {...props} />
      case 'education':      return <EducationForm {...props} />
      case 'skills':         return <SkillsForm {...props} />
      case 'certifications': return <CertificationsForm {...props} />
      case 'languages':      return <LanguagesForm {...props} />
      case 'achievements':
        return <ListTextForm label="Achievements (one per line)" hint="Each line = one achievement statement."
          initialLines={cvData.achievements || []} fieldKey="achievements" onSave={onSave} onClose={onClose} />
      case 'awards':
        return <ListTextForm label="Awards & Recognition (one per line)" hint=""
          initialLines={cvData.awards || []} fieldKey="awards" onSave={onSave} onClose={onClose} />
      default:
        return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No editor for section "{section}"</div>
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%', maxWidth: 640,
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '13px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            ✏ {SECTION_LABELS[section] || section}
          </span>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Scrollable form area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, scrollbarWidth: 'thin' }}>
          {renderForm()}
        </div>
      </div>
    </div>
  )
}
