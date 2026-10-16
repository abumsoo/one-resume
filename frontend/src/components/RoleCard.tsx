import { useState, type FormEvent } from 'react'
import { updateRole, type Bullet, type Role, type RoleUpdate } from '../api'
import BulletItem from './BulletItem'

const FIELDS = [
  ['title', 'Title'],
  ['company', 'Company'],
  ['location', 'Location'],
  ['start_date', 'Start'],
  ['end_date', 'End'],
] as const

interface Props {
  role: Role
  onRoleChange: (role: Role) => void
  onBulletChange: (bullet: Bullet) => void
}

export default function RoleCard({ role, onRoleChange, onBulletChange }: Props) {
  const [editing, setEditing] = useState(false)

  return (
    <article className="role">
      {role.heading !== null &&
        (editing ? (
          <RoleForm
            role={role}
            onSaved={(saved) => {
              onRoleChange(saved)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="role-heading">
            <h3>
              {[role.title, role.company].filter(Boolean).join(', ')}
              {role.location && <span className="muted"> – {role.location}</span>}
            </h3>
            <span className="muted">
              {[role.start_date, role.end_date].filter(Boolean).join(' – ')}
            </span>
            <button type="button" onClick={() => setEditing(true)}>
              Edit role
            </button>
          </div>
        ))}
      <ul>
        {role.bullets.map((bullet, i) => {
          // Bullets that share a subheading ("Fintech client") are shown under it.
          const showSubheading =
            bullet.subheading && bullet.subheading !== role.bullets[i - 1]?.subheading
          return (
            <li key={bullet.id}>
              {showSubheading && <h4>{bullet.subheading}</h4>}
              <BulletItem bullet={bullet} onChange={onBulletChange} />
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function RoleForm({
  role,
  onSaved,
  onCancel,
}: {
  role: Role
  onSaved: (role: Role) => void
  onCancel: () => void
}) {
  const [fields, setFields] = useState<RoleUpdate>({
    section: role.section,
    ...Object.fromEntries(FIELDS.map(([name]) => [name, role[name] ?? ''])),
  })
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!fields.section?.trim()) {
      setError("Section can't be empty")
      return
    }
    // An emptied field is cleared, not saved as "".
    const body = Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, value?.trim() || null]),
    ) as RoleUpdate
    try {
      onSaved(await updateRole(role.id, body))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <form className="role-form" onSubmit={submit}>
      <p className="muted">Imported as: {role.heading}</p>
      {/* Only roles with a heading get here, so the section can always change. */}
      <label>
        Section
        <input
          value={fields.section ?? ''}
          onChange={(e) => setFields({ ...fields, section: e.target.value })}
        />
      </label>
      {FIELDS.map(([name, label]) => (
        <label key={name}>
          {label}
          <input
            value={fields[name] ?? ''}
            onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          />
        </label>
      ))}
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
