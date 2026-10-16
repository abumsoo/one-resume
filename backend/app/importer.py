"""Split a plain-text CV into sections, roles, and bullets.

The input is text as it comes out of a PDF or doc export (for PDFs,
`pdftotext -layout` works best). Rules, applied line by line:

- Lines before the first section heading are the header (name, contact).
- A section heading is a known name ("Experience", "Skills", ...). Once inside
  a section, a short all-caps line is one too, unless it continues the bullet
  above (e.g. a wrapped "AWS."). The header only ends at a known name, so an
  all-caps title under the name stays in the header.
- A role heading is a line ending in a date or date range, e.g.
  "Software Engineer, Acme Corp – Chicago, IL    Jun 2020 – Apr 2023".
- A bullet starts with a marker (●, •, -, * ...). A following line that is
  indented further, or starts lowercase, continues it.
- A plain line followed by bullets is a subheading that groups them
  ("Healthcare client"). Any other plain line is an item on its own, which is
  how Skills lines and unbulleted entries are kept.

Imports are imperfect by nature, so every role keeps its raw heading and the
whole input is stored on the CvImport for manual fixes.
"""

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import Bullet, BulletVersion, CvImport, Role

KNOWN_SECTIONS = {
    "summary", "profile", "about", "objective",
    "experience", "work experience", "professional experience", "employment",
    "employment history", "work history",
    "projects", "personal projects", "selected projects",
    "education", "skills", "technical skills", "certifications", "awards",
    "publications", "volunteering", "volunteer experience", "leadership",
    "languages", "interests",
}  # fmt: skip

# Invisible characters that PDF and Docs exports scatter through text.
INVISIBLE = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)

BULLET_RE = re.compile(r"^(\s*)(?:[●•▪◦‣∙·○■□➢►*]|[-–—](?=\s))\s*(.*)$")

_MONTH = (
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?"
    r"|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?"
)
_DATE = rf"(?:\b{_MONTH}\s+\d{{4}}|\b\d{{1,2}}/\d{{4}}|\b\d{{4}}|\bPresent\b|\bCurrent\b|\bNow\b)"
DATES_AT_END_RE = re.compile(
    rf"(?:(?P<start>{_DATE})\s*(?:[–—-]|to)\s*(?P<end>{_DATE})"
    rf"|(?P<single>\b{_MONTH}\s+\d{{4}})"
    # A bare year only counts when set apart from the text, as layout output does.
    rf"|(?:\t|\s{{2}})\s*(?P<year>\d{{4}}))\s*$",
    re.IGNORECASE,
)
SPACED_DASH_RE = re.compile(r"\s+[–—-]\s+")


@dataclass
class ParsedBullet:
    text: str
    subheading: str | None = None


@dataclass
class ParsedRole:
    section: str
    heading: str | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[ParsedBullet] = field(default_factory=list)


@dataclass
class ParsedCv:
    header: list[str] = field(default_factory=list)
    roles: list[ParsedRole] = field(default_factory=list)


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def _is_section_heading(text: str, *, allow_caps: bool) -> bool:
    name = text.rstrip(":").strip()
    if name.lower() in KNOWN_SECTIONS:
        return True
    return (
        allow_caps
        and name.isupper()
        and len(name.split()) <= 4
        and not any(c.isdigit() for c in name)
    )


def _top_level_comma(text: str) -> int | None:
    depth = 0
    for i, char in enumerate(text):
        if char in "([":
            depth += 1
        elif char in ")]":
            depth = max(depth - 1, 0)
        elif char == "," and depth == 0:
            return i
    return None


