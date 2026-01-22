import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  fontSize: number;      // rem 단위
  lineHeight: number;    // 배수
  textAlign: 'left' | 'center' | 'justify';
  maxWidth: number;      // rem 단위
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setTextAlign: (align: 'left' | 'center' | 'justify') => void;
  setMaxWidth: (width: number) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  fontSize: 1.125,
  lineHeight: 2,
  textAlign: 'justify' as const,
  maxWidth: 50,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setFontSize: (size) => set({ fontSize: size }),
      setLineHeight: (height) => set({ lineHeight: height }),
      setTextAlign: (align) => set({ textAlign: align }),
      setMaxWidth: (width) => set({ maxWidth: width }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'heatmap-settings',
    }
  )
);
