import re
import json
import asyncio
import logging
from typing import List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor
import anthropic
from config import ANTHROPIC_API_KEY, HAIKU_MODEL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_CONCURRENT_CHUNKS = 5  # 동시 처리할 청크 수

CHUNK_SIZE = 5000  # 청크당 최대 문자 수 (빠른 응답 위해 작게 설정)

EXTRACTION_PROMPT = """다음 텍스트에서 핵심 내용을 담은 문장이나 구절을 추출해주세요.
목표: 하이라이트된 부분만 읽어도 전체 내용을 파악할 수 있어야 합니다.

추출 기준:
- 반드시 완전한 문장이나 의미 있는 구절 단위로 추출 (최소 5단어 이상)
- 단독 단어나 짧은 조각은 절대 추출하지 마세요
- 글의 핵심 정보, 주요 사실, 중요한 주장이 담긴 문장
- 누가/언제/무엇을/왜 했는지 알 수 있는 문장
- 숫자, 날짜, 이름 등 구체적 정보가 포함된 문장

좋은 예시:
- "버셀이 18일 AI 코딩 에이전트의 활용도를 높이기 위한 오픈형 기술 묶음인 '에이전트 스킬즈'를 깃허브를 통해 공개했다" (핵심 사실)
- "하나의 스킬은 지침과 선택적 스크립트를 담은 폴더 구조로 구성된다" (구체적 설명)
- "개발자는 코드를 직접 짜는 시간보다, AI가 따를 스킬을 설계하고 관리하는 역량이 중요해질 것" (핵심 주장)

나쁜 예시:
- "에이전트" (단어 조각)
- "깃허브를 통해" (의미 불완전)
- "18일" (맥락 없는 숫자)

점수 기준:
- 0.9~1.0: 글 전체의 핵심을 담은 문장 (리드문, 결론)
- 0.7~0.8: 주요 사실이나 중요한 세부 정보
- 0.5~0.6: 부가적이지만 알아두면 좋은 정보

JSON 형식으로만 응답 (다른 텍스트 없이):
{"sentences": [{"text": "완전한 문장을 그대로 추출", "score": 0.9}, ...]}

텍스트:
"""


def split_into_words(text: str) -> List[str]:
    """텍스트를 단어 단위로 분리합니다. 줄바꿈은 별도 토큰으로 처리."""
    result = []
    lines = text.split('\n')

    for i, line in enumerate(lines):
        words = re.findall(r'\S+', line)
        result.extend(words)

        if i < len(lines) - 1:
            result.append('\n')

    return result


def split_into_chunks(text: str) -> List[str]:
    """텍스트를 청크로 분할합니다. 챕터나 섹션 경계를 우선 감지."""
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks = []

    # 챕터/섹션 패턴 감지
    chapter_patterns = [
        r'\n(?=Chapter\s+\d+)',  # Chapter 1, Chapter 2...
        r'\n(?=CHAPTER\s+\d+)',  # CHAPTER 1...
        r'\n(?=제\s*\d+\s*장)',   # 제1장, 제 2 장...
        r'\n(?=Part\s+\d+)',      # Part 1...
        r'\n(?=\d+\.\s+[A-Z])',   # 1. Title...
    ]

    # 챕터 경계로 분할 시도
    split_points = []
    for pattern in chapter_patterns:
        matches = list(re.finditer(pattern, text))
        if matches:
            split_points = [m.start() for m in matches]
            break

    if split_points:
        # 챕터 경계로 분할
        prev = 0
        for point in split_points:
            if point > prev:
                chunk = text[prev:point].strip()
                if chunk:
                    # 청크가 너무 크면 추가 분할
                    if len(chunk) > CHUNK_SIZE:
                        chunks.extend(split_by_size(chunk))
                    else:
                        chunks.append(chunk)
            prev = point
        # 마지막 청크
        if prev < len(text):
            chunk = text[prev:].strip()
            if chunk:
                if len(chunk) > CHUNK_SIZE:
                    chunks.extend(split_by_size(chunk))
                else:
                    chunks.append(chunk)
    else:
        # 챕터 없으면 크기로 분할
        chunks = split_by_size(text)

    return chunks


def split_by_size(text: str) -> List[str]:
    """텍스트를 크기 기준으로 분할. 문단 경계 우선."""
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks = []
    current_pos = 0

    while current_pos < len(text):
        end_pos = min(current_pos + CHUNK_SIZE, len(text))

        if end_pos < len(text):
            # 문단 경계 찾기 (더블 줄바꿈)
            newline_pos = text.rfind('\n\n', current_pos, end_pos)
            if newline_pos > current_pos + CHUNK_SIZE // 2:
                end_pos = newline_pos + 2
            else:
                # 단일 줄바꿈 찾기
                newline_pos = text.rfind('\n', current_pos, end_pos)
                if newline_pos > current_pos + CHUNK_SIZE // 2:
                    end_pos = newline_pos + 1

        chunk = text[current_pos:end_pos].strip()
        if chunk:
            chunks.append(chunk)
        current_pos = end_pos

    return chunks


