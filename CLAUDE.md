# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Text Heatmap - 텍스트 분석 및 히트맵 시각화 웹 애플리케이션

## Commands

### Backend
```bash
cd backend
uv pip install -r requirements.txt  # 의존성 설치
uvicorn main:app --reload           # 개발 서버 실행
```

### Frontend
```bash
cd frontend
bun install      # 의존성 설치
bun run dev      # 개발 서버 실행
```

## Architecture

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (TypeScript)
- **Package Manager**: uv (backend), bun (frontend)

## Current Configuration

The project has Claude Code plugins enabled, specifically the superpowers plugin.