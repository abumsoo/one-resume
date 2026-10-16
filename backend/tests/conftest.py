from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings

# A fictional CV in the same layout as a real Google Docs export; see the
# comment in sample_cv.html for how to regenerate the PDF and text.
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SAMPLE_PDF = FIXTURES / "sample_cv.pdf"
SAMPLE_TEXT = FIXTURES / "sample_cv.txt"


@pytest.fixture
def sample_text() -> str:
    return SAMPLE_TEXT.read_text()


@pytest.fixture
def sample_pdf() -> bytes:
    return SAMPLE_PDF.read_bytes()


@pytest.fixture
def client(tmp_path) -> TestClient:
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}")
    return TestClient(create_app(settings))
