import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getCv, type Bullet, type Cv, type Role } from '../api'
import RoleCard from '../components/RoleCard'

// Which card is open is one string, so the header and the sections share an id
// space. Section ids are the section name with a prefix (sectionId), so a CV
// section that is itself named "header" can't open the header card too.
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
  // Group roles by section, keeping the order they appear in the CV.
  const sections = new Map<string, Role[]>()
  for (const role of cv.roles) {
    sections.set(role.section, [...(sections.get(role.section) ?? []), role])
  }

  return (
    <div className="sections">
      {/* The header isn't editable yet; it comes with the edit page work in Week 2. */}
      <SectionCard name="Header" isOpen={open === HEADER} onToggle={() => onToggle(HEADER)}>
        <div className="cv-header">
          {cv.header
            .split('\n')
            .filter((line) => line.trim())
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
        </div>
      </SectionCard>
      {[...sections].map(([section, roles]) => {
        const id = sectionId(section)
        return (
          <SectionCard
            key={id}
            name={section}
            isOpen={open === id}
            onToggle={() => onToggle(id)}
          >
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onRoleChange={onRoleChange}
                onBulletChange={onBulletChange}
              />
            ))}
          </SectionCard>
        )
      })}
    </div>
  )
}

interface SectionCardProps {
  name: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

// One collapsible card. It knows nothing about the CV: the list decides what
// goes inside and which card is open.
function SectionCard({ name, isOpen, onToggle, children }: SectionCardProps) {
  const bodyId = useId()
  return (
    <section className="section-card">
      <h2>
        <button type="button" aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
          {name}
        </button>
      </h2>
      {/* Hidden, not unmounted, so closing a card keeps unsaved drafts and
          in-flight saves in the editors inside it. */}
      <div id={bodyId} hidden={!isOpen}>
        {children}
      </div>
    </section>
  )
}
