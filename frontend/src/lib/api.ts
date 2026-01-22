const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AnalyzeResponse {
  words: string[];
  scores: number[];
}

export async function analyzeText(text: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "분석 중 오류가 발생했습니다.");
  }

  return response.json();
}

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/analyze/file`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "파일 분석 중 오류가 발생했습니다.");
  }

  return response.json();
}
