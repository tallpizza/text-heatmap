"use client";

import { useState, useCallback, useMemo } from "react";
import TextInput from "@/components/TextInput";
import HeatmapView from "@/components/HeatmapView";
import LoadingState from "@/components/LoadingState";
import FileUpload from "@/components/FileUpload";
import SettingsPanel from "@/components/SettingsPanel";
import { analyzeText, uploadFile, analyzeChunk } from "@/lib/api";

interface ChunkResult {
  words: string[];
  scores: number[];
}

export default function Home() {
  const [text, setText] = useState("");
  const [fullText, setFullText] = useState<string | null>(null);  // 파일 전체 텍스트
  const [totalChunks, setTotalChunks] = useState(0);
  const [loadedChunks, setLoadedChunks] = useState<ChunkResult[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 결과 합산 (rerender-memo: 비싼 계산 메모이제이션)
  const combinedWords = useMemo(
    () => loadedChunks.flatMap((c) => c.words),
    [loadedChunks]
  );
  const combinedScores = useMemo(
    () => loadedChunks.flatMap((c) => c.scores),
    [loadedChunks]
  );

  const handleAnalyze = async () => {
    if (!text.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setLoadedChunks([]);
    setFullText(null);
    setTotalChunks(0);

    try {
      const response = await analyzeText(text);
      setLoadedChunks([{ words: response.words, scores: response.scores }]);
      setTotalChunks(1);
      setCurrentChunk(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setLoadedChunks([]);
    setText("");
    setFullText(null);
    setTotalChunks(0);
    setCurrentChunk(0);

    try {
      // 1. 파일 업로드 & 텍스트 추출
      const uploadResponse = await uploadFile(file);
      setFullText(uploadResponse.text);
      setTotalChunks(uploadResponse.total_chunks);

      // 2. 첫 번째 청크 분석
      const chunkResponse = await analyzeChunk(uploadResponse.text, 0);
      setLoadedChunks([{ words: chunkResponse.words, scores: chunkResponse.scores }]);
      setCurrentChunk(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 다음 청크 로드 (무한 스크롤에서 호출)
  const loadNextChunk = useCallback(async () => {
    if (!fullText || currentChunk >= totalChunks || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const chunkResponse = await analyzeChunk(fullText, currentChunk);
      setLoadedChunks((prev) => [
        ...prev,
        { words: chunkResponse.words, scores: chunkResponse.scores },
      ]);
      setCurrentChunk((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "청크 분석 중 오류가 발생했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [fullText, currentChunk, totalChunks, loadingMore]);

  const hasMoreChunks = fullText !== null && currentChunk < totalChunks;

  return (
    <main className="page-container">
      <SettingsPanel />
      <div className="page-content">
        <header className="mb-12">
          <h1 className="heading-primary">Text Heatmap</h1>
          <p className="text-description">
            LLM을 사용하여 텍스트에서 중요한 부분을 시각화합니다.
          </p>
        </header>

        <div className="space-y-6">
          <div className="card card-lg">
            <TextInput value={text} onChange={setText} disabled={loading} />
            <div className="mt-3 flex justify-between text-small">
              <span>지원 형식: .txt, .pdf, .docx (최대 100MB)</span>
              <span>{text.length.toLocaleString()}자</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleAnalyze}
              disabled={loading || !text.trim()}
              className="btn-primary"
            >
              분석하기
            </button>
            <FileUpload onFileSelect={handleFileSelect} disabled={loading} />
          </div>

          {error && <div className="error-box">{error}</div>}

          {loading && <LoadingState />}

          {loadedChunks.length > 0 && (
            <HeatmapView
              words={combinedWords}
              scores={combinedScores}
              hasMore={hasMoreChunks}
              loadingMore={loadingMore}
              onLoadMore={loadNextChunk}
              totalChunks={totalChunks}
              loadedChunkCount={currentChunk}
            />
          )}
        </div>
      </div>
    </main>
  );
}
