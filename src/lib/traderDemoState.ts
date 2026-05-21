// Trader-side demo state — prototype-only switcher to preview the trader's
// page-level user states on /listings and /trader/*.
// Persisted to localStorage. Synced across components via a custom event.
// NOT shipped as user feature — visual treatment in TraderStateSwitcher.tsx is
// the same "developer console badge" treatment as LPStateSwitcher.
//
// Eugene 2026-05-20: «У Trader'а статусы — подключен кошелёк, не подключен,
// есть позиции, нет позиций». Simpler than the LP model — trader axis is
// «have I deposited and do I have anything live», not «how many NFTs do I
// own and how many are listed».

import { useEffect, useState } from 'react'

export type TraderDemoStateId =
  | 'guest'                  // T1 — wallet not connected
  | 'connected-no-positions' // T2 — wallet OK, no active positions
  | 'connected-with-positions' // T3 — wallet OK, has active positions

export const TRADER_DEMO_STATES: { id: TraderDemoStateId; code: string; label: string; short: string }[] = [
  { id: 'guest',                    code: 'T1', label: 'Not connected',           short: 'Wallet not connected' },
  { id: 'connected-no-positions',   code: 'T2', label: 'Connected · no positions', short: 'Wallet OK · nothing live' },
  { id: 'connected-with-positions', code: 'T3', label: 'Connected · with positions', short: 'Wallet OK · positions live' },
]

const STORAGE_KEY = 'sliq.traderDemoState'
const EVENT_NAME = 'sliq:traderDemoStateChange'
const DEFAULT_STATE: TraderDemoStateId = 'connected-with-positions'

export function useTraderDemoState() {
  const [state, setStateRaw] = useState<TraderDemoStateId>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE
    const stored = localStorage.getItem(STORAGE_KEY) as TraderDemoStateId | null
    return stored && TRADER_DEMO_STATES.some(s => s.id === stored) ? stored : DEFAULT_STATE
  })

  // Cross-component sync via event
  useEffect(() => {
    function onChange() {
      const next = (localStorage.getItem(STORAGE_KEY) as TraderDemoStateId | null) ?? DEFAULT_STATE
      setStateRaw(next)
    }
    window.addEventListener(EVENT_NAME, onChange)
    return () => window.removeEventListener(EVENT_NAME, onChange)
  }, [])

  function setState(s: TraderDemoStateId) {
    setStateRaw(s)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, s)
      window.dispatchEvent(new Event(EVENT_NAME))
    }
  }

  return [state, setState] as const
}

// Helpers — derive booleans per state so screens stay readable
export function deriveTraderState(s: TraderDemoStateId) {
  return {
    isConnected: s !== 'guest',
    hasPositions: s === 'connected-with-positions',
  }
}
