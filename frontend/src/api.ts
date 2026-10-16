// Typed calls to the backend. Shapes mirror backend/app/schemas.py.

export interface Bullet {
  id: number
  role_id: number
  text: string
  subheading: string | null
  tags: string[]
  version: number
  position: number
}

export interface BulletVersion {
  version: number
  text: string
  source: 'import' | 'edit' | 'promote'
  created_at: string
}

export interface Role {
  id: number
  section: string
  heading: string | null
  title: string | null
  company: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  position: number
  archived_at: string | null
  bullets: Bullet[]
}

export interface Cv {
  id: number
  filename: string | null
  header: string
  roles: Role[]
}

export type RoleUpdate = Partial<
  Pick<Role, 'section' | 'title' | 'company' | 'location' | 'start_date' | 'end_date'>
>

export interface BulletUpdate {
  text?: string
  tags?: string[]
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(body) ?? response.statusText)
  }
  return body as T
}

// FastAPI sends `detail` as a string, or as a list of validation errors.
function errorMessage(body: unknown): string | null {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
  return null
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** The current CV, or null before the first import. */
export async function getCv(): Promise<Cv | null> {
  try {
    return await request<Cv>('/cv')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function importPdf(file: File): Promise<Cv> {
  const form = new FormData()
  form.append('file', file)
  return request<Cv>('/imports', { method: 'POST', body: form })
}

export function updateRole(id: number, fields: RoleUpdate): Promise<Role> {
  return request<Role>(`/roles/${id}`, json('PATCH', fields))
}

export function updateBullet(id: number, fields: BulletUpdate): Promise<Bullet> {
  return request<Bullet>(`/bullets/${id}`, json('PATCH', fields))
}

export function getBulletVersions(id: number): Promise<BulletVersion[]> {
  return request<BulletVersion[]>(`/bullets/${id}/versions`)
}
