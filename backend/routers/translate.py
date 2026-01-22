import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
from config import ANTHROPIC_API_KEY, HAIKU_MODEL, CACHE_TTL_TRANSLATE
from services.cache import cache, CacheService

router = APIRouter()


class WordTranslateRequest(BaseModel):
    word: str
    context: str = ""  # 문맥 (선택)


class SentenceTranslateRequest(BaseModel):
    sentence: str


class ParagraphTranslateRequest(BaseModel):
    paragraph: str


class TranslateResponse(BaseModel):
    original: str
    translation: str
    cached: bool = False


@router.post("/translate/word", response_model=TranslateResponse)
async def translate_word(request: WordTranslateRequest):
    """단어를 한글로 번역합니다."""
    word = request.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="단어가 비어있습니다.")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="API 키가 설정되지 않았습니다.")

    # 캐시 확인
    cache_key = CacheService.make_translate_key("word", HAIKU_MODEL, word)
    cached_result = await cache.get(cache_key)
    if cached_result:
        data = json.loads(cached_result)
        return TranslateResponse(original=word, translation=data["translation"], cached=True)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""영어 단어 "{word}"의 한글 뜻을 한 단어로만 답변하세요. 설명, 품사, 화살표 없이 한글만."""

    try:
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        translation = message.content[0].text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"번역 중 오류: {str(e)}")

    # 캐시 저장
    await cache.set(cache_key, json.dumps({"translation": translation}), CACHE_TTL_TRANSLATE)

    return TranslateResponse(original=word, translation=translation, cached=False)


@router.post("/translate/sentence", response_model=TranslateResponse)
async def translate_sentence(request: SentenceTranslateRequest):
    """문장을 한글로 번역합니다."""
    sentence = request.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="문장이 비어있습니다.")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="API 키가 설정되지 않았습니다.")

    # 캐시 확인
    cache_key = CacheService.make_translate_key("sentence", HAIKU_MODEL, sentence)
    cached_result = await cache.get(cache_key)
    if cached_result:
        data = json.loads(cached_result)
        return TranslateResponse(original=sentence, translation=data["translation"], cached=True)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""다음 영어 문장을 한글로 자연스럽게 번역해주세요. 번역문만 답변하세요.

문장: {sentence}"""

    try:
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        translation = message.content[0].text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"번역 중 오류: {str(e)}")

    # 캐시 저장
    await cache.set(cache_key, json.dumps({"translation": translation}), CACHE_TTL_TRANSLATE)

    return TranslateResponse(original=sentence, translation=translation, cached=False)


@router.post("/translate/paragraph", response_model=TranslateResponse)
async def translate_paragraph(request: ParagraphTranslateRequest):
    """문단을 한글로 번역합니다."""
    paragraph = request.paragraph.strip()
    if not paragraph:
        raise HTTPException(status_code=400, detail="문단이 비어있습니다.")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="API 키가 설정되지 않았습니다.")

    # 캐시 확인
    cache_key = CacheService.make_translate_key("paragraph", HAIKU_MODEL, paragraph)
    cached_result = await cache.get(cache_key)
    if cached_result:
        data = json.loads(cached_result)
        return TranslateResponse(original=paragraph, translation=data["translation"], cached=True)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""다음 영어 문단을 한글로 자연스럽게 번역해주세요. 번역문만 답변하세요.

문단: {paragraph}"""

    try:
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        translation = message.content[0].text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"번역 중 오류: {str(e)}")

    # 캐시 저장
    await cache.set(cache_key, json.dumps({"translation": translation}), CACHE_TTL_TRANSLATE)

    return TranslateResponse(original=paragraph, translation=translation, cached=False)
