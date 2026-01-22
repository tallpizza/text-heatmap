"use client";

import { useState } from "react";
import TextInput from "@/components/TextInput";
import HeatmapView from "@/components/HeatmapView";
import LoadingState from "@/components/LoadingState";
import FileUpload from "@/components/FileUpload";
import { analyzeText, analyzeFile, AnalyzeResponse } from "@/lib/api";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await analyzeText(text);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setText("");

    try {
      const response = await analyzeFile(file);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className="page-content">
        <header className="mb-12">
          <h1 className="heading-primary">Text Heatmap</h1>
          <p className="text-description">
            LLM attention을 사용하여 텍스트에서 중요한 부분을 시각화합니다.
          </p>
        </header>

        <div className="space-y-6">
          <div className="card card-lg">
            <TextInput value={text} onChange={setText} disabled={loading} />
            <div className="mt-3 flex justify-between text-small">
              <span>지원 형식: .txt, .pdf, .docx (최대 10MB)</span>
              <span className={text.length > 100000 ? "text-error" : ""}>
                {text.length.toLocaleString()} / 100,000자
              </span>
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

          {result && <HeatmapView words={result.words} scores={result.scores} />}
        </div>
      </div>
    </main>
  );
}
