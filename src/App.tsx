// App shell — simplified per v1 conversation:
// Header = brand + [Trade] [Pools] [Keeper(cond)] + Connect Wallet dropdown
// SubNav = contextual sub-tabs per section
// No more Portfolio Overview (orphaned); no more RoleBadge in header.

import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { AppSubNav } from '@/components/AppSubNav'
// StatusBanner is now rendered inside AppHeader (between dev-switcher row and section-nav row).
import { Landing } from '@/screens/Landing'
import { ListingsMarketplace } from '@/screens/ListingsMarketplace'
import { ListingDetail } from '@/screens/ListingDetail'
// LPDeposit retired — listing flow merged into MyListings (mode='list') with inline Lite/Pro form.
import { TraderOpen } from '@/screens/TraderOpen'
import { PositionDetail } from '@/screens/PositionDetail'
import { TraderPositions } from '@/screens/TraderPositions'
import { MyListings } from '@/screens/MyListings'
import { ClosedPositionsList } from '@/screens/ClosedPositionsList'
import { ClosedPositionDetail } from '@/screens/ClosedPositionDetail'
// ClaimableHub retired — aggregated «Claimable now» banner inlined on MyListings (mode='positions').
import { Onboarding } from '@/screens/Onboarding'
import { WhitelistGate } from '@/screens/WhitelistGate'
import { Settings } from '@/screens/Settings'
import { ListingLiquidationView } from '@/screens/ListingLiquidation'
import { LiquidatorPositions, LiquidatorListings } from '@/screens/LiquidatorQueue'

// Scroll-to-top on route change — per Eugene 2026-05-15: «При переходе из My
// Listings внутрь в детали, страничка должны открываться сверху». React Router
// preserves window scroll across navigations by default; this resets it.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  // Landing has its own nav/footer — bypass AppShell entirely
  if (location.pathname === '/') {
    return <Landing />
  }
  return (
    <div className="min-h-full flex flex-col overflow-x-hidden">
      <ScrollToTop />
      <AppHeader />
      <AppSubNav />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          {/* Trade section */}
          <Route path="/listings" element={<ListingsMarketplace />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/listings/:id/liquidation" element={<ListingLiquidationView />} />
          <Route path="/trader/positions" element={<SectionWrap><TraderPositions /></SectionWrap>} />
          <Route path="/trader/positions/:id" element={<PositionDetail />} />
          <Route path="/trader/open" element={<TraderOpen />} />
          <Route path="/trader/closed" element={<SectionWrap><ClosedPositionsList /></SectionWrap>} />
          <Route path="/trader/closed/:id" element={<ClosedPositionDetail />} />

          {/* Pools section — 2 logical tabs:
                /lp/list       = ListNFTPage (onboarding + eligible NFTs + inline Lite/Pro form)
                /lp/positions  = MyPositionsPage (existing listings table)
              Old URLs (/lp/listings, /lp/deposit, /lp/claims) preserved as aliases for back-compat. */}
          <Route path="/lp/list" element={<SectionWrap><MyListings mode="list" /></SectionWrap>} />
          <Route path="/lp/positions" element={<SectionWrap><MyListings mode="positions" /></SectionWrap>} />
          <Route path="/lp/listings/:id" element={<ListingDetail />} />
          {/* Back-compat aliases */}
          <Route path="/lp/listings" element={<Navigate to="/lp/positions" replace />} />
          <Route path="/lp/deposit" element={<SectionWrap><MyListings mode="list" /></SectionWrap>} />
          <Route path="/lp/claims" element={<Navigate to="/lp/positions" replace />} />

          {/* Keeper section (formerly /liquidator) */}
          <Route path="/keeper/positions" element={<LiquidatorPositions />} />
          <Route path="/keeper/listings" element={<LiquidatorListings />} />
          {/* Back-compat alias for old links during refactor window */}
          <Route path="/liquidator/positions" element={<Navigate to="/keeper/positions" replace />} />
          <Route path="/liquidator/listings" element={<Navigate to="/keeper/listings" replace />} />

          {/* Auth / config */}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/access" element={<WhitelistGate />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function SectionWrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 text-xs text-gray-500 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-4 flex flex-wrap gap-x-6 gap-y-2 justify-between">
        <span>sLiq Beta version · v2.1 prototype</span>
        <span>v1: Uniswap V3 only · No insurance fund · No oracle</span>
      </div>
    </footer>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h2 className="text-xl font-semibold mb-2">Not found</h2>
    </div>
  )
}
