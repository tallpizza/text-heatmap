from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List
from services.extraction import extract_important_parts
from services.file_parser import extract_text
from config import MAX_CHARACTERS, MAX_FILE_SIZE_MB

router = APIRouter()


class TextRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    words: List[str]
    scores: List[float]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(request: TextRequest):
    """텍스트를 분석하여 단어별 중요도를 반환합니다."""
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="텍스트가 비어있습니다.")

    if len(text) > MAX_CHARACTERS:
        raise HTTPException(
            status_code=400,
            detail=f"텍스트가 너무 깁니다. 최대 {MAX_CHARACTERS}자까지 가능합니다.",
        )

    try:
        words, scores = await extract_important_parts(text)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return AnalyzeResponse(words=words, scores=scores)


@router.post("/analyze/file", response_model=AnalyzeResponse)
async def analyze_file(file: UploadFile = File(...)):
    """파일을 업로드하여 텍스트를 분석합니다."""
    # 파일 크기 확인
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE_MB}MB까지 가능합니다.",
        )

    # 텍스트 추출
    try:
        text = extract_text(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}")

    text = text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

    if len(text) > MAX_CHARACTERS:
        raise HTTPException(
            status_code=400,
            detail=f"텍스트가 너무 깁니다. 최대 {MAX_CHARACTERS}자까지 가능합니다.",
        )

    try:
        words, scores = await extract_important_parts(text)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return AnalyzeResponse(words=words, scores=scores)
