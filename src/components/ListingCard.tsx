// ListingCard — design spec §9.8 + §11.6 (Listings browse)
// Single component, role-conditional CTA. Same listing renders different actions for LP-owner / Trader / Liquidator / public.

import { Link } from 'react-router-dom'
import type { Listing } from '@/lib/types'
import {
  fmtFeeTier,
  fmtPct,
  fmtRange,
  fmtTimeAgo,
  fmtUSD,
  isInRange,
} from '@/lib/format'
import { APYBreakdown } from './APYBreakdown'

type ViewerRole = 'lp-owner' | 'trader' | 'liquidator' | 'public'

interface Props {
  listing: Listing
  viewerRole: ViewerRole
}

export function ListingCard({ listing, viewerRole }: Props) {
  const inRange = isInRange(listing.currentPrice, listing.rangeLow, listing.rangeHigh)
  const isAdvanced = listing.providerMode === 'advanced'
  const isSubsidized = listing.minPremiumApyBps < 0
  const capacityPct = listing.totalCapacityUSD > 0
    ? (listing.availableCapacityUSD / listing.totalCapacityUSD) * 100
    : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <Link
            to={`/listings/${listing.id}`}
            className="text-base font-semibold tracking-tight hover:underline"
          >
            {listing.pair.token0} / {listing.pair.token1}
          </Link>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>fee {fmtFeeTier(listing.feeTierBps)}</span>
            <span>·</span>
            <span>listed {fmtTimeAgo(listing.listedAt)}</span>
            <span>·</span>
            <span>NFT #{listing.tokenId}</span>
          </div>
        </div>

        {/* Mode chip */}
        <ModeChip mode={listing.providerMode} leverage={listing.providerLeverage} />
      </div>

      {/* Range */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="num text-sm">
          <span className="text-gray-500">Range </span>
          <span className="font-medium">{fmtRange(listing.rangeLow, listing.rangeHigh)}</span>
        </div>
        {inRange ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30">
            in range
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-300">
            out of range
          </span>
        )}
      </div>

      {/* Subsidized badge — UC-LP-1.D mechanic */}
      {isSubsidized && (
        <div className="my-2 flex items-center gap-2 text-xs px-2 py-1 rounded bg-[var(--color-negative-apy-bg)] border border-[var(--color-negative-apy)]/30 text-[var(--color-negative-apy)]">
          <span className="font-medium">Subsidized listing</span>
          <span className="opacity-80">— LP pays {fmtPct(Math.abs(listing.minPremiumApyBps))} carry to traders</span>
        </div>
      )}

      {/* APY snapshot */}
      <div className="my-3">
        <div className="text-xs text-gray-500 mb-1">Yields (last 30d)</div>
        <APYBreakdown
          layout="compact"
          uniswapApyBps={listing.uniswapApyBps}
          refRealizedApyBps={listing.referenceApyBps}
        />
        <div className="text-xs text-gray-700 mt-1.5 num">
          <span className="text-gray-500">Min Premium APY:</span>{' '}
          <span
            className="font-medium"
            style={{
              color: isSubsidized ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)',
            }}
          >
            {fmtPct(listing.minPremiumApyBps, { signed: true })}
          </span>
        </div>
      </div>

      {/* Capacity */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Capacity</span>
          <span className="num">
            {fmtUSD(listing.availableCapacityUSD)} of {fmtUSD(listing.totalCapacityUSD)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-role-lp)]/60 transition-all"
            style={{ width: `${100 - capacityPct}%` }}
          />
        </div>
      </div>

      {/* Advanced-only risk strip */}
      {isAdvanced && listing.distanceToLiqPct !== undefined && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 flex items-center gap-2">
          <span className="font-medium">Advanced — collateralized</span>
          <span>·</span>
          <span className="num">distance to liq: {listing.distanceToLiqPct}%</span>
        </div>
      )}

      {/* Role-conditional action */}
      <RoleAction listing={listing} viewerRole={viewerRole} />
    </div>
  )
}

function ModeChip({ mode, leverage }: { mode: 'conservative' | 'advanced'; leverage: number }) {
  if (mode === 'conservative') {
    return (
      <span className="text-xs whitespace-nowrap px-2 py-1 rounded-md bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
        Conservative · 1×
      </span>
    )
  }
  return (
    <span className="text-xs whitespace-nowrap px-2 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-medium">
      Advanced · {leverage}×
    </span>
  )
}

function RoleAction({ listing, viewerRole }: { listing: Listing; viewerRole: ViewerRole }) {
  const fullCapacity = listing.availableCapacityUSD <= 0

  if (viewerRole === 'lp-owner') {
    return (
      <Link
        to={`/lp/listings/${listing.id}`}
        className="block w-full text-center text-sm font-medium px-3 py-2 rounded-md border border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)] transition"
      >
        Manage listing
      </Link>
    )
  }

  if (viewerRole === 'trader') {
    if (fullCapacity) {
      return (
        <Link
          to={`/trader/open?listing=${listing.id}&intent=outbid`}
          className="block w-full text-center text-sm font-medium px-3 py-2 rounded-md bg-[var(--color-role-trader)] text-white hover:opacity-90 transition"
        >
          Outbid active position
        </Link>
      )
    }
    return (
      <Link
        to={`/trader/open?listing=${listing.id}`}
        className="block w-full text-center text-sm font-medium px-3 py-2 rounded-md bg-[var(--color-role-trader)] text-white hover:opacity-90 transition"
      >
        Open position
      </Link>
    )
  }

  if (viewerRole === 'liquidator') {
    return (
      <Link
        to={`/listings/${listing.id}`}
        className="block w-full text-center text-sm font-medium px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
      >
        View (read-only)
      </Link>
    )
  }

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="block w-full text-center text-sm font-medium px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
    >
      View listing
    </Link>
  )
}
