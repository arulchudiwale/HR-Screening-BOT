import PyPDF2
from docx import Document
import io

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text from a PDF file (bytes), handles encrypted/corrupt/empty files safely."""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        if reader.is_encrypted:
            try:
                reader.decrypt("")  # Sometimes empty password works
            except Exception:
                return "[Error reading PDF: File is encrypted.]"
        for page in reader.pages:
            page_text = page.extract_text() if hasattr(page, "extract_text") else None
            if page_text:
                text += page_text
        # Post-process for extra whitespace/empty:
        out = text.strip()
        if not out:
            return "[Error reading PDF: No extractable text found.]"
        return out
    except Exception as e:
        return f"[Error reading PDF: {e}]"

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts text from a DOCX file (bytes), skips empty lines."""
    try:
        doc = Document(io.BytesIO(file_bytes))
        lines = [para.text.strip() for para in doc.paragraphs if para.text and para.text.strip()]
        out = "\n".join(lines).strip()
        if not out:
            return "[Error reading DOCX: No text found in DOCX document.]"
        return out
    except Exception as e:
        return f"[Error reading DOCX: {e}]"

def parse_resume(file: bytes, filename: str) -> str:
    """Determines file type by extension, routes to extractor, returns error if unsupported."""
    ext = filename.lower().strip().split('.')[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file)
    elif ext == "docx":
        return extract_text_from_docx(file)
    else:
        return f"[Unsupported file format: {filename}]"