def match_keywords_to_words(
    words: List[str],
    keywords: List[dict],
) -> List[float]:
    """문장/구절을 원문 단어에 매칭하여 점수 배열 생성."""
    scores = [0.0] * len(words)

    # 불용어 (단독으로 매칭되면 안 되는 단어들)
    stopwords = {
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
        'you', 'your', 'yours', 'yourself', 'yourselves',
        'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
        'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
        'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
        'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as',
        'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
        'against', 'between', 'into', 'through', 'during', 'before',
        'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in',
        'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then',
        'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
        'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
        'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd',
        'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn',
        'doesn', 'hadn', 'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn',
        'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn'
    }

    for kw in keywords:
        keyword_text = kw.get("text", "")
        keyword_score = float(kw.get("score", 0.5))

        if not keyword_text:
            continue

        # 문장/구절을 단어로 분리
        kw_words = keyword_text.split()
        if not kw_words:
            continue

        # 단일 단어이고 불용어면 스킵
        if len(kw_words) == 1 and kw_words[0].lower().strip('.,!?"\';:') in stopwords:
            continue

        # 2단어 이하이고 모두 불용어면 스킵
        if len(kw_words) <= 2:
            non_stop = [w for w in kw_words if w.lower().strip('.,!?"\';:') not in stopwords]
            if len(non_stop) == 0:
                continue

        # 원문에서 문장/구절 시퀀스 찾기
        for i in range(len(words) - len(kw_words) + 1):
            match = True
            matched_indices = []

            j = i
            for kw_word in kw_words:
                # 줄바꿈 건너뛰기
                while j < len(words) and words[j] == '\n':
                    j += 1

                if j >= len(words):
                    match = False
                    break

                # 단어 비교 (대소문자 무시, 구두점 제거하여 비교)
                word_clean = words[j].lower().strip('.,!?"\';:()[]{}')
                kw_clean = kw_word.lower().strip('.,!?"\';:()[]{}')

                if word_clean == kw_clean or kw_clean in word_clean or word_clean in kw_clean:
                    matched_indices.append(j)
                    j += 1
                else:
                    match = False
                    break

            if match and len(matched_indices) == len(kw_words):
                for idx in matched_indices:
                    scores[idx] = max(scores[idx], keyword_score)

    return scores


def extract_chunk_sync(client: anthropic.Anthropic, chunk_text: str, chunk_idx: int) -> List[dict]:
    """단일 청크에서 키워드 추출 (동기)."""
    logger.info(f"청크 {chunk_idx} 처리 시작 ({len(chunk_text):,}자)")
    try:
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=4096,
            messages=[
                {"role": "user", "content": EXTRACTION_PROMPT + chunk_text}
            ]
        )

        response_text = message.content[0].text.strip()
        json_match = re.search(r'\{[\s\S]*\}', response_text)

        if not json_match:
            logger.warning(f"청크 {chunk_idx}: JSON 응답 없음")
            return []

        result = json.loads(json_match.group())
        # sentences 또는 keywords 둘 다 지원 (하위 호환성)
        sentences = result.get("sentences", result.get("keywords", []))
        logger.info(f"청크 {chunk_idx} 완료: {len(sentences)}개 문장 추출")
        return sentences
    except Exception as e:
        logger.error(f"청크 {chunk_idx} 에러: {e}")
        return []


async def extract_important_parts_single_chunk(text: str) -> Tuple[List[str], List[float]]:
    """
    단일 청크(또는 짧은 텍스트)를 Haiku API로 분석합니다.

    Returns:
        words: 단어 리스트
        scores: 각 단어의 중요도 점수 (0~1)
    """
    words = split_into_words(text)

    if not words:
        return [], []

    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY가 설정되지 않았습니다.")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    logger.info(f"텍스트 분석 시작 ({len(text):,}자, {len(words):,}단어)")

    # 단일 청크 처리
    keywords = extract_chunk_sync(client, text, 0)

    logger.info(f"{len(keywords)}개 키워드 추출 완료")

    # 키워드를 단어에 매칭
    scores = match_keywords_to_words(words, keywords)

    return words, scores


def get_chunk_count(text: str) -> int:
    """텍스트의 청크 수를 반환합니다."""
    return len(split_into_chunks(text))
