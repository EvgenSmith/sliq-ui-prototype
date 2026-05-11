// NetworkSwitcher — chip + dropdown, lives in AppHeader between nav and wallet button.
// Per S3 redesign spec: V3 multi-chain ready, Arbitrum active (sLiq deployed here), остальные "Coming soon".

import { useEffect, useRef, useState } from 'react'
import { CHAINS, LOCKED_STRINGS, type ChainOption } from '@/lib/marketplace-constants'
import type { ChainId } from '@/lib/types'

interface Props {
  value: ChainId
  onChange: (next: ChainId) => void
  compact?: boolean // mobile icon-only
}

export function NetworkSwitcher({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onClick)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = CHAINS.find(c => c.id === value) ?? CHAINS[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Network: ${active.fullLabel}`}
      >
        <ChainIcon chain={active} />
        {!compact && <span>{active.shortLabel}</span>}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-[220px] rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-30"
        >
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide font-semibold text-gray-500 border-b border-gray-100">
            {LOCKED_STRINGS.selectNetwork}
          </div>
          <ul className="py-1">
            {CHAINS.filter(c => c.state !== 'dev' || isDev()).map(c => {
              const isActive = c.id === value
              const disabled = c.state !== 'active' && c.state !== 'dev'
              const isNextUp = c.state === 'next-up'
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      onChange(c.id)
                      setOpen(false)
                    }}
                    className={
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition ' +
                      (isActive
                        ? 'bg-gray-50 font-medium'
                        : isNextUp
                        ? 'opacity-90 cursor-not-allowed bg-amber-50/30'
                        : disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50')
                    }
                  >
                    <ChainIcon chain={c} />
                    <span className="flex-1">{c.fullLabel}</span>
                    {isNextUp && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                        Next
                      </span>
                    )}
                    {c.state === 'coming-soon' && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {LOCKED_STRINGS.comingSoon}
                      </span>
                    )}
                    {c.state === 'dev' && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                        dev
                      </span>
                    )}
                    {isActive && !disabled && (
                      <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
                        <path
                          d="M1 5l3 3 7-7"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function ChainIcon({ chain }: { chain: ChainOption }) {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
      style={{ background: chain.iconColor }}
      aria-hidden="true"
    >
      {chain.shortLabel.slice(0, 1)}
    </span>
  )
}

function isDev() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('dev')
}
