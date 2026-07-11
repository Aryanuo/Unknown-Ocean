import { create } from 'zustand'

type AppPhase = 'landing' | 'diving' | 'ocean'

interface AppState {
  phase: AppPhase
  setPhase: (phase: AppPhase) => void
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'landing',
  setPhase: (phase) => set({ phase }),
}))
