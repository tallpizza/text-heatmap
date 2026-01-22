"use client";

export default function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <span className="loading-text">분석 중...</span>
    </div>
  );
}
