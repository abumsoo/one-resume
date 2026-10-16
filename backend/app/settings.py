import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./one_resume.db"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(database_url=os.environ.get("ONE_RESUME_DATABASE_URL", cls.database_url))
