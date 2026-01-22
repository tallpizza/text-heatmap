import torch
import re
from typing import List, Tuple
from services.model_loader import get_model_and_tokenizer
from config import MAX_TOKENS, OVERLAP


def extract_attention_scores(text: str) -> Tuple[List[str], List[float]]:
    """
    텍스트에서 단어별 attention 점수를 추출합니다.

    Returns:
        words: 단어 리스트
        scores: 각 단어의 중요도 점수 (0~1)
    """
    model, tokenizer = get_model_and_tokenizer()
    device = next(model.parameters()).device

    # 단어 단위로 분리
    words = split_into_words(text)

    if not words:
        return [], []

    # 토큰화
    encoding = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_TOKENS,
        return_offsets_mapping=True,
    )

    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)
    offset_mapping = encoding["offset_mapping"][0].tolist()

    # 모델 추론
    with torch.no_grad():
        outputs = model(input_ids=input_ids, attention_mask=attention_mask)

    # 마지막 레이어의 attention 추출 (shape: [batch, heads, seq, seq])
    last_layer_attention = outputs.attentions[-1]

    # 모든 헤드의 평균 (shape: [batch, seq, seq])
    attention_avg = last_layer_attention.mean(dim=1)

    # 각 토큰이 받는 attention 합산 (column-wise sum)
    # shape: [seq]
    token_importance = attention_avg[0].sum(dim=0).cpu().numpy()

    # 특수 토큰 제외 ([CLS], [SEP], [PAD] 등)
    special_tokens_mask = encoding.get("special_tokens_mask", None)
    if special_tokens_mask is not None:
        special_mask = special_tokens_mask[0].numpy()
    else:
        # 수동으로 특수 토큰 마스킹
        special_mask = [1 if i == 0 or i == len(token_importance) - 1 else 0
                        for i in range(len(token_importance))]

    # 토큰 점수를 단어에 매핑
    word_scores = map_tokens_to_words(
        text, words, offset_mapping, token_importance, special_mask
    )

    # 정규화 (0~1)
    if word_scores:
        min_score = min(word_scores)
        max_score = max(word_scores)
        if max_score > min_score:
            word_scores = [(s - min_score) / (max_score - min_score) for s in word_scores]
        else:
            word_scores = [0.5] * len(word_scores)

    return words, word_scores


def split_into_words(text: str) -> List[str]:
    """텍스트를 단어 단위로 분리합니다. 줄바꿈은 별도 토큰으로 처리."""
    result = []
    lines = text.split('\n')

    for i, line in enumerate(lines):
        # 각 줄의 단어들 추출
        words = re.findall(r'\S+', line)
        result.extend(words)

        # 마지막 줄이 아니면 줄바꿈 토큰 추가
        if i < len(lines) - 1:
            result.append('\n')

    return result


def map_tokens_to_words(
    text: str,
    words: List[str],
    offset_mapping: List[Tuple[int, int]],
    token_importance: list,
    special_mask: list,
) -> List[float]:
    """토큰별 점수를 단어별 점수로 매핑합니다."""
    word_scores = []

    # 각 단어의 시작/끝 위치 계산
    word_positions = []
    current_pos = 0
    for word in words:
        start = text.find(word, current_pos)
        if start == -1:
            start = current_pos
        end = start + len(word)
        word_positions.append((start, end))
        current_pos = end

    # 각 단어에 해당하는 토큰들의 점수 평균
    for word_start, word_end in word_positions:
        token_scores = []
        for i, (tok_start, tok_end) in enumerate(offset_mapping):
            if special_mask[i]:
                continue
            # 토큰이 단어와 겹치는지 확인
            if tok_start < word_end and tok_end > word_start:
                token_scores.append(token_importance[i])

        if token_scores:
            word_scores.append(sum(token_scores) / len(token_scores))
        else:
            word_scores.append(0.0)

    return word_scores


def process_long_text(text: str) -> Tuple[List[str], List[float]]:
    """
    긴 텍스트를 청크로 나누어 처리합니다.
    """
    model, tokenizer = get_model_and_tokenizer()

    # 전체 토큰 수 확인
    tokens = tokenizer.tokenize(text)

    if len(tokens) <= MAX_TOKENS - 2:  # [CLS], [SEP] 고려
        return extract_attention_scores(text)

    # 청크로 분할
    words = split_into_words(text)
    all_scores = [[] for _ in range(len(words))]

    # 단어 단위로 청크 분할
    chunk_size_words = MAX_TOKENS // 2  # 대략적인 단어 수
    overlap_words = OVERLAP // 2

    start_idx = 0
    while start_idx < len(words):
        end_idx = min(start_idx + chunk_size_words, len(words))
        chunk_words = words[start_idx:end_idx]
        chunk_text = " ".join(chunk_words)

        _, chunk_scores = extract_attention_scores(chunk_text)

        # 점수 저장
        for i, score in enumerate(chunk_scores):
            if start_idx + i < len(all_scores):
                all_scores[start_idx + i].append(score)

        if end_idx >= len(words):
            break

        start_idx = end_idx - overlap_words

    # 겹치는 부분 평균
    final_scores = []
    for scores in all_scores:
        if scores:
            final_scores.append(sum(scores) / len(scores))
        else:
            final_scores.append(0.0)

    # 정규화
    if final_scores:
        min_score = min(final_scores)
        max_score = max(final_scores)
        if max_score > min_score:
            final_scores = [(s - min_score) / (max_score - min_score) for s in final_scores]

    return words, final_scores
