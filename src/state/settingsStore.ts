import { create } from 'zustand';

export interface SettingsState {
  revealRawProbability: boolean;
  reducedMotion: boolean;
  minFontSize: number;

  setRevealRawProbability: (b: boolean) => void;
  setReducedMotion: (b: boolean) => void;
  setMinFontSize: (px: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  revealRawProbability: false,
  reducedMotion: false,
  minFontSize: 14,
  setRevealRawProbability: (b) => set({ revealRawProbability: b }),
  setReducedMotion: (b) => set({ reducedMotion: b }),
  setMinFontSize: (px) => set({ minFontSize: px }),
}));
