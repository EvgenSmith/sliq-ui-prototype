// Trade Listing Detail — trader-side entry point for /listings/:id.
//
// Eugene 2026-05-20: physically split from ListingDetail.tsx to isolate the
// trader-side rework (per the 2026-05-18 trader UI ТЗ) from the LP-side
// (Pools), which is in stabilisation. Step 1 = soft split: file is a byte
// copy of ListingDetail.tsx with the exported function renamed; the route
// in App.tsx now points here. No behavioural change yet.
//
// Step 1b (next commit) will prune the OwnerPanel branch out of this file
// and the TraderPanel branch out of ListingDetail.tsx, then move shared
// helpers (ProMetrics, FeeRow, ActionButton, splitToTokens, etc.) to
// src/components/. From there, all trader rework lives here, all LP work
// lives in ListingDetail.tsx — no cross-contamination.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listings, positions, closedPositions, connectedWallet } from '@/mocks/data'
import {
  fmtFeeTier,
  fmtPct,
  fmtRange,
  fmtTimeAgo,
  fmtToken,
  fmtUSD,
  isInRange,
  shortAddr,
} from '@/lib/format'
import { APYBreakdown } from '@/components/APYBreakdown'
// RiskPanel removed from this screen per Eugene 2026-05-15. Component still
// lives in components/ for the ListingLiquidation route.
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import { LPFlowSelector } from '@/components/LPFlowSelector'
import { HelpPopover } from '@/components/HelpPopover'
import { CopyAddress } from '@/components/CopyAddress'
import { RangeBar } from '@/components/RangeBar'
import {
  capacityFreePct,
  estimatePositionPnL,
  getAuctionHeat,
  getTraderListingStatus,
  type TraderListingStatus,
} from '@/lib/derive'
import { useState as useState2 } from 'react'

