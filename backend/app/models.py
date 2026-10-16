"""The CV bullet bank.

A CV is a bank of roles and bullets. Every change to a bullet's text is kept as
a BulletVersion, so later features (resume overrides, promote-back) can diff
against, and write back onto, a known version.
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, TypeDecorator, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator):
    """A datetime stored as UTC and always read back timezone-aware.

    SQLite drops the timezone, so without this the API would send naive
    times that browsers read as local time.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


class CvImport(Base):
    """The original text of an import, kept so a bad split can be fixed by hand."""

    __tablename__ = "cv_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str | None] = mapped_column(String(255))
    raw_text: Mapped[str] = mapped_column(Text)
    # Lines above the first section: name, contact details.
    header: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    roles: Mapped[list["Role"]] = relationship(back_populates="cv_import")


class Role(Base):
    """An entry in a CV section: a job, project, or degree.

    Sections without entries of their own (Skills, Summary) are stored as a
    single role with no heading whose bullets are the section's items.

    Roles are archived, never deleted, so resumes that select their bullets keep
    working. Archived roles are left out of the bullet bank. Nothing archives yet:
    re-import, which will, is not built.
    """

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    cv_import_id: Mapped[int | None] = mapped_column(ForeignKey("cv_imports.id"))
    section: Mapped[str] = mapped_column(String(100))
    heading: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    # Kept as written ("Jun 2021", "Present"); parsed when sorting needs it.
    start_date: Mapped[str | None] = mapped_column(String(50))
    end_date: Mapped[str | None] = mapped_column(String(50))
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    cv_import: Mapped[CvImport | None] = relationship(back_populates="roles")
    bullets: Mapped[list["Bullet"]] = relationship(
        back_populates="role", cascade="all, delete-orphan", order_by="Bullet.position"
    )


class Bullet(Base):
    __tablename__ = "bullets"

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    # Group label inside a role, e.g. "Healthcare client".
    subheading: Mapped[str | None] = mapped_column(String(255))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(default=1)
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, onupdate=utcnow)

    role: Mapped[Role] = relationship(back_populates="bullets")
    versions: Mapped[list["BulletVersion"]] = relationship(
        back_populates="bullet", cascade="all, delete-orphan", order_by="BulletVersion.version"
    )

    def set_text(self, text: str, source: str = "edit") -> None:
        """Change the wording, keeping the previous text in the history."""
        if text == self.text:
            return
        self.version += 1
        self.text = text
        self.versions.append(BulletVersion(version=self.version, text=text, source=source))


class BulletVersion(Base):
    __tablename__ = "bullet_versions"
    __table_args__ = (UniqueConstraint("bullet_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bullet_id: Mapped[int] = mapped_column(ForeignKey("bullets.id", ondelete="CASCADE"))
    version: Mapped[int]
    text: Mapped[str] = mapped_column(Text)
    # "import", "edit", or "promote" (an override saved back to the CV).
    source: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    bullet: Mapped[Bullet] = relationship(back_populates="versions")
