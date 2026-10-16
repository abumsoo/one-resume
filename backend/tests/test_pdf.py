import pytest

from app.pdf import PdfError, extract_text


def test_sample_pdf_matches_fixture(sample_pdf, sample_text):
    # The importer tests run on the .txt fixture; this keeps it honest. If the
    # extractor or its version changes the layout, regenerate the fixture and
    # check the importer tests still pass.
    assert extract_text(sample_pdf) == sample_text


def test_unreadable_pdf_raises():
    with pytest.raises(PdfError):
        extract_text(b"%PDF-1.4 not really a pdf")
