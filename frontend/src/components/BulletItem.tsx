import { useState, type FormEvent } from 'react'
import { getBulletVersions, updateBullet, type Bullet, type BulletUpdate, type BulletVersion } from '../api'

interface Props {
  bullet: Bullet
  onChange: (bullet: Bullet) => void
}

export default function BulletItem({ bullet, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [history, setHistory] = useState<BulletVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // One save at a time: a tag change sends the whole list, so a second change
  // made before the first returns would be built from the old list.
  const [saving, setSaving] = useState(false)

  async function save(fields: BulletUpdate): Promise<boolean> {
    if (saving) return false
    setSaving(true)
    setError(null)
    try {
      const saved = await updateBullet(bullet.id, fields)
      onChange(saved)
      // Keep an open history in step with the new version.
      if (history && saved.version !== bullet.version) {
        setHistory(await getBulletVersions(bullet.id))
      }
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveText(event: FormEvent) {
    event.preventDefault()
    if (draft !== null && (await save({ text: draft }))) setDraft(null)
  }

  async function addTag(event: FormEvent) {
    event.preventDefault()
    if (newTag.trim() && (await save({ tags: [...bullet.tags, newTag] }))) setNewTag('')
  }

  async function toggleHistory() {
    if (history) {
      setHistory(null)
      return
    }
    try {
      setHistory(await getBulletVersions(bullet.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="bullet">
      {draft === null ? (
        <p>
          {bullet.text}{' '}
          <button type="button" onClick={() => setDraft(bullet.text)}>
            Edit
          </button>
        </p>
      ) : (
        <form onSubmit={saveText}>
          <textarea
            aria-label="Bullet text"
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={!draft.trim() || saving}>
            Save
          </button>
          <button type="button" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </form>
      )}

      <div className="tags">
        {bullet.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              disabled={saving}
              onClick={() => save({ tags: bullet.tags.filter((t) => t !== tag) })}
            >
              ×
            </button>
          </span>
        ))}
        <form onSubmit={addTag}>
          <input
            aria-label="New tag"
            placeholder="add tag"
            disabled={saving}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
        </form>
        <button type="button" className="link" onClick={toggleHistory}>
          history (v{bullet.version})
        </button>
      </div>

      {history && (
        <ol className="history">
          {history.map((v) => (
            <li key={v.version}>
              <span className="muted">
                v{v.version} · {v.source} · {new Date(v.created_at).toLocaleString()}
              </span>
              <p>{v.text}</p>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
