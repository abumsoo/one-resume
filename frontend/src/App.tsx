import { useEffect, useState, type FormEvent } from 'react'
import { getCv, importPdf, type Bullet, type Cv, type Role } from './api'
import RoleCard from './components/RoleCard'

export default function App() {
  const [cv, setCv] = useState<Cv | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }

  function replaceBullet(saved: Bullet) {
    mapRole(saved.role_id, (role) => ({
      ...role,
      bullets: role.bullets.map((b) => (b.id === saved.id ? saved : b)),
    }))
  }

  if (loading) return <main>Loading…</main>

  return (
    <main>
      <h1>One Resume</h1>
      {error && <p className="error">{error}</p>}
      {cv ? (
        <BulletBank cv={cv} onRoleChange={replaceRoleFields} onBulletChange={replaceBullet} />
      ) : (
        <UploadForm onImported={setCv} />
      )}
    </main>
  )
}

function UploadForm({ onImported }: { onImported: (cv: Cv) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onImported(await importPdf(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="upload">
      <p>No CV yet. Import it from a PDF.</p>
      <label>
        CV (PDF){' '}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={!file || busy}>
        {busy ? 'Importing…' : 'Import'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

interface BulletBankProps {
  cv: Cv
  onRoleChange: (role: Role) => void
  onBulletChange: (bullet: Bullet) => void
}

function BulletBank({ cv, onRoleChange, onBulletChange }: BulletBankProps) {
  // Group roles by section, keeping the order they appear in the CV.
  const sections = new Map<string, Role[]>()
  for (const role of cv.roles) {
    sections.set(role.section, [...(sections.get(role.section) ?? []), role])
  }

  return (
    <>
      <header className="cv-header">
        {cv.header
          .split('\n')
          .filter((line) => line.trim())
          .map((line, i) => (
            <p key={i}>{line}</p>
          ))}
      </header>
      {[...sections].map(([section, roles]) => (
        <section key={section}>
          <h2>{section}</h2>
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onRoleChange={onRoleChange}
              onBulletChange={onBulletChange}
            />
          ))}
        </section>
      ))}
    </>
  )
}
