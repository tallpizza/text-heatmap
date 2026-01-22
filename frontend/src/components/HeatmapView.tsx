"use client";

interface HeatmapViewProps {
  words: string[];
  scores: number[];
}

function getScoreClass(score: number): string {
  if (score >= 0.75) return "score-very-high";
  if (score >= 0.5) return "score-high";
  if (score >= 0.25) return "score-medium";
  return "score-low";
}

function getMarkdownClass(word: string): string | null {
  // 헤딩
  if (word.startsWith("###")) return "md-heading md-h3";
  if (word.startsWith("##")) return "md-heading md-h2";
  if (word.startsWith("#")) return "md-heading md-h1";

  // 리스트
  if (word === "-" || word === "*" || word.match(/^\d+\.$/)) return "md-list-marker";

  // 코드 (백틱으로 감싸진)
  if (word.startsWith("`") && word.endsWith("`")) return "md-code";

  // 볼드
  if (word.startsWith("**") && word.endsWith("**")) return "md-bold";

  // 테이블 헤더
  if (word === "|") return "md-table-sep";

  return null;
}

function isListStart(word: string): boolean {
  return word === "-" || word === "*" || /^\d+\.$/.test(word);
}

export default function HeatmapView({ words, scores }: HeatmapViewProps) {
  if (words.length === 0) {
    return null;
  }

  const renderContent = () => {
    const elements: React.ReactNode[] = [];
    let currentLineElements: React.ReactNode[] = [];
    let isLineStart = true;
    let isListItem = false;
    let headingLevel = 0;

    const flushLine = (key: string, lineHeadingLevel: number = 0) => {
      if (currentLineElements.length > 0) {
        let className = "";
        if (isListItem) {
          className = "md-list-item";
        } else if (lineHeadingLevel > 0) {
          className = `md-heading md-h${lineHeadingLevel}`;
        }
        elements.push(
          <span key={key} className={className || undefined}>
            {currentLineElements}
          </span>
        );
        currentLineElements = [];
        isListItem = false;
      }
    };

    words.forEach((word, index) => {
      const score = scores[index] || 0;

      // 줄바꿈 처리
      if (word === "\n") {
        flushLine(`line-${index}`, headingLevel);
        elements.push(<br key={`br-${index}`} />);
        isLineStart = true;
        headingLevel = 0;
        return;
      }

      // 줄 시작에서 마크다운 체크
      if (isLineStart) {
        // 리스트 아이템 체크
        if (isListStart(word)) {
          isListItem = true;
          isLineStart = false;
          // 리스트 마커는 표시하지 않음 (CSS에서 처리)
          return;
        }

        // 헤딩 체크 (## 또는 ### 단독 토큰)
        if (word === "###") {
          headingLevel = 3;
          isLineStart = false;
          return;
        }
        if (word === "##") {
          headingLevel = 2;
          isLineStart = false;
          return;
        }
        if (word === "#") {
          headingLevel = 1;
          isLineStart = false;
          return;
        }
      }

      isLineStart = false;

      // 마크다운 스타일 적용
      const mdClass = getMarkdownClass(word);
      const scoreClass = getScoreClass(score);

      // 테이블 구분자는 건너뛰기
      if (word === "|" || word.match(/^-+$/)) {
        currentLineElements.push(" ");
        currentLineElements.push(
          <span key={index} className="heatmap-word" style={{ opacity: 0.5 }}>
            {word}
          </span>
        );
        currentLineElements.push(" ");
        return;
      }

      // 코드 블록 처리
      if (word.startsWith("`") && word.endsWith("`") && word.length > 2) {
        const codeContent = word.slice(1, -1);
        currentLineElements.push(" ");
        currentLineElements.push(
          <code key={index} className="md-code">
            {codeContent}
          </code>
        );
        return;
      }

      // 볼드 처리
      if (word.startsWith("**") && word.endsWith("**") && word.length > 4) {
        const boldContent = word.slice(2, -2);
        currentLineElements.push(" ");
        currentLineElements.push(
          <strong key={index} className={`heatmap-word ${scoreClass} md-bold`} title={`중요도: ${(score * 100).toFixed(0)}%`}>
            {boldContent}
          </strong>
        );
        return;
      }

      // 일반 단어
      currentLineElements.push(" ");
      currentLineElements.push(
        <span
          key={index}
          className={`heatmap-word ${scoreClass}`}
          title={`중요도: ${(score * 100).toFixed(0)}%`}
        >
          {word}
        </span>
      );
    });

    // 마지막 줄 처리
    flushLine("line-final", headingLevel);

    return elements;
  };

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <div className="heatmap-indicator" />
        <h3 className="heatmap-title">분석 결과</h3>
      </div>

      <div className="heatmap-content">{renderContent()}</div>

      <div className="heatmap-legend">
        <div className="legend-items">
          <span className="legend-label">중요도:</span>
          <span className="heatmap-word score-low">낮음</span>
          <span className="heatmap-word score-medium">중간</span>
          <span className="heatmap-word score-high">높음</span>
          <span className="heatmap-word score-very-high">매우 높음</span>
        </div>
      </div>
    </div>
  );
}
