"""Turn an uploaded PDF into the text the importer splits.

Uses poppler's `pdftotext -layout`, which keeps the right-aligned dates and
bullet indentation the importer relies on. This is the one place to swap in
another extractor (e.g. PyMuPDF) for comparison.
"""

import shutil
import subprocess

TIMEOUT_SECONDS = 30


class PdfError(Exception):
    """The PDF could not be turned into text."""


def extract_text(pdf: bytes) -> str:
    binary = shutil.which("pdftotext")
    if binary is None:
        raise PdfError("pdftotext is not installed (install poppler-utils)")
    try:
        result = subprocess.run(
            [binary, "-layout", "-enc", "UTF-8", "-", "-"],
            input=pdf,
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise PdfError("pdftotext timed out") from exc
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip()
        raise PdfError(f"Could not read the PDF: {detail or 'pdftotext failed'}")
    return result.stdout.decode("utf-8")
