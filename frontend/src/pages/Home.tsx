import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getCv, type Cv } from '../api'
import UploadForm from '../components/UploadForm'

export default function Home() {
  const navigate = useNavigate()
  const [cv, setCv] = useState<Cv | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCv()
      .then(setCv)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main>Loading…</main>

  return (
    <main>
      {error && <p className="error">{error}</p>}
      {cv ? (
        <div className="actions">
          <Link className="button" to="/edit">
            Edit resume
          </Link>
          {/* Tailored resumes are built in Week 3. */}
          <button type="button" disabled title="Coming in Week 3">
            Create new resume
          </button>
        </div>
      ) : (
        !error && <UploadForm onImported={() => navigate('/edit')} />
      )}
    </main>
  )
}