export function TradeListingDetail() {
  const { id } = useParams<{ id: string }>()
  const listing = useMemo(() => listings.find(l => l.id === id), [id])
  const listingPositions = useMemo(
    () => positions.filter(p => p.listingId === id),
    [id]
  )

  const isOwner = listing?.owner === connectedWallet.address
  // Owner-side Lite/Pro toggle is lifted to the parent so the right-rail
  // ProMetrics block can hide in Lite mode (call 2026-05-14 feedback).
  const [ownerMode, setOwnerMode] = useState2<'lite' | 'pro'>('lite')

  if (!listing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Listing not found</h2>
        <Link to="/listings" className="text-sm underline">
          ← Back to Listings
        </Link>
      </div>
    )
  }

  const inRange = isInRange(listing.currentPrice, listing.rangeLow, listing.rangeHigh)
  const isAdvanced = listing.providerMode === 'advanced'
  const isSubsidized = listing.minPremiumApyBps < 0
  const isFull = listing.availableCapacityUSD <= 0

  // `stress` + `traderClaimsUSD` lived here as inputs to the removed
  // RiskPanel block. Dropped 2026-05-15 with the panel itself.

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/listings" className="hover:underline">
          Listings
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">
          {listing.pair.token0} / {listing.pair.token1}
        </span>
      </nav>

      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-baseline gap-2 flex-wrap">
            <span>{listing.pair.token0} / {listing.pair.token1}</span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">
              Uniswap
              <span className="ml-1 px-1 rounded bg-[#bef264] border border-[#a3e635]/60 text-gray-900 font-semibold">v3</span>
            </span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
              {fmtFeeTier(listing.feeTierBps)}
            </span>
          </h1>
          <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
            {/* Status chip — final spec (Eugene 2026-05-15). Same vocab as My Listings:
                Earning / Listed / Withdrawing / Liquidating / Liquidated / Closed.
                Sits first in the meta-line — primary state-of-the-listing signal. */}
            {(() => {
              const leasedPct = listing.totalCapacityUSD > 0
                ? ((listing.totalCapacityUSD - listing.availableCapacityUSD) / listing.totalCapacityUSD) * 100
                : 0
              const s = listing.status
              const chip = s === 'LIQUIDATING'
                ? { label: 'Liquidating', cls: 'bg-red-50 text-[var(--color-status-danger)] border-[var(--color-status-danger)]/40' }
                : s === 'LIQUIDATED'
                ? { label: 'Liquidated', cls: 'bg-red-50/60 text-red-900/70 border-red-200' }
                : s === 'WITHDRAWAL_REQUESTED'
                ? { label: 'Withdrawing', cls: 'bg-amber-50 text-amber-900 border-amber-300' }
                : s === 'WITHDRAWN'
                ? { label: 'Closed', cls: 'bg-gray-100 text-gray-500 border-gray-300' }
                : leasedPct <= 0.5
                ? { label: 'Listed', cls: 'bg-gray-50 text-gray-700 border-gray-200' }
                : { label: 'Earning', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
              return (
                <span className={'text-xs whitespace-nowrap px-2 py-0.5 rounded-full font-medium border ' + chip.cls}>
                  {chip.label}
                </span>
              )
            })()}
            <span className={'text-xs px-2 py-0.5 rounded-full ' + (inRange
              ? 'bg-gray-50 text-gray-700 border border-gray-200'
              : 'bg-amber-50 text-amber-900 border border-amber-300 font-medium')}>
              {inRange ? 'in range' : 'out of range'}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs num">NFT #{listing.tokenId}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs">listed {fmtTimeAgo(listing.listedAt)}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs num">owner {shortAddr(listing.owner)}</span>
            {/* Full · open-to-outbid chip moved inline into the meta-line
                (Eugene 2026-05-15) — was a separate row that wasted vertical
                space on mobile. */}
            {isFull && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs whitespace-nowrap px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium">
                  Full · open to outbid
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Safe/At-risk + Full chips removed from header right (duplicate / inlined).
              Subsidized stays — orthogonal signal not in summary. */}
          {isSubsidized && (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] border border-[var(--color-negative-apy)]/30 font-medium">
              Subsidized
            </span>
          )}
        </div>
      </header>

      {/* Layout: main + sidebar — no tabs, role-conditional */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          {isOwner ? (
            <OwnerPanel listing={listing} ownerMode={ownerMode} setOwnerMode={setOwnerMode} />
          ) : (
            <TraderPanel
              listing={listing}
              isFull={isFull}
              positions={listingPositions}
            />
          )}
        </section>

        {/* Sidebar — for trader perspective. Owner has its own Listing Summary block
            in the main column, so we hide this duplicate for them. */}
        <aside className="space-y-4">
          {/* TraderInfoCard — collects everything we moved out of the
              marketplace row (Eugene 2026-05-20: «Прячем в карточку Listing
              stability, NFT ID, 4 цены, Lifetime, Uniswap APY, IP APY»). */}
          {!isOwner && <TraderInfoCard listing={listing} positions={listingPositions} />}

          {/* «Advanced — listing risk» panel removed per Eugene 2026-05-15
              («Этот блок выпили»). The signal it carried (aggregate reserve,
              distance to liq, stress test, trader claims) is now better served
              by the Risk column in My Listings + the HF / liquidation context
              in the per-listing Listing summary card. The collapsible
              «what happens if liquidation triggers» explainer was the only
              part not covered elsewhere — if needed back, lives in component
              `RiskPanel` and the screen-specific `ListingLiquidation` route. */}

          {/* Owner-specific position analytics — always-visible quick-glance perf
              indicators (hit-rate, avg leased). Per Eugene 2026-05-15 placed ABOVE
              the collapsible ProMetrics block: open-by-default essentials first,
              collapsed-by-default «advanced» analytics underneath. */}
          {isOwner && ownerMode === 'pro' && (
            <OwnerPositionAnalytics listing={listing} />
          )}

          {/* Faint divider/label before ProMetrics — signals that hit-rate / avg-leased
              above are «always-on essentials», ProMetrics below is the deeper / optional
              advanced analytics (UX audit P2.19). Only for owner Pro view (trader sees
              ProMetrics adjacent to Open CTA without the LP-style divider). */}
          {isOwner && ownerMode === 'pro' && (
            <div className="flex items-center gap-2 pt-2 pb-1">
              <span className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Advanced analytics</span>
              <span className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          {/* Pro Metrics:
              - Trader (non-owner): keeps full ProMetrics block — decision context
                near the Open CTA.
              - Owner Pro: per Eugene 2026-05-15 the LP-side analytics here are
                placeholdered until the option-style metrics suite is ready. The
                rendered block previews the upcoming surface (IV-based pricing,
                σ-distance, vega/theta, range-event probabilities) without
                exposing the half-finished current numbers. */}
          {!isOwner && (
            <ProMetrics listing={listing} positions={listingPositions} isOwner={isOwner} />
          )}
          {isOwner && ownerMode === 'pro' && (
            // Copy validated against Kolya's spec — sLiq LP interface review,
            // 2026-05-15 1320, ~47:51–52:01. Key points he locked in:
            //   • Panel is per-trader / per-portfolio (Deribit-style positions
            //     list), NOT per-listing. Don't promise listing analytics here.
            //   • Same math apparatus as options → Greeks (theta, delta, vega,
            //     etc.) are computable on our positions; values are comparable
            //     and additive with the trader's actual options book.
            //   • Theta on sLiq positions is inverted vs option-buyer theta:
            //     «у нас тета — это сколько ты платишь за время, за которое
            //     несёшь риск». Mention this explicitly — it's the differentiator.
            //   • Hedging use-case: connect exchange keys → combined risk read
            //     across sLiq + options → know what to hedge with futures /
            //     options. Even without keys, surfacing just our risks is
            //     enough for v1 of the panel.
            //   • Naming Kolya proposed: «Option style» / «Obsonov расчёт».
            //   • Scope: separate tab, not v1. «позже сделать».
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-1.5">
                  Option-style risk panel
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Soon</span>
                </h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Portfolio-level Greeks across your sLiq positions — delta, vega, and an inverted
                theta (sLiq theta = what you <em>pay</em> per unit of time you carry the risk,
                not what you earn). Same math as options pricing, so values are directly comparable
                and additive with the rest of your options book.
              </p>
              <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
                Connect your exchange keys to combine sLiq exposure with live option / future
                positions — read total risk in one place, decide what to hedge with what.
              </p>
              <p className="text-[10px] text-gray-500 mt-2 leading-snug">
                Separate tab, post-Beta · ping us to pilot the panel before it ships.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Listing transactions — full-width footer below the 2-col grid. Moved out of
          OwnerPanel main column (Eugene 2026-05-15) so that on mobile the right-aside
          analytics (Range hit-rate · Avg leased · Pro metrics) stack ABOVE the
          transactions table — operational decision support before retrospective audit.
          On desktop the transactions go full-width, which suits the 7-column table
          better than a 2/3 col constraint. Only for owners. */}
      {isOwner && (
        <div className="mt-6">
          <ListingTransactions listing={listing} />
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}

function TraderPanel({
  listing,
  isFull,
  positions,
}: {
  listing: import('@/lib/types').Listing
  isFull: boolean
  positions: import('@/lib/types').Position[]
}) {
  // Trader-relative status — drives which Action card we render.
  // Eugene 2026-05-20 — § «Проработай вид карточки заявок с разными статусами».
  const traderStatus = getTraderListingStatus(listing, positions, connectedWallet.address)

  // Variant E — terminal listing states (no action possible).
  // Show a read-only banner + the 24h chart for context.
  if (traderStatus.terminal) {
    return (
      <div className="space-y-4">
        <TerminalListingBanner status={traderStatus} listing={listing} />
        <ListingPriceChart listing={listing} />
      </div>
    )
  }

  // Variant F — my position active (no outbid). Per Eugene 2026-05-20
  // «пока не трогай мои активные позиции, карточку под них сделаем в
  // рамках подраздела My Positions». Show a referral card pointing the
  // user to /trader/positions/:id, plus chart for context.
  if (traderStatus.chip === 'my-position' || traderStatus.chip === 'open-and-mine') {
    return (
      <div className="space-y-4">
        <MyPositionReferralCard listing={listing} positions={positions} />
        <ListingPriceChart listing={listing} />
      </div>
    )
  }

  // Variants A/B/C/D — Open / Full-buyout / Outbid / Out-of-margin.
  // OpenPositionForm already adapts via outbidTargetId; we additionally pass
  // traderStatus so it can surface the right header + framing copy. Variant-
  // specific «Outbid your slot back» / «Top up margin» wrappers come next pass.
  return (
    <div className="space-y-4">
      {(traderStatus.chip === 'outbid' || traderStatus.chip === 'out-of-margin') && (
        <OutbidContextBanner listing={listing} positions={positions} status={traderStatus} />
      )}
      {/* Inline Open Position form FIRST — CTA above the fold (primary intent) */}
      <OpenPositionForm listing={listing} isFull={isFull} positionsOnListing={positions} />

      {/* Price + Range chart 24h — context after form */}
      <ListingPriceChart listing={listing} />

      {/* Active positions — incumbents with live PnL для outbid-решений */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">
            Positions on this listing{positions.length > 0 ? ` (${positions.length})` : ''}
          </h3>
          {positions.length > 0 && (
            <span className="text-[11px] text-gray-500">
              PnL ниже — estimated impermanent profit − fees accrued. Перебив incumbent ставкой выше его Premium APY, ты захватываешь convex tail от его текущей точки.
            </span>
          )}
        </div>
        {positions.length === 0 ? (
          <p className="text-sm text-gray-500">No active positions yet. Be first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left font-medium pb-2">Trader</th>
                <th className="text-right font-medium pb-2">Notional</th>
                <th className="text-right font-medium pb-2">APY paid</th>
                <th className="text-right font-medium pb-2">Live PnL</th>
                <th className="text-right font-medium pb-2">Reserve</th>
                <th className="text-right font-medium pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const pnl = estimatePositionPnL(p)
                const positivePnl = pnl > 0
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-2.5 num text-xs">{shortAddr(p.trader)}</td>
                    <td className="py-2.5 text-right num">{fmtUSD(p.notionalUSD)}</td>
                    <td className="py-2.5 text-right num font-medium">{fmtPct(p.apyBps, { signed: true })}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className="num font-semibold"
                        style={{ color: pnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                      >
                        {pnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(pnl))}
                      </span>
                      {positivePnl && (
                        <div className="text-[10px] text-amber-800 leading-tight mt-0.5">
                          🎯 capture-able
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right num text-xs">
                      {fmtUSD(p.reserveUSD)}{' '}
                      <span className="text-gray-500">({p.reservePctOfInitial}%)</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => {
                          // Dispatch custom event picked up by OpenPositionForm to prefill bid
                          window.dispatchEvent(new CustomEvent('sliq:prefillOutbid', { detail: { positionId: p.id, targetApyBps: p.apyBps } }))
                          document.getElementById('open-position-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                        className={
                          'text-xs font-medium px-2.5 py-1 rounded border transition ' +
                          (positivePnl
                            ? 'border-amber-700 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold'
                            : 'border-[var(--color-role-trader)] text-[var(--color-role-trader)] hover:bg-[var(--color-role-trader-bg)]')
                        }
                        title={positivePnl ? `Перебей >${fmtPct(p.apyBps)} APY — захвати +${fmtUSD(pnl)}` : `Outbid this position`}
                      >
                        {positivePnl ? `Outbid → +${fmtUSD(pnl)}` : 'Outbid'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Realized yields — collapsible (secondary signal, not first-touch) */}
      <details className="rounded-lg border border-gray-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700">
          Realized yields (last 30d)
        </summary>
        <div className="mt-3">
          <APYBreakdown
            uniswapApyBps={listing.uniswapApyBps}
            refRealizedApyBps={listing.referenceApyBps}
            perspective="trader"
          />
        </div>
      </details>

      {/* Pro Metrics — moved to right rail of main page */}
    </div>
  )
}

// === ListingPriceChart — 24h price line with LP range overlay ===
function ListingPriceChart({ listing }: { listing: import('@/lib/types').Listing }) {
  // Synthetic 24h path through listing.currentPrice
  const seed = parseInt(listing.id.replace(/\D/g, '') || '0')
  const points = useMemo(() => {
    const arr: Array<{ x: number; y: number }> = []
    const n = 40
    const driftMag = (listing.rangeHigh - listing.rangeLow) * 0.15
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const drift = Math.sin(t * 4 + seed) * driftMag * 0.5 + Math.cos(t * 9 + seed * 2) * driftMag * 0.3
      arr.push({ x: t * 100, y: listing.currentPrice + drift * (t - 0.5) })
    }
    // Anchor end point to current price exactly
    arr[arr.length - 1] = { x: 100, y: listing.currentPrice }
    return arr
  }, [listing, seed])

  const minY = Math.min(listing.rangeLow, listing.currentPrice * 0.985, ...points.map(p => p.y)) * 0.995
  const maxY = Math.max(listing.rangeHigh, listing.currentPrice * 1.015, ...points.map(p => p.y)) * 1.005
  const yRange = maxY - minY
  const yToPx = (y: number) => 100 - ((y - minY) / yRange) * 100
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${yToPx(p.y)}`).join(' ')

  // 24h change vs first point
  const startPrice = points[0].y
  const change24hPct = ((listing.currentPrice - startPrice) / startPrice) * 100

  const fmtP = (n: number) => {
    if (n >= 1000) return `$${Math.round(n).toLocaleString()}`
    if (n >= 1) return `$${n.toFixed(2)}`
    if (n >= 0.01) return `$${n.toFixed(4)}`
    return `$${n.toExponential(2)}`
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <h2 className="text-sm font-semibold">Price · 24h</h2>
        <div className="text-xs num">
          <span className="font-semibold text-gray-900">{fmtP(listing.currentPrice)}</span>
          <span
            className="ml-2 font-semibold"
            style={{ color: change24hPct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
          >
            {change24hPct >= 0 ? '+' : ''}{change24hPct.toFixed(2)}% 24h
          </span>
        </div>
      </div>
      <div className="relative w-full" style={{ aspectRatio: '5 / 1.4' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          {/* LP range zone */}
          <rect
            x="0"
            y={yToPx(listing.rangeHigh)}
            width="100"
            height={yToPx(listing.rangeLow) - yToPx(listing.rangeHigh)}
            fill="var(--color-role-lp)"
            opacity="0.08"
          />
          {/* Range bounds */}
          <line x1="0" y1={yToPx(listing.rangeHigh)} x2="100" y2={yToPx(listing.rangeHigh)} stroke="var(--color-role-lp)" strokeOpacity="0.4" strokeDasharray="1.5,1" strokeWidth="0.3" />
          <line x1="0" y1={yToPx(listing.rangeLow)} x2="100" y2={yToPx(listing.rangeLow)} stroke="var(--color-role-lp)" strokeOpacity="0.4" strokeDasharray="1.5,1" strokeWidth="0.3" />
          {/* Price path */}
          <path d={pathD} fill="none" stroke="oklch(35% 0 0)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          {/* Current marker */}
          <circle cx="100" cy={yToPx(listing.currentPrice)} r="1.4" fill="var(--color-role-trader)" />
        </svg>
        {/* Labels */}
        <div className="absolute right-1 text-[9px] num text-[var(--color-role-trader)] font-semibold whitespace-nowrap" style={{ top: `${yToPx(listing.currentPrice)}%`, transform: 'translateY(-50%)' }}>
          ▶ {fmtP(listing.currentPrice)}
        </div>
        <div className="absolute left-1 text-[9px] num text-[var(--color-role-lp)] opacity-70" style={{ top: `${yToPx(listing.rangeHigh)}%`, transform: 'translateY(-50%)' }}>
          ↑ {fmtP(listing.rangeHigh)}
        </div>
        <div className="absolute left-1 text-[9px] num text-[var(--color-role-lp)] opacity-70" style={{ top: `${yToPx(listing.rangeLow)}%`, transform: 'translateY(-50%)' }}>
          ↓ {fmtP(listing.rangeLow)}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[var(--color-role-trader)]"></span>current</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-1 border-b-2 border-dashed border-[var(--color-role-lp)]"></span>LP range</span>
        <span className="ml-auto text-gray-400">mock 24h data for prototype</span>
      </div>
    </div>
  )
}

// === OpenPositionForm — inline buyout/outbid form, replaces /trader/open nav ===
function OpenPositionForm({
  listing,
  isFull,
  positionsOnListing,
}: {
  listing: import('@/lib/types').Listing
  isFull: boolean
  positionsOnListing: import('@/lib/types').Position[]
}) {
  const minApyBps = listing.minPremiumApyBps
  // Active incumbents — used для auction context + outbid mechanic
  const incumbents = positionsOnListing.filter(p => p.status === 'OPEN')
  const topActiveApyBps = incumbents.length > 0 ? Math.max(...incumbents.map(p => p.apyBps)) : minApyBps
  const weakestActiveApyBps = incumbents.length > 0 ? Math.min(...incumbents.map(p => p.apyBps)) : minApyBps
  // For outbid mode (full listing): default = weakest + 100 bps. For normal: default = min + 100 bps.
  const suggestedApyBps = isFull ? weakestActiveApyBps + 100 : minApyBps + 100

  const [marginUSD, setMarginUSD] = useState2<number>(1000)
  const [leverage, setLeverage] = useState2<number>(1000) // default 1000× per Eugene 2026-05-20 — «maximally efficient» framing (ТЗ §5.3 P1 R-024)
  const [apyBps, setApyBps] = useState2<number>(suggestedApyBps)
  const [twoTokenMode, setTwoTokenMode] = useState2<boolean>(false)
  const [marginTok0, setMarginTok0] = useState2<number>(0)
  const [marginTok1, setMarginTok1] = useState2<number>(0)
  const [outbidTargetId, setOutbidTargetId] = useState2<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState2<boolean>(false)

  // Listen for Outbid-button events from positions table
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ positionId: string; targetApyBps: number }>
      setOutbidTargetId(ev.detail.positionId)
      setApyBps(ev.detail.targetApyBps + 100)
    }
    window.addEventListener('sliq:prefillOutbid', handler)
    return () => window.removeEventListener('sliq:prefillOutbid', handler)
  }, [])

  const apyPct = apyBps / 100
  const virtualNotional = marginUSD * leverage
  const apyValid = apyBps >= minApyBps
  const outbidPossible = isFull && apyBps > weakestActiveApyBps
  const outbidTargetPos = outbidTargetId ? incumbents.find(p => p.id === outbidTargetId) : null

  // 2-token suggested split — 50/50 by USD value (token0 expressed via current price)
  const suggestedTok0 = (marginUSD / 2) / listing.currentPrice
  const suggestedTok1 = marginUSD / 2

  // Live preview math
  const carryPerHour = (virtualNotional * apyBps / 10000) / 8760 + (virtualNotional * listing.referenceApyBps / 10000) / 8760
  // Liquidation distance: rough proxy 0.9 / leverage × 100 (matches PnLEstimator)
  const liqDistancePct = (0.9 / leverage) * 100
  const liqDown = listing.currentPrice * (1 - liqDistancePct / 100)
  const liqUp = listing.currentPrice * (1 + liqDistancePct / 100)
  // Breakeven (24h hold): √(2 × carry24h / notional) × 100
  const carry24h = carryPerHour * 24
  const breakevenMovePct = Math.sqrt(2 * carry24h / virtualNotional) * 100
  // PnL if ±1% move (pair-aware default — keep simple ±1% baseline)
  const previewMovePct = 0.01
  const previewGrossIP = virtualNotional * previewMovePct * previewMovePct / 2
  const previewNet = previewGrossIP - carry24h

  // Errors
  const errors: string[] = []
  if (!apyValid) errors.push(`APY must be ≥ ${(minApyBps / 100).toFixed(2)}%`)
  if (outbidPossible && apyBps <= weakestActiveApyBps) errors.push(`Outbid requires APY > ${(weakestActiveApyBps / 100).toFixed(2)}% (weakest active)`)
  if (marginUSD < 10) errors.push('Min margin $10')
  if (apyBps % 100 !== 0) errors.push('APY step = 1% in Beta')

  const isOutbidMode = isFull || !!outbidTargetId
  const ctaLabel = isOutbidMode
    ? outbidTargetPos
      ? `Outbid ${outbidTargetPos.id} → take their slot`
      : 'Outbid weakest active'
    : 'Open position'

  return (
    <div id="open-position-form" className="rounded-lg border border-[var(--color-role-trader)]/40 bg-[var(--color-role-trader-bg)]/30 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold">
          {isOutbidMode ? '🎯 Outbid mode' : 'Open position'}
        </h2>
        {isFull && (
          <span className="text-[11px] text-amber-800">
            Listing is full — only outbid possible
          </span>
        )}
        {outbidTargetPos && (
          <button
            type="button"
            onClick={() => setOutbidTargetId(null)}
            className="text-[11px] text-gray-500 hover:text-gray-700 underline decoration-dotted"
          >
            clear target
          </button>
        )}
      </div>

      {outbidTargetPos && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs num">
          <div className="font-semibold text-amber-900 mb-0.5">Targeting incumbent {outbidTargetPos.id}</div>
          <div className="text-amber-800">
            Current APY {fmtPct(outbidTargetPos.apyBps)} · notional {fmtUSD(outbidTargetPos.notionalUSD)} ·
            est. PnL <span style={{ color: estimatePositionPnL(outbidTargetPos) >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
              {estimatePositionPnL(outbidTargetPos) >= 0 ? '+' : '−'}{fmtUSD(Math.abs(estimatePositionPnL(outbidTargetPos)))}
            </span>
          </div>
        </div>
      )}

      {/* Margin */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-sm font-medium">
            Margin
            <HelpPopover label="Что такое margin" width="w-72">
              <p className="font-semibold mb-1">Margin</p>
              <p>Сколько ты вкладываешь как collateral под позицию. Можно в одном или двух токенах — UI предлагает 50/50 split по текущей цене (advanced toggle справа — кастомный сплит).</p>
            </HelpPopover>
          </label>
          <button
            type="button"
            onClick={() => setTwoTokenMode(t => !t)}
            className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
          >
            {twoTokenMode ? '← Use USD (auto-split)' : 'Advanced: 2-token split →'}
          </button>
        </div>
        {!twoTokenMode ? (
          <>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={marginUSD || ''}
                onChange={e => setMarginUSD(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm num"
              />
              <span className="text-xs text-gray-500">USD</span>
              <button
                type="button"
                onClick={() => setMarginUSD(100)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                $100
              </button>
              <button
                type="button"
                onClick={() => setMarginUSD(1000)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                $1K
              </button>
              <button
                type="button"
                onClick={() => setMarginUSD(10000)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                $10K
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 num">
              Auto-split: <strong>{suggestedTok0.toFixed(6)}</strong> {listing.pair.token0} + <strong>${suggestedTok1.toFixed(2)}</strong> {listing.pair.token1}
            </p>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500">{listing.pair.token0}</label>
              <input
                type="number"
                value={marginTok0 || ''}
                onChange={e => setMarginTok0(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm num"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">{listing.pair.token1}</label>
              <input
                type="number"
                value={marginTok1 || ''}
                onChange={e => setMarginTok1(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm num"
              />
            </div>
          </div>
        )}
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-sm font-medium">
            Leverage
            <HelpPopover label="Что такое leverage" width="w-72">
              <p className="font-semibold mb-1">Trader leverage (5× — 1000×)</p>
              <p className="mb-1">Множитель virtual notional. Notional = margin × leverage.</p>
              <p>1000× — максимально для capital efficiency. Меньшее плечо (100×, 10×) — для длинных safe позиций, чтобы не подходить к монитору на выходных.</p>
            </HelpPopover>
          </label>
          <span className="num font-semibold text-sm">{leverage}×</span>
        </div>
        <input
          type="range"
          min={5}
          max={1000}
          step={5}
          value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="w-full accent-[var(--color-role-trader)]"
        />
        <div className="flex justify-between text-[10px] text-gray-400 num mt-1">
          <span>5×</span><span>100×</span><span>250×</span><span>500×</span><span>1000×</span>
        </div>
      </div>

      {/* Premium APY */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-sm font-medium">
            Premium APY (your bid)
            <HelpPopover label="Что такое Premium APY bid" width="w-80">
              <p className="font-semibold mb-1">Premium APY auction</p>
              <p className="mb-1.5">Ставка carry, которую <strong>ты обещаешь платить</strong> LP'у годовых на virtual notional.</p>
              <p className="mb-1.5">Минимум — задан LP. Шаг 1% (Beta constraint). Чем выше bid — тем меньше шанс что тебя перекупят, но тем больше carry платишь.</p>
              <p className="text-[11px] text-gray-500">Если listing FULL — bid должен быть выше weakest incumbent чтобы зайти.</p>
            </HelpPopover>
          </label>
          <span className="num font-semibold text-sm">{apyPct.toFixed(2)}% APY</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={apyPct}
            step={1}
            onChange={e => setApyBps(Math.round(Number(e.target.value) * 100))}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm num"
          />
          <span className="text-xs text-gray-500">%</span>
          <button
            type="button"
            onClick={() => setApyBps(suggestedApyBps)}
            className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            title="min + 1%"
          >
            suggest
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-1 num">
          min <strong>{(minApyBps / 100).toFixed(2)}%</strong>
          {incumbents.length > 0 && (
            <>
              {' '}· weakest active <strong>{(weakestActiveApyBps / 100).toFixed(2)}%</strong>
              {' '}· top active <strong>{(topActiveApyBps / 100).toFixed(2)}%</strong>
            </>
          )}
        </p>
        {apyValid && apyBps > topActiveApyBps + 100 && incumbents.length > 0 && (
          <p className="text-[11px] text-[var(--color-status-success)] mt-1">
            ✓ Outbid-resistant — твоя ставка выше всех активных
          </p>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-md border border-gray-200 bg-white p-3 space-y-1.5 num text-sm">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Live preview</div>
        <PreviewRow label="Virtual notional" value={fmtUSD(virtualNotional)} />
        <PreviewRow
          label="Liquidation"
          value={
            <span>
              <span style={{ color: 'var(--color-status-danger)' }}>↓ ${liqDown.toFixed(2)}</span>
              <span className="mx-1 text-gray-400">·</span>
              <span style={{ color: 'var(--color-status-danger)' }}>↑ ${liqUp.toFixed(2)}</span>
              <span className="text-gray-500 text-[10px]"> (±{liqDistancePct.toFixed(2)}%)</span>
            </span>
          }
        />
        <PreviewRow
          label="Carry $/h"
          value={
            <span style={{ color: apyBps < 0 ? 'var(--color-negative-apy)' : 'var(--color-status-danger)' }}>
              {apyBps < 0 ? '+' : '−'}{fmtUSD(Math.abs(carryPerHour))}
            </span>
          }
        />
        <PreviewRow
          label="Breakeven move (24h)"
          value={<span>±{breakevenMovePct.toFixed(2)}%</span>}
        />
        <PreviewRow
          label="If price ±1% in 24h"
          value={
            <span style={{ color: previewNet >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }} className="font-semibold">
              {previewNet >= 0 ? '+' : '−'}{fmtUSD(Math.abs(previewNet))}
            </span>
          }
        />
        <PreviewRow
          label="If price flat 24h"
          value={
            <span style={{ color: 'var(--color-status-danger)' }} className="font-semibold">
              −{fmtUSD(carry24h)}
            </span>
          }
        />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <ul className="text-[11px] text-amber-900 space-y-0.5">
            {errors.map(e => <li key={e}>⚠️ {e}</li>)}
          </ul>
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        disabled={errors.length > 0}
        onClick={() => setConfirmOpen(true)}
        className={
          'w-full text-sm font-semibold px-4 py-3 rounded-md transition ' +
          (errors.length > 0
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : isOutbidMode
            ? 'bg-amber-700 text-white hover:bg-amber-800'
            : 'bg-[var(--color-role-trader)] text-white hover:opacity-90')
        }
      >
        {ctaLabel}
      </button>

      <p className="text-[10px] text-gray-500 leading-snug">
        ⓘ Settlement по цене Uniswap на следующем блоке Arbitrum. После открытия позиция появится в <strong>My Positions</strong>.
        Carry будет начисляться ежесекундно.
      </p>

      <HighStakesConfirmModal
        open={confirmOpen}
        title={isOutbidMode ? 'Outbid position — confirm' : 'Open position — confirm'}
        subtitle={isOutbidMode
          ? 'Перекуп incumbent\'а исполнится на следующем блоке. Они получат margin + накопленный PnL обратно.'
          : 'Открытие позиции на следующем блоке Arbitrum. Settlement по live-цене Uniswap.'}
        currentState={[
          { label: 'Listing', value: `${listing.pair.token0}/${listing.pair.token1} · ${fmtFeeTier(listing.feeTierBps)}` },
          { label: 'Margin', value: fmtUSD(marginUSD) },
          { label: 'Leverage', value: `${leverage}×` },
          { label: 'APY bid', value: `${apyPct.toFixed(2)}%` },
        ]}
        newState={[
          { label: 'Virtual notional', value: fmtUSD(virtualNotional), deltaTone: 'neutral' },
          { label: 'Carry', value: `${fmtUSD(carryPerHour)}/h`, deltaTone: 'negative' },
          { label: 'Liquidation if', value: `±${liqDistancePct.toFixed(2)}%`, deltaTone: 'neutral' },
        ]}
        risks={[
          'Карри начисляется ежесекундно — если рынок встанет, теряешь.',
          'Movement против тебя сильнее liq-distance → margin потеряна.',
          isOutbidMode ? 'Перекуп нельзя отменить — incumbent force-closed по live-цене.' : 'Открытие нельзя отменить после подтверждения.',
        ]}
        irreversibilityNote="Как только keeper подхватит (~следующий блок) — действие финальное."
        confirmType="checkbox"
        confirmButtonLabel={isOutbidMode ? 'Confirm outbid' : 'Confirm open'}
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}

function ProMetrics({
  listing,
  positions,
  isOwner,
}: {
  listing: import('@/lib/types').Listing
  positions: import('@/lib/types').Position[]
  isOwner?: boolean
}) {
  // Mock-derived metrics — UX-grade placeholders
  // realized vol estimate from pair tier (high-vol pairs would have wider range)
  const rangeWidthPct = ((listing.rangeHigh - listing.rangeLow) / listing.currentPrice) * 100
  // Crude IV proxy: range width × 0.6 ≈ implied σ at LP-tier choice
  const ivProxy = rangeWidthPct * 0.6
  // Realized vol 7d / 30d — pseudo-deterministic per listing id
  const seed = parseInt(listing.id.replace(/\D/g, '') || '0')
  const rv7d = ivProxy * (0.7 + (seed % 7) / 20)
  const rv30d = ivProxy * (0.85 + (seed % 5) / 25)
  // σ-normalized distances
  const midpoint = (listing.rangeLow + listing.rangeHigh) / 2
  const halfWidth = (listing.rangeHigh - listing.rangeLow) / 2
  const distFromMidSigma = halfWidth > 0
    ? Math.abs(listing.currentPrice - midpoint) / (halfWidth * 0.6)
    : 0
  const distToLowerSigma = halfWidth > 0
    ? Math.max(0, (listing.currentPrice - listing.rangeLow) / (halfWidth * 0.6))
    : 0
  const distToUpperSigma = halfWidth > 0
    ? Math.max(0, (listing.rangeHigh - listing.currentPrice) / (halfWidth * 0.6))
    : 0
  // Open Interest = sum of incumbent notionals
  const openInterest = positions.filter(p => p.status === 'OPEN').reduce((s, p) => s + p.notionalUSD, 0)
  // Auction depth — list of incumbent APYs sorted, lowest first (the one that gets outbid)
  const auctionDepth = positions
    .filter(p => p.status === 'OPEN')
    .map(p => ({ id: p.id, apy: p.apyBps, notional: p.notionalUSD }))
    .sort((a, b) => a.apy - b.apy)

  return (
    <details className="group rounded-lg border border-gray-200 bg-white p-5">
      {/* «advanced» badge dropped — the divider/label above («Advanced analytics»)
          already names the group. Chevron rotates on open for clearer affordance.
          Eugene 2026-05-15. */}
      <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700 inline-flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true" className="transition-transform group-open:rotate-180 text-gray-500">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Pro metrics
        <span className="text-[11px] text-gray-500 font-normal ml-1">
          {isOwner ? 'performance · vs HODL · vol · σ-distance · auction · OI' : 'vol · σ-distance · auction depth · OI'}
        </span>
      </summary>

      {/* LP-only sub-section: Listing performance + Vs HODL */}
      {isOwner && (() => {
        const ageHoursLocal = Math.max(1, (Date.now() - listing.listedAt) / (1000 * 60 * 60))
        const netPnLLocal = listing.netPnLUSD ?? 0
        const lifetimeUniLocal = listing.lifetimeUniFeesUSD ?? 0
        const lifetimePremiumLocal = listing.lifetimePremiumUSD ?? 0
        const lifetimeRefLocal = listing.lifetimeReferenceUSD ?? 0
        const ilProxyLocal = netPnLLocal - lifetimeUniLocal - lifetimePremiumLocal - lifetimeRefLocal
        const effectiveApr = (netPnLLocal / listing.initialLiquidityUSD) * (365 / (ageHoursLocal / 24)) * 100
        const ilFeesRatio = Math.abs(ilProxyLocal) / Math.max(0.01, lifetimeUniLocal + lifetimePremiumLocal + lifetimeRefLocal)
        const uniDelta = lifetimeUniLocal + ilProxyLocal
        const sliqDelta = netPnLLocal
        return (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-gray-200 p-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Listing performance</div>
              <div className="grid grid-cols-2 gap-2 text-xs num">
                <MetricBlock label="Effective APR" value={`${effectiveApr.toFixed(2)}%`} />
                <MetricBlock label="Lessees turnover" value={`${positions.length} pos lifetime`} />
                <MetricBlock label="Capacity utilization" value={`${(100 - capacityFreePct(listing)).toFixed(0)}%`} />
                <MetricBlock label="IL / Fees ratio" value={`${ilFeesRatio.toFixed(2)}×`} />
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Vs HODL · с момента листинга</div>
              <div className="grid grid-cols-3 gap-2 text-xs num">
                <MetricBlock label="HODL" value="$0" />
                <MetricBlock
                  label="Uniswap LP only"
                  value={`${uniDelta >= 0 ? '+' : '−'}${fmtUSD(Math.abs(uniDelta))}`}
                  tone={uniDelta >= 0 ? 'ok' : 'warn'}
                />
                <MetricBlock
                  label="sLiq LP"
                  value={`${sliqDelta >= 0 ? '+' : '−'}${fmtUSD(Math.abs(sliqDelta))}`}
                  tone={sliqDelta >= 0 ? 'ok' : 'warn'}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 leading-snug">
                Все числа — отклонение от baseline «just held tokens» ($0). sLiq column &gt; Uniswap LP only = листинг приносит extra поверх обычного LP.
              </p>
            </div>
          </div>
        )
      })()}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vol panel */}
        <div className="rounded border border-gray-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 inline-flex items-center gap-1">
            Volatility (estimated)
            <HelpPopover label="Откуда vol numbers" width="w-80">
              <p className="font-semibold mb-1">Vol — derivation</p>
              <p className="mb-1.5"><strong>Realized 7d/30d</strong> = σ(log returns) на swap-events из Uniswap V3 subgraph за окно. Aggregated client-side.</p>
              <p className="mb-1.5"><strong>IV (LP-implied)</strong> ≈ rangeWidth × 0.6 — наша эвристика: узкий range = LP закладывает низкую vol. <strong>Не market-implied</strong>: для большинства pairs нет options venue.</p>
              <p className="text-[11px] text-gray-500">Major pairs (BTC/ETH) — можем подкреплять Deribit IV как secondary signal. Long-tail — нет данных, IV proxy единственный источник.</p>
            </HelpPopover>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs num">
            <MetricBlock label="Realized 7d" value={`${rv7d.toFixed(2)}%`} />
            <MetricBlock label="Realized 30d" value={`${rv30d.toFixed(2)}%`} />
            <MetricBlock label="IV (LP-implied)" value={`${ivProxy.toFixed(2)}%`} />
          </div>
        </div>

        {/* σ-distance panel */}
        <div className="rounded border border-gray-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 inline-flex items-center gap-1">
            Range position (σ-normalized)
            <HelpPopover label="Формула σ-distance" width="w-72">
              <p className="font-semibold mb-1">σ-normalized distance</p>
              <p className="mb-1">distance to bound = (price − bound) / (halfRangeWidth × 0.6)</p>
              <p className="text-[11px] text-gray-500">halfWidth × 0.6 — approximate IV-equivalent шага в pair price units. Result в σ-units сравним между pair'ами разной vol.</p>
            </HelpPopover>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs num">
            <MetricBlock label="To lower" value={`${distToLowerSigma.toFixed(2)}σ`} tone={distToLowerSigma < 0.3 ? 'warn' : 'ok'} />
            <MetricBlock label="To mid" value={`${distFromMidSigma.toFixed(2)}σ`} />
            <MetricBlock label="To upper" value={`${distToUpperSigma.toFixed(2)}σ`} tone={distToUpperSigma < 0.3 ? 'warn' : 'ok'} />
          </div>
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            Distance в σ-units до границ range. {'<'} 0.3σ от edge — risk выпадения; центр = max convexity.
          </p>
        </div>

        {/* Open Interest + LP-side leverage exposure */}
        <div className="rounded border border-gray-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 inline-flex items-center gap-1">
            Liquidity exposure
            <HelpPopover label="Формулы liquidity" width="w-72">
              <p className="font-semibold mb-1">Liquidity primitives</p>
              <p className="mb-1"><strong>OI</strong> = Σ(position.notionalUSD) for status='OPEN' — из sLiq subgraph.</p>
              <p className="mb-1"><strong>LP virtual TVL</strong> = NFT underlying × Provider Leverage.</p>
              <p><strong>OI / NFT ratio</strong> = насколько leveraged этот листинг сейчас vs underlying. {'>'} 1× означает trader-side notional превышает реальную NFT.</p>
            </HelpPopover>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs num">
            <MetricBlock label="Open Interest" value={fmtUSD(openInterest)} />
            <MetricBlock label="LP virtual TVL" value={fmtUSD(listing.totalCapacityUSD)} />
            <MetricBlock label="LP underlying NFT" value={fmtUSD(listing.initialLiquidityUSD)} />
            <MetricBlock label="OI / NFT ratio" value={`${(openInterest / Math.max(listing.initialLiquidityUSD, 1)).toFixed(2)}×`} />
          </div>
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            OI = сумма notional открытых позиций. OI / underlying NFT — насколько leveraged этот листинг сейчас.
          </p>
        </div>

        {/* Auction depth */}
        <div className="rounded border border-gray-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 inline-flex items-center gap-1">
            Premium APY auction (incumbents sorted)
            <HelpPopover label="Что такое auction depth" width="w-72">
              <p className="font-semibold mb-1">Auction order book</p>
              <p className="mb-1">Все активные incumbent позиции, sorted по их APY rate (lowest first). Lowest = «weakest» = next to be outbid если кто-то приходит с higher bid.</p>
              <p className="text-[11px] text-gray-500">Чтобы перекупить — bid Premium APY {'>'} weakest. Single-tx outbid replaces incumbent на next-block keeper claim.</p>
            </HelpPopover>
          </div>
          {auctionDepth.length === 0 ? (
            <p className="text-xs text-gray-500">Никто ещё не зашёл. Min APY: <span className="font-semibold num">{fmtPct(listing.minPremiumApyBps)}</span></p>
          ) : (
            <table className="w-full text-xs num">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left font-medium pb-1">Position</th>
                  <th className="text-right font-medium pb-1">APY</th>
                  <th className="text-right font-medium pb-1">Notional</th>
                </tr>
              </thead>
              <tbody>
                {auctionDepth.map((p, i) => (
                  <tr key={p.id} className={i === 0 ? 'border-t border-gray-100 bg-amber-50/40' : 'border-t border-gray-100'}>
                    <td className="py-1 text-[11px]">
                      {p.id}
                      {i === 0 && <span className="ml-1 text-[9px] uppercase font-semibold text-amber-800">↓ weakest</span>}
                    </td>
                    <td className="py-1 text-right font-medium">{fmtPct(p.apy)}</td>
                    <td className="py-1 text-right text-gray-600">{fmtUSD(p.notional)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            Чтобы перекупить — bid Premium APY выше «weakest» позиции.
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 space-y-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('CSV export — в проде. Mock: листинг + auction state + 30d история.')}
            className="text-[11px] font-medium px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            ↓ Export CSV
          </button>
          <span className="text-[10px] text-gray-400 num">block snapshot {Math.floor(Date.now() / 12000) % 100000} · ~just now</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-snug">
          <strong>Data sources:</strong> price/swaps/fees → Uniswap V3 subgraph · OI/auction → sLiq subgraph · greeks → client-side V3 math · IV proxy → range-width heuristic.
        </p>
      </div>
    </details>
  )
}

function MetricBlock({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div
        className="font-semibold"
        style={{ color: tone === 'warn' ? 'var(--color-status-warning)' : undefined }}
      >
        {value}
      </div>
    </div>
  )
}

function OwnerPanel({
  listing,
  ownerMode,
  setOwnerMode,
}: {
  listing: import('@/lib/types').Listing
  ownerMode: 'lite' | 'pro'
  setOwnerMode: (m: 'lite' | 'pro') => void
}) {
  const isPro = ownerMode === 'pro'

  const [leverageOpen, setLeverageOpen] = useState2(false)
  const [topUpOpen, setTopUpOpen] = useState2(false)
  const [removeLiqOpen, setRemoveLiqOpen] = useState2(false)
  const [topUpAmountUSD, setTopUpAmountUSD] = useState2(5000)
  const [removeLiqPct, setRemoveLiqPct] = useState2(25)
  const [withdrawOpen, setWithdrawOpen] = useState2(false)
  const [updateApyOpen, setUpdateApyOpen] = useState2(false)
  const [withdrawing, setWithdrawing] = useState2(false)
  const [newLeverage, setNewLeverage] = useState2(listing.providerLeverage)
  const [newMode, setNewMode] = useState2(listing.providerMode)
  const [newMinApyPct, setNewMinApyPct] = useState2(listing.minPremiumApyBps / 100)
  // Auto-compound moved to Soon (call 2026-05-15 user feedback) — no toggle state needed.

  const myListingPositions = positions.filter(p => p.listingId === listing.id)
  const activeLessees = myListingPositions.filter(p => p.status === 'OPEN')
  const lifetimeUni = listing.lifetimeUniFeesUSD ?? 0
  const lifetimePremium = listing.lifetimePremiumUSD ?? 0
  const lifetimeRef = listing.lifetimeReferenceUSD ?? 0
  const netPnL = listing.netPnLUSD ?? 0

  // Fees panel — positive-perspective layout (user spec 2026-05-15):
  //   Row 1: Uniswap fees (total · USD + token split)
  //   Row 2: Premium APY (total · USD + token split)
  //   Row 3: Total fees (sum, bold)
  //   Sub-block: Accrued (already-claimed portion) + Claimable now (LP color)
  //   IL line (vs HODL)
  // Reference is folded into Uniswap stream — term retired per call 2026-05-14.
  const uniswapFeesTotal = lifetimeUni + lifetimeRef
  const premiumFeesTotal = lifetimePremium
  const totalFees = uniswapFeesTotal + premiumFeesTotal
  const claimableNow = listing.claimableNowUSD ?? totalFees * 0.2  // mock: ~20% sitting unclaimed
  const accruedClaimed = Math.max(0, totalFees - claimableNow)
  const ilProxy = netPnL - totalFees

  const subsidized = listing.minPremiumApyBps < 0
  const isAdvanced = listing.providerMode === 'advanced'
  const hitRate = listing.rangeHitRatePct ?? 0
  // avgLeased moved to OwnerPositionAnalytics (right aside under ProMetrics)
  // per Eugene 2026-05-15. Only hitRate still referenced inside OwnerPanel
  // (the «💡 Что делать» amber callout under Fees).

  return (
    <div className="space-y-5">
      {/* Top action bar — primary owner actions (Claim + Manage▾) on the right,
          Lite/Pro view toggle on the left. Moved up from the bottom of the page
          per Eugene 2026-05-15 — owner came here to ACT, not to scroll past
          read-only data first. Convention: Uniswap V3 / OpenSea / Aave all put
          owner actions in the page header. */}
      {/* Action bar — Lite/Pro toggle (left) + Manage dropdown (right). Always on
          ONE row, even on mobile (Eugene 2026-05-15: «должно быть на 1й»). */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        {/* Lite / Pro view-mode toggle + explicit risk subtitle. Subtitle makes the
            real difference between modes visible at-a-glance — previously hidden
            inside a tooltip Help-popover (UX audit P1, Eugene 2026-05-15). */}
        <div className="inline-flex flex-col gap-0.5 min-w-0">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setOwnerMode('lite')}
              className={'text-xs px-3.5 py-1.5 transition ' + (!isPro ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50')}
            >Lite</button>
            <button
              type="button"
              onClick={() => setOwnerMode('pro')}
              className={'text-xs px-3.5 py-1.5 transition ' + (isPro ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50')}
            >Pro</button>
          </div>
          <span className="text-[10px] text-gray-500 leading-tight truncate">
            {isPro
              ? <>Pro — <span className="text-[var(--color-status-danger)]">NFT becomes collateral</span></>
              : 'Lite — no liquidation risk'}
          </span>
        </div>

        {/* Action cluster.
              Mobile (<sm)  → collapsed <ManageMenu> dropdown — keeps the row tight.
              Desktop (sm+) → inline buttons spread out, place permits (Eugene
                              2026-05-15: «кнопку Manage можно раскрывать на
                              несколько»). */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={claimableNow <= 0.01}
            onClick={() => claimableNow > 0.01 && alert(`Mock: claim ${fmtUSD(claimableNow)} в одной tx`)}
            className={
              'text-sm font-semibold px-3.5 py-1.5 rounded-md transition ' +
              (claimableNow > 0.01
                ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed')
            }
          >
            {claimableNow > 0.01 ? `Claim ${fmtUSD(claimableNow)}` : 'Claim'}
          </button>
          {isPro && (
            <>
              <button
                type="button"
                onClick={() => setLeverageOpen(true)}
                className="text-sm font-medium px-3.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition"
              >
                Update Leverage
              </button>
              <button
                type="button"
                onClick={() => setUpdateApyOpen(true)}
                className="text-sm font-medium px-3.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition"
              >
                Update Min APY
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="text-sm font-medium px-3.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition"
          >
            Withdraw NFT
          </button>
        </div>
        {/* Mobile dropdown — single Manage menu (space-constrained). */}
        <div className="sm:hidden flex items-center gap-2 shrink-0">
          <ManageMenu
            isPro={isPro}
            claimableNow={claimableNow}
            onClaim={() => alert(`Mock: claim ${fmtUSD(claimableNow)} в одной tx`)}
            onUpdateLeverage={() => setLeverageOpen(true)}
            onUpdateApy={() => setUpdateApyOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        </div>
      </div>

      {/* Listing Summary + Manage · Pro paired layout (Eugene 2026-05-15:
          «пользователь включает Pro чтобы настроить плечо и Premium APY — панель
          должна быть рядом, не внизу страницы»).
            Lite view  → Summary full width, Manage не рендерится.
            Pro view   → lg+: Summary | Manage side-by-side; mobile: stacked. */}
      {(() => {
        const totalApyBps = listing.minPremiumApyBps + listing.uniswapApyBps
        const activeCount = activeLessees.length
        // LP stability — unified scale Safe / Stable / Moderate / At-risk.
        // Conservative (1×) is always Safe; Pro+leverage>1 is graded by health factor.
        const hf = listing.healthFactorPct
        const stability: 'Safe' | 'Stable' | 'Moderate' | 'At-risk' =
          !isAdvanced ? 'Safe'
          : hf === undefined ? 'Stable'
          : hf >= 70 ? 'Stable'
          : hf >= 30 ? 'Moderate'
          : 'At-risk'
        const stabilityCls = {
          // Safe — plain text, no chip styling and no px padding. Aligns flush-left
          // with the other Listing-summary values (Eugene 2026-05-15).
          Safe: 'text-gray-700 py-0.5',
          Stable: 'bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5',
          Moderate: 'bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5',
          'At-risk': 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 px-1.5 py-0.5',
        }[stability]
        const leasedUSD = listing.totalCapacityUSD - listing.availableCapacityUSD
        const leasedPct = listing.totalCapacityUSD > 0 ? (leasedUSD / listing.totalCapacityUSD) * 100 : 0
        const summary = (
          <div className="rounded-lg border border-gray-200 bg-white p-4 h-full">
            <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
              Listing summary
              {/* Mobile-only consolidated tooltip: single (i) next to title explains
                  all metrics in one popover. Per-metric (i) icons hide on mobile
                  (each wrapped with `hidden sm:inline-flex` below).
                  Desktop keeps per-metric tooltips for precise context. */}
              <span className="sm:hidden">
                <HelpPopover label="Listing summary — all metrics" width="w-80" size="lg">
                  <p className="font-semibold mb-1.5">All metrics on this card</p>
                  <ul className="space-y-1.5 text-[11px] leading-relaxed">
                    <li><strong>Uniswap APY</strong> — realised pool fee APY на underlying V3 пуле за 30d. Базовая доходность без sLiq.</li>
                    <li><strong>Min Premium APY</strong> — минимум аукциона. Трейдер должен предложить ≥ этой ставки. Negative = subsidized (LP платит трейдерам).</li>
                    <li><strong>Total APY</strong> = Uniswap + Premium. Сколько ты заработаешь при текущих условиях.</li>
                    <li><strong>Active positions</strong> — сколько трейдер-позиций открыто. 0 = арендаторов нет → снизь min APY.</li>
                    <li><strong>LP stability</strong> — Safe / Stable / Moderate / At-risk grade. Safe = no leverage. Pro grades by HF.</li>
                    <li><strong>Leased / Total capacity</strong> — занятая доля от total. Premium APY идёт только на leased.</li>
                  </ul>
                </HelpPopover>
              </span>
            </h3>
            <dl className="grid grid-cols-2 gap-y-2.5 gap-x-3 sm:gap-x-6 text-sm">
              {/* Order swapped (Eugene 2026-05-15): Uniswap left (baseline) →
                  Premium right (additive carry). Mirrors the Total APY breakdown
                  «Uniswap + Premium». */}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Uniswap APY
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="Uniswap APY" width="w-64">
                      <p>Realised pool fee APY за последние 30d на текущем range. Это та доходность, которую NFT и так зарабатывал бы на Uniswap без sLiq. На вершину этого аукцион добавляет Premium APY.</p>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="font-semibold text-gray-900 num">{fmtPct(listing.uniswapApyBps)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Min Premium APY
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="Min Premium APY" width="w-64">
                      <p>Минимум, с которого начинается аукцион для трейдеров. Трейдер должен предложить ≥ этой ставки. Если subsidized — ты платишь трейдерам (negative).</p>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="font-semibold num" style={{ color: subsidized ? 'var(--color-negative-apy)' : undefined }}>
                  {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
                </dd>
                {/* Auction-heat sub-line (Eugene 2026-05-15) — explicit «Median
                    bid X.X% (+Ypp)» when incumbent lessees are paying above the
                    floor. Tells LP they're under-pricing; suggests raising. */}
                {(() => {
                  const heat = getAuctionHeat(listing, positions)
                  if (!heat) return null
                  const medianPct = (heat.medianApyBps / 100).toFixed(1)
                  const deltaPp = (heat.deltaBps / 100).toFixed(1)
                  return (
                    <dd className="text-[11px] num mt-0.5 leading-tight inline-flex items-center gap-1 font-medium" style={{ color: 'var(--color-status-warning)' }}>
                      ↑ Median bid {medianPct}% <span className="text-amber-700/70">(+{deltaPp}pp)</span>
                      <HelpPopover label="Median lessee bid" width="w-72">
                        <p>Median APY across {heat.sampleSize} active lessee position{heat.sampleSize === 1 ? '' : 's'} on this listing. They're paying ≥ 3pp above your Min Premium APY floor — auction is hotter than your floor reflects.</p>
                        <p className="mt-1.5">Consider raising Min APY to capture the spread. Existing lessees keep their original rate; only new positions price against the new floor.</p>
                      </HelpPopover>
                    </dd>
                  )
                })()}
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Total APY
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="Total APY" width="w-64">
                      <p>Сумма: <strong>Uniswap APY + min Premium APY</strong>. То, на что в сумме можно рассчитывать при текущих условиях аукциона и Uniswap pool yield.</p>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="font-semibold text-gray-900 num text-base flex items-baseline gap-2 flex-wrap">
                  <span>{fmtPct(totalApyBps)}</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    = {fmtPct(listing.uniswapApyBps)} Uniswap + {fmtPct(listing.minPremiumApyBps, { signed: subsidized })} Premium
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Active positions
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="Active positions" width="w-72">
                      <p>Сколько отдельных трейдер-позиций сейчас открыто на твоём листинге. Каждая платит Premium APY на свою долю notional. <strong>0</strong> = арендаторов нет → надо снизить Min APY или ждать.</p>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="font-semibold text-gray-900 num">
                  {activeCount}
                  {/* Sub-text CTA removed per Eugene 2026-05-15 — explanation lives
                      in tooltip; cell stays compact. */}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  LP stability
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="LP stability" width="w-80">
                      <p className="font-semibold mb-1">Унифицированный risk grade</p>
                      <ul className="text-xs space-y-1">
                        <li><strong>Safe</strong> — Conservative (1×), NFT не collateral, ликвидации невозможны.</li>
                        <li><strong>Stable</strong> — Pro с health factor &gt; 70, дистанция до ликвидации большая.</li>
                        <li><strong>Moderate</strong> — Pro, HF 30–70, можно тюнить.</li>
                        <li><strong>At-risk</strong> — Pro, HF &lt; 30, близко к listing-level ликвидации.</li>
                      </ul>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="flex items-center gap-2 flex-wrap">
                  <span className={'text-[11px] font-semibold rounded ' + stabilityCls}>
                    {stability}
                  </span>
                  {/* Always show leverage (incl. 1× for Safe — per Eugene 2026-05-15:
                      «где safe нужно показывать плечо»). */}
                  <span className="text-[11px] text-gray-500 num">{listing.providerLeverage}×</span>
                  {/* HF only when leverage > 1 — at 1× there's no liquidation risk to grade. */}
                  {isAdvanced && listing.healthFactorPct !== undefined && (
                    <span className="text-[11px] inline-flex items-center gap-1 num">
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">HF</span>
                      <span
                        className="font-semibold"
                        style={{
                          color: (listing.healthFactorPct ?? 0) > 60 ? 'var(--color-status-success)'
                            : (listing.healthFactorPct ?? 0) > 30 ? 'var(--color-status-warning)'
                            : 'var(--color-status-danger)',
                        }}
                      >
                        {listing.healthFactorPct}%
                      </span>
                    </span>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Leased / Total capacity
                  <span className="hidden sm:inline-flex">
                    <HelpPopover label="Leased / Total" width="w-72">
                      <p>Сколько из доступной capacity сейчас арендовано трейдерами. <strong>Leased</strong> = занято · <strong>Total</strong> = весь capacity (включая amplified leverage). Premium APY идёт только на leased долю.</p>
                    </HelpPopover>
                  </span>
                </dt>
                <dd className="num flex items-baseline gap-2 mt-0.5">
                  <span className="font-semibold text-gray-900">{fmtUSD(leasedUSD)}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-500">{fmtUSD(listing.totalCapacityUSD)}</span>
                  <span className="text-[11px] text-gray-500">({Math.round(leasedPct)}%)</span>
                </dd>
                <div className="mt-1 h-1 w-full rounded-sm bg-gray-200 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(leasedPct)}%`,
                      background: leasedPct >= 99.5 ? 'var(--color-status-success)' : 'var(--color-role-lp)',
                    }}
                  />
                </div>
              </div>
            </dl>
          </div>
        )
        if (!isPro) return summary
        // Manage · Pro — same JSX as before, just relocated next to Summary.
        const managePro = (
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 h-full flex flex-col">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Manage listing · Pro</h2>
              {isAdvanced && (listing.healthFactorPct !== undefined) && (
                <span className="text-[11px] inline-flex items-center gap-1">
                  Health
                  <span
                    className="font-semibold num"
                    style={{
                      color: (listing.healthFactorPct ?? 0) > 60 ? 'var(--color-status-success)'
                        : (listing.healthFactorPct ?? 0) > 30 ? 'var(--color-status-warning)'
                        : 'var(--color-status-danger)',
                    }}
                  >
                    {listing.healthFactorPct}%
                  </span>
                  <HelpPopover label="Health Factor" width="w-80" size="lg">
                    <p className="font-semibold mb-1.5">Health Factor (Aave-style)</p>
                    <p className="mb-1.5">Шкала 0–100% — насколько твоя Pro-позиция близка к listing-level ликвидации. Чем ниже, тем ближе.</p>
                    <ul className="space-y-1 text-[11px] leading-relaxed">
                      <li><strong className="text-[var(--color-status-success)]">&gt; 60%</strong> — Stable: дистанция до ликвидации большая.</li>
                      <li><strong className="text-[var(--color-status-warning)]">30–60%</strong> — Moderate: можно тюнить leverage / min APY.</li>
                      <li><strong className="text-[var(--color-status-danger)]">&lt; 30%</strong> — At-risk: близко к ликвидации, снижай leverage или закрывай.</li>
                    </ul>
                    <p className="mt-2 text-[11px] text-gray-500">Только для Pro-листингов с плечом &gt; 1. Conservative (1×) ликвидации не подвергаются.</p>
                  </HelpPopover>
                </span>
              )}
            </div>
            {/* 2x2 grid of management actions. Subtitles dropped per Eugene
                2026-05-15 — current values already live in Listing summary card
                next to this one. Top up + Remove liquidity are the new active
                pair (replaced disabled Auto-compound). flex-1 + items-stretch so
                the 4 action cells fill the height. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 items-stretch">
              <ActionButton
                // Single label both modes — Eugene 2026-05-15: «Enable Advanced mode»
                // was misleading. Function is the same regardless of current mode:
                // open the leverage editor. The Safe ↔ At-risk mode toggle lives
                // inside the modal where it belongs.
                title="Provider Leverage"
                subtitle=""
                onClick={() => setLeverageOpen(true)}
                tooltipLabel="Update Provider Leverage"
                tooltipBody={isAdvanced
                  ? 'Provider Leverage 2–100×. Выше = amplified pool под Premium APY, ниже = безопаснее. Можно вернуться к Safe · 1× выбрав mode в модалке.'
                  : 'Provider Leverage. Сейчас Safe · 1×. В модалке можно переключиться на At-risk · N× (NFT станет collateral) или оставить Safe.'}
              />
              <ActionButton
                title="Min Premium APY"
                subtitle=""
                onClick={() => setUpdateApyOpen(true)}
                tooltipLabel="Update Min APY"
                tooltipBody="Floor для auction. Трейдер должен предложить ≥ этой ставки чтобы зайти. Подними если есть demand, опусти чтобы привлечь арендаторов."
              />
              <ActionButton
                title="Top up liquidity"
                subtitle=""
                onClick={() => setTopUpOpen(true)}
                tooltipLabel="Top up liquidity"
                tooltipBody="Add more liquidity to this NFT position. Increases your share of Uniswap fees and the capacity traders can rent. Existing lessees are not affected."
              />
              <ActionButton
                title="Remove liquidity"
                subtitle=""
                onClick={() => setRemoveLiqOpen(true)}
                tooltipLabel="Remove liquidity"
                tooltipBody="Pull part of your NFT's liquidity. Only the unleased portion can be removed — existing lessees stay protected. For full exit use «Request withdrawal» from the header menu."
              />
            </div>
          </div>
        )
        // items-stretch + h-full on both cards equalises Manage block to
        // Listing summary height (Eugene 2026-05-15 — Pro view had visible
        // height mismatch since Listing summary has 6 dl rows and Manage has
        // only 4 actions; now both extend to the taller one).
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
            {summary}
            {managePro}
          </div>
        )
      })()}

      {/* Position Info — underlying Uniswap pool facts. Listed-since + NFT id are
          already in the page header above, so we don't duplicate them here.
          Per-param tooltips replaced with a single card-level (i) — Eugene 2026-05-15
          («сделай тултип на всю карточку, а не на 1 параметр»). */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
            Position info
            <HelpPopover label="Position info — all metrics" width="w-80" size="lg">
              <p className="font-semibold mb-1.5">Position info — underlying Uniswap pool facts</p>
              <ul className="space-y-1.5 text-[11px] leading-relaxed">
                <li><strong>Pool size</strong> — USD value locked in the NFT at listing time. Token-pair sub-line shows the actual token amounts on each side.</li>
                {isPro && isAdvanced && <li><strong>Trader market</strong> — Pool size × Leverage. The leveraged exposure traders compete for; backed by the Pool-size amount.</li>}
                <li><strong>Range</strong> — Uniswap V3 price range; outside this band the LP earns no Uniswap fees.</li>
                <li><strong>Uniswap APY</strong> — realised pool-fee APY on the current range over the last 30d. Baseline yield without sLiq.</li>
                <li><strong>Protocol · fee tier</strong> — underlying DEX + Uniswap fee tier of this pool.</li>
              </ul>
            </HelpPopover>
          </h3>
          <a
            href={`https://app.uniswap.org/positions/v3/arbitrum/${listing.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[var(--color-role-lp)] hover:underline inline-flex items-center gap-1"
          >
            View on Uniswap →
          </a>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 gap-x-3 sm:gap-x-6 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Pool size</dt>
            <dd className="font-semibold text-gray-900 num">{fmtUSD(listing.initialLiquidityUSD)}</dd>
            {/* Token-pair sub-line: 2-line LEFT-aligned (Eugene 2026-05-15 mobile
                review reversed earlier right-align decision — label and value
                both flush-left reads cleaner inside narrow card columns). */}
            <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5 flex flex-col items-start">
              {(() => {
                const { t0Amt, t1Amt } = splitToTokens(listing.initialLiquidityUSD, listing)
                if (t0Amt !== null && t1Amt !== null) {
                  return <>
                    <span>{fmtToken(t0Amt, listing.pair.token0)}</span>
                    <span>{fmtToken(t1Amt, listing.pair.token1)}</span>
                  </>
                }
                return <>
                  <span>{fmtUSD(listing.initialLiquidityUSD / 2)} {listing.pair.token0}</span>
                  <span>{fmtUSD(listing.initialLiquidityUSD / 2)} {listing.pair.token1}</span>
                </>
              })()}
            </dd>
          </div>
          {/* Trader market — derived figure that only exists at leverage > 1.
              Vocabulary matches the List NFT modal (ProPreview): Pool size × Leverage.
              Hidden for Conservative listings (would equal Pool size, redundant)
              and in Lite view (kept clean per call 2026-05-14).
              IMPORTANT: compute as initialLiquidity × leverage directly, NOT from
              listing.totalCapacityUSD — mocks have inconsistent semantics for that
              field across listings (some apply leverage, some don't), which made
              Trader market render identical to Pool size in many cases. */}
          {isPro && isAdvanced && (() => {
            const traderMarketUSD = listing.initialLiquidityUSD * listing.providerLeverage
            return (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500">Trader market</dt>
                {/* Formula «= $X × N×» removed per Eugene 2026-05-15 — token-pair
                    sub-line is the «what the market actually is» figure. Formula
                    lives in the card-level tooltip. */}
                <dd className="font-semibold text-gray-900 num">{fmtUSD(traderMarketUSD)}</dd>
                <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5 flex flex-col items-start">
                  {(() => {
                    const { t0Amt, t1Amt } = splitToTokens(traderMarketUSD, listing)
                    if (t0Amt !== null && t1Amt !== null) {
                      return <>
                        <span>{fmtToken(t0Amt, listing.pair.token0)}</span>
                        <span>{fmtToken(t1Amt, listing.pair.token1)}</span>
                      </>
                    }
                    return <>
                      <span>{fmtUSD(traderMarketUSD / 2)} {listing.pair.token0}</span>
                      <span>{fmtUSD(traderMarketUSD / 2)} {listing.pair.token1}</span>
                    </>
                  })()}
                </dd>
              </div>
            )
          })()}
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Range</dt>
            <dd className="font-medium text-gray-900 num">{fmtRange(listing.rangeLow, listing.rangeHigh)}</dd>
            <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5">{listing.pair.token0}/{listing.pair.token1}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Uniswap APY</dt>
            <dd className="font-semibold text-gray-900 num">{fmtPct(listing.uniswapApyBps)}</dd>
            <dd className="text-[11px] text-gray-500 leading-tight mt-0.5">30d</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Protocol · fee tier</dt>
            <dd className="font-medium text-gray-900">Uniswap v3 <span className="num">· {fmtFeeTier(listing.feeTierBps)}</span></dd>
            {/* NFT #X removed per Eugene 2026-05-15 — already shown in the page header
                (breadcrumb area). Was duplicated here. */}
          </div>
        </dl>
      </div>

      {/* Fees panel — positive perspective (user feedback 2026-05-15):
          Uniswap → Premium → Total → Accrued/Claimable breakdown → IL. */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold inline-flex items-center gap-1">
            Fees · earnings
            <HelpPopover label="Fees · earnings" width="w-80" size="lg">
              <p className="font-semibold mb-1">Что заработала позиция</p>
              <p className="mb-1.5">Две статьи дохода LP — Uniswap fees от underlying pool + Premium APY от sLiq trader auction. Каждая в USD и в разбивке по паре активов.</p>
              <p className="mb-1"><strong>Total fees</strong> — суммарно с момента листинга (Uniswap baseline + Premium APY).</p>
              <p><strong>Already claimed / Claimable now</strong> — сколько уже зачислено в кошелёк vs сколько можно забрать в одной транзакции.</p>
            </HelpPopover>
          </h2>
          {/* Header KPI: Total fees (gross) + pair breakdown + Claimable now.
              Per Eugene 2026-05-15 — Net PnL (IL-adjusted) header dropped in
              favour of positive-framing total + immediate-action claimable.
              v2 (2026-05-15): single canonical pair breakdown lives here
              (was duplicated under each FeeRow). */}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Total fees</div>
            <div
              className="num font-bold text-xl leading-tight"
              style={{ color: 'var(--color-status-success)' }}
            >
              +{fmtUSD(totalFees)}
            </div>
            {(() => {
              const { t0Amt, t1Amt } = splitToTokens(totalFees, listing)
              if (t0Amt === null || t1Amt === null) return null
              return (
                <div className="text-[10px] text-gray-500 num leading-tight mt-0.5">
                  {fmtToken(t0Amt, listing.pair.token0)} · {fmtToken(t1Amt, listing.pair.token1)}
                </div>
              )
            })()}
            {/* Claimable now lifted back into the KPI per Eugene 2026-05-15
                («Claimable now подними под total fee»). Body-row duplicate
                removed below to avoid showing the same number twice. */}
            {claimableNow > 0.01 && (
              <div className="text-[11px] num mt-1">
                <span className="text-gray-500">Claimable now </span>
                <span className="font-semibold" style={{ color: 'var(--color-role-lp)' }}>+{fmtUSD(claimableNow)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <FeeRow label="Uniswap fees" usd={uniswapFeesTotal} listing={listing} />
          <FeeRow label="Premium APY" usd={premiumFeesTotal} listing={listing} />
          {/* Total-fees row dropped per Eugene 2026-05-15 — Total fees already
              live as the top-right KPI of this card. Claimable now lifted into
              the KPI as well (sub-line under Total). Only «Already claimed»
              stays as a body row, and only when it carries a non-zero number. */}
          {accruedClaimed > 0.01 && (
            <div className="border-t border-gray-200 mt-2 pt-2 text-[12px]">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-500">Already claimed <span className="text-gray-400">(in wallet)</span></span>
                <span className="num text-gray-700">{fmtUSD(accruedClaimed)}</span>
              </div>
            </div>
          )}
        </div>
        {/* Vs HODL — Pro UI mode only (Eugene 2026-05-15 v3: gate is on
            isPro, the UI-mode toggle, NOT on isAdvanced/leverage. Earlier
            commit conflated them — on Conservative listings the block
            disappeared even in Pro UI. Correct semantics: Lite = simple
            view (hide noise), Pro = full info (show Vs HODL regardless of
            whether the listing itself has leverage). */}
        {isPro && (
          <div className="mt-3 border-t border-gray-200 pt-3 space-y-1.5">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-gray-600 inline-flex items-center gap-1">
                Impermanent Loss <span className="text-gray-400">vs HODL</span>
                <HelpPopover label="Impermanent Loss vs HODL" width="w-72">
                  <p>Difference between the current value of the LP position and the value you'd have if you simply held the original token amounts (no LP, no fees). Always ≤ 0 by construction — that's why it's not coloured red.</p>
                </HelpPopover>
              </span>
              <span className="num text-gray-800">{ilProxy >= 0 ? '' : '−'}{fmtUSD(Math.abs(ilProxy))}</span>
            </div>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-gray-600 inline-flex items-center gap-1">
                PnL <span className="text-gray-400">vs HODL</span>
                <HelpPopover label="PnL vs HODL" width="w-72">
                  <p>Total fees earned (Uniswap + Premium) minus Impermanent Loss. <strong>Positive</strong> = the listing is earning more than HODL would have. <strong>Negative</strong> = HODL would have beaten this listing so far.</p>
                </HelpPopover>
              </span>
              <span
                className="num font-semibold"
                style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
              </span>
            </div>
          </div>
        )}
        {/* Suggestions block — all-English copy (was mixed RU/EN per UX audit). */}
        {netPnL < 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
            <div className="text-xs font-semibold text-amber-900 mb-1">💡 Suggestions</div>
            <ul className="text-[11px] text-amber-900 space-y-1 leading-snug list-disc list-outside ml-4">
              {hitRate < 50 && (
                <li><strong>Range hit-rate {hitRate}% low</strong> — NFT is often out-of-range. Withdraw + re-list on Uniswap with a wider range.</li>
              )}
              {hitRate >= 50 && hitRate < 70 && (
                <li>Range hit-rate {hitRate}% — OK, but a wider range would stabilise fees.</li>
              )}
              {Math.abs(ilProxy) > totalFees && (
                <li><strong>IL exceeds earnings</strong> — price moved against your range. If you expect mean-reversion, hold; otherwise close via Request withdrawal.</li>
              )}
              {!isAdvanced && (
                <li>Consider Pro mode — Premium APY on the amplified pool yields more carry. But the NFT becomes collateral.</li>
              )}
              {activeLessees.length === 0 && (
                <li>No lessees — the listing isn't attractive at the current Min APY. Lower it.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Position analytics (Range hit-rate + Avg leased) moved to right aside
          under ProMetrics per Eugene 2026-05-15. Lives in OwnerPositionAnalytics
          component now, rendered next to ProMetrics for visual grouping. */}

      {/* Listing transactions moved to page-level footer below the 2-col grid
          (Eugene 2026-05-15) — see comment in outer ListingDetail. */}

      {/* Manage listing · Pro panel moved up next to Listing summary (Eugene 2026-05-15) —
          user switches to Pro specifically to tune leverage / min APY, panel needs to be
          visible without scrolling. See paired layout inside the Listing Summary IIFE above.

          Active lessees block was already removed (call 2026-05-14): «lessees» as a term
          wasn't used — Liquidity Used / Leased % already conveys "how much rented". */}

      {/* === Modals === */}

      {/* Update Leverage — topSlot has the actual slider/ticks so user can SET
          newLeverage / newMode; the before/after comparison reflects what they picked. */}
      <HighStakesConfirmModal
        open={leverageOpen}
        compact
        title="Update Provider Leverage"
        subtitle={
          newMode === 'advanced' && listing.providerMode !== 'advanced'
            ? 'Switching to Advanced. NFT becomes collateral — listing-level liquidation possible at vol-event.'
            : newLeverage > listing.providerLeverage
            ? 'Higher leverage → tighter liquidation distance. Reference Fees pool amplified.'
            : newLeverage < listing.providerLeverage
            ? 'Lower leverage → safer, but Reference Fees pool shrinks.'
            : 'Adjust leverage below, then confirm.'
        }
        topSlot={(() => {
          const liqDistancePct = newLeverage > 1 ? (2 / newLeverage) * 100 : null
          const newTraderMarketUSD = listing.initialLiquidityUSD * newLeverage
          return (
            <div className="space-y-3">
              {/* Pool size + Trader market preview — mirrors the ListNFTModal Pro
                  pre-listing card (Eugene 2026-05-15: «как на окне листинга в про
                  режиме»). Pool size is fixed (= initial NFT liquidity); Trader
                  market scales with the leverage slider below, so LP sees the
                  exact carry surface the change will create. */}
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Pool size</div>
                  <div className="num font-semibold text-gray-900 mt-0.5">{fmtUSD(listing.initialLiquidityUSD)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Trader market</div>
                  <div className="num font-semibold text-gray-900 mt-0.5">
                    {newMode === 'advanced' ? fmtUSD(newTraderMarketUSD) : <span className="text-gray-400">—</span>}
                  </div>
                </div>
              </div>

              {/* Mode toggle — always visible (Eugene 2026-05-15: «Mode может
                  меняться»). LP can downgrade Advanced→Safe or upgrade Safe→Advanced
                  without leaving the modal. Tapping ticks/slider also auto-flips
                  this in sync. */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">Mode:</span>
                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setNewMode('conservative'); setNewLeverage(1) }}
                    className={'px-3 py-1 transition ' + (newMode === 'conservative' ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50')}
                  >Safe · 1×</button>
                  <button
                    type="button"
                    onClick={() => { setNewMode('advanced'); if (newLeverage === 1) setNewLeverage(2) }}
                    className={'px-3 py-1 transition ' + (newMode === 'advanced' ? 'bg-white text-[var(--color-status-danger)] border-l-2 border-[var(--color-status-danger)] font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50')}
                  >At-risk · N×</button>
                </div>
              </div>

              {/* Leverage slider + numeric input — fine-tune via input (Viktor: «slider
                  min step=1 на 1–100 слишком груб, дай fine-tune через number input»).
                  ± buttons left/right (Eugene 2026-05-15: matches Min APY modal pattern).
                  Disabled in Safe mode. */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">Provider Leverage</label>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const v = Math.max(1, newLeverage - 1)
                        setNewLeverage(v)
                        if (v === 1) setNewMode('conservative')
                      }}
                      disabled={newMode === 'conservative'}
                      className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Decrease leverage"
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={newLeverage}
                      onChange={e => {
                        const v = Math.max(1, Math.min(100, Number(e.target.value) || 1))
                        setNewLeverage(v)
                        if (v > 1) setNewMode('advanced')
                        else setNewMode('conservative')
                      }}
                      disabled={newMode === 'conservative'}
                      className="w-14 text-sm font-semibold num text-gray-900 text-right border border-gray-200 rounded px-1.5 py-1 focus:border-[var(--color-role-lp)] focus:outline-none disabled:opacity-50"
                    />
                    <span className="text-sm font-semibold num text-gray-900">×</span>
                    <button
                      type="button"
                      onClick={() => {
                        // + always enabled — bumps 1×→2× (and auto-switches to advanced),
                        // otherwise just increments by 1 within [1, 100].
                        const v = Math.min(100, Math.max(2, newLeverage + 1))
                        setNewLeverage(v)
                        setNewMode('advanced')
                      }}
                      disabled={newLeverage >= 100}
                      className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase leverage"
                    >+</button>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={newLeverage}
                  onChange={e => setNewLeverage(Number(e.target.value))}
                  disabled={newMode === 'conservative'}
                  className="w-full accent-[var(--color-role-lp)] disabled:opacity-50"
                />
                <div className="grid grid-cols-5 gap-0.5 mt-1.5">
                  {[1, 25, 50, 75, 100].map(tick => (
                    <button
                      key={tick}
                      type="button"
                      onClick={() => { setNewLeverage(tick); if (tick > 1) setNewMode('advanced'); else setNewMode('conservative') }}
                      className={
                        'text-[10px] num py-0.5 rounded transition ' +
                        (newLeverage === tick
                          ? 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] font-semibold'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
                      }
                    >
                      {tick}×
                    </button>
                  ))}
                </div>
                {newLeverage > 1 && liqDistancePct !== null && (
                  <div className={
                    'mt-2 text-[11px] rounded px-3 py-2 flex items-start gap-2 ' +
                    (newLeverage > 25
                      ? 'text-[var(--color-status-danger)] bg-red-50 border border-[var(--color-status-danger)]/40'
                      : 'text-amber-700 bg-amber-50 border border-amber-200')
                  }>
                    <span>⚠️</span>
                    <div>
                      <strong>Liquidation risk applies.</strong> At {newLeverage}× listing-level liquidation
                      triggers when the pool moves ~<span className="num">{liqDistancePct.toFixed(1)}%</span> against your range.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
        currentState={(() => {
          const currentHF = listing.healthFactorPct
          const rows: import('@/components/HighStakesConfirmModal').KeyValue[] = [
            { label: 'Mode', value: listing.providerMode === 'advanced' ? `at-risk · ${listing.providerLeverage}×` : 'safe · 1×' },
            { label: 'NFT at risk', value: isAdvanced ? 'Yes' : 'No' },
          ]
          // HF row only when current position has it (Pro+leverage>1)
          if (isAdvanced && currentHF !== undefined) {
            rows.push({ label: 'Health Factor', value: `${currentHF}%` })
          }
          return rows
        })()}
        newState={(() => {
          // HF scales roughly inversely with leverage. Rough est: HF_new ≈ HF_current × (current_lev / new_lev).
          // For Conservative→Advanced switch (no current HF), start from neutral 80% baseline.
          const currentHF = listing.healthFactorPct ?? (isAdvanced ? 50 : 80)
          const currentLev = Math.max(1, listing.providerLeverage)
          const estHF = newMode === 'advanced'
            ? Math.max(0, Math.round(currentHF * (currentLev / Math.max(1, newLeverage))))
            : null // Switching to Safe = no HF concept
          const hfDelta = estHF !== null && listing.healthFactorPct !== undefined
            ? estHF - listing.healthFactorPct
            : null
          const rows: import('@/components/HighStakesConfirmModal').KeyValueWithDelta[] = [
            { label: 'Mode', value: newMode === 'advanced' ? `at-risk · ${newLeverage}×` : 'safe · 1×', deltaTone: newLeverage > listing.providerLeverage ? 'negative' : 'positive' },
            { label: 'NFT at risk', value: newMode === 'advanced' ? 'Yes' : 'No', deltaTone: newMode === 'advanced' && !isAdvanced ? 'negative' : 'neutral' },
          ]
          // Live HF preview — critical for Pro decision (UX audit P1, Eugene 2026-05-15).
          if (newMode === 'advanced') {
            const deltaStr = hfDelta !== null
              ? ` (${hfDelta >= 0 ? '+' : '−'}${Math.abs(hfDelta)}pp)`
              : ''
            rows.push({
              label: 'Health Factor (est.)',
              value: `${estHF}%${deltaStr}`,
              deltaTone: hfDelta !== null
                ? (hfDelta < -10 ? 'negative' : hfDelta > 0 ? 'positive' : 'neutral')
                : 'neutral',
            })
          }
          return rows
        })()}
        risks={[
          newLeverage > listing.providerLeverage ? 'Higher leverage tightens distance to listing-level liquidation' : 'Lower leverage safer but reduces Reference Fees',
          'Existing lessees keep their original leverage (per excerpt 1 §3 — open positions don\'t re-quote)',
          newMode === 'advanced' && !isAdvanced ? 'NFT becomes collateral — possible loss at vol-event' : 'NFT stays under your control',
        ]}
        irreversibilityNote="Going up takes 1 block to activate (manipulation guard). Going down — immediate next-block."
        confirmType={newLeverage > 25 ? 'type-to-confirm' : 'checkbox'}
        typeWord={`${newLeverage}X`}
        confirmButtonLabel="Confirm leverage"
        onConfirm={() => setLeverageOpen(false)}
        onCancel={() => setLeverageOpen(false)}
      />

      {/* Update Min APY — topSlot lets user actually set the new value via
          +/- buttons, number input, and preset chips (same pattern as ListNFTModal Pro). */}
      <HighStakesConfirmModal
        open={updateApyOpen}
        compact
        title="Update Min Premium APY"
        subtitle={newMinApyPct < 0
          ? `⚠️ Negative APY — you'll pay traders ${Math.abs(newMinApyPct)}% annualised. Use only if you know what you're doing.`
          : 'Changes the auction floor. Existing lessees keep their carry rate.'
        }
        topSlot={(
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">New Min Premium APY</label>
              <span className="text-[10px] text-gray-500">
                Current: {fmtPct(listing.minPremiumApyBps, { signed: true })}
              </span>
            </div>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setNewMinApyPct(v => Math.max(1, v - 1))}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                aria-label="Decrease by 1%"
              >−</button>
              <div className="relative flex-1">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={newMinApyPct}
                  onChange={e => setNewMinApyPct(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-lp)] focus:outline-none transition text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
              </div>
              <button
                type="button"
                onClick={() => setNewMinApyPct(v => v + 1)}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                aria-label="Increase by 1%"
              >+</button>
            </div>
            {/* Presets — 100% dropped per Eugene 2026-05-15 (unrealistic Min APY
                floor; if LP wants extreme rates they'll type the number). */}
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[10, 20, 30, 50].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewMinApyPct(p)}
                  className={
                    'px-2.5 py-2 text-[11px] font-medium rounded border transition ' +
                    (newMinApyPct === p
                      ? 'bg-[var(--color-role-lp-bg)] border-[var(--color-role-lp)] text-[var(--color-role-lp)]'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900')
                  }
                >{p}%</button>
              ))}
            </div>
          </div>
        )}
        currentState={[
          { label: 'Current Min APY', value: fmtPct(listing.minPremiumApyBps, { signed: true }) },
        ]}
        newState={[
          { label: 'New Min APY', value: `${newMinApyPct}%`, deltaTone: newMinApyPct < (listing.minPremiumApyBps / 100) ? 'negative' : 'positive' },
        ]}
        risks={[
          newMinApyPct > (listing.minPremiumApyBps / 100) ? 'Higher floor — могут быть меньше lessees' : 'Lower floor — больше lessees но per-lessee earnings снижаются',
          newMinApyPct < 0 ? `Subsidized — ты платишь ${Math.abs(newMinApyPct)}% годовых` : 'Existing lessees keep their original rate, не affected',
        ]}
        irreversibilityNote="Effective next-block Arbitrum."
        confirmType="checkbox"
        confirmButtonLabel="Confirm Min APY update"
        onConfirm={() => setUpdateApyOpen(false)}
        onCancel={() => setUpdateApyOpen(false)}
      />

      {/* Top up liquidity modal — designed 2026-05-15.
          Compact: existing lessees stay protected (we're only growing the
          pool), so no checkbox/risk-list. User enters USD amount → preview
          shows token split + Pool size before/after. */}
      <HighStakesConfirmModal
        open={topUpOpen}
        compact
        title="Top up liquidity"
        subtitle={`Add liquidity to NFT #${listing.tokenId}. Increases your Uniswap-fee share and the capacity traders can rent. Existing lessees keep their carry rate.`}
        topSlot={(() => {
          const newPoolSize = listing.initialLiquidityUSD + topUpAmountUSD
          const { t0Amt, t1Amt } = splitToTokens(topUpAmountUSD, listing)
          return (
            <div className="space-y-3">
              {/* Pool size before/after — what the deposit looks like */}
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Pool size now</div>
                  <div className="num font-semibold text-gray-900 mt-0.5">{fmtUSD(listing.initialLiquidityUSD)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">After top up</div>
                  <div className="num font-semibold mt-0.5" style={{ color: 'var(--color-role-lp)' }}>{fmtUSD(newPoolSize)}</div>
                </div>
              </div>

              {/* Amount input with ± controls + presets */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">Amount to add</label>
                  <span className="text-[10px] text-gray-500">USD value · auto-split at pool ratio</span>
                </div>
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setTopUpAmountUSD(v => Math.max(100, v - 1000))}
                    className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                    aria-label="Decrease by $1k"
                  >−</button>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      min={100}
                      step={500}
                      value={topUpAmountUSD}
                      onChange={e => setTopUpAmountUSD(Math.max(100, Number(e.target.value) || 100))}
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-lp)] focus:outline-none transition text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopUpAmountUSD(v => v + 1000)}
                    className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                    aria-label="Increase by $1k"
                  >+</button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[1000, 5000, 10000, 25000].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTopUpAmountUSD(p)}
                      className={
                        'px-2 py-1.5 text-[11px] font-medium rounded border transition num ' +
                        (topUpAmountUSD === p
                          ? 'bg-[var(--color-role-lp-bg)] border-[var(--color-role-lp)] text-[var(--color-role-lp)]'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900')
                      }
                    >+{fmtUSD(p)}</button>
                  ))}
                </div>
              </div>

              {/* Token split preview */}
              {t0Amt !== null && t1Amt !== null && (
                <div className="rounded-md border border-gray-200 px-3 py-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">You'll deposit</div>
                  <div className="num font-medium text-gray-900 flex items-baseline justify-between">
                    <span>{fmtToken(t0Amt, listing.pair.token0)}</span>
                    <span className="text-gray-400">+</span>
                    <span>{fmtToken(t1Amt, listing.pair.token1)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
        currentState={[]}
        newState={[]}
        risks={[]}
        irreversibilityNote=""
        confirmType="checkbox"
        confirmButtonLabel="Confirm top up"
        onConfirm={() => setTopUpOpen(false)}
        onCancel={() => setTopUpOpen(false)}
      />

      {/* Remove liquidity modal — designed 2026-05-15.
          Compact: removal is bounded by available (unleased) capacity, so it
          can never break existing positions — no nuclear-action scaffolding.
          For full exit the LP uses Request withdrawal from the header menu. */}
      {(() => {
        const totalCap = listing.totalCapacityUSD
        const leasedUSD = totalCap - listing.availableCapacityUSD
        const maxRemovablePct = totalCap > 0 ? Math.floor((listing.availableCapacityUSD / totalCap) * 100) : 0
        // Clamp the slider so user can't try to remove leased portion
        const effectivePct = Math.min(removeLiqPct, maxRemovablePct)
        const removeUSDOfNFT = listing.initialLiquidityUSD * (effectivePct / 100)
        const newPoolSize = listing.initialLiquidityUSD - removeUSDOfNFT
        const { t0Amt: t0Remove, t1Amt: t1Remove } = splitToTokens(removeUSDOfNFT, listing)
        return (
          <HighStakesConfirmModal
            open={removeLiqOpen}
            compact
            title="Remove liquidity"
            subtitle={`Pull part of NFT #${listing.tokenId}. Only the unleased portion can be removed — existing lessees stay protected. For a full exit use Request withdrawal from the menu.`}
            topSlot={(
              <div className="space-y-3">
                {/* Pool size before/after */}
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Pool size now</div>
                    <div className="num font-semibold text-gray-900 mt-0.5">{fmtUSD(listing.initialLiquidityUSD)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">After remove</div>
                    <div className="num font-semibold mt-0.5" style={{ color: 'var(--color-status-warning)' }}>{fmtUSD(newPoolSize)}</div>
                  </div>
                </div>

                {/* Removable cap notice */}
                <div className="text-[11px] text-gray-600 leading-snug rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="font-medium">Removable now: </span>
                  <span className="num font-semibold text-gray-900">{maxRemovablePct}%</span>
                  <span className="text-gray-500"> · leased {fmtUSD(leasedUSD)} locked until lessees close</span>
                </div>

                {/* % slider + presets */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">Remove</label>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRemoveLiqPct(v => Math.max(1, v - 5))}
                        className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                        aria-label="Decrease by 5%"
                      >−</button>
                      <input
                        type="number"
                        min={1}
                        max={maxRemovablePct}
                        step={1}
                        value={effectivePct}
                        onChange={e => setRemoveLiqPct(Math.max(1, Math.min(maxRemovablePct, Number(e.target.value) || 1)))}
                        className="w-14 text-sm font-semibold num text-gray-900 text-right border border-gray-200 rounded px-1.5 py-1 focus:border-[var(--color-role-lp)] focus:outline-none"
                      />
                      <span className="text-sm font-semibold num text-gray-900">%</span>
                      <button
                        type="button"
                        onClick={() => setRemoveLiqPct(v => Math.min(maxRemovablePct, v + 5))}
                        className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                        aria-label="Increase by 5%"
                      >+</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, maxRemovablePct)}
                    step={1}
                    value={effectivePct}
                    onChange={e => setRemoveLiqPct(Number(e.target.value))}
                    className="w-full accent-[var(--color-role-lp)]"
                  />
                  <div className="grid grid-cols-4 gap-0.5 mt-1.5">
                    {[25, 50, 75, 100].map(tick => {
                      const clamped = Math.min(tick, maxRemovablePct)
                      const disabled = clamped < tick && tick !== 100
                      return (
                        <button
                          key={tick}
                          type="button"
                          disabled={disabled}
                          onClick={() => setRemoveLiqPct(tick === 100 ? maxRemovablePct : tick)}
                          className={
                            'text-[10px] num py-1 rounded transition ' +
                            (effectivePct === (tick === 100 ? maxRemovablePct : tick)
                              ? 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] font-semibold'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed')
                          }
                        >
                          {tick === 100 ? 'Max' : `${tick}%`}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Token receive preview */}
                {t0Remove !== null && t1Remove !== null && (
                  <div className="rounded-md border border-gray-200 px-3 py-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">You'll receive</div>
                    <div className="num font-medium text-gray-900 flex items-baseline justify-between">
                      <span>{fmtToken(t0Remove, listing.pair.token0)}</span>
                      <span className="text-gray-400">+</span>
                      <span>{fmtToken(t1Remove, listing.pair.token1)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            currentState={[]}
            newState={[]}
            risks={[]}
            irreversibilityNote=""
            confirmType="checkbox"
            confirmButtonLabel="Confirm remove"
            onConfirm={() => setRemoveLiqOpen(false)}
            onCancel={() => setRemoveLiqOpen(false)}
          />
        )
      })()}

      {/* Withdrawal modal */}
      <HighStakesConfirmModal
        open={withdrawOpen}
        title="Запрос вывода NFT — подтверди"
        subtitle={`Принудительно закрывает всех текущих арендаторов. Тот же NFT (#${listing.tokenId}) возвращается в кошелёк через 2-block keeper settlement — но с текущим P&L (если margin съел часть, NFT придёт с уменьшенной стоимостью).`}
        currentState={[
          { label: 'Active арендаторы', value: String(activeLessees.length) },
          { label: 'Pool size (now)', value: fmtUSD(listing.initialLiquidityUSD) },
          { label: 'Net PnL · IL-adjusted', value: `${netPnL >= 0 ? '+' : '−'}${fmtUSD(Math.abs(netPnL))}` },
          { label: 'NFT in protocol', value: `#${listing.tokenId}` },
        ]}
        newState={[
          { label: 'Listing status', value: 'withdrawing · LP exit', deltaTone: 'neutral' },
          { label: 'NFT после settlement', value: `#${listing.tokenId} обратно (тот же ID)`, deltaTone: 'neutral' },
          {
            label: 'Estimated NFT value',
            value: fmtUSD(Math.max(0, listing.initialLiquidityUSD + netPnL)),
            deltaTone: netPnL < 0 ? 'negative' : 'positive',
          },
          { label: 'Claimable now (auto-paid)', value: fmtUSD(claimableNow), deltaTone: 'positive' },
        ]}
        risks={[
          'NFT возвращается с текущим P&L — если margin съел часть позиции, ты получаешь NFT с reduced value (proof-of-deposit ID тот же)',
          'Pending Premium + Uniswap fees списываются from each lessee reserve и идут тебе при settlement',
          'Withdrawal нельзя отменить после submit — relisting требует свежий deposit',
        ]}
        irreversibilityNote="Re-listing требует свежего deposit (новый NFT import flow)."
        confirmType="type-to-confirm"
        typeWord="WITHDRAW"
        confirmButtonLabel="Подтвердить вывод"
        onConfirm={() => {
          setWithdrawOpen(false)
          setWithdrawing(true)
        }}
        onCancel={() => setWithdrawOpen(false)}
      />
    </div>
  )
}

// OwnerPositionAnalytics — LP performance retrospective. Two bars stacked.
// Lives in the right aside under ProMetrics (owner pro view only). The visual
// pairing reads as «market context → my listing's performance under it».
function OwnerPositionAnalytics({ listing }: { listing: import('@/lib/types').Listing }) {
  const hitRate = listing.rangeHitRatePct ?? 0
  const avgLeased = listing.avgLeasedPct30d ?? 0

  return (
    <>
      {/* Range hit-rate */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1">
            Range hit-rate · 30d
            <HelpPopover label="Range hit-rate" width="w-64">
              <p>% времени, когда цена была внутри твоего Uniswap range. Низкий hit-rate = NFT часто out-of-range, Uniswap fees не идут. Сигнал расширить range или перелистить.</p>
            </HelpPopover>
          </h3>
          <span
            className="num font-bold text-base"
            style={{ color: hitRate > 70 ? 'var(--color-status-success)' : hitRate > 40 ? 'var(--color-status-warning)' : 'var(--color-status-danger)' }}
          >
            {hitRate}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${hitRate}%`,
              background: hitRate > 70 ? 'var(--color-status-success)' : hitRate > 40 ? 'var(--color-status-warning)' : 'var(--color-status-danger)',
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-2 leading-snug">
          {hitRate > 70 ? 'Хорошо — Uniswap fees регулярно начисляются.'
           : hitRate > 40 ? 'Средне — рассмотри расширение range.'
           : 'Низко — NFT часто out-of-range. Withdraw + re-list с новым range.'}
        </p>
      </div>

      {/* Avg leased — utilization */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1">
            Avg leased · 30d
            <HelpPopover label="Avg leased · 30d" width="w-72">
              <p className="font-semibold mb-1">Средняя загруженность за 30 дней</p>
              <p className="mb-1.5">Какая доля пула в среднем была арендована трейдерами за период. Это сигнал спроса: высокая utilization → можно поднять min Premium APY; низкая → надо снизить чтобы привлечь.</p>
              <p className="text-[11px] text-gray-500">Сейчас в таблице ты видишь snapshot (текущий leased %). Здесь — time-weighted среднее.</p>
            </HelpPopover>
          </h3>
          <span
            className="num font-bold text-base"
            style={{ color: avgLeased > 70 ? 'var(--color-status-success)' : avgLeased > 30 ? 'var(--color-status-warning)' : 'var(--color-status-danger)' }}
          >
            {avgLeased}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${avgLeased}%`,
              background: avgLeased > 70 ? 'var(--color-status-success)' : avgLeased > 30 ? 'var(--color-role-lp)' : 'var(--color-status-danger)',
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-2 leading-snug">
          {avgLeased > 70 ? 'Высокий спрос — можно поднять min Premium APY.'
           : avgLeased > 30 ? 'Умеренный — позиция в work, можно тюнить min APY.'
           : 'Низкий — спрос слабый. Снизь min Premium APY чтобы привлечь арендаторов.'}
        </p>
      </div>
    </>
  )
}

// ListingTransactions — per-listing log of closed trader positions.
// Mirrors the global «Market transactions» (ClosedPositionsList) vocabulary —
// same data type, scoped to this listing. LP-perspective columns vs the
// global feed: drop Pair (single listing), drop Entry→Exit / % move / trader
// Net PnL (trader-side numbers irrelevant to LP); keep Trader / Position size /
// APY paid / Lifetime / Earned-for-LP / Outcome / Closed.
// Default shows 7 most recent + «View all» expand. Empty state when zero closes.
// Sort keys for Listing transactions table — sortable headers (Viktor P3.30).
type TxSortKey = 'closedAt' | 'notional' | 'apy' | 'held' | 'earned'
type TxSortDir = 'asc' | 'desc'

function SortTh({ children, align, active, dir, onClick, className = '' }: {
  children: React.ReactNode
  align: 'left' | 'right'
  active: boolean
  dir: TxSortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th className={`text-${align} font-medium px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={
          'inline-flex items-center gap-1 transition hover:text-gray-900 ' +
          (active ? 'text-gray-900 font-semibold' : 'text-gray-500')
        }
      >
        {children}
        <span aria-hidden="true" className="text-[8px]">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

function ListingTransactions({ listing }: { listing: import('@/lib/types').Listing }) {
  const [expanded, setExpanded] = useState(false)
  const [sortKey, setSortKey] = useState<TxSortKey>('closedAt')
  const [sortDir, setSortDir] = useState<TxSortDir>('desc')

  const rows = useMemo(() => closedPositions.filter(c => c.listingId === listing.id), [listing.id])
  const transactions = useMemo(() => {
    const out = [...rows]
    out.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'closedAt': return (a.closedAt - b.closedAt) * mul
        case 'notional': return (a.notionalUSD - b.notionalUSD) * mul
        case 'apy':      return (a.apyBps - b.apyBps) * mul
        case 'held':     return (a.durationHours - b.durationHours) * mul
        case 'earned':   return ((a.referencePaidUSD + a.premiumPaidUSD) - (b.referencePaidUSD + b.premiumPaidUSD)) * mul
      }
    })
    return out
  }, [rows, sortKey, sortDir])

  // Median APY paid across settled positions (Viktor P3.30) — useful bench against current floor.
  const medianApyBps = useMemo(() => {
    if (!rows.length) return null
    const sorted = [...rows].map(r => r.apyBps).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
  }, [rows])

  const visible = expanded ? transactions : transactions.slice(0, 7)
  const hasMore = transactions.length > 7

  function toggleSort(key: TxSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function exportCsv() {
    const header = ['Trader', 'Position size USD', 'APY bps', 'Lifetime hours', 'Earned USD (Reference + Premium)', 'Outcome', 'Closed at ISO']
    const csvRows = transactions.map(r => [
      r.trader,
      r.notionalUSD.toFixed(2),
      r.apyBps,
      r.durationHours.toFixed(2),
      (r.referencePaidUSD + r.premiumPaidUSD).toFixed(2),
      r.liquidated ? 'liquidated' : r.paidInFull ? 'paid_in_full' : `partial -${(r.unpaidUSD ?? 0).toFixed(2)}`,
      new Date(r.closedAt).toISOString(),
    ])
    const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sLiq-listing-${listing.id}-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-base font-semibold inline-flex items-center gap-1">
          Listing transactions
          <HelpPopover label="Listing transactions" width="w-80">
            <p className="font-semibold mb-1">Settled positions on this listing</p>
            <p className="mb-1.5">Each row = a trader position that opened against this listing and has now closed (paid in full, partial settlement, or liquidated). Same data as the global Market transactions feed, filtered to this listing.</p>
            <p className="text-[11px] text-gray-500"><strong>Earned</strong> = Reference + Premium paid by that trader (your take from this position). <strong>Outcome</strong> = how settlement resolved.</p>
          </HelpPopover>
        </h2>
        <div className="inline-flex items-center gap-3 text-[11px] text-gray-500 num">
          {medianApyBps !== null && (
            <span>median APY <span className="font-medium text-gray-700">{fmtPct(medianApyBps)}</span></span>
          )}
          <span>{transactions.length} {transactions.length === 1 ? 'closed position' : 'closed positions'}</span>
          {transactions.length > 0 && (
            <button type="button" onClick={exportCsv} className="text-[var(--color-role-lp)] hover:underline">
              Export CSV ↓
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-600">No transactions yet.</p>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            History appears here once traders open and close positions against this listing.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Trader</th>
                  <SortTh align="right" active={sortKey === 'notional'} dir={sortDir} onClick={() => toggleSort('notional')}>Position size</SortTh>
                  <SortTh align="right" active={sortKey === 'apy'} dir={sortDir} onClick={() => toggleSort('apy')}>APY paid</SortTh>
                  <SortTh align="right" className="hidden lg:table-cell" active={sortKey === 'held'} dir={sortDir} onClick={() => toggleSort('held')}>Lifetime</SortTh>
                  <SortTh align="right" active={sortKey === 'earned'} dir={sortDir} onClick={() => toggleSort('earned')}>Earned</SortTh>
                  <th className="text-left font-medium px-3 py-2">Outcome</th>
                  <SortTh align="right" className="hidden lg:table-cell" active={sortKey === 'closedAt'} dir={sortDir} onClick={() => toggleSort('closedAt')}>Closed</SortTh>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const earned = r.referencePaidUSD + r.premiumPaidUSD
                  // Outcome chip — emoji «💥» replaced with red ● dot for liquidated
                  // (UX audit P2.21: emoji renders poorly on Windows Chrome).
                  const outcome = r.liquidated
                    ? { label: 'liquidated', dot: true, cls: 'bg-red-50 text-[var(--color-status-danger)] border-[var(--color-status-danger)]/40' }
                    : r.paidInFull
                    ? { label: 'paid in full', dot: false, cls: 'bg-gray-50 text-gray-700 border-gray-200' }
                    : { label: `partial · −${fmtUSD(r.unpaidUSD ?? 0)}`, dot: false, cls: 'bg-amber-50 text-amber-900 border-amber-300' }
                  return (
                    <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition">
                      <td className="px-3 py-2 num text-[12px] text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          {shortAddr(r.trader)}
                          <CopyAddress address={r.trader} />
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right num">{fmtUSD(r.notionalUSD)}</td>
                      <td className="px-3 py-2 text-right num">{fmtPct(r.apyBps, { signed: r.apyBps < 0 })}</td>
                      <td className="px-3 py-2 text-right num text-gray-600 hidden lg:table-cell">{fmtHeld(r.durationHours)}</td>
                      <td className="px-3 py-2 text-right num font-medium" style={{ color: earned > 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
                        {earned >= 0 ? '+' : '−'}{fmtUSD(Math.abs(earned))}
                      </td>
                      <td className="px-3 py-2">
                        <span className={'whitespace-nowrap rounded-full font-medium text-[10px] px-2 py-0.5 border inline-flex items-center gap-1 ' + outcome.cls}>
                          {outcome.dot && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-danger)]" />}
                          {outcome.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] text-gray-500 num hidden lg:table-cell">{fmtTimeAgo(r.closedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile — card per rental */}
          <div className="md:hidden space-y-2">
            {visible.map(r => {
              const earned = r.referencePaidUSD + r.premiumPaidUSD
              const outcome = r.liquidated
                ? { label: '💥 liquidated', cls: 'bg-red-50 text-[var(--color-status-danger)] border-[var(--color-status-danger)]/40' }
                : r.paidInFull
                ? { label: 'paid in full', cls: 'bg-gray-50 text-gray-700 border-gray-200' }
                : { label: `partial · −${fmtUSD(r.unpaidUSD ?? 0)}`, cls: 'bg-amber-50 text-amber-900 border-amber-300' }
              return (
                <div key={r.id} className="rounded-md border border-gray-200 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="num text-[12px] text-gray-700 inline-flex items-center gap-1">
                      {shortAddr(r.trader)}
                      <CopyAddress address={r.trader} />
                    </span>
                    <span className={'whitespace-nowrap rounded-full font-medium text-[10px] px-2 py-0.5 border ' + outcome.cls}>{outcome.label}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] num">
                    <div><span className="text-gray-500">Position size </span><span>{fmtUSD(r.notionalUSD)}</span></div>
                    <div><span className="text-gray-500">APY </span><span>{fmtPct(r.apyBps, { signed: r.apyBps < 0 })}</span></div>
                    <div><span className="text-gray-500">Lifetime </span><span>{fmtHeld(r.durationHours)}</span></div>
                    <div>
                      <span className="text-gray-500">Earned </span>
                      <span className="font-medium" style={{ color: earned > 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
                        {earned >= 0 ? '+' : '−'}{fmtUSD(Math.abs(earned))}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500 num">closed {fmtTimeAgo(r.closedAt)}</div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="text-xs font-medium text-[var(--color-role-lp)] hover:underline"
              >
                {expanded ? `Show recent 7 ↑` : `View all (${transactions.length}) →`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function fmtHeld(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

// ManageMenu — owner-actions surface in the OwnerPanel header strip.
//   Lite mode  → no dropdown, single inline «Withdraw NFT» button (only one
//                action available, dropdown would be needless friction).
//   Pro mode   → dropdown with Update Leverage / Update Min APY / Withdraw.
// View-on-Uniswap link removed (Eugene 2026-05-15) — already in Position
// info card's «View on Uniswap →» header; duplicate.
// ManageMenu — single action surface on the listing detail header.
// All actions collapsed into this dropdown (Eugene 2026-05-15):
//   Lite mode → [Claim, Withdraw NFT]
//   Pro mode  → [Claim, Update Leverage, Update Min Premium APY, Withdraw NFT]
// Claim sits first; Withdraw sits last (destructive, divided). Manage button
// gains LP-color accent + claimable amount badge when there's something to claim
// — preserves primary-action visibility despite the action being in a dropdown.
//
// Positioning: pixel-clamp the dropdown panel to the viewport (mirror of the
// HelpPopover fix) — was clipping off-screen on mobile when Manage button sat
// near the right edge of a narrow viewport.
function ManageMenu({
  isPro,
  claimableNow,
  onClaim,
  onUpdateLeverage,
  onUpdateApy,
  onWithdraw,
}: {
  isPro: boolean
  claimableNow: number
  onClaim: () => void
  onUpdateLeverage: () => void
  onUpdateApy: () => void
  onWithdraw: () => void
}) {
  const [open, setOpen] = useState(false)
  const [offsetX, setOffsetX] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hasClaimable = claimableNow > 0.01

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Pixel-clamp panel to viewport so it never clips on narrow screens.
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) {
      setOffsetX(null)
      return
    }
    const triggerRect = ref.current.getBoundingClientRect()
    const panelWidth = panelRef.current.offsetWidth
    const viewportW = window.innerWidth
    const padding = 8
    // Prefer anchoring panel's right edge to the trigger's right edge (default),
    // but clamp so left edge stays ≥ padding.
    const idealLeft = triggerRect.right - panelWidth
    const clampedLeft = Math.max(padding, Math.min(idealLeft, viewportW - panelWidth - padding))
    setOffsetX(clampedLeft - triggerRect.left)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          'text-sm font-semibold px-3.5 py-1.5 rounded-md inline-flex items-center gap-1.5 transition ' +
          (hasClaimable
            ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90 border border-[var(--color-role-lp)]'
            : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-300')
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Manage
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          style={{
            left: offsetX !== null ? `${offsetX}px` : undefined,
            right: offsetX !== null ? 'auto' : 0,
            visibility: offsetX === null ? 'hidden' : 'visible',
          }}
          className="absolute top-full mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-30 py-1"
        >
          {/* Claim — first menu item. Disabled when nothing to claim, so the
              row stays visible (action discoverability) but inert. */}
          <button
            type="button"
            disabled={!hasClaimable}
            onClick={() => { setOpen(false); onClaim() }}
            className={
              'w-full text-left px-3 py-2 text-sm transition ' +
              (hasClaimable
                ? 'hover:bg-[var(--color-role-lp-bg)]'
                : 'cursor-not-allowed opacity-50')
            }
            role="menuitem"
          >
            <div className="font-medium inline-flex items-center gap-2" style={{ color: hasClaimable ? 'var(--color-role-lp)' : '#9ca3af' }}>
              Claim {hasClaimable ? <span className="num">{fmtUSD(claimableNow)}</span> : <span className="text-[11px] font-normal">— nothing to claim</span>}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Sweep fees (Uniswap + Premium) in one tx</div>
          </button>

          {/* Pro-only parameter edits */}
          {isPro && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <MenuRow
                label="Update leverage"
                hint="Re-lists slices below new floor"
                onClick={() => { setOpen(false); onUpdateLeverage() }}
              />
              <MenuRow
                label="Update Min Premium APY"
                hint="Re-lists slices below new floor"
                onClick={() => { setOpen(false); onUpdateApy() }}
              />
            </>
          )}

          {/* Destructive Withdraw — last, separated, danger-coloured */}
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onWithdraw() }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 transition"
            role="menuitem"
          >
            <div className="font-medium text-[var(--color-status-danger)]">Withdraw NFT</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Closes all open positions, returns NFT to wallet</div>
          </button>
        </div>
      )}
    </div>
  )
}

function MenuRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition"
      role="menuitem"
    >
      <div className="font-medium text-gray-900">{label}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </button>
  )
}

function BreakdownRow({ label, hint, value }: { label: string; hint?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <div className="text-[10px] text-gray-500 leading-tight">{hint}</div>}
      </div>
      <div>{value}</div>
    </div>
  )
}

// Split a USD amount into the listing pair's two token amounts at midprice (V3 in-range ≈ 50/50).
// Returns null token amounts for non-USD-quoted pairs (we then fall back to USD-split display).
const STABLE_TOKENS = new Set(['USDC', 'USDT', 'DAI', 'PYUSD', 'crvUSD'])
function splitToTokens(usd: number, listing: import('@/lib/types').Listing): { t0Amt: number | null; t1Amt: number | null } {
  const half = usd / 2
  const t0IsUSD = STABLE_TOKENS.has(listing.pair.token0)
  const t1IsUSD = STABLE_TOKENS.has(listing.pair.token1)
  if (t1IsUSD) return { t0Amt: half / Math.max(listing.currentPrice, 1e-12), t1Amt: half }
  if (t0IsUSD) return { t0Amt: half, t1Amt: half * listing.currentPrice }
  return { t0Amt: null, t1Amt: null }
}

function FeeRow({ label, usd, listing, highlight, bold }: {
  label: string
  usd: number
  listing: import('@/lib/types').Listing
  highlight?: boolean
  bold?: boolean
}) {
  // Per-row pair breakdown restored per Eugene 2026-05-15 («ты из раздела по
  // фи везде убрал фи в паре пула, нужно вернуть»). KPI-level summed pair
  // also kept above — both surfaces are useful: per-row to see how each
  // stream splits, KPI to see the total in tokens.
  const { t0Amt, t1Amt } = splitToTokens(usd, listing)
  const tokenLine = t0Amt !== null && t1Amt !== null
    ? `${fmtToken(t0Amt, listing.pair.token0)} · ${fmtToken(t1Amt, listing.pair.token1)}`
    : `${fmtUSD(usd / 2)} ${listing.pair.token0} · ${fmtUSD(usd / 2)} ${listing.pair.token1}`
  const valueColor = highlight ? 'var(--color-role-lp)' : undefined
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={'text-sm ' + (bold ? 'font-semibold text-gray-900' : 'text-gray-700')}>{label}</span>
      <div className="text-right">
        <div className={'num ' + (bold ? 'font-semibold text-base' : highlight ? 'font-semibold' : '')} style={{ color: valueColor }}>
          {fmtUSD(usd)}
        </div>
        <div className="text-[10px] text-gray-500 num leading-tight">{tokenLine}</div>
      </div>
    </div>
  )
}

function ActionButton({
  title,
  subtitle,
  onClick,
  tooltipLabel,
  tooltipBody,
  disabled,
}: {
  title: string
  subtitle: string
  onClick: () => void
  tooltipLabel: string
  tooltipBody: string
  disabled?: boolean
}) {
  return (
    <div className={'rounded-md border p-3 flex items-baseline justify-between gap-2 ' + (disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white')}>
      <div className="flex-1 min-w-0">
        <div className={'text-sm font-medium inline-flex items-center gap-1 ' + (disabled ? 'text-gray-400' : '')}>
          {title}
          <HelpPopover label={tooltipLabel} width="w-64">
            <p>{tooltipBody}</p>
          </HelpPopover>
        </div>
        {subtitle && <div className="text-[11px] text-gray-500 num mt-0.5">{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          'text-xs font-medium px-2.5 py-1 rounded border whitespace-nowrap transition ' +
          (disabled
            ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
            : 'border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)]')
        }
      >
        {disabled ? 'Soon' : 'Update'}
      </button>
    </div>
  )
}

function ToggleAction({
  title,
  subtitle,
  active,
  onClick,
  tooltipLabel,
  tooltipBody,
}: {
  title: string
  subtitle: string
  active: boolean
  onClick: () => void
  tooltipLabel: string
  tooltipBody: string
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 flex items-baseline justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium inline-flex items-center gap-1">
          {title}
          <HelpPopover label={tooltipLabel} width="w-64">
            <p>{tooltipBody}</p>
          </HelpPopover>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={
          'text-xs font-medium px-2.5 py-1 rounded transition whitespace-nowrap ' +
          (active
            ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50')
        }
      >
        {active ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function ComparisonBlock({
  label,
  value,
  subtitle,
  tone,
  highlight,
}: {
  label: string
  value: string
  subtitle?: string
  tone: 'success' | 'danger' | 'neutral'
  highlight?: boolean
}) {
  const color = tone === 'success' ? 'var(--color-status-success)' : tone === 'danger' ? 'var(--color-status-danger)' : 'oklch(20% 0 0)'
  return (
    <div className={'rounded-md px-3 py-2 ' + (highlight ? 'bg-[var(--color-role-lp-bg)]/30 border border-[var(--color-role-lp)]/30' : 'bg-gray-50')}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide leading-tight">{label}</div>
      <div className="text-lg font-semibold mt-1" style={{ color }}>{value}</div>
      {subtitle && <div className="text-[10px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Status-aware variant components for TraderPanel (Eugene 2026-05-20).
// Open / Full-buyout: handled by existing OpenPositionForm (no new wrapper).
// Outbid / Out-of-margin: banner above the form contextualises the state.
// My-position-active: referral card pointing to /trader/positions.
// Terminal: read-only banner replacing the form entirely.
// ─────────────────────────────────────────────────────────────────────────

function TerminalListingBanner({
  status,
  listing,
}: {
  status: TraderListingStatus
  listing: import('@/lib/types').Listing
}) {
  const meta = (() => {
    if (status.chip === 'liquidating') return {
      title: '💥 Liquidating',
      tone: 'danger',
      body: 'Listing-level ликвидация в процессе. Все incumbent-позиции закрываются по snapshot-цене. Зайти новой позицией нельзя.',
      cta: { label: 'View liquidation page', href: `/listings/${listing.id}/liquidation` },
    }
    if (status.chip === 'liquidated') return {
      title: 'Closed · liquidated',
      tone: 'neutral',
      body: 'Листинг полностью ликвидирован. Зайти нельзя. LP residual NFT (если остался) можно увидеть в liquidation page.',
      cta: { label: 'View liquidation page', href: `/listings/${listing.id}/liquidation` },
    }
    if (status.chip === 'withdrawn') return {
      title: 'Closed',
      tone: 'neutral',
      body: 'LP забрал NFT. Листинг закрыт навсегда. Зайти нельзя.',
      cta: null as null | { label: string; href: string },
    }
    // closing
    return {
      title: 'Closing · LP exit',
      tone: 'warn',
      body: 'LP запросил вывод NFT. Все incumbent-позиции принудительно закрываются. Новых трейдеров листинг не принимает.',
      cta: null as null | { label: string; href: string },
    }
  })()
  const cls = meta.tone === 'danger'
    ? 'border-[var(--color-status-danger)]/40 bg-red-50 text-[var(--color-status-danger)]'
    : meta.tone === 'warn'
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-gray-300 bg-gray-50 text-gray-800'
  return (
    <div className={'rounded-lg border p-5 ' + cls}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold">{meta.title}</h2>
        {meta.cta && (
          <Link
            to={meta.cta.href}
            className="text-xs font-semibold underline decoration-dotted hover:opacity-80"
          >
            {meta.cta.label} →
          </Link>
        )}
      </div>
      <p className="text-sm mt-2 leading-relaxed">{meta.body}</p>
    </div>
  )
}

function MyPositionReferralCard({
  listing,
  positions,
}: {
  listing: import('@/lib/types').Listing
  positions: import('@/lib/types').Position[]
}) {
  // Find all of MY positions on this listing (in active/close-requested states).
  const myPositions = positions.filter(
    p => p.trader === connectedWallet.address
      && (p.status === 'OPEN' || p.status === 'CLOSE_REQUESTED'),
  )
  const firstId = myPositions[0]?.id
  return (
    <div className="rounded-lg border border-[var(--color-role-lp)]/40 bg-[var(--color-role-lp-bg)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <h2 className="text-base font-semibold text-[var(--color-role-lp)]">You have an active position here</h2>
        <span className="text-[11px] text-gray-600 num">
          {myPositions.length} position{myPositions.length === 1 ? '' : 's'} on {listing.pair.token0}/{listing.pair.token1}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
        Управление активными позициями (P&L, top-up margin, request close) живёт в разделе <strong>My Positions</strong>.
        Эта страница — про сам листинг и состояние аукциона.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {firstId ? (
          <Link
            to={`/trader/positions/${firstId}`}
            className="inline-flex items-center text-sm font-semibold px-3 py-2 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
          >
            Manage in My Positions →
          </Link>
        ) : (
          <Link
            to="/trader/positions"
            className="inline-flex items-center text-sm font-semibold px-3 py-2 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
          >
            Go to My Positions →
          </Link>
        )}
        {listing.availableCapacityUSD > 0.01 && (
          <span className="text-[11px] text-gray-500 leading-snug">
            ↳ available capacity ${(listing.availableCapacityUSD / 1000).toFixed(1)}K still open — can add to existing
          </span>
        )}
      </div>
    </div>
  )
}

function OutbidContextBanner({
  listing,
  positions,
  status,
}: {
  listing: import('@/lib/types').Listing
  positions: import('@/lib/types').Position[]
  status: TraderListingStatus
}) {
  void listing
  const myPos = positions.find(
    p => p.trader === connectedWallet.address && p.status === 'OUTBID_PENDING',
  )
  // Find the trader who took our slot — the one with the highest premium APY
  // amongst current OPEN positions (best-effort heuristic for the prototype).
  const incumbent = positions
    .filter(p => p.status === 'OPEN' && p.trader !== connectedWallet.address)
    .sort((a, b) => b.apyBps - a.apyBps)[0]
  if (!myPos) return null

  const outOfMargin = status.chip === 'out-of-margin'
  const tone = outOfMargin
    ? 'border-[var(--color-status-danger)]/40 bg-red-50 text-[var(--color-status-danger)]'
    : 'border-amber-300 bg-amber-50 text-amber-900'

  return (
    <div className={'rounded-lg border p-5 ' + tone}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-base font-semibold">
          {outOfMargin ? 'Out of margin' : 'Your position was outbid'}
        </h2>
        <span className="text-[11px] num">
          margin remaining <strong>{fmtUSD(myPos.marginValueUSD ?? 0)}</strong>
        </span>
      </div>
      <p className="text-sm leading-relaxed mb-3">
        {outOfMargin ? (
          <>
            Тебя outbid'нули + маржи не хватает на возврат. <strong>Сначала top up margin</strong>, потом сможешь
            выставить ставку выше incumbent'а и забрать слот обратно. ≠ ликвидация — margin не нулевой.
          </>
        ) : (
          <>
            Кто-то предложил выше Premium APY и забрал твой слот. Margin сохранён.
            <strong> Buyout back</strong> — выставь Premium APY выше его ставки, чтобы вернуть позицию.
          </>
        )}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] num">
        <div>
          <div className="text-[10px] uppercase opacity-70">Your original APY</div>
          <div className="font-semibold text-sm">{fmtPct(myPos.openedAtLeverage ? myPos.apyBps : myPos.apyBps)}</div>
        </div>
        {incumbent && (
          <div>
            <div className="text-[10px] uppercase opacity-70">Incumbent now paying</div>
            <div className="font-semibold text-sm">{fmtPct(incumbent.apyBps)}</div>
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase opacity-70">Your notional</div>
          <div className="font-semibold text-sm">{fmtUSD(myPos.notionalUSD)}</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TraderInfoCard — sidebar info card that absorbs every field we pruned
// out of the marketplace row (Eugene 2026-05-20). Lives in the right rail
// of the trader detail page. Sections:
//   1. Headline — Pair · Status chip · Provider Leverage chip
//   2. Range — RangeBar primitive (centered ±10%, raw + delta-%)
//   3. APY block — Total = Uniswap + Premium, with IP APY illustrative
//   4. Pool size + token-pair breakdown + Available
//   5. NFT id (truncated) + Uniswap link
//   6. Lifetime + Fee tier
// ─────────────────────────────────────────────────────────────────────────

function TraderInfoCard({
  listing,
  positions,
}: {
  listing: import('@/lib/types').Listing
  positions: import('@/lib/types').Position[]
}) {
  const subsidized = listing.minPremiumApyBps < 0
  const isAdvanced = listing.providerMode === 'advanced'
  const totalApyBps = listing.uniswapApyBps + listing.minPremiumApyBps
  const activeCount = positions.filter(p => p.status === 'OPEN').length
  const { t0Amt, t1Amt } = splitToTokens(listing.initialLiquidityUSD, listing)
  const freePct = (listing.availableCapacityUSD / Math.max(listing.totalCapacityUSD, 1)) * 100
  const ageMs = Date.now() - listing.listedAt
  const ageStr = ageMs < 1000 * 60 * 60 * 24
    ? `${Math.floor(ageMs / (1000 * 60 * 60))}h`
    : `${Math.floor(ageMs / (1000 * 60 * 60 * 24))}d`

  // Provider Leverage chip — moved out of marketplace per Eugene 2026-05-20.
  // For LP-vocabulary compactness we keep the «safe / at-risk» language
  // on the detail card only.
  const stabilityChip = isAdvanced
    ? <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium num">at-risk · {listing.providerLeverage}×</span>
    : <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded text-gray-600 border border-gray-200 font-medium num">safe · 1×</span>

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      {/* 1. Headline — Pair + Provider Leverage chip */}
      <div>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold">
            {listing.pair.token0} / {listing.pair.token1}
          </h3>
          {stabilityChip}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {fmtFeeTier(listing.feeTierBps)} fee tier · {activeCount} position{activeCount === 1 ? '' : 's'} live
        </div>
      </div>

      {/* 2. Range — centered scale */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5 font-semibold">Range</div>
        <RangeBar
          rangeLow={listing.rangeLow}
          rangeHigh={listing.rangeHigh}
          currentPrice={listing.currentPrice}
        />
      </div>

      {/* 3. APY block — Total + breakdown + IP illustrative */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold inline-flex items-center gap-1">
            Total APY
            <HelpPopover label="Total APY (trader cost)" width="w-72">
              <p>Сумма Uniswap APY (LP earns from swaps) + Premium APY (твой carry to LP). Сколько в общей сумме «крутится» на этом листинге в год относительно его notional. Net APY (signed expected return) — отдельная метрика, см. на странице маркетплейса.</p>
            </HelpPopover>
          </span>
          <span className="text-base font-semibold num text-gray-900">{fmtPct(totalApyBps)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[11px] num text-gray-700">
          <span className="text-gray-500">Uniswap baseline</span>
          <span>{fmtPct(listing.uniswapApyBps)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[11px] num">
          <span className="text-gray-500">Min Premium APY</span>
          <span style={{ color: subsidized ? 'var(--color-negative-apy)' : undefined }}>
            {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[11px] num">
          <span className="text-gray-500 inline-flex items-center gap-1">
            Impermanent Profit APY
            <HelpPopover label="Impermanent Profit APY (illustrative)" width="w-72">
              <p className="font-semibold mb-1">Illustrative, not predictive</p>
              <p className="mb-1.5">Прогноз ожидаемого IP за год при текущей волатильности пула. Считается на базе historical Uniswap APY как proxy. Реальный IP зависит от движения цены, может быть как выше, так и существенно ниже.</p>
              <p className="text-[10px] text-gray-500">Per ТЗ §3.4 P1 R-068 — «historical, not predictive» caveat применяется ко всем IP-figures.</p>
            </HelpPopover>
          </span>
          <span className="text-gray-700">≈ {fmtPct(listing.uniswapApyBps)}</span>
        </div>
      </div>

      {/* 4. Pool size + Available */}
      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Pool size</span>
          <span className="text-sm font-semibold num text-gray-900">{fmtUSD(listing.initialLiquidityUSD)}</span>
        </div>
        {t0Amt !== null && t1Amt !== null && (
          <div className="text-[11px] num text-gray-600 flex items-baseline justify-end gap-1">
            <span>{fmtToken(t0Amt, listing.pair.token0)}</span>
            <span className="text-gray-400">+</span>
            <span>{fmtToken(t1Amt, listing.pair.token1)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between text-[11px] num text-gray-600">
          <span className="text-gray-500">Available</span>
          <span>
            <span className="font-medium text-gray-900">{fmtUSD(listing.availableCapacityUSD)}</span>
            <span className="text-gray-400"> ({Math.round(freePct)}%)</span>
          </span>
        </div>
      </div>

      {/* 5. NFT id + Uniswap link */}
      <div className="flex items-baseline justify-between text-[11px] num border-t border-gray-100 pt-3">
        <span className="text-gray-500">NFT</span>
        <a
          href={`https://app.uniswap.org/positions/v3/arbitrum/${listing.tokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-role-trader)] hover:underline font-medium"
        >
          #{listing.tokenId} ↗
        </a>
      </div>

      {/* 6. Lifetime + Fee tier */}
      <div className="flex items-baseline justify-between text-[11px] num">
        <span className="text-gray-500">Lifetime</span>
        <span className="text-gray-700">{ageStr}</span>
      </div>
    </div>
  )
}
