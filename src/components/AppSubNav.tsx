// Contextual sub-nav strip — appears below header for top-level sections.
// Maps current pathname to a section + active sub-tab.

import { Link, useLocation } from 'react-router-dom'

type SubTab = { to: string; label: string; match: (path: string) => boolean }

const TRADE_TABS: SubTab[] = [
  {
    to: '/listings',
    label: 'Marketplace',
    match: p => p === '/listings' || p.startsWith('/listings/') || p.startsWith('/trader/open'),
    // /trader/open is a derived flow from Marketplace (click listing → S4 → wizard).
    // Не показываем как самостоятельный tab — попадает сюда через breadcrumb.
  },
  {
    to: '/trader/positions',
    label: 'My positions',
    match: p => p === '/trader/positions' || p.startsWith('/trader/positions/'),
  },
  {
    to: '/trader/closed',
    label: 'Market transactions',
    match: p => p === '/trader/closed' || p.startsWith('/trader/closed/'),
  },
]

// LP sub-nav: split into 2 logical tabs per Eugene's IA call (2026-05-14):
//   - «List NFT»: onboarding flow + eligible NFTs + inline Lite/Pro form (states 1.1-1.3)
//   - «My positions»: existing listings table + claimable banner (states 1.4-1.5)
// Old /lp/deposit and /lp/claims tabs removed — /lp/list replaces the form flow,
// claims live inline on My positions header.
const POOLS_TABS: SubTab[] = [
  { to: '/lp/list', label: 'List NFT', match: p => p === '/lp/list' || p === '/lp/deposit' || p.startsWith('/lp/deposit/') },
  { to: '/lp/positions', label: 'My positions', match: p => p === '/lp/positions' || p === '/lp/listings' || p.startsWith('/lp/listings/') || p === '/lp/claims' },
]

const KEEPER_TABS: SubTab[] = [
  { to: '/keeper/positions', label: 'Positions queue', match: p => p === '/keeper/positions' },
  { to: '/keeper/listings', label: 'Listings queue', match: p => p === '/keeper/listings' },
]

function pickSection(path: string): SubTab[] | null {
  if (path.startsWith('/listings') || path.startsWith('/trader')) return TRADE_TABS
  if (path.startsWith('/lp')) return POOLS_TABS
  if (path.startsWith('/keeper')) return KEEPER_TABS
  return null
}

export function AppSubNav() {
  const location = useLocation()
  const tabs = pickSection(location.pathname)
  if (!tabs) return null

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 h-10 flex items-center gap-1">
        {tabs.map(t => {
          const active = t.match(location.pathname)
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                'px-3 py-1.5 text-sm rounded transition ' +
                (active
                  ? 'font-semibold text-gray-900 bg-gray-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')
              }
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
