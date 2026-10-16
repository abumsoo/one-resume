from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BulletOut(ORM):
    id: int
    role_id: int
    text: str
    subheading: str | None
    tags: list[str]
    version: int
    position: int


class BulletVersionOut(ORM):
    version: int
    text: str
    source: str
    created_at: datetime


class BulletUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, tags: list[str] | None) -> list[str] | None:
        """Trim each tag, drop empty ones, and drop repeats, keeping the first."""
        if tags is None:
            return None
        return list(dict.fromkeys(t.strip() for t in tags if t.strip()))


class RoleOut(ORM):
    id: int
    section: str
    heading: str | None
    title: str | None
    company: str | None
    location: str | None
    start_date: str | None
    end_date: str | None
    position: int
    archived_at: datetime | None
    bullets: list[BulletOut]


class RoleUpdate(BaseModel):
    section: str | None = Field(default=None, min_length=1)
    title: str | None = None
    company: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class ImportOut(ORM):
    id: int
    filename: str | None
    header: str
    roles: list[RoleOut]
