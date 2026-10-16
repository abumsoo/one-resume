from app.importer import parse_cv_text, parse_role_heading


def test_sample_cv_header(sample_text):
    cv = parse_cv_text(sample_text)
    assert cv.header[0] == "Alex Rivera"
    assert "github.com/example-alex" in cv.header[1]


def test_sample_cv_sections_and_roles(sample_text):
    cv = parse_cv_text(sample_text)
    summary = [(r.section, r.title, r.company) for r in cv.roles]
    assert summary == [
        ("Experience", "Co-founder", "Paper Lantern Labs"),
        ("Experience", "Software Engineer", "Brightline Consulting"),
        ("Experience", "Software Engineer Intern", "Open Data Lab"),
        ("Projects", "Puzzle game (Godot, C#)", "tile tumble"),
        ("Education", "MS Computer Science", "Lakeside State University"),
        ("Education", "BA Mathematics", "River Valley College"),
        ("Skills", None, None),
    ]


def test_sample_cv_role_fields(sample_text):
    paper_lantern, brightline, *_ = parse_cv_text(sample_text).roles
    assert paper_lantern.location == "Portland, OR"
    assert (paper_lantern.start_date, paper_lantern.end_date) == ("June 2024", "May 2026")
    assert (brightline.start_date, brightline.end_date) == ("Jun 2020", "Apr 2023")
    assert paper_lantern.heading.startswith("Co-founder, Paper Lantern Labs")


def test_sample_cv_single_date_and_dateless_entries(sample_text):
    roles = parse_cv_text(sample_text).roles
    project = roles[3]
    assert (project.start_date, project.end_date) == ("Dec 2025", None)
    education = [r for r in roles if r.section == "Education"]
    assert all(r.bullets == [] for r in education)


def test_sample_cv_bullets_join_wrapped_lines(sample_text):
    paper_lantern = parse_cv_text(sample_text).roles[0]
    assert [b.text for b in paper_lantern.bullets] == [
        "Built a full-stack journaling app that limits users to one entry per day "
        "(Next.js, TypeScript, Node.js, PostgreSQL), reaching 40 users and 90 entries in "
        "live deployment (inkwell)",
        "Recorded video tutorials on Rust command-line tools, editor setup with Neovim, "
        "and a live-streamed web app build, gathering 8,000+ views",
    ]


def test_sample_cv_subheadings_group_bullets(sample_text):
    brightline = parse_cv_text(sample_text).roles[1]
    assert [b.subheading for b in brightline.bullets] == [
        "Healthcare client",
        "Healthcare client",
        "Logistics client",
        "Logistics client",
        "Logistics client",
    ]
    assert brightline.bullets[2].text.startswith("Implemented live shipment tracking with WebSockets")


def test_sample_cv_skills_lines_are_items(sample_text):
    skills = parse_cv_text(sample_text).roles[-1]
    assert skills.heading is None
    assert [b.text for b in skills.bullets] == [
        "Languages/frameworks: TypeScript, JavaScript, Python, Rust, C#, React, Next.js, "
        "Node.js, PostgreSQL",
        "Testing/tools/infrastructure: Jest, Playwright, REST APIs, Git, Docker, AWS, Godot",
        "AI-assisted development: Claude Code, Neovim",
    ]


def test_sample_cv_strips_invisible_characters(sample_text):
    cv = parse_cv_text(sample_text)
    texts = [b.text for r in cv.roles for b in r.bullets] + [r.heading or "" for r in cv.roles]
    assert not any("​" in t for t in texts)
    assert sum(len(r.bullets) for r in cv.roles) == 13


def test_plain_text_without_layout():
    text = """JANE DOE
jane@example.com

SUMMARY
Backend engineer who likes boring technology.

WORK EXPERIENCE
Staff Engineer, Acme Corp - Remote    2019 - Present
- Led the billing rewrite,
  cutting invoice errors by 40%
- Mentored four engineers
Engineer, Initech – Austin, TX    Mar 2015 to Dec 2018
* Shipped the TPS report service
"""
    cv = parse_cv_text(text)
    assert cv.header == ["JANE DOE", "jane@example.com"]
    summary, acme, initech = cv.roles
    assert summary.section == "SUMMARY"
    assert [b.text for b in summary.bullets] == ["Backend engineer who likes boring technology."]
    assert (acme.title, acme.company, acme.location) == ("Staff Engineer", "Acme Corp", "Remote")
    assert (acme.start_date, acme.end_date) == ("2019", "Present")
    assert [b.text for b in acme.bullets] == [
        "Led the billing rewrite, cutting invoice errors by 40%",
        "Mentored four engineers",
    ]
    assert (initech.start_date, initech.end_date) == ("Mar 2015", "Dec 2018")
    assert [b.text for b in initech.bullets] == ["Shipped the TPS report service"]


def test_role_heading_requires_date():
    assert parse_role_heading("Healthcare client", "Experience") is None
    assert parse_role_heading("Built it in 2020", "Experience") is None


def test_bullet_ending_in_year_is_not_a_heading():
    cv = parse_cv_text("Experience\nEngineer, Acme   2020 – 2021\n• Migrated the database in 2020\n")
    (role,) = cv.roles
    assert [b.text for b in role.bullets] == ["Migrated the database in 2020"]


def test_wrapped_all_caps_word_continues_the_bullet():
    text = """Experience
Engineer, Acme   2020 – 2021
●  Migrated the payment services to
      AWS.
●  Cut deploy time in half
"""
    cv = parse_cv_text(text)
    assert [r.section for r in cv.roles] == ["Experience"]
    assert [b.text for b in cv.roles[0].bullets] == [
        "Migrated the payment services to AWS.",
        "Cut deploy time in half",
    ]


def test_all_caps_line_in_header_stays_in_header():
    text = """Jane Doe
SENIOR SOFTWARE ENGINEER
jane@example.com

Experience
Engineer, Acme   2020 – 2021
- Shipped things
"""
    cv = parse_cv_text(text)
    assert cv.header == ["Jane Doe", "SENIOR SOFTWARE ENGINEER", "jane@example.com"]
    assert [r.section for r in cv.roles] == ["Experience"]


def test_all_caps_line_after_a_section_starts_a_new_section():
    cv = parse_cv_text("Experience\nEngineer, Acme   2020 – 2021\n- Shipped things\n\nTOOLS\nGit\n")
    assert [r.section for r in cv.roles] == ["Experience", "TOOLS"]
