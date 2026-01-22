"use client";

import { useState, useEffect, memo, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

// rendering-hoist-jsx: 정적 SVG를 컴포넌트 외부로 추출
const SettingsIcon = memo(function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
});

// 플레이스홀더 버튼 (SSR용) - rendering-hoist-jsx
const PlaceholderButton = (
  <div className="fixed top-4 right-4 z-50">
    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md" />
  </div>
);

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    fontSize,
    lineHeight,
    textAlign,
    maxWidth,
    translationEnabled,
    setFontSize,
    setLineHeight,
    setTextAlign,
    setMaxWidth,
    setTranslationEnabled,
    resetSettings,
  } = useSettingsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 외부 클릭 시 패널 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // rerender-functional-setstate: 토글 콜백 안정화
  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  // SSR에서는 렌더링하지 않음
  if (!mounted) {
    return PlaceholderButton;
  }

  return (
    <div ref={panelRef} className="fixed top-4 right-4 z-50">
      <button
        className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md hover:shadow-lg text-gray-500 hover:text-gray-700 transition-all"
        onClick={toggleOpen}
        title="설정"
      >
        <SettingsIcon />
      </button>

      {/* rendering-conditional-render: 삼항 연산자 사용 */}
      {isOpen ? (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl p-4 shadow-xl z-50">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800">표시 설정</h4>
            <button
              className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
              onClick={resetSettings}
            >
              초기화
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>글자 크기</span>
                <span className="font-mono text-gray-400">{fontSize.toFixed(2)}rem</span>
              </label>
              <input
                type="range"
                min="0.875"
                max="1.5"
                step="0.0625"
                value={fontSize}
                onChange={(e) => setFontSize(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div>
              <label className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>줄 간격</span>
                <span className="font-mono text-gray-400">{lineHeight.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="1.4"
                max="3"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div>
              <label className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>최대 너비</span>
                <span className="font-mono text-gray-400">{maxWidth}rem</span>
              </label>
              <input
                type="range"
                min="30"
                max="80"
                step="5"
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">텍스트 정렬</label>
              <div className="flex gap-1">
                <button
                  className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-colors ${
                    textAlign === 'left'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  onClick={() => setTextAlign('left')}
                >
                  왼쪽
                </button>
                <button
                  className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-colors ${
                    textAlign === 'center'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  onClick={() => setTextAlign('center')}
                >
                  가운데
                </button>
                <button
                  className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-colors ${
                    textAlign === 'justify'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  onClick={() => setTextAlign('justify')}
                >
                  양쪽
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <label className="flex justify-between items-center cursor-pointer">
                <span className="text-xs text-gray-500">번역</span>
                <button
                  onClick={() => setTranslationEnabled(!translationEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    translationEnabled ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      translationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
