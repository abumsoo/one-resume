import { useState, type FormEvent } from 'react'
import { importPdf, type Cv } from '../api'

export default function UploadForm({ onImported }: { onImported: (cv: Cv) => void }) {
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
