from io import BytesIO
from PyPDF2 import PdfReader
from docx import Document


def extract_text_from_pdf(file_content: bytes) -> str:
    """PDF 파일에서 텍스트를 추출합니다."""
    reader = PdfReader(BytesIO(file_content))
    text_parts = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)

    return "\n".join(text_parts)


def extract_text_from_docx(file_content: bytes) -> str:
    """DOCX 파일에서 텍스트를 추출합니다."""
    doc = Document(BytesIO(file_content))
    text_parts = []

    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)

    return "\n".join(text_parts)


def extract_text_from_txt(file_content: bytes) -> str:
    """TXT 파일에서 텍스트를 추출합니다."""
    return file_content.decode("utf-8")


def extract_text(filename: str, file_content: bytes) -> str:
    """파일 확장자에 따라 적절한 파서를 사용하여 텍스트를 추출합니다."""
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_content)
    elif filename_lower.endswith(".docx"):
        return extract_text_from_docx(file_content)
    elif filename_lower.endswith(".txt"):
        return extract_text_from_txt(file_content)
    else:
        raise ValueError(f"지원하지 않는 파일 형식입니다: {filename}")
