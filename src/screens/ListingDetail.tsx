// S4 Listing Detail (canonical) — design spec §8 S4 + §11.6
// One page per listing, role-aware tabs (About | Open as Trader | Manage as Owner).
// Listing is the spine of the product — every link points here.

import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listings, positions, connectedWallet } from '@/mocks/data'
import {
  fmtFeeTier,
  fmtPct,
  fmtRange,
  fmtTimeAgo,
  fmtUSD,
  isInRange,
  shortAddr,
} from '@/lib/format'
import { APYBreakdown } from '@/components/APYBreakdown'
import { RiskPanel } from '@/components/RiskPanel'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import { LPFlowSelector } from '@/components/LPFlowSelector'
import { HelpPopover } from '@/components/HelpPopover'
import { capacityFreePct, estimatePositionPnL } from '@/lib/derive'
import { useState as useState2 } from 'react'

export function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const listing = useMemo(() => listings.find(l => l.id === id), [id])
  const listingPositions = useMemo(
    () => positions.filter(p => p.listingId === id),
    [id]
  )

  const isOwner = listing?.owner === connectedWallet.address

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

  // Compute stress for RiskPanel
  const stress = isAdvanced && listing.aggregateReserveUSD !== undefined
    ? [
        { label: '+20%', reserveAfter: listing.aggregateReserveUSD * 0.62, triggers: false },
        { label: '−20%', reserveAfter: listing.aggregateReserveUSD * 0.41, triggers: false },
      ]
    : []
  const traderClaimsUSD = listingPositions.reduce((s, p) => s + p.reserveUSD * 0.3, 0)

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
            {inRange ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30">
                in range
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                out of range
              </span>
            )}
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs num">NFT #{listing.tokenId}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs">listed {fmtTimeAgo(listing.listedAt)}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs num">owner {shortAddr(listing.owner)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdvanced ? (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              Advanced · {listing.providerLeverage}×
            </span>
          ) : (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
              Conservative · 1×
            </span>
          )}
          {isSubsidized && (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] border border-[var(--color-negative-apy)]/30 font-medium">
              Subsidized
            </span>
          )}
          {isFull && (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              Full · open to outbid
            </span>
          )}
        </div>
      </header>

      {/* Layout: main + sidebar — no tabs, role-conditional */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          {isOwner ? (
            <OwnerPanel listing={listing} />
          ) : (
            <TraderPanel
              listing={listing}
              isFull={isFull}
              positions={listingPositions}
            />
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Listing summary — enriched с LP context для trader decision */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Listing summary
            </h3>
            <dl className="space-y-1.5 text-sm">
              <Row k="Min Premium APY" v={
                <span className="num font-medium" style={{ color: isSubsidized ? 'var(--color-negative-apy)' : undefined }}>
                  {isSubsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
                </span>
              } />
              <Row k="Available / Total" v={
                <span className="num text-xs">
                  <strong>{fmtUSD(listing.availableCapacityUSD)}</strong>
                  <span className="text-gray-500"> / {fmtUSD(listing.totalCapacityUSD)}</span>
                </span>
              } />
              <Row k="Active positions" v={
                <span className="num">{listingPositions.filter(p => p.status === 'OPEN').length}</span>
              } />
              <Row k="LP stability" v={
                isAdvanced ? (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium">
                    at-risk · {listing.providerLeverage}×
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
                    safe · 1×
                  </span>
                )
              } />
              <Row k="Range" v={<span className="num text-xs">{fmtRange(listing.rangeLow, listing.rangeHigh)}</span>} />
              <Row k="Fee tier" v={<span className="num text-xs">{fmtFeeTier(listing.feeTierBps)}</span>} />
              <Row k="LP underlying" v={<span className="num text-xs">{fmtUSD(listing.initialLiquidityUSD)}</span>} />
            </dl>

          </div>

          {/* Risk panel — Advanced only, OWNER perspective. Hidden for trader (his risk = his own position liq, shown on S9 instead) */}
          {isOwner && isAdvanced && listing.aggregateReserveUSD !== undefined && (
            <RiskPanel
              context="lp-listing"
              aggregateReserveUSD={listing.aggregateReserveUSD}
              distanceToLiqPct={listing.distanceToLiqPct ?? 0}
              stress={stress}
              traderClaimsUSD={traderClaimsUSD}
            />
          )}

          {/* Pro Metrics — relocated to right rail per design feedback */}
          {!isOwner && <ProMetrics listing={listing} positions={listingPositions} />}
        </aside>
      </div>
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
  return (
    <div className="space-y-4">
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
  const [leverage, setLeverage] = useState2<number>(100) // default 100× (excerpt 1: «можно 100-м или 10-м плечом маржу обеспечить»)
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
}: {
  listing: import('@/lib/types').Listing
  positions: import('@/lib/types').Position[]
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
    <details className="rounded-lg border border-gray-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700 inline-flex items-center gap-2">
        Pro metrics
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">для опытных</span>
        <span className="text-[11px] text-gray-500 font-normal ml-1">vol · σ-distance · auction depth · OI</span>
      </summary>

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

function OwnerPanel({ listing }: { listing: import('@/lib/types').Listing }) {
  const [leverageOpen, setLeverageOpen] = useState2(false)
  const [withdrawOpen, setWithdrawOpen] = useState2(false)
  const [updateApyOpen, setUpdateApyOpen] = useState2(false)
  const [withdrawing, setWithdrawing] = useState2(false)
  const [newLeverage, setNewLeverage] = useState2(listing.providerLeverage)
  const [newMode, setNewMode] = useState2(listing.providerMode)
  const [newMinApyPct, setNewMinApyPct] = useState2(listing.minPremiumApyBps / 100)
  const [autoCompound, setAutoCompound] = useState2(listing.autoCompound ?? true)
  const [paused, setPaused] = useState2(listing.status === 'PAUSED')

  const myListingPositions = positions.filter(p => p.listingId === listing.id)
  const activeLessees = myListingPositions.filter(p => p.status === 'OPEN')
  const lifetimeUni = listing.lifetimeUniFeesUSD ?? 0
  const lifetimePremium = listing.lifetimePremiumUSD ?? 0
  const lifetimeRef = listing.lifetimeReferenceUSD ?? 0
  const netPnL = listing.netPnLUSD ?? 0
  const ilProxy = netPnL - lifetimeUni - lifetimePremium - lifetimeRef
  const claimable = lifetimeUni * 0.3 + lifetimePremium * 0.2 + lifetimeRef * 0.4 // mock — accrued but not claimed
  const ageHours = Math.max(1, (Date.now() - listing.listedAt) / (1000 * 60 * 60))
  const uniPerHour = lifetimeUni / ageHours
  const premPerHour = lifetimePremium / ageHours

  const subsidized = listing.minPremiumApyBps < 0
  const isAdvanced = listing.providerMode === 'advanced'
  const hitRate = listing.rangeHitRatePct ?? 0

  return (
    <div className="space-y-5">
      {/* Earnings panel — headline */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold">Earnings since listing</h2>
          <span
            className="num font-bold text-2xl"
            style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
          >
            {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
            <span className="text-xs font-medium text-gray-500 ml-2">net</span>
          </span>
        </div>
        <div className="space-y-1.5 text-sm">
          <BreakdownRow label="Uniswap fees (baseline)" hint={`real fees from V3 pool · ${fmtUSD(uniPerHour)}/h avg`} value={
            <span className="num font-medium text-[var(--color-status-success)]">+{fmtUSD(lifetimeUni)}</span>
          } />
          <BreakdownRow label="Reference Fees" hint={`paid by lessees, ${listing.providerLeverage}× amplified`} value={
            <span className="num text-[var(--color-status-success)]">+{fmtUSD(lifetimeRef)}</span>
          } />
          <BreakdownRow
            label={subsidized ? 'Premium APY (you pay traders)' : 'Premium APY (paid by lessees)'}
            hint={`${subsidized ? 'paid out' : 'collected'} · ${fmtUSD(Math.abs(premPerHour))}/h`}
            value={
              <span className="num" style={{ color: subsidized ? 'var(--color-status-danger)' : 'var(--color-status-success)' }}>
                {subsidized ? '−' : '+'}{fmtUSD(Math.abs(lifetimePremium))}
              </span>
            }
          />
          <BreakdownRow label="Impermanent Loss" hint="vs HODL value (V3 IL math)" value={
            <span className="num text-[var(--color-status-danger)]">{fmtUSD(ilProxy)}</span>
          } />
        </div>
        <hr className="border-gray-100 my-2.5" />
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Net PnL (IL-adjusted)</span>
          <span
            className="num font-bold"
            style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
          >
            {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 leading-snug">
          Что Uniswap UI скрывает: gross fees − IL = real PnL. С sLiq добавляются Reference Fees + Premium APY от lessees → итог часто positive даже когда Uniswap-only был бы в минусе.
        </p>
      </div>

      {/* Range hit-rate */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold">Range hit-rate · last 30d</h3>
          <span
            className="num font-bold text-lg"
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
          % времени когда price была в твоём range. <strong>{hitRate}% / 30d.</strong>{' '}
          {hitRate > 70 ? 'Хорошо — fees регулярно начисляются.'
           : hitRate > 40 ? 'Средне — рассмотри расширение range.'
           : 'Низко — NFT часто out-of-range, fees не идут. Withdraw + re-list с новым range.'}
        </p>
      </div>

      {/* Manage actions panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-semibold">Manage listing</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ActionButton
            title="Update Provider Leverage"
            subtitle={`Now: ${listing.providerLeverage}×`}
            onClick={() => setLeverageOpen(true)}
            tooltipLabel="Update Leverage"
            tooltipBody="Conservative ↔ Advanced. Higher leverage amplifies Reference Fees pool но делает NFT collateralized."
          />
          <ActionButton
            title="Update Min Premium APY"
            subtitle={`Now: ${fmtPct(listing.minPremiumApyBps, { signed: true })}`}
            onClick={() => setUpdateApyOpen(true)}
            tooltipLabel="Update Min APY"
            tooltipBody="Floor для auction. Trader должен предложить ≥ этой ставки чтобы зайти. Подними если есть demand, опусти чтобы привлечь lessees."
          />
          <ToggleAction
            title="Pause new lessees"
            subtitle={paused ? 'Paused — existing keep' : 'Active — accepting opens'}
            active={paused}
            onClick={() => setPaused(p => !p)}
            tooltipLabel="Pause"
            tooltipBody="Pause blocks new opens, existing lessees продолжают сидеть и платить carry. To force-close everyone → use Request withdrawal instead."
          />
          <ToggleAction
            title="Auto-compound Uniswap fees"
            subtitle={autoCompound ? 'ON — keeper compounds на каждом settlement' : 'OFF — fees collect-only'}
            active={autoCompound}
            onClick={() => setAutoCompound(a => !a)}
            tooltipLabel="Auto-compound"
            tooltipBody="Keeper автоматически collect Uniswap fees и re-добавляет к NFT при каждом settlement event. No manual collect+re-add."
          />
        </div>

        {claimable > 1 && (
          <div className="rounded-md border border-[var(--color-role-lp)]/30 bg-[var(--color-role-lp-bg)]/40 p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Ready to claim: {fmtUSD(claimable)}</div>
              <div className="text-[11px] text-gray-600 mt-0.5">Uniswap fees + Reference + Premium accrued</div>
            </div>
            <Link
              to="/lp/claims"
              className="text-sm font-semibold px-3 py-1.5 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
            >
              Claim →
            </Link>
          </div>
        )}

        <hr className="border-gray-100" />

        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Request NFT withdrawal</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Force-closes все existing lessees. NFT возвращается на твой wallet через 2-block keeper settlement.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            disabled={withdrawing}
            className="text-sm font-semibold px-4 py-2 rounded-md border border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-red-50 transition disabled:opacity-50"
          >
            {withdrawing ? 'Withdrawing…' : 'Request withdraw'}
          </button>
        </div>
      </div>

      {/* Active lessees table */}
      {activeLessees.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold mb-3">Active lessees ({activeLessees.length})</h3>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left font-medium pb-2">Trader</th>
                <th className="text-right font-medium pb-2">Notional</th>
                <th className="text-right font-medium pb-2">APY paid to you</th>
                <th className="text-right font-medium pb-2">Their PnL</th>
                <th className="text-right font-medium pb-2">Opened</th>
              </tr>
            </thead>
            <tbody>
              {activeLessees.map(p => {
                const pnl = estimatePositionPnL(p)
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-2 num text-xs">{shortAddr(p.trader)}</td>
                    <td className="py-2 text-right num">{fmtUSD(p.notionalUSD)}</td>
                    <td className="py-2 text-right num font-medium" style={{ color: p.apyBps < 0 ? 'var(--color-negative-apy)' : undefined }}>
                      {fmtPct(p.apyBps, { signed: true })}
                    </td>
                    <td className="py-2 text-right num text-xs" style={{ color: pnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
                      {pnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(pnl))}
                    </td>
                    <td className="py-2 text-right num text-xs text-gray-500">{fmtTimeAgo(p.openedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 mt-3 leading-snug">
            Если их PnL positive — рынок верит что твой листинг стоит carry. Сигнал поднять Min APY.
          </p>
        </div>
      )}

      {/* Vs HODL chart placeholder */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold mb-2">Vs HODL · 30d</h3>
        <div className="text-[11px] text-gray-500 mb-3">
          Что было бы если бы ты просто держал tokens (без LP):
        </div>
        <div className="grid grid-cols-3 gap-3 num text-sm">
          <ComparisonBlock label="Pure HODL" value={`−${fmtUSD(Math.abs(ilProxy))}`} tone="neutral" subtitle="just held tokens" />
          <ComparisonBlock label="Uniswap LP only" value={`+${fmtUSD(lifetimeUni + ilProxy)}`} tone={lifetimeUni + ilProxy >= 0 ? 'success' : 'danger'} subtitle="fees minus IL" />
          <ComparisonBlock label="sLiq LP" value={netPnL >= 0 ? `+${fmtUSD(netPnL)}` : `−${fmtUSD(Math.abs(netPnL))}`} tone={netPnL >= 0 ? 'success' : 'danger'} subtitle="+ Premium + Reference" highlight />
        </div>
        <p className="text-[10px] text-gray-500 mt-3 leading-snug">
          sLiq добавляет Premium APY + Reference Fees к Uniswap baseline. Total &gt; HODL — листинг успешный.
        </p>
      </div>

      {/* Pro Metrics */}
      <details className="rounded-lg border border-gray-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700 inline-flex items-center gap-2">
          Pro metrics
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">для опытных</span>
        </summary>
        <div className="mt-4 space-y-3">
          <div className="rounded border border-gray-200 p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Listing economics</div>
            <div className="grid grid-cols-2 gap-2 text-sm num">
              <MetricBlock label="Effective APR (combined)" value={`${((netPnL / listing.initialLiquidityUSD) * (365 / (ageHours / 24)) * 100).toFixed(2)}%`} />
              <MetricBlock label="Lessees turnover" value={`${myListingPositions.length} pos lifetime`} />
              <MetricBlock label="Capacity utilization" value={`${(100 - capacityFreePct(listing)).toFixed(0)}%`} />
              <MetricBlock label="IL/Fees ratio" value={`${(Math.abs(ilProxy) / Math.max(0.01, lifetimeUni + lifetimePremium + lifetimeRef)).toFixed(2)}×`} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => alert('CSV export — mock. Production: full listing history + earnings + lessees.')}
            className="text-[11px] font-medium px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            ↓ Export CSV
          </button>
          <p className="text-[10px] text-gray-400 leading-snug">
            <strong>Data sources:</strong> Uniswap fees → V3 subgraph · IL → V3 SDK client-side · Reference/Premium → sLiq subgraph · range hit-rate → swap-events aggregation.
          </p>
        </div>
      </details>

      {/* === Modals === */}

      {/* Update Leverage */}
      <HighStakesConfirmModal
        open={leverageOpen}
        title="Update Provider Leverage — confirm"
        subtitle={
          newMode === 'advanced' && listing.providerMode !== 'advanced'
            ? 'Switching to Advanced. NFT becomes collateral — listing-level liquidation possible at vol-event.'
            : newLeverage > listing.providerLeverage
            ? 'Higher leverage → tighter liquidation distance. Reference Fees pool amplified.'
            : 'Lower leverage → safer но Reference Fees pool сокращается.'
        }
        currentState={[
          { label: 'Mode', value: listing.providerMode === 'advanced' ? `at-risk · ${listing.providerLeverage}×` : 'safe · 1×' },
          { label: 'NFT at risk', value: isAdvanced ? 'Yes' : 'No' },
        ]}
        newState={[
          { label: 'Mode', value: newMode === 'advanced' ? `at-risk · ${newLeverage}×` : 'safe · 1×', deltaTone: newLeverage > listing.providerLeverage ? 'negative' : 'positive' },
          { label: 'NFT at risk', value: newMode === 'advanced' ? 'Yes' : 'No', deltaTone: newMode === 'advanced' && !isAdvanced ? 'negative' : 'neutral' },
        ]}
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

      {/* Update Min APY */}
      <HighStakesConfirmModal
        open={updateApyOpen}
        title="Update Min Premium APY — confirm"
        subtitle={newMinApyPct < 0
          ? `⚠️ Negative APY — ты будешь платить ${Math.abs(newMinApyPct)}% годовых traders. Use только если знаешь что делаешь.`
          : 'Changes the floor для auction. Existing lessees keep their carry rate.'
        }
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

      {/* Withdrawal modal */}
      <HighStakesConfirmModal
        open={withdrawOpen}
        title="Request NFT withdrawal — confirm"
        subtitle="Force-closes все existing lessees. NFT возвращается на wallet через 2-block keeper settlement."
        currentState={[
          { label: 'Active lessees', value: String(activeLessees.length) },
          { label: 'Listing status', value: listing.status },
          { label: 'NFT in protocol', value: `#${listing.tokenId}` },
        ]}
        newState={[
          { label: 'Listing status', value: 'withdrawing · LP exit', deltaTone: 'neutral' },
          { label: 'New lessees', value: 'Blocked', deltaTone: 'neutral' },
          { label: 'Existing lessees', value: 'Force-closed at next-block price', deltaTone: 'negative' },
        ]}
        risks={[
          'Lessees могут заработать меньше Premium чем при wait-out',
          'Pending Reference + Premium списываются from each lessee\'s reserve at close',
          'Withdrawal can\'t be cancelled after submit',
        ]}
        irreversibilityNote="Re-listing requires fresh deposit (new NFT import)."
        confirmType="type-to-confirm"
        typeWord="WITHDRAW"
        confirmButtonLabel="Confirm withdrawal"
        onConfirm={() => {
          setWithdrawOpen(false)
          setWithdrawing(true)
        }}
        onCancel={() => setWithdrawOpen(false)}
      />
    </div>
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

function ActionButton({
  title,
  subtitle,
  onClick,
  tooltipLabel,
  tooltipBody,
}: {
  title: string
  subtitle: string
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
        <div className="text-[11px] text-gray-500 num mt-0.5">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)] transition whitespace-nowrap"
      >
        Edit
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
