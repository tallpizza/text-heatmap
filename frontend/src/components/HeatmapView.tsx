"use client";

interface HeatmapViewProps {
  words: string[];
  scores: number[];
}

interface WordData {
  word: string;
  score: number;
  index: number;
}

interface LineData {
  words: WordData[];
  isListItem: boolean;
  headingLevel: number;
}

// 스코어를 색상 투명도로 변환
function scoreToOpacity(score: number): number {
  return 0.05 + (score * 0.75);
}

// 단어 스타일 (배경 + 텍스트 + 블렌딩)
function getWordStyle(score: number, prevScore?: number, nextScore?: number): React.CSSProperties {
  const opacity = scoreToOpacity(score);

  // 텍스트 색상: 배경이 진하면 밝은 색으로
  let textColor: string;
  let textShadow: string | undefined;

  if (score >= 0.7) {
    textColor = "#ffffff";
    textShadow = "0 1px 2px rgba(0,0,0,0.2)";
  } else if (score >= 0.5) {
    textColor = "#3d1508";
  } else {
    textColor = "#1a1a1a";
  }

  // 좌우 그라데이션 블렌딩을 위한 box-shadow
  const shadows: string[] = [];

  // 왼쪽으로 블렌딩 (이전 단어와의 전환)
  if (prevScore !== undefined) {
    const blendOpacity = (scoreToOpacity(prevScore) + opacity) / 2;
    shadows.push(`-8px 0 12px -4px rgba(196, 93, 53, ${blendOpacity})`);
  }

  // 오른쪽으로 블렌딩 (다음 단어와의 전환)
  if (nextScore !== undefined) {
    const blendOpacity = (scoreToOpacity(nextScore) + opacity) / 2;
    shadows.push(`8px 0 12px -4px rgba(196, 93, 53, ${blendOpacity})`);
  }

  return {
    background: `rgba(196, 93, 53, ${opacity})`,
    color: textColor,
    textShadow,
    padding: "6px 0",
    boxShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
  };
}

function isListStart(word: string): boolean {
  return word === "-" || word === "*" || /^\d+\.$/.test(word);
}

export default function HeatmapView({ words, scores }: HeatmapViewProps) {
  if (words.length === 0) {
    return null;
  }

  // 단어들을 라인별로 그룹화
  const parseLines = (): LineData[] => {
    const lines: LineData[] = [];
    let currentLine: WordData[] = [];
    let isListItem = false;
    let headingLevel = 0;
    let isLineStart = true;

    words.forEach((word, index) => {
      const score = scores[index] || 0;

      // 줄바꿈 처리
      if (word === "\n") {
        if (currentLine.length > 0) {
          lines.push({
            words: currentLine,
            isListItem,
            headingLevel,
          });
        }
        currentLine = [];
        isListItem = false;
        headingLevel = 0;
        isLineStart = true;
        return;
      }

      // 줄 시작에서 마크다운 체크
      if (isLineStart) {
        if (isListStart(word)) {
          isListItem = true;
          isLineStart = false;
          return;
        }

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
      currentLine.push({ word, score, index });
    });

    // 마지막 줄 처리
    if (currentLine.length > 0) {
      lines.push({
        words: currentLine,
        isListItem,
        headingLevel,
      });
    }

    return lines;
  };

  const renderLine = (line: LineData, lineIndex: number) => {
    let className = "heatmap-line";
    if (line.isListItem) {
      className += " md-list-item";
    } else if (line.headingLevel > 0) {
      className += ` md-heading md-h${line.headingLevel}`;
    }

    const wordElements = line.words.map((wordData, wordIndex) => {
      const { word, score, index } = wordData;
      const isFirst = wordIndex === 0;
      const isLast = wordIndex === line.words.length - 1;

      // 이전/다음 단어의 점수 (그라데이션 블렌딩용)
      const prevScore = isFirst ? undefined : line.words[wordIndex - 1].score;
      const nextScore = isLast ? undefined : line.words[wordIndex + 1].score;

      const style = getWordStyle(score, prevScore, nextScore);

      // 공백은 앞 단어 스타일에 포함 (자연스러운 연결)
      const prefix = isFirst ? "" : " ";

      // 테이블 구분자
      if (word === "|" || word.match(/^-+$/)) {
        return (
          <span key={index} className="heatmap-word" style={{ ...style, opacity: 0.5 }}>
            {prefix}{word}
          </span>
        );
      }

      // 코드 블록 처리
      if (word.startsWith("`") && word.endsWith("`") && word.length > 2) {
        const codeContent = word.slice(1, -1);
        return (
          <span key={index} className="heatmap-word" style={style}>
            {prefix}<code className="md-code-inline">{codeContent}</code>
          </span>
        );
      }

      // 볼드 처리 (마크다운 **로 감싸진 경우만)
      if (word.startsWith("**") && word.endsWith("**") && word.length > 4) {
        const boldContent = word.slice(2, -2);
        return (
          <span
            key={index}
            className="heatmap-word"
            style={{ ...style, fontWeight: 600 }}
            title={`중요도: ${(score * 100).toFixed(0)}%`}
          >
            {prefix}{boldContent}
          </span>
        );
      }

      // 일반 단어
      return (
        <span
          key={index}
          className="heatmap-word"
          style={style}
          title={`중요도: ${(score * 100).toFixed(0)}%`}
        >
          {prefix}{word}
        </span>
      );
    });

    return (
      <div key={`line-${lineIndex}`} className={className}>
        {wordElements}
      </div>
    );
  };

  const lines = parseLines();

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <div className="heatmap-indicator" />
        <h3 className="heatmap-title">분석 결과</h3>
      </div>

      <div className="heatmap-content">
        {lines.map((line, index) => renderLine(line, index))}
      </div>

      <div className="heatmap-legend">
        <div className="legend-items">
          <span className="legend-label">중요도:</span>
          <span className="legend-sample" style={{ background: `rgba(196, 93, 53, ${scoreToOpacity(0.1)})`, color: "#1a1a1a", padding: "4px 12px", borderRadius: "4px" }}>낮음</span>
          <span className="legend-sample" style={{ background: `rgba(196, 93, 53, ${scoreToOpacity(0.35)})`, color: "#1a1a1a", padding: "4px 12px", borderRadius: "4px" }}>중간</span>
          <span className="legend-sample" style={{ background: `rgba(196, 93, 53, ${scoreToOpacity(0.6)})`, color: "#3d1508", padding: "4px 12px", borderRadius: "4px" }}>높음</span>
          <span className="legend-sample" style={{ background: `rgba(196, 93, 53, ${scoreToOpacity(0.9)})`, color: "#ffffff", padding: "4px 12px", borderRadius: "4px", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>매우 높음</span>
        </div>
      </div>
    </div>
  );
}
