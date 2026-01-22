from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, translate
from services.cache import cache
from config import REDIS_URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 캐시 초기화
    await cache.initialize(REDIS_URL)
    yield
    # 종료 시 캐시 연결 해제
    await cache.close()


app = FastAPI(
    title="Text Heatmap API",
    description="LLM attention 기반 텍스트 중요도 분석 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://read.tallpizza.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(translate.router, prefix="/api", tags=["translate"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
