# One Resume

A resume manager: one master CV stored as a bank of bullets, tailored resumes that
select from it, and promote-back of improved wording. `SPEC.md` is the source of truth
for scope and the build plan; read it before planning a feature.

## Status

Week 1 (data, PDF import, bullet bank) is built. A second import returns 409 until
re-import with matching is built; during development, delete `backend/one_resume.db`
to start over.

## Commands

Backend, from `backend/`:

- Install: `uv sync`
- Test: `uv run pytest`
- Run: `uv run uvicorn --factory app.main:create_app` (port 8000; the database is
  `ONE_RESUME_DATABASE_URL`, default `sqlite:///./one_resume.db`). From Week 3, when
  sign-in is added, it needs `ONE_RESUME_SECRET_KEY` and `ONE_RESUME_PASSWORD_HASH`
  (`python -m app.auth` generates the hash).
- System dependency: `pdftotext` from poppler (`poppler-utils` on Debian/Fedora),
  for PDF import. The deploy container and CI need it installed too.

Frontend, from `frontend/`:

- Install: `npm install`
- Test: `npm test` (Vitest); type-check and build: `npm run build`; lint: `npm run lint`
- Run: `npm run dev` (Vite on port 5173, proxying `/api` to the backend on 8000)

## Layout

- `backend/app/`: FastAPI app, all routes under `/api`. `models.py` is the data model,
  `pdf.py` turns a PDF into text (`pdftotext -layout`), `importer.py` splits CV text
  into roles and bullets, `routes.py` the API. `auth.py` (sign-in) comes in Week 3.
- `frontend/src/`: React app. `api.ts` holds typed calls mirroring
  `backend/app/schemas.py`; `components/` the UI pieces. Tests mock `api.ts`.
- `backend/tests/`: pytest. Tests use a fresh SQLite file per test.
- `backend/tests/fixtures/`: a fictional CV (`sample_cv.html`, printed to
  `sample_cv.pdf`) in the same layout as the real one. `sample_cv.txt` is
  `pdftotext -layout` of the PDF and is the importer's main test fixture; a test checks
  the PDF still extracts to exactly that text. The HTML comment says how to
  regenerate both.
- `samples/`: the real CV, for checking imports by hand. Git-ignored; keep it out of
  commits and tests.

## Data model

The full model, including `Export`, is the table in `SPEC.md`; this list adds detail.
`Resume`, `Selection`, and `Export` are not built yet (Week 2).

- `CvImport`: the original text of an import and its header (name, contact).
- `Role`: an entry in a CV section (job, project, degree): section, raw heading,
  title, company, location, start/end dates as written, `archived_at`. Sections
  without entries (Skills, Summary) are one role with no heading; only roles with a
  heading can have their section changed, so that stays true.
- `Bullet`: text, optional subheading (e.g. "Healthcare client"), tags, version.
- `BulletVersion`: every text a bullet has had, with its source
  (`import`, `edit`, `promote`).
- `Resume`: name, target company, job description, template.
- `Selection`: a resume's pick of a bullet: position, optional override text, and
  `base_version`, the bullet version the override was written against.

## Design rules

- A bullet lives in exactly one place. Resumes hold selections that point at bullets;
  never copy bullet text into a resume.
- An override changes wording for one resume only and never edits the CV bullet.
  Only an explicit promote writes it back, as a new bullet version.
- Every change to a bullet's text creates a `BulletVersion` (`Bullet.set_text`).
  Don't assign `bullet.text` directly.
- Import must not lose text: keep the raw heading on each role and the raw input on
  `CvImport`, so a bad split can be fixed by hand.
- AI features (weeks 4-5) may only select or reword existing bullets, never add facts,
  and every suggestion is shown as a diff before it is applied.

## Decisions

- Stack: Python/FastAPI backend, React + TypeScript frontend.
- Database: SQLite for now. Move to Postgres when the project outgrows it, so keep
  queries to portable SQLAlchemy and avoid SQLite-only features.
- Encryption at rest: the host's disk/volume encryption, not field-level encryption
  in the app. Data in transit goes over HTTPS only; backups must be encrypted too.
- Re-importing a CV matches new roles and bullets to the current ones. For each
  matched bullet the user chooses: replace (the new text becomes a new version of
  the old bullet, source `import`, keeping its history, tags, and resume selections),
  merge (the user edits a combined text, saved as a new version of the old bullet),
  or add as new (a separate bullet with its own history; the user also chooses
  whether the old bullet is archived or both stay in the bullet bank). Old roles and bullets that nothing matched are
  archived (`archived_at`), never deleted, so existing resumes keep them. Archived
  roles are hidden from the bullet bank and their bullets can't be added to new
  resumes; promoting an override onto an archived bullet warns first.

## Working conventions

- Plan before coding: agree a feature's design (plan mode) before any code is written.
- One feature per branch, merged when tests pass and the diff has been reviewed.
- New behaviour comes with tests in the same change.
- Every importer rule gets a test; prefer adding a case to the sample-based tests.
- No database migrations at first: tables come from `create_all` at startup. Add
  Alembic before the first deploy, since that is when real data first needs to
  survive a schema change.
- MVP scope is the list in `SPEC.md`. New ideas go to a backlog, not into the
  current feature.

## Privacy

`samples/` and any imported data hold personal details (email, work history).
`samples/` is git-ignored, and `*.db` files are ignored
in `backend/`. Keep real CV data out of commits, tests, and fixtures; tests use the
fictional CV in `backend/tests/fixtures/`.
