// SectionSelector — main role/section toggle (Trade / Pools / Keeper).
// Lives above sub-nav, below header — Uniswap-style page-level segmented control.

import { useLocation, useNavigate } from 'react-router-dom'
import { connectedWallet } from '@/mocks/data'

const SECTIONS = [
  { id: 'trade', label: 'Trade', match: ['/listings', '/trader'], dest: '/listings' },
  { id: 'pools', label: 'Pools', match: ['/lp'], dest: '/lp/listings' },
] as const

export function SectionSelector() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  // Hide on screens without section context
  if (
    path.startsWith('/onboarding') ||
    path.startsWith('/access') ||
    path.startsWith('/settings')
  ) {
    return null
  }

  const inTrade = SECTIONS[0].match.some(p => path.startsWith(p))
  const inPools = SECTIONS[1].match.some(p => path.startsWith(p))
  const inKeeper = path.startsWith('/keeper')

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center">
        <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 p-1">
          <Segment
            label="Trade"
            active={inTrade}
            onClick={() => navigate(SECTIONS[0].dest)}
          />
          <Segment
            label="Pools"
            active={inPools}
            onClick={() => navigate(SECTIONS[1].dest)}
          />
          {connectedWallet.isPermissionedLiquidator && (
            <Segment
              label="Keeper"
              active={inKeeper}
              onClick={() => navigate('/keeper/positions')}
              accent="liquidator"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Segment({
  label,
  active,
  onClick,
  accent = 'default',
}: {
  label: string
  active: boolean
  onClick: () => void
  accent?: 'default' | 'liquidator'
}) {
  const activeColor =
    accent === 'liquidator' ? 'var(--color-role-liquidator)' : 'oklch(20% 0 0)'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-4 py-1.5 text-sm font-medium rounded transition ' +
        (active ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900')
      }
      style={active ? { color: activeColor } : undefined}
    >
      {label}
    </button>
  )
}
