import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import type { Bullet, Cv, Role } from '../api'
import { AppRoutes } from '../App'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getCv: vi.fn(),
  updateRole: vi.fn(),
  updateBullet: vi.fn(),
  getBulletVersions: vi.fn(),
}))

const bullet: Bullet = {
  id: 1,
  role_id: 10,
  text: 'Built a thing',
  subheading: null,
  tags: [],
  version: 1,
  position: 0,
}

const job: Role = {
  id: 10,
  section: 'Experience',
  heading: 'Engineer, Acme – NYC   2020 – 2021',
  title: 'Engineer',
  company: 'Acme',
  location: 'NYC',
  start_date: '2020',
  end_date: '2021',
  position: 0,
  archived_at: null,
  bullets: [bullet],
}

const skills: Role = {
  ...job,
  id: 11,
  section: 'Skills',
  heading: null,
  title: null,
  company: null,
  location: null,
  start_date: null,
  end_date: null,
  position: 1,
  bullets: [{ ...bullet, id: 2, role_id: 11, text: 'Languages: Python' }],
}

const cv: Cv = { id: 1, filename: 'cv.pdf', header: 'Jane Doe', roles: [job, skills] }

beforeEach(() => {
  vi.resetAllMocks()
})

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/edit']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

/** Opens a section card by its name, once the page has loaded. */
async function openSection(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }))
}

describe('EditResume', () => {
  it('lists the header first, then the sections, all closed', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    renderPage()
    await screen.findByRole('button', { name: 'Header' })
    const names = screen
      .getAllByRole('button', { expanded: false })
      .map((b) => b.textContent)
    expect(names).toEqual(['Header', 'Experience', 'Skills'])
    expect(screen.queryByText('Built a thing')).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Preview' })).toBeInTheDocument()
  })

  it('opens one section at a time, and closes it on a second click', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    renderPage()
    await openSection('Header')
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()

    await openSection('Experience')
    expect(screen.getByText('Built a thing')).toBeInTheDocument()
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()

    await openSection('Experience')
    expect(screen.queryByText('Built a thing')).not.toBeInTheDocument()
  })

  it('links back home when there is no CV', async () => {
    vi.mocked(api.getCv).mockResolvedValue(null)
    renderPage()
    expect(await screen.findByRole('link', { name: 'Import one' })).toHaveAttribute('href', '/')
  })

  it('saves an edited bullet and shows its new version', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    vi.mocked(api.updateBullet).mockResolvedValue({ ...bullet, text: 'Shipped a thing', version: 2 })
    renderPage()
    await openSection('Experience')

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const box = screen.getByLabelText('Bullet text')
    await userEvent.clear(box)
    await userEvent.type(box, 'Shipped a thing')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(api.updateBullet).toHaveBeenCalledWith(1, { text: 'Shipped a thing' })
    expect(await screen.findByText('Shipped a thing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'history (v2)' })).toBeInTheDocument()
  })

  it('adds a tag', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    vi.mocked(api.updateBullet).mockResolvedValue({ ...bullet, tags: ['python'] })
    renderPage()
    await openSection('Experience')
    await userEvent.type(screen.getByLabelText('New tag'), 'python{Enter}')
    expect(api.updateBullet).toHaveBeenCalledWith(1, { tags: ['python'] })
    expect(await screen.findByRole('button', { name: 'Remove tag python' })).toBeInTheDocument()
  })

  it('edits a role with a heading, but not a section without one', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    vi.mocked(api.updateRole).mockResolvedValue({ ...job, title: 'Staff Engineer' })
    renderPage()

    // Skills has no heading to edit, so no "Edit role" button.
    await openSection('Skills')
    expect(screen.getByText('Languages: Python')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit role' })).not.toBeInTheDocument()

    await openSection('Experience')
    await userEvent.click(screen.getByRole('button', { name: 'Edit role' }))
    const title = screen.getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Staff Engineer')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(api.updateRole).toHaveBeenCalledWith(10, {
      section: 'Experience',
      title: 'Staff Engineer',
      company: 'Acme',
      location: 'NYC',
      start_date: '2020',
      end_date: '2021',
    })
    expect(await screen.findByText(/Staff Engineer, Acme/)).toBeInTheDocument()
  })

  it('shows API errors inline', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    vi.mocked(api.updateBullet).mockRejectedValue(new Error('Bullet 1 not found'))
    renderPage()
    await openSection('Experience')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Bullet 1 not found')).toBeInTheDocument()
  })

  it('keeps both edits when two bullets of one role save at once', async () => {
    const second: Bullet = { ...bullet, id: 3, text: 'Fixed a bug', position: 1 }
    vi.mocked(api.getCv).mockResolvedValue({ ...cv, roles: [{ ...job, bullets: [bullet, second] }] })
    const pending = new Map<number, (b: Bullet) => void>()
    vi.mocked(api.updateBullet).mockImplementation(
      (id) => new Promise((resolve) => pending.set(id, resolve)),
    )
    renderPage()
    await openSection('Experience')

    for (const [old, edited] of [
      ['Built a thing', 'Built A'],
      ['Fixed a bug', 'Fixed B'],
    ]) {
      const item = screen.getByText(old).closest('.bullet') as HTMLElement
      await userEvent.click(within(item).getByRole('button', { name: 'Edit' }))
      const box = within(item).getByLabelText('Bullet text')
      await userEvent.clear(box)
      await userEvent.type(box, edited)
      await userEvent.click(within(item).getByRole('button', { name: 'Save' }))
    }

    // Both requests are in flight; they return in the order they were sent.
    await act(async () => pending.get(1)!({ ...bullet, text: 'Built A', version: 2 }))
    await act(async () => pending.get(3)!({ ...second, text: 'Fixed B', version: 2 }))
    expect(screen.getByText('Built A')).toBeInTheDocument()
    expect(screen.getByText('Fixed B')).toBeInTheDocument()
  })

  it('locks tag changes while a save is in flight', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    let finish: (b: Bullet) => void = () => {}
    vi.mocked(api.updateBullet).mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    )
    renderPage()
    await openSection('Experience')
    const input = screen.getAllByLabelText('New tag')[0]
    await userEvent.type(input, 'python{Enter}')
    expect(input).toBeDisabled()

    await act(async () => finish({ ...bullet, tags: ['python'] }))
    expect(input).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove tag python' })).toBeInTheDocument()
  })

  it('refuses to save an empty section', async () => {
    vi.mocked(api.getCv).mockResolvedValue(cv)
    renderPage()
    await openSection('Experience')
    await userEvent.click(screen.getByRole('button', { name: 'Edit role' }))
    await userEvent.clear(screen.getByLabelText('Section'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText("Section can't be empty")).toBeInTheDocument()
    expect(api.updateRole).not.toHaveBeenCalled()
  })
})
