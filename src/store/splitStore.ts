import { create } from 'zustand'

/** 오른쪽 분할 패널에 띄울 수 있는 뷰(파라미터 없는 라우트만) */
export type RightView = 'today' | 'inbox' | 'upcoming' | 'week' | 'calendar'

interface SplitStore {
  on: boolean
  rightView: RightView
  /** 왼쪽 패널 폭 비율 (0.25 ~ 0.75) */
  ratio: number
  toggle: () => void
  setOn: (v: boolean) => void
  setRightView: (v: RightView) => void
  setRatio: (r: number) => void
}

const readRatio = () => {
  const n = Number(localStorage.getItem('pd-split-ratio'))
  return n >= 0.25 && n <= 0.75 ? n : 0.5
}

export const useSplit = create<SplitStore>(set => ({
  on: localStorage.getItem('pd-split') === '1',
  rightView: (localStorage.getItem('pd-split-view') as RightView) || 'inbox',
  ratio: readRatio(),
  toggle: () => set(s => { const on = !s.on; localStorage.setItem('pd-split', on ? '1' : '0'); return { on } }),
  setOn: v => { localStorage.setItem('pd-split', v ? '1' : '0'); set({ on: v }) },
  setRightView: v => { localStorage.setItem('pd-split-view', v); set({ rightView: v }) },
  setRatio: r => { const c = Math.min(0.75, Math.max(0.25, r)); localStorage.setItem('pd-split-ratio', String(c)); set({ ratio: c }) },
}))
