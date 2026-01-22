from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from services.extraction import extract_important_parts_single_chunk, split_into_chunks, split_into_words
from services.file_parser import extract_text
from config import MAX_CHARACTERS, MAX_FILE_SIZE_MB

router = APIRouter()


class TextRequest(BaseModel):
    text: str


class ChunkRequest(BaseModel):
    text: str
    chunk_index: int


class AnalyzeResponse(BaseModel):
    words: List[str]
    scores: List[float]


class ChunkAnalyzeResponse(BaseModel):
    words: List[str]
    scores: List[float]
    chunk_index: int
    total_chunks: int


class FileUploadResponse(BaseModel):
    text: str
    total_chunks: int
    total_characters: int


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(request: TextRequest):
    """짧은 텍스트를 분석하여 단어별 중요도를 반환합니다."""
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="텍스트가 비어있습니다.")

    # 짧은 텍스트는 바로 처리
    if len(text) > 50000:
        raise HTTPException(
            status_code=400,
            detail="텍스트가 너무 깁니다. 긴 텍스트는 파일 업로드를 사용해주세요.",
        )

    try:
        words, scores = await extract_important_parts_single_chunk(text)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return AnalyzeResponse(words=words, scores=scores)


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """파일을 업로드하여 텍스트를 추출합니다. (분석은 별도 요청)"""
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE_MB}MB까지 가능합니다.",
        )

    try:
        text = extract_text(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}")

    text = text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

    chunks = split_into_chunks(text)

    return FileUploadResponse(
        text=text,
        total_chunks=len(chunks),
        total_characters=len(text),
    )


@router.post("/analyze/chunk", response_model=ChunkAnalyzeResponse)
async def analyze_chunk(request: ChunkRequest):
    """특정 청크만 분석합니다."""
    text = request.text.strip()
    chunk_index = request.chunk_index

    if not text:
        raise HTTPException(status_code=400, detail="텍스트가 비어있습니다.")

    chunks = split_into_chunks(text)
    total_chunks = len(chunks)

    if chunk_index < 0 or chunk_index >= total_chunks:
        raise HTTPException(
            status_code=400,
            detail=f"잘못된 청크 인덱스입니다. (0-{total_chunks - 1})",
        )

    chunk_text = chunks[chunk_index]

    try:
        words, scores = await extract_important_parts_single_chunk(chunk_text)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return ChunkAnalyzeResponse(
        words=words,
        scores=scores,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
    )


# 기존 파일 분석 엔드포인트 (하위 호환성)
@router.post("/analyze/file", response_model=AnalyzeResponse)
async def analyze_file(file: UploadFile = File(...)):
    """파일을 업로드하여 첫 번째 청크를 분석합니다."""
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE_MB}MB까지 가능합니다.",
        )

    try:
        text = extract_text(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}")

    text = text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

    # 첫 번째 청크만 분석
    chunks = split_into_chunks(text)
    first_chunk = chunks[0] if chunks else text

    try:
        words, scores = await extract_important_parts_single_chunk(first_chunk)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return AnalyzeResponse(words=words, scores=scores)
