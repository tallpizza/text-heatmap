import re
import json
from typing import List, Tuple
import anthropic
from config import ANTHROPIC_API_KEY, HAIKU_MODEL

EXTRACTION_PROMPT = """다음 텍스트에서 독자가 빠르게 핵심을 파악하는 데 도움이 되는 중요한 키워드와 구문을 추출해주세요.

규칙:
- 텍스트 길이에 비례해서 적절한 수만큼 추출
- 각 항목에 중요도 점수 (0.0~1.0) 부여
- 고유명사, 숫자, 핵심 동사, 핵심 개념 위주

점수 기준:
- 0.9~1.0: 핵심 주제, 결론, 액션 아이템
- 0.7~0.8: 주요 개념, 중요 조건
- 0.5~0.6: 부가 정보지만 알아두면 좋은 것

JSON 형식으로만 응답 (다른 텍스트 없이):
{"keywords": [{"text": "키워드", "score": 0.9}, ...]}

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


def match_keywords_to_words(
    words: List[str],
    keywords: List[dict],
) -> List[float]:
    """키워드를 원문 단어에 매칭하여 점수 배열 생성."""
    scores = [0.0] * len(words)

    # 줄바꿈 제외한 단어들의 텍스트 (매칭용)
    word_texts = [w if w != '\n' else '' for w in words]

    for kw in keywords:
        keyword_text = kw.get("text", "")
        keyword_score = float(kw.get("score", 0.5))

        if not keyword_text:
            continue

        # 키워드를 단어로 분리
        kw_words = keyword_text.split()
        if not kw_words:
            continue

        # 원문에서 키워드 시퀀스 찾기
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

                # 단어 비교 (대소문자 무시, 부분 매칭)
                if kw_word.lower() in words[j].lower() or words[j].lower() in kw_word.lower():
                    matched_indices.append(j)
                    j += 1
                else:
                    match = False
                    break

            if match and len(matched_indices) == len(kw_words):
                for idx in matched_indices:
                    scores[idx] = max(scores[idx], keyword_score)

    return scores


async def extract_important_parts(text: str) -> Tuple[List[str], List[float]]:
    """
    Haiku API를 사용하여 중요한 키워드를 추출하고 단어별 점수를 반환합니다.

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

    # Haiku API 호출
    message = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=4096,
        messages=[
            {"role": "user", "content": EXTRACTION_PROMPT + text}
        ]
    )

    # 응답 파싱
    response_text = message.content[0].text.strip()

    # JSON 추출 (응답에 다른 텍스트가 있을 수 있음)
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if not json_match:
        return words, [0.0] * len(words)

    try:
        result = json.loads(json_match.group())
        keywords = result.get("keywords", [])
    except json.JSONDecodeError:
        return words, [0.0] * len(words)

    # 키워드를 단어에 매칭
    scores = match_keywords_to_words(words, keywords)

    return words, scores
