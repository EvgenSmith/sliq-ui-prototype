// RoleBadge — design spec §7 + §9.2
// Persistent role indicator. Sticky per-tab via localStorage.

import { useEffect, useRef, useState } from 'react'
import type { Role } from '@/lib/types'

const ROLES: { id: Role; label: string; color: string; bg: string }[] = [
  { id: 'All', label: 'All', color: 'var(--color-role-all)', bg: 'var(--color-role-all-bg)' },
  { id: 'LP', label: 'LP', color: 'var(--color-role-lp)', bg: 'var(--color-role-lp-bg)' },
  { id: 'Trader', label: 'Trader', color: 'var(--color-role-trader)', bg: 'var(--color-role-trader-bg)' },
  { id: 'Liquidator', label: 'Liquidator', color: 'var(--color-role-liquidator)', bg: 'var(--color-role-liquidator-bg)' },
]

interface Props {
  value: Role
  onChange: (next: Role) => void
  showLiquidator?: boolean
}

export function RoleBadge({ value, onChange, showLiquidator = false }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = ROLES.find(r => r.id === value)!
  const visible = ROLES.filter(r => r.id !== 'Liquidator' || showLiquidator)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border transition hover:opacity-90"
        style={{ color: current.color, background: current.bg, borderColor: current.color }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: current.color }}
        />
        <span>{current.label === 'All' ? 'Mode: All' : `${current.label} mode`}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-30"
        >
          {visible.map(r => {
            const selected = r.id === value
            return (
              <button
                key={r.id}
                onClick={() => {
                  onChange(r.id)
                  setOpen(false)
                }}
                role="menuitem"
                className={
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition ' +
                  (selected ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50')
                }
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: r.color }}
                />
                <span>{r.label === 'All' ? 'All (portfolio)' : r.label}</span>
                {selected && (
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true" className="ml-auto">
                    <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
