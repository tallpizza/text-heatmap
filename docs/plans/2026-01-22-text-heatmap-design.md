# Text Heatmap - 설계 문서

LLM의 self-attention을 활용하여 텍스트에서 중요한 부분을 자동으로 하이라이트하는 웹앱

## 개요

### 목적
- 텍스트나 문서를 입력하면 중요한 부분이 히트맵 형태로 강조됨
- 빠른 읽기와 핵심 파악을 도움

### 핵심 기능
- 텍스트 직접 입력 또는 파일 업로드 (.txt, .pdf, .docx)
- Self-attention 기반 단어별 중요도 계산
- 단어 단위 히트맵 시각화

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ 텍스트 입력  │  │ 파일 업로드  │  │ 히트맵 결과 뷰  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────┐
│                   FastAPI Backend                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ 파일 파싱    │  │ 모델 추론   │  │ Attention 추출  │  │
│  │ (PDF/DOCX)  │  │ (HF Trans.) │  │ & 단어 매핑     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 기술 스택
- **프론트엔드**: Next.js + TypeScript
- **백엔드**: FastAPI (Python)
- **모델**: Hugging Face Transformers (DistilBERT 등 경량 모델)

## 백엔드 구조

```
backend/
├── main.py              # FastAPI 앱 진입점
├── config.py            # 모델 설정 로드 (환경변수/.env)
├── routers/
│   └── analyze.py       # POST /api/analyze 엔드포인트
├── services/
│   ├── file_parser.py   # PDF, DOCX, TXT 텍스트 추출
│   ├── model_loader.py  # HF 모델 로드 및 캐싱
│   └── attention.py     # Attention 추출 & 단어 매핑
└── requirements.txt
```

### API 엔드포인트

```
POST /api/analyze
- Request: { text: string } 또는 multipart/form-data (파일)
- Response: {
    text: "전체 텍스트...",
    scores: [0.8, 0.3, 0.5, ...]  // 단어별 중요도 (0~1)
  }
```

### 모델 설정

```env
MODEL_NAME=distilbert-base-multilingual-cased
```

- 사용자 UI에서 모델 선택 불가
- 개발 단계에서 .env로 모델 변경하며 테스트

### Attention 계산 방식

1. 마지막 레이어의 attention만 사용 (속도 최적화)
2. 각 토큰이 받는 attention 합산 (column-wise sum)
3. 같은 단어에 속한 토큰들의 점수를 평균
4. 0~1 범위로 정규화

## 프론트엔드 구조

```
frontend/
├── app/
│   ├── layout.tsx       # 공통 레이아웃
│   ├── page.tsx         # 메인 페이지
│   └── globals.css
├── components/
│   ├── TextInput.tsx    # 텍스트 입력 영역
│   ├── FileUpload.tsx   # 파일 업로드 버튼
│   ├── HeatmapView.tsx  # 히트맵 결과 표시
│   └── LoadingState.tsx # 로딩 스피너
├── lib/
│   └── api.ts           # 백엔드 API 호출
└── package.json
```

### UI 흐름

```
┌─────────────────────────────────────────┐
│  📄 Text Heatmap                        │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 텍스트를 입력하세요...             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [파일 업로드]  [분석하기]               │
├─────────────────────────────────────────┤
│  결과:                                  │
│  ████ 중요한 ░░ 부분이 ██ 강조됩니다    │
│                                         │
└─────────────────────────────────────────┘
```

### 히트맵 렌더링

- 각 단어를 `<span>`으로 감싸고 배경색 투명도로 중요도 표현
- `rgba(255, 200, 0, ${score})` 형태로 노란색~주황색 그라데이션
- 점수가 높을수록 진한 하이라이트

## 긴 텍스트 처리

### 모델 토큰 제한
- BERT 계열: 512 토큰 (약 1,500~2,000자 한글 기준)
- 이보다 긴 텍스트는 청크로 나눠서 처리

### 청크 처리 전략

```python
MAX_TOKENS = 512
OVERLAP = 50  # 청크 간 겹침 (문맥 유지)

def process_long_text(text):
    tokens = tokenizer(text)

    if len(tokens) <= MAX_TOKENS:
        return analyze_single(tokens)

    # 청크로 분할 (겹침 포함)
    chunks = split_with_overlap(tokens, MAX_TOKENS, OVERLAP)

    # 각 청크별 attention 계산
    results = [analyze_single(chunk) for chunk in chunks]

    # 겹치는 부분은 평균내서 병합
    return merge_results(results)
```

### 전체 제한

```
MAX_FILE_SIZE = 10MB
MAX_CHARACTERS = 100,000자 (약 A4 50페이지)
```

- 제한 초과 시 프론트엔드에서 에러 메시지 표시
- 청크 처리는 백엔드에서 자동으로, 사용자는 신경 쓸 필요 없음

## 프로젝트 구조

```
text-heatmap/
├── frontend/           # Next.js 앱
│   ├── app/
│   ├── components/
│   └── package.json
├── backend/            # FastAPI 서버
│   ├── main.py
│   ├── services/
│   └── requirements.txt
├── .env.example        # 모델 설정 템플릿
├── docker-compose.yml  # 로컬 개발용 (선택)
└── README.md
```

## 개발 순서

1. 백엔드: 모델 로드 + attention 추출 핵심 로직
2. 백엔드: API 엔드포인트 + 파일 파싱
3. 프론트엔드: 텍스트 입력 + API 연동
4. 프론트엔드: 히트맵 시각화
5. 프론트엔드: 파일 업로드 추가
6. 청크 처리 + 에러 핸들링

## 배포

- **프론트엔드**: Vercel
- **백엔드**: GPU 서버 필요 시 Modal, Replicate, 또는 직접 서버

## 최적화 전략

1. **경량 모델 사용** - DistilBERT (BERT 대비 60% 빠름, 성능 97% 유지)
2. **마지막 레이어만 사용** - 모든 레이어 평균 대신 마지막 레이어 attention만
3. **양자화 고려** - FP16 또는 INT8로 추론 속도 향상 가능
4. **응답 형식 최적화** - 텍스트 + 점수 배열 분리 (단어별 객체 대신)
