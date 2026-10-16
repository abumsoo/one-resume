from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    if not url.startswith("sqlite"):
        return create_engine(url)

    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.sessionmaker() as session:
        yield session
