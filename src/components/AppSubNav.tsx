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

// LP sub-nav: «Deposit» and «Claims» tabs removed per IA simplification.
//   - «Deposit» — superseded by inline «+ List NFT» CTA inside /lp/listings (states 1.3/1.5).
//     Deposit form route /lp/deposit is reached via that CTA, not via top nav.
//   - «Claims» — aggregated into /lp/listings summary; per-listing claim lives in ListingDetail.
const POOLS_TABS: SubTab[] = [
  { to: '/lp/listings', label: 'My listings', match: p => p.startsWith('/lp') },
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