def parse_role_heading(line: str, section: str) -> ParsedRole | None:
    """Parse a heading such as "Title, Company – City, ST   Jan 2020 – Present".

    Returns None when the line does not end in a date.
    """
    match = DATES_AT_END_RE.search(line)
    if not match or not line[: match.start()].strip():
        return None
    if match["start"]:
        start, end = match["start"], match["end"]
    else:
        start, end = match["single"] or match["year"], None

    text = line[: match.start()].strip().rstrip("|,–—-").strip()
    left, _, right = (part.strip() for part in _partition_dash(text))
    comma = _top_level_comma(left)
    if comma is not None:
        # "Title, Company – Location"
        title, company, location = left[:comma].strip(), left[comma + 1 :].strip(), right
    else:
        # "Degree – School" or "Project – Description"
        title, company, location = left, right, ""

    return ParsedRole(
        section=section,
        heading=line.strip(),
        title=title or None,
        company=company or None,
        location=location or None,
        start_date=start,
        end_date=end,
    )


def _partition_dash(text: str) -> tuple[str, str, str]:
    match = SPACED_DASH_RE.search(text)
    if not match:
        return text, "", ""
    return text[: match.start()], match.group(), text[match.end() :]


def parse_cv_text(text: str) -> ParsedCv:
    lines = [line.translate(INVISIBLE).replace("\xa0", " ").rstrip() for line in text.splitlines()]
    cv = ParsedCv()
    section: str | None = None
    role: ParsedRole | None = None
    subheading: str | None = None
    # The bullet that a continuation line would extend, and its indent.
    open_bullet: ParsedBullet | None = None
    open_indent = 0

    def next_content_line(i: int) -> str | None:
        for later in lines[i + 1 :]:
            if later.strip():
                return later
        return None

    def start_section(name: str) -> None:
        nonlocal section, role, subheading, open_bullet
        section, role, subheading, open_bullet = name.rstrip(":"), None, None, None

    def add_bullet(text: str, indent: int) -> None:
        nonlocal role, open_bullet, open_indent
        if role is None:
            # Items of a section with no entries, such as Skills.
            role = ParsedRole(section=section)
            cv.roles.append(role)
        open_bullet = ParsedBullet(text=text, subheading=subheading)
        open_indent = indent
        role.bullets.append(open_bullet)

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            open_bullet = None
            continue

        if _is_section_heading(stripped, allow_caps=False):
            start_section(stripped)
            continue
        if section is None:
            cv.header.append(stripped)
            continue

        bullet = BULLET_RE.match(line)
        if bullet:
            add_bullet(bullet.group(2).strip(), _indent(line))
            continue

        if open_bullet and (_indent(line) > open_indent or stripped[0].islower()):
            open_bullet.text = f"{open_bullet.text} {stripped}"
            continue

        if _is_section_heading(stripped, allow_caps=True):
            start_section(stripped)
            continue

        heading = parse_role_heading(stripped, section)
        if heading:
            role, subheading, open_bullet = heading, None, None
            cv.roles.append(role)
            continue

        following = next_content_line(i)
        if role is not None and role.heading and following and BULLET_RE.match(following):
            subheading, open_bullet = stripped, None
        else:
            add_bullet(stripped, _indent(line))

    return cv


def import_cv(session: Session, text: str, filename: str | None = None) -> CvImport:
    """Parse `text` and store it as the CV, each bullet at version 1.

    The caller checks that no CV exists yet: re-import, which matches new bullets
    to old ones, is not built.
    """
    parsed = parse_cv_text(text)
    record = CvImport(filename=filename, raw_text=text, header="\n".join(parsed.header))
    for role_pos, parsed_role in enumerate(parsed.roles):
        role = Role(
            section=parsed_role.section,
            heading=parsed_role.heading,
            title=parsed_role.title,
            company=parsed_role.company,
            location=parsed_role.location,
            start_date=parsed_role.start_date,
            end_date=parsed_role.end_date,
            position=role_pos,
        )
        for bullet_pos, parsed_bullet in enumerate(parsed_role.bullets):
            role.bullets.append(
                Bullet(
                    text=parsed_bullet.text,
                    subheading=parsed_bullet.subheading,
                    tags=[],
                    version=1,
                    position=bullet_pos,
                    versions=[BulletVersion(version=1, text=parsed_bullet.text, source="import")],
                )
            )
        record.roles.append(role)
    session.add(record)
    session.commit()
    return record
