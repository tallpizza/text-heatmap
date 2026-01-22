"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { translateWord, translateSentence, translateParagraph } from "@/lib/api";

const WORDS_PER_PAGE = 2000;

// rendering-hoist-jsx: 고정 스타일 객체를 컴포넌트 외부로 추출
const SENTENCE_TOOLTIP_BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#2d2d2d',
  color: '#ffffff',
  padding: '16px 24px',
  borderRadius: '12px',
  fontSize: '1rem',
  maxWidth: '600px',
  zIndex: 9999,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  whiteSpace: 'pre-wrap',
  lineHeight: 1.6,
};

const DEFAULT_CONTENT_STYLE: React.CSSProperties = {
  fontSize: "1.125rem",
  lineHeight: 2,
  textAlign: "justify",
  maxWidth: "50rem",
  margin: "0 auto",
};

interface HeatmapViewProps {
  words: string[];
  scores: number[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  totalChunks?: number;
  loadedChunkCount?: number;
}

// 스코어를 색상 투명도로 변환
function scoreToOpacity(score: number): number {
  if (score <= 0) return 0;
  return 0.3 + (score * 0.5);
}

// 하이라이터 스타일
function getHighlightStyle(
  score: number,
  prevScore: number,
  nextScore: number
): React.CSSProperties {
  const opacity = scoreToOpacity(score);
  const hasHighlight = score > 0;
  const prevHasHighlight = prevScore > 0;
  const nextHasHighlight = nextScore > 0;

  if (!hasHighlight) {
    return {};
  }

  // 위치에 따른 border-radius
  let borderRadius: string;
  if (prevHasHighlight && nextHasHighlight) {
    borderRadius = "0";
  } else if (prevHasHighlight) {
    borderRadius = "0 4px 4px 0";
  } else if (nextHasHighlight) {
    borderRadius = "4px 0 0 4px";
  } else {
    borderRadius = "4px";
  }

  return {
    background: `rgba(255, 213, 79, ${opacity})`,
    padding: "2px 0",
    borderRadius,
  };
}

export default function HeatmapView({
  words,
  scores,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  totalChunks = 1,
  loadedChunkCount = 1,
}: HeatmapViewProps) {
  const { fontSize, lineHeight, textAlign, maxWidth } = useSettingsStore();
  const [visibleCount, setVisibleCount] = useState(WORDS_PER_PAGE);
  const [mounted, setMounted] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // 호버 상태
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPhase, setHoverPhase] = useState<0 | 1 | 2 | 3>(0); // 0: 단어만, 1: 단어번역, 2: 문장번역, 3: 문단번역
  const [wordTranslation, setWordTranslation] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null);
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [sentenceRange, setSentenceRange] = useState<[number, number] | null>(null);
  const [paragraphTranslation, setParagraphTranslation] = useState<string | null>(null);
  const [paragraphLoading, setParagraphLoading] = useState(false);
  const [paragraphRange, setParagraphRange] = useState<[number, number] | null>(null);
  const [tooltipOnTop, setTooltipOnTop] = useState(true);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sentenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 문장 경계 찾기 (시작: 줄바꿈 또는 마침표 이후, 끝: 마침표)
  const findSentenceBounds = useCallback((index: number): [number, number] => {
    let start = index;
    let end = index;

    // 문장 시작 찾기 (마침표 또는 줄바꿈 이후)
    while (start > 0) {
      const prevWord = words[start - 1];
      if (prevWord === "\n" || prevWord.endsWith(".")) break;
      start--;
    }

    // 문장 끝 찾기 (마침표만, 줄바꿈 제외)
    while (end < words.length - 1) {
      const currentWord = words[end];
      if (currentWord !== "\n" && currentWord.endsWith(".")) break;
      end++;
    }

    return [start, end];
  }, [words]);

  // 문단 경계 찾기 (줄바꿈 기준)
  const findParagraphBounds = useCallback((index: number): [number, number] => {
    let start = index;
    let end = index;

    // 문단 시작 찾기 (줄바꿈 이후)
    while (start > 0) {
      if (words[start - 1] === "\n") break;
      start--;
    }

    // 문단 끝 찾기 (줄바꿈 전)
    while (end < words.length - 1) {
      if (words[end + 1] === "\n") break;
      end++;
    }

    return [start, end];
  }, [words]);

  // 호버 핸들러
  const handleMouseEnter = useCallback((index: number, word: string, event: React.MouseEvent) => {
    if (word === "\n") return;

    // 마우스 Y 위치 저장 (툴팁 위치 결정용)
    const mouseY = event.clientY;
    setTooltipOnTop(mouseY > window.innerHeight / 2);

    setHoveredIndex(index);
    setHoverPhase(0);
    setWordTranslation(null);
    setWordLoading(false);
    setSentenceTranslation(null);
    setSentenceLoading(false);
    setSentenceRange(null);
    setParagraphTranslation(null);
    setParagraphLoading(false);
    setParagraphRange(null);

    // 0.5초 후 단어 번역 시작
    hoverTimerRef.current = setTimeout(() => {
      setHoverPhase(1);
      setWordLoading(true);

      translateWord(word)
        .then((result) => {
          setWordTranslation(result.translation);
        })
        .catch((e) => {
          console.error("단어 번역 실패:", e);
          setWordTranslation("번역 실패");
        })
        .finally(() => {
          setWordLoading(false);
        });

      // 단어 번역 후 3초 뒤 문장 번역 시작
      sentenceTimerRef.current = setTimeout(() => {
        const [start, end] = findSentenceBounds(index);
        setSentenceRange([start, end]);
        setHoverPhase(2);
        setSentenceLoading(true);

        const sentenceWords = words.slice(start, end + 1).filter(w => w !== "\n");
        const sentence = sentenceWords.join(" ");

        translateSentence(sentence)
          .then((result) => {
            setSentenceTranslation(result.translation);
            // 문장 번역 완료 후 문단 범위 설정 (하이라이트용)
            const [pStart, pEnd] = findParagraphBounds(index);
            setParagraphRange([pStart, pEnd]);
          })
          .catch((e) => {
            console.error("문장 번역 실패:", e);
            setSentenceTranslation("번역 실패");
          })
          .finally(() => {
            setSentenceLoading(false);
          });
      }, 3000);
    }, 500);
  }, [words, findSentenceBounds, findParagraphBounds]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (sentenceTimerRef.current) clearTimeout(sentenceTimerRef.current);
    setHoveredIndex(null);
    setHoverPhase(0);
    setWordTranslation(null);
    setWordLoading(false);
    setSentenceTranslation(null);
    setSentenceLoading(false);
    setSentenceRange(null);
    setParagraphTranslation(null);
    setParagraphLoading(false);
    setParagraphRange(null);
  }, []);

  // 클릭 시 문단 번역 시작
  const handleClick = useCallback((index: number) => {
    if (hoverPhase < 2 || !paragraphRange) return;

    setHoverPhase(3);
    setParagraphLoading(true);

    const paragraphWords = words.slice(paragraphRange[0], paragraphRange[1] + 1).filter(w => w !== "\n");
    const paragraph = paragraphWords.join(" ");

    translateParagraph(paragraph)
      .then((result) => {
        setParagraphTranslation(result.translation);
      })
      .catch((e) => {
        console.error("문단 번역 실패:", e);
        setParagraphTranslation("번역 실패");
      })
      .finally(() => {
        setParagraphLoading(false);
      });
  }, [hoverPhase, paragraphRange, words]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + WORDS_PER_PAGE, words.length));
  }, [words.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (visibleCount < words.length) {
            loadMore();
          } else if (hasMore && !loadingMore && onLoadMore) {
            onLoadMore();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, words.length, loadMore, hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    setVisibleCount(WORDS_PER_PAGE);
  }, [words, scores]);

  // rerender-memo: 단어 수 계산 메모이제이션
  const wordCount = useMemo(
    () => words.filter(w => w !== "\n").length,
    [words]
  );

  // rerender-memo: visible words 메모이제이션
  const visibleWords = useMemo(
    () => words.slice(0, visibleCount),
    [words, visibleCount]
  );

  if (words.length === 0) {
    return null;
  }

  const hasMoreWords = visibleCount < words.length;
  const showLoader = hasMoreWords || hasMore;

  // 클라이언트 마운트 후에만 설정 적용 (hydration 문제 방지)
  // rerender-memo: 스타일 객체 메모이제이션
  const contentStyle = useMemo<React.CSSProperties>(() =>
    mounted
      ? {
          fontSize: `${fontSize}rem`,
          lineHeight: lineHeight,
          textAlign: textAlign,
          maxWidth: `${maxWidth}rem`,
          margin: "0 auto",
        }
      : DEFAULT_CONTENT_STYLE,
    [mounted, fontSize, lineHeight, textAlign, maxWidth]
  );

  const renderWord = (word: string, index: number) => {
    // 줄바꿈 처리
    if (word === "\n") {
      return <br key={index} />;
    }

    const score = scores[index] || 0;
    const prevScore = index > 0 ? (scores[index - 1] || 0) : 0;
    const nextScore = index < words.length - 1 ? (scores[index + 1] || 0) : 0;

    // 이전이 줄바꿈이면 prevScore = 0으로 처리
    const effectivePrevScore = index > 0 && words[index - 1] === "\n" ? 0 : prevScore;
    // 다음이 줄바꿈이면 nextScore = 0으로 처리
    const effectiveNextScore = index < words.length - 1 && words[index + 1] === "\n" ? 0 : nextScore;

    const baseStyle = getHighlightStyle(score, effectivePrevScore, effectiveNextScore);

    // 호버 상태에 따른 추가 스타일
    const isHovered = hoveredIndex === index;
    const isInSentence = sentenceRange && index >= sentenceRange[0] && index <= sentenceRange[1];
    const isInParagraph = paragraphRange && index >= paragraphRange[0] && index <= paragraphRange[1];

    // 문장 번역 완료 여부 (문단 하이라이트 표시 조건)
    const sentenceComplete = hoverPhase >= 2 && !sentenceLoading && sentenceTranslation;

    let hoverStyle: React.CSSProperties = {};
    if (isHovered) {
      // 호버된 단어: 더 진하게
      hoverStyle = {
        background: `rgba(255, 180, 50, ${0.6 + hoverPhase * 0.15})`,
        borderRadius: "4px",
        transition: "background 0.3s ease",
      };
    } else if (sentenceComplete && isInParagraph && !isInSentence) {
      // 문단 내 단어들 (문장 제외): 회색 하이라이트 (더블클릭 유도)
      hoverStyle = {
        background: `rgba(180, 180, 180, 0.3)`,
        borderRadius: "2px",
        transition: "background 0.3s ease",
        cursor: "pointer",
      };
    } else if (hoverPhase >= 2 && isInSentence) {
      // 문장 내 다른 단어들: 약간 진하게
      hoverStyle = {
        background: `rgba(255, 200, 100, 0.4)`,
        borderRadius: "2px",
        transition: "background 0.3s ease",
      };
    }

    const combinedStyle = { ...baseStyle, ...hoverStyle };

    // 첫 단어 또는 줄바꿈 직후가 아니면 공백 추가
    const needsSpace = index > 0 && words[index - 1] !== "\n";

    // 툴팁 표시 여부
    const showWordTooltip = isHovered && hoverPhase >= 1;

    return (
      <span
        key={index}
        className="heatmap-word"
        style={combinedStyle}
        onMouseEnter={(e) => handleMouseEnter(index, word, e)}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleClick(index)}
      >
        {needsSpace ? " " : ""}{word}
        {/* rendering-conditional-render: 삼항 연산자 사용 */}
        {showWordTooltip ? (
          <span className="word-tooltip">
            {wordLoading ? "번역 중..." : wordTranslation}
          </span>
        ) : null}
      </span>
    );
  };

  // 번역 툴팁 표시 여부
  const showSentenceTooltip = hoverPhase >= 2 && hoverPhase < 3;
  const showParagraphTooltip = hoverPhase === 3;

  return (
    <>
      <div className="heatmap-container">
        <div className="heatmap-header">
          <div className="heatmap-indicator" />
          <h3 className="heatmap-title">분석 결과</h3>
          <span className="heatmap-stats">
            {wordCount.toLocaleString()}단어
            {/* rendering-conditional-render */}
            {totalChunks > 1 ? ` (청크 ${loadedChunkCount}/${totalChunks})` : null}
          </span>
        </div>

        <div className="heatmap-content" style={contentStyle}>
          {visibleWords.map((word, index) => renderWord(word, index))}

          {/* rendering-conditional-render: 삼항 연산자 사용 */}
          {showLoader ? (
            <div ref={loaderRef} className="heatmap-loader">
              {loadingMore ? (
                <span>청크 {loadedChunkCount + 1}/{totalChunks} 분석 중...</span>
              ) : hasMoreWords ? (
                <span>더 불러오는 중...</span>
              ) : hasMore ? (
                <span>스크롤하여 다음 청크 로드</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="heatmap-legend">
          <div className="legend-items">
            <span className="legend-label">중요도:</span>
            <div className="legend-gradient">
              <span className="legend-gradient-bar" />
              <div className="legend-gradient-labels">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 문장 번역 툴팁 (고정 위치) */}
      {/* rendering-conditional-render: 삼항 연산자 사용 */}
      {showSentenceTooltip ? (
        <div
          style={{
            ...SENTENCE_TOOLTIP_BASE_STYLE,
            top: tooltipOnTop ? '100px' : 'auto',
            bottom: tooltipOnTop ? 'auto' : '100px',
          }}
        >
          {sentenceLoading ? "문장 번역 중..." : sentenceTranslation || "번역 대기중..."}
        </div>
      ) : null}

      {/* 문단 번역 툴팁 (고정 위치) */}
      {showParagraphTooltip ? (
        <div
          style={{
            ...SENTENCE_TOOLTIP_BASE_STYLE,
            top: tooltipOnTop ? '100px' : 'auto',
            bottom: tooltipOnTop ? 'auto' : '100px',
            maxWidth: '700px',
            borderLeft: '4px solid #ffd54f',
          }}
        >
          {paragraphLoading ? "문단 번역 중..." : paragraphTranslation || "번역 대기중..."}
        </div>
      ) : null}
    </>
  );
}
