import re
from io import BytesIO
from collections import Counter
import pdfplumber
from docx import Document


def extract_text_from_pdf(file_content: bytes) -> str:
    """PDF 파일에서 폰트 크기 기반으로 제목을 구분하여 텍스트를 추출합니다."""
    with pdfplumber.open(BytesIO(file_content)) as pdf:
        # 1단계: 모든 문자의 폰트 크기를 수집하여 본문 크기 결정
        all_sizes = []
        for page in pdf.pages:
            chars = page.chars
            for char in chars:
                if char.get("text", "").strip():
                    size = round(char.get("size", 0), 1)
                    if size > 0:
                        all_sizes.append(size)

        if not all_sizes:
            # 문자 정보가 없으면 기본 텍스트 추출
            return _fallback_extract(pdf)

        # 가장 많이 사용된 폰트 크기를 본문 크기로 결정
        size_counter = Counter(all_sizes)
        body_size = size_counter.most_common(1)[0][0]

        # 제목으로 간주할 최소 크기 (본문보다 1.2배 이상 큰 것)
        title_threshold = body_size * 1.2

        # 2단계: 페이지별로 텍스트 추출 (폰트 크기 정보 포함)
        result_parts = []

        for page in pdf.pages:
            chars = page.chars
            if not chars:
                continue

            # 같은 줄의 문자들을 그룹화 (y 좌표 기준)
            lines = _group_chars_into_lines(chars)

            for line_chars in lines:
                if not line_chars:
                    continue

                # 줄의 평균 폰트 크기 계산
                sizes = [c.get("size", 0) for c in line_chars if c.get("size", 0) > 0]
                if not sizes:
                    continue

                avg_size = sum(sizes) / len(sizes)
                text = "".join(c.get("text", "") for c in line_chars).strip()

                if not text:
                    continue

                # 제목인 경우 앞에 빈 줄 추가
                if avg_size >= title_threshold:
                    if result_parts and result_parts[-1] != "":
                        result_parts.append("")
                    result_parts.append(text)
                    result_parts.append("")  # 제목 뒤에도 빈 줄
                else:
                    result_parts.append(text)

        # 본문 줄들을 병합
        return _merge_body_lines(result_parts, body_size)


def _group_chars_into_lines(chars: list) -> list:
    """문자들을 y 좌표 기준으로 줄 단위로 그룹화합니다."""
    if not chars:
        return []

    # y 좌표(top)로 정렬
    sorted_chars = sorted(chars, key=lambda c: (c.get("top", 0), c.get("x0", 0)))

    lines = []
    current_line = []
    current_y = None
    y_tolerance = 3  # 같은 줄로 간주할 y 좌표 허용 오차

    for char in sorted_chars:
        char_y = char.get("top", 0)

        if current_y is None:
            current_y = char_y
            current_line = [char]
        elif abs(char_y - current_y) <= y_tolerance:
            current_line.append(char)
        else:
            # 새 줄 시작
            if current_line:
                # x 좌표로 정렬하여 저장
                current_line.sort(key=lambda c: c.get("x0", 0))
                lines.append(current_line)
            current_line = [char]
            current_y = char_y

    # 마지막 줄 추가
    if current_line:
        current_line.sort(key=lambda c: c.get("x0", 0))
        lines.append(current_line)

    return lines


def _merge_body_lines(parts: list, body_size: float) -> str:
    """본문 줄들을 적절히 병합합니다."""
    merged = []
    buffer = ""

    for part in parts:
        # 빈 줄이면 문단 구분
        if not part:
            if buffer:
                merged.append(buffer)
                buffer = ""
            merged.append("")
            continue

        # 버퍼가 비어있으면 새로 시작
        if not buffer:
            buffer = part
            continue

        # 이전 줄이 문장 종결 부호로 끝났으면 새 문단
        if buffer.endswith(('.', '!', '?', '。', '"', '"', '）', ')')):
            merged.append(buffer)
            buffer = part
            continue

        # 하이픈으로 끝나면 단어가 잘린 것
        if buffer.endswith('-'):
            buffer = buffer[:-1] + part
        else:
            buffer = buffer + ' ' + part

    if buffer:
        merged.append(buffer)

    # 연속 빈 줄을 하나로 정리
    result = '\n'.join(merged)
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()


def _fallback_extract(pdf) -> str:
    """폰트 정보가 없을 때 기본 텍스트 추출."""
    text_parts = []
    for page in pdf.pages:
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
