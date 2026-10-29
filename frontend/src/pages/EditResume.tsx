import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getCv, type Bullet, type Cv, type Role } from '../api'
import RoleCard from '../components/RoleCard'

// The header's card id; section cards use the section name, prefixed so a
// section named "Header" can't clash with it.
const HEADER = 'header'

export default function EditResume() {
  const [cv, setCv] = useState<Cv | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The open card's id; one is open at a time, null when all are closed.
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    getCv()
      .then(setCv)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Updates go through the latest state by id, so overlapping saves don't
  // undo each other.
  function mapRole(id: number, change: (role: Role) => Role) {
    setCv((current) =>
      current && { ...current, roles: current.roles.map((r) => (r.id === id ? change(r) : r)) },
    )
  }

  function replaceRoleFields(saved: Role) {
    // Keep the bullets in state; a bullet save may have landed since.
    mapRole(saved.id, (role) => ({ ...saved, bullets: role.bullets }))
    // A role moved to another section: follow it there, so it stays in view.
    setOpen(sectionId(saved.section))
  }

  function replaceBullet(saved: Bullet) {
    mapRole(saved.role_id, (role) => ({
      ...role,
      bullets: role.bullets.map((b) => (b.id === saved.id ? saved : b)),
    }))
  }

  if (loading) return <main>Loading…</main>

  return (
    <main className="edit-page">
      {error && <p className="error">{error}</p>}
      {cv ? (
        <>
          <SectionList
            cv={cv}
            open={open}
            onToggle={(id) => setOpen(open === id ? null : id)}
            onRoleChange={replaceRoleFields}
            onBulletChange={replaceBullet}
          />
          <aside className="preview" aria-label="Preview">
            <p className="muted">Preview comes in a later feature.</p>
          </aside>
        </>
      ) : (
        !error && (
          <p>
            No CV yet. <Link to="/">Import one</Link> first.
          </p>
        )
      )}
    </main>
  )
}

function sectionId(section: string): string {
  return `section:${section}`
}

interface SectionListProps {
  cv: Cv
  open: string | null
  onToggle: (id: string) => void
  onRoleChange: (role: Role) => void
  onBulletChange: (bullet: Bullet) => void
}

function SectionList({ cv, open, onToggle, onRoleChange, onBulletChange }: SectionListProps) {
  const idPrefix = useId()

  // Group roles by section, keeping the order they appear in the CV.
  const sections = new Map<string, Role[]>()
  for (const role of cv.roles) {
    sections.set(role.section, [...(sections.get(role.section) ?? []), role])
  }

  function card(id: string, name: string, body: ReactNode) {
    const isOpen = open === id
    const bodyId = `${idPrefix}-${id}`
    return (
      <section key={id} className="section-card">
        <h2>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={() => onToggle(id)}
          >
            {name}
          </button>
        </h2>
        {/* Hidden, not unmounted, so closing a card keeps unsaved drafts and
            in-flight saves in the editors inside it. */}
        <div id={bodyId} hidden={!isOpen}>
          {body}
        </div>
      </section>
    )
  }

  return (
    <div className="sections">
      {/* The header isn't editable yet; it comes with the edit page work in Week 2. */}
      {card(
        HEADER,
        'Header',
        <div className="cv-header">
          {cv.header
            .split('\n')
            .filter((line) => line.trim())
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
        </div>,
      )}
      {[...sections].map(([section, roles]) =>
        card(
          sectionId(section),
          section,
          roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onRoleChange={onRoleChange}
              onBulletChange={onBulletChange}
            />
          )),
        ),
      )}
    </div>
  )
}
