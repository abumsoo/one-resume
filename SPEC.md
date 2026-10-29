# Resume Manager: One-Page Spec

Oct 12, 2026 · @Bum

## Problem and goal

The goal is one master CV that stays current, with every tailored resume traceable back to it. Today the CV goes stale: wording improvements made inside role-specific Google Docs never reach it, and copies pile up in per-company folders.

Three frictions this app removes:

- **Drift:** better bullets live only in your latest tailored resume, so the CV is out of date within weeks.
- **Copy overhead:** each application means copying a doc, filing it under the company, editing, and exporting.
- **Filename collisions:** every export must be named `Resume_BumSooKim.pdf`, so exports overwrite each other locally.

Target: tailor a resume for a job in under 10 minutes without editing a copy by hand, and promote any improvement back to the CV in one click.

## Core workflow

A tailored resume pulls bullets from the CV bank, and any wording you improve can be promoted back so the CV stays current.

&#91;embedded content: core workflow · 4 steps, 1 loop\]

Read it as a loop: bullets go out to a resume, and improvements come back as new bullet versions.

The app is two pages:

- **Home:** an Upload CV button when no CV is on file; otherwise Edit resume, which opens the main resume, and Create new resume, which starts a tailored resume from the main one for a job application.
- **Edit page:** one page for both the main resume and tailored ones. It lists the resume's sections (header, education, professional experience, projects, skills, or a custom section) as cards you click into to edit and drag to reorder, beside a live preview of the PDF output. The preview renders the same HTML template that export prints, so it matches the PDF except for page breaks.

The main resume is the CV: editing it edits the bullet bank directly, and every text change is a new bullet version. Editing a tailored resume changes that resume only (which bullets it selects, their order, the section order, and wording overrides); its wording reaches the main resume only through promote.

## Data model

A CV is a bank of bullets and a resume is a selection from it, so nothing is copied and each bullet is fixed in one place.

| Entity | Key fields | Notes |
| --- | --- | --- |
| CvImport | raw text, header (name, contact) | The original input of an import, kept so a bad split can be fixed by hand |
| Role | section, raw heading, company, title, dates (as written), location, archived at | Belongs to the CV; archived roles are hidden from the bullet bank |
| Bullet | text, role, optional subheading, skill tags, version | The atomic unit; every edit keeps history |
| BulletVersion | bullet, text, source (import, edit, promote) | Every text a bullet has had |
| Section | name, kind (header, education, experience, projects, skills, custom), position | The ordered sections of the main resume; roles belong to a section. Not built yet: today a role holds its section as a name |
| Resume | name, target company, job description, template, section order | One per application; its section order starts as a copy of the main resume's |
| Selection | resume, bullet, order, override text (optional), base version | Picks a bullet; an override changes the wording for this resume only, and base version is the bullet version it was written against |
| Export | resume, date, file path | A record of what was sent where |

Summary, skills, and education are stored the same way, as a section holding items.

Promote-back is the key feature. Promoting an override saves it as a new version of the source bullet in the CV. Every override shows a diff against its source, and the CV page lists overrides that have not been promoted yet, so drift is always visible.

## MVP scope

The MVP covers the whole loop for one person, without AI, and should be usable in 2-3 weeks.

Ships in the MVP:

- Import the existing CV from PDF, and split it into roles and bullets
- Bullet bank with skill tags and edit history
- Home page: upload a CV, edit the main resume, create a new resume
- Edit page for the main resume and tailored ones: click a section to edit it, drag sections to reorder them, add custom sections, and see a live preview
- Create a resume from the main one: pick bullets, reorder, override wording, one template
- Promote an override back to the CV, with a diff
- PDF export named `Resume_BumSooKim.pdf`, saved into a per-company folder, with an export log
- An "overrides not yet promoted" view

Left out for now: multi-user accounts (one sign-in is enough for now), many templates, two-way Google Docs sync, LinkedIn auto-fill, and job board scraping.

## AI features

The AI suggests and you decide, and every change appears as a diff before it is applied.

1. **Bullet picker:** paste a job description and the app ranks your bullets by relevance and proposes a selection.
2. **Keyword gaps:** lists requirements in the posting that no selected bullet covers, and which unused bullets could cover them.
3. **Reword suggestions:** proposes wording closer to the posting's language, saved as an override.
4. **Promote hints:** flags overrides that read better than their source bullet and offers to promote them.

