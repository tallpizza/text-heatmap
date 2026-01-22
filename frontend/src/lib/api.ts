const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// js-cache-function-results: 번역 결과 캐싱
const wordTranslationCache = new Map<string, TranslateResponse>();
const sentenceTranslationCache = new Map<string, TranslateResponse>();
const paragraphTranslationCache = new Map<string, TranslateResponse>();

// client-swr-dedup: 진행 중인 요청 추적으로 중복 요청 방지
const pendingWordRequests = new Map<string, Promise<TranslateResponse>>();
const pendingSentenceRequests = new Map<string, Promise<TranslateResponse>>();
const pendingParagraphRequests = new Map<string, Promise<TranslateResponse>>();

export interface AnalyzeResponse {
  words: string[];
  scores: number[];
}

export interface ChunkAnalyzeResponse {
  words: string[];
  scores: number[];
  chunk_index: number;
  total_chunks: number;
}

export interface FileUploadResponse {
  text: string;
  total_chunks: number;
  total_characters: number;
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

export async function uploadFile(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "파일 업로드 중 오류가 발생했습니다.");
  }

  return response.json();
}

export async function analyzeChunk(
  text: string,
  chunkIndex: number
): Promise<ChunkAnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/chunk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, chunk_index: chunkIndex }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "청크 분석 중 오류가 발생했습니다.");
  }

  return response.json();
}

export interface TranslateResponse {
  original: string;
  translation: string;
}

export async function translateWord(word: string, context?: string): Promise<TranslateResponse> {
  const cacheKey = `${word}:${context || ""}`;

  // 캐시 확인
  const cached = wordTranslationCache.get(cacheKey);
  if (cached) return cached;

  // 진행 중인 요청 확인 (중복 요청 방지)
  const pending = pendingWordRequests.get(cacheKey);
  if (pending) return pending;

  // 새 요청 생성
  const request = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/translate/word`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word, context: context || "" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "번역 중 오류가 발생했습니다.");
    }

    const result = await response.json();
    wordTranslationCache.set(cacheKey, result);
    return result;
  })();

  pendingWordRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingWordRequests.delete(cacheKey);
  }
}

export async function translateSentence(sentence: string): Promise<TranslateResponse> {
  // 캐시 확인
  const cached = sentenceTranslationCache.get(sentence);
  if (cached) return cached;

  // 진행 중인 요청 확인 (중복 요청 방지)
  const pending = pendingSentenceRequests.get(sentence);
  if (pending) return pending;

  // 새 요청 생성
  const request = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/translate/sentence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sentence }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "번역 중 오류가 발생했습니다.");
    }

    const result = await response.json();
    sentenceTranslationCache.set(sentence, result);
    return result;
  })();

  pendingSentenceRequests.set(sentence, request);

  try {
    return await request;
  } finally {
    pendingSentenceRequests.delete(sentence);
  }
}

export async function translateParagraph(paragraph: string): Promise<TranslateResponse> {
  // 캐시 확인
  const cached = paragraphTranslationCache.get(paragraph);
  if (cached) return cached;

  // 진행 중인 요청 확인 (중복 요청 방지)
  const pending = pendingParagraphRequests.get(paragraph);
  if (pending) return pending;

  // 새 요청 생성
  const request = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/translate/paragraph`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paragraph }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "번역 중 오류가 발생했습니다.");
    }

    const result = await response.json();
    paragraphTranslationCache.set(paragraph, result);
    return result;
  })();

  pendingParagraphRequests.set(paragraph, request);

  try {
    return await request;
  } finally {
    pendingParagraphRequests.delete(paragraph);
  }
}

// 하위 호환성용
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
