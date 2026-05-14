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
  // Simplified brand glyphs per chain. Inline SVG keeps build lean (no external assets).
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full overflow-hidden shrink-0"
      aria-hidden="true"
    >
      {chain.id === 'arbitrum' && <ArbitrumLogo />}
      {chain.id === 'ethereum' && <EthereumLogo />}
      {chain.id === 'base' && <BaseLogo />}
      {chain.id === 'optimism' && <OptimismLogo />}
      {chain.id === 'polygon' && <PolygonLogo />}
      {chain.id === 'sepolia' && <SepoliaLogo />}
    </span>
  )
}

function ArbitrumLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#213147" />
      <path d="M18.7 9 22 19.4l1.6-2.5L19.6 8h-1l-.9 1z" fill="#12AAFF" />
      <path d="M22.7 22.7 22 21l-3.9-6.1L15.3 9l-.6 1.6 3.7 11.4 1.4-.5z" fill="#9DCCED" />
      <path d="m16 9.4-.6 1.5 3.3 10.3-1.5.5L13.7 12l-1.1.7 4.7 13 3.5-1.3 1.6-.6L18.7 13 16 9.4z" fill="#fff" />
    </svg>
  )
}

function EthereumLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16.5 4v8.87l7.5 3.35L16.5 4z" fill="#fff" fillOpacity=".602" />
      <path d="M16.5 4 9 16.22l7.5-3.35V4z" fill="#fff" />
      <path d="M16.5 21.97v6.03l7.5-10.37-7.5 4.34z" fill="#fff" fillOpacity=".602" />
      <path d="M16.5 28v-6.03L9 17.63 16.5 28z" fill="#fff" />
      <path d="m16.5 20.57 7.5-4.34-7.5-3.36v7.7z" fill="#fff" fillOpacity=".2" />
      <path d="m9 16.22 7.5 4.35v-7.7L9 16.22z" fill="#fff" fillOpacity=".602" />
    </svg>
  )
}

function BaseLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path d="M15.96 27.86c6.55 0 11.86-5.31 11.86-11.86 0-6.56-5.31-11.86-11.86-11.86C9.74 4.14 4.64 8.94 4.14 15h15.7v2H4.14c.5 6.06 5.6 10.86 11.82 10.86z" fill="#fff" />
    </svg>
  )
}

function OptimismLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#FF0420" />
      <path d="M11.32 19.94c-.97 0-1.77-.23-2.4-.69-.61-.46-.92-1.12-.92-1.97 0-.18.02-.4.06-.66.1-.62.27-1.36.47-2.22.59-2.38 2.11-3.57 4.56-3.57.66 0 1.26.11 1.78.34.53.21.94.55 1.25.99.3.43.45.95.45 1.55 0 .17-.02.39-.06.65a26 26 0 0 1-.47 2.23c-.3 1.18-.83 2.06-1.59 2.64-.75.58-1.79.87-3.13.87zm.18-1.81c.52 0 .96-.16 1.32-.47.37-.31.63-.78.78-1.42.21-.86.37-1.62.47-2.27.04-.2.06-.4.06-.6 0-.83-.43-1.25-1.29-1.25-.52 0-.97.16-1.34.47-.36.31-.62.78-.77 1.42-.17.62-.32 1.38-.47 2.27-.04.18-.06.38-.06.6 0 .83.43 1.25 1.3 1.25zm5.4 1.65c-.09 0-.17-.03-.23-.1-.05-.07-.06-.15-.05-.24l1.65-7.77c.02-.1.07-.19.14-.25a.4.4 0 0 1 .26-.09h3.18c.88 0 1.6.18 2.13.55.54.36.81.9.81 1.59 0 .2-.02.4-.07.62-.22 1-.66 1.74-1.32 2.22-.66.47-1.55.7-2.7.7h-1.61l-.56 2.63c-.02.1-.07.19-.14.25a.4.4 0 0 1-.26.1h-1.23zm4.76-5.32c.37 0 .69-.1.96-.3.27-.21.45-.5.54-.88a1.45 1.45 0 0 0 .03-.27c0-.25-.07-.45-.22-.58-.15-.13-.4-.2-.76-.2h-1.43l-.47 2.24h1.35z" fill="#fff" />
    </svg>
  )
}

function PolygonLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path d="M21.04 12.39c-.36-.21-.83-.21-1.23 0l-2.85 1.69-1.94 1.1-2.81 1.69c-.36.21-.83.21-1.23 0l-2.21-1.31c-.36-.2-.6-.6-.6-1.05v-2.54c0-.4.2-.8.6-1.05l2.21-1.27c.36-.2.83-.2 1.23 0l2.21 1.31c.36.21.6.61.6 1.06v1.69l1.94-1.14v-1.73c0-.4-.2-.8-.6-1.05l-4.11-2.42c-.36-.2-.83-.2-1.23 0l-4.19 2.46c-.4.21-.6.61-.6 1.01v4.84c0 .4.2.8.6 1.05l4.15 2.42c.36.21.83.21 1.23 0l2.81-1.65 1.94-1.14 2.81-1.65c.36-.21.83-.21 1.23 0l2.21 1.3c.36.21.6.61.6 1.06v2.54c0 .4-.2.8-.6 1.05l-2.17 1.3c-.36.21-.83.21-1.23 0l-2.21-1.3c-.36-.21-.6-.61-.6-1.06v-1.65l-1.94 1.14v1.69c0 .4.2.8.6 1.05l4.15 2.42c.36.21.83.21 1.23 0l4.15-2.42c.36-.2.6-.6.6-1.05v-4.88c0-.4-.2-.8-.6-1.05l-4.11-2.42z" fill="#fff" />
    </svg>
  )
}

function SepoliaLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#CC2D2D" />
      <text x="16" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">S</text>
    </svg>
  )
}

function isDev() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('dev')
}