Guardrails: the model may only select or reword existing bullets, and never adds experience, numbers, or technologies that are not in the CV. A check compares suggested text with its source and warns when it introduces a new fact. Keep a small set of saved job descriptions to test suggestions against, so changes to prompts do not quietly make results worse.

## Tech stack

TypeScript on the frontend and Python on the backend, which also suits the AI layer.

- **Frontend:** React with TypeScript, with drag-and-drop for ordering bullets
- **Backend:** Python with FastAPI over SQLite or Postgres
- **PDF export:** render the resume as HTML and print it with a headless browser such as Playwright, which gives exact control over layout and file name
- **AI:** an LLM API with structured (JSON) outputs for ranking and rewording; embeddings are optional for relevance ranking
- **Hosting:** a single deployed app (cloud container) with sign-in, reachable from anywhere, which doubles as your cloud practice

## Build plan

Four weeks gets you a usable MVP, and three more add the AI layer and ship it. Each week assumes about 14-16 project hours.

1. **Week 1, data and import:** schema, CV import from PDF (text extracted with `pdftotext -layout`, which needs poppler installed) into roles and bullets, and the bullet bank with edit history. Delivered as the API plus a minimal bullet-bank page: upload a PDF, view roles and bullets, edit role fields (title, company, location, dates, and section for roles with a heading) and bullet text, and add skill tags by hand. Runs locally without sign-in. Done when your real CV loads and edits save.
2. **Week 2, edit page:** the home page, and the edit page for the main resume: sections as cards, drag to reorder, header editing, custom sections, the one template, and the live preview.
3. **Week 3, tailored resumes and export:** Create new resume, select and reorder bullets, overrides, and PDF export with the fixed file name and per-company folder.
4. **Week 4, promote-back:** diff view, the promote action, and the "not yet promoted" list. Add single-user sign-in and Alembic migrations, then deploy it this week so you can use it from anywhere. Done when you have used it for a real application.
5. **Week 5, AI picker and keyword gaps:** job description in, ranked bullets and gaps out, with diffs.
6. **Week 6, rewording and guardrails:** reword suggestions, the new-fact check, and saved test job descriptions.
7. **Week 7, ship:** harden the deployment, write a README with a short demo video, and document the design decisions.

## Risks and how to present it

The biggest risk is scope creep, and the second is that AI resume tools are common, so the source-of-truth sync is what has to stand out.

- **Scope creep:** hold the MVP list above and send new ideas to a backlog.
- **Fabrication:** an AI rewording that adds claims could end up in a real application, which is why diffs are mandatory and the guardrails check for new facts.
- **Import quality:** messy imports, PDFs especially, may split badly, so allow manual fixes and keep the original text.
- **Crowded category:** differentiate on bullet-level provenance and promote-back, not on templates.

Decided: you will import your CV from PDFs in the MVP, but will eventually want to be able to import word docs, google docs, and plain text. It will also be a hosted app, so you can reach it from anywhere, with sign-in and encrypted storage, since a resume holds personal details.

Also decided: re-importing a CV matches the new roles and bullets to the current ones, and for each matched bullet asks whether to replace the old bullet (new version, keeping its history, tags, and resume selections), merge the two texts, or add it as a new bullet (and then whether to archive the old bullet or keep both in the bullet bank). Old roles and bullets that nothing matched are archived, never deleted, so existing resumes keep them. Skill tags are added by hand for now.

On your own resume, a line like "Built a resume manager with a bullet-level source of truth and LLM-assisted tailoring" works if you can then walk through the data model, the guardrails, and how you tested suggestions.

## Open questions

- What else the home page shows, for example a list of tailored resumes and their exports.
- Whether a custom section needs adding new roles and bullets by hand, which is in the backlog today.

## Backlog

Ideas that are out of the current scope, kept here so they don't creep in:

- Try PyMuPDF for PDF text extraction and compare its output with `pdftotext` on the sample CV
- Move a bullet to another role; split, merge, or delete bullets and roles
- Seed skill tags from the CV's Skills section
- Import from Word, Google Docs, and plain text
- Re-import with bullet matching (behaviour decided above; not yet scheduled in a week)
