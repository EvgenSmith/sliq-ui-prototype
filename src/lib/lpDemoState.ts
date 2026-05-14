// LP-side demo state — prototype-only switcher to preview the 5 user states on /lp/listings.
// Persisted to localStorage. Synced across components via a custom event.
// NOT shipped as user feature — visual treatment in LPStateSwitcher.tsx is intentionally
// "developer console badge" (monospace + dashed border + no brand color).

import { useEffect, useState } from 'react'

export type LPDemoStateId =
  | 'guest'                    // 1.1 — wallet not connected
  | 'connected-no-nfts'        // 1.2 — connected, no LP NFTs in wallet
  | 'connected-fresh'          // 1.3 — connected, has eligible NFTs, no listings yet
  | 'connected-all-listed'     // 1.4 — connected, has listings, no more eligible NFTs
  | 'connected-partial'        // 1.5 — connected, has listings AND more eligible NFTs

export const LP_DEMO_STATES: { id: LPDemoStateId; code: string; label: string; short: string }[] = [
  { id: 'guest',                code: '1.1', label: 'Not connected',       short: 'Wallet not connected' },
  { id: 'connected-no-nfts',    code: '1.2', label: 'Wallet · empty',      short: 'Connected · 0 LP NFTs' },
  { id: 'connected-fresh',      code: '1.3', label: 'Has NFT · no listings', short: 'Eligible to list · nothing listed yet' },
  { id: 'connected-all-listed', code: '1.4', label: 'All listed',          short: 'No more eligible NFTs · all deployed' },
  { id: 'connected-partial',    code: '1.5', label: 'Partial listed',      short: 'Some listed · more available' },
]

const STORAGE_KEY = 'sliq.lpDemoState'
const EVENT_NAME = 'sliq:lpDemoStateChange'
const DEFAULT_STATE: LPDemoStateId = 'connected-partial'

export function useLPDemoState() {
  const [state, setStateRaw] = useState<LPDemoStateId>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE
    const stored = localStorage.getItem(STORAGE_KEY) as LPDemoStateId | null
    return stored && LP_DEMO_STATES.some(s => s.id === stored) ? stored : DEFAULT_STATE
  })

  // Cross-component sync via event
  useEffect(() => {
    function onChange() {
      const next = (localStorage.getItem(STORAGE_KEY) as LPDemoStateId | null) ?? DEFAULT_STATE
      setStateRaw(next)
    }
    window.addEventListener(EVENT_NAME, onChange)
    return () => window.removeEventListener(EVENT_NAME, onChange)
  }, [])

  function setState(s: LPDemoStateId) {
    setStateRaw(s)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, s)
      window.dispatchEvent(new Event(EVENT_NAME))
    }
  }

  return [state, setState] as const
}

// Helpers — derive booleans per state so screens stay readable
export function deriveLPState(s: LPDemoStateId) {
  return {
    isConnected: s !== 'guest',
    hasListings: s === 'connected-all-listed' || s === 'connected-partial',
    hasEligibleNFTs: s === 'connected-fresh' || s === 'connected-partial',
  }
}
