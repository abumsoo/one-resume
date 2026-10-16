from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from app import routes
from app.db import Base, make_engine
from app.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = make_engine(settings.database_url)
    # No migrations yet; Alembic comes before the first deploy (Week 3).
    Base.metadata.create_all(engine)

    app = FastAPI(title="One Resume")
    app.state.settings = settings
    app.state.sessionmaker = sessionmaker(engine, expire_on_commit=False)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(routes.router, prefix="/api")
    return app
