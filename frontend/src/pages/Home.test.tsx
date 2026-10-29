import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import type { Cv } from '../api'
import { AppRoutes } from '../App'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getCv: vi.fn(),
  importPdf: vi.fn(),
}))

const cv: Cv = {
  id: 1,
  filename: 'cv.pdf',
  header: 'Jane Doe',
  roles: [
    {
      id: 10,
      section: 'Experience',
      heading: 'Engineer, Acme',
      title: 'Engineer',
      company: 'Acme',
      location: null,
      start_date: null,
      end_date: null,
      position: 0,
      archived_at: null,
      bullets: [
        {
          id: 1,
          role_id: 10,
          text: 'Built a thing',
          subheading: null,
          tags: [],
          version: 1,
          position: 0,
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
})

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('Home', () => {
  it('shows the upload form before any CV exists', async () => {
    vi.mocked(api.getCv).mockResolvedValue(null)
    renderHome()
    expect(await screen.findByText(/No CV yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Edit resume' })).not.toBeInTheDocument()
  })

  it('imports a PDF and opens the edit page', async () => {
    vi.mocked(api.getCv).mockResolvedValueOnce(null).mockResolvedValue(cv)
    vi.mocked(api.importPdf).mockResolvedValue(cv)
    renderHome()
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' })
    await userEvent.upload(await screen.findByLabelText(/CV \(PDF\)/), file)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(api.importPdf).toHaveBeenCalledWith(file)
    expect(await screen.findByRole('button', { name: 'Experience' })).toBeInTheDocument()
  })

  it('offers to edit the resume once a CV exists', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    renderHome()
    await userEvent.click(await screen.findByRole('link', { name: 'Edit resume' }))
    expect(await screen.findByRole('button', { name: 'Header' })).toBeInTheDocument()
  })

  it('shows Create new resume, disabled until tailored resumes are built', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    renderHome()
    expect(await screen.findByRole('button', { name: 'Create new resume' })).toBeDisabled()
    expect(screen.queryByText(/No CV yet/)).not.toBeInTheDocument()
  })
})
