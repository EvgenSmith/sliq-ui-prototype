// S4 Listing Detail (canonical) — design spec §8 S4 + §11.6
// One page per listing, role-aware tabs (About | Open as Trader | Manage as Owner).
// Listing is the spine of the product — every link points here.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listings, positions, connectedWallet } from '@/mocks/data'
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
            <span className={'text-xs px-2 py-0.5 rounded-full ' + (inRange
              ? 'bg-gray-50 text-gray-700 border border-gray-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200')}>
              {inRange ? 'in range' : 'out of range'}
            </span>
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
              At-risk · {listing.providerLeverage}×
            </span>
          ) : (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md text-gray-600 border border-gray-200 font-medium">
              Safe · 1×
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
          {/* Listing summary — for trader decision context (hidden for owner — they have it in main) */}
          {!isOwner && (
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
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded text-gray-600 border border-gray-200 font-medium">
                    safe · 1×
                  </span>
                )
              } />
              <Row k="Range" v={<span className="num text-xs">{fmtRange(listing.rangeLow, listing.rangeHigh)}</span>} />
              <Row k="Fee tier" v={<span className="num text-xs">{fmtFeeTier(listing.feeTierBps)}</span>} />
              <Row k="LP underlying" v={<span className="num text-xs">{fmtUSD(listing.initialLiquidityUSD)}</span>} />
            </dl>

          </div>
          )}

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

          {/* Pro Metrics — relocated to right rail. Trader sees always (decision context).
              Owner sees only in Pro mode (Lite stays lean per call 2026-05-14 feedback). */}
          {(!isOwner || ownerMode === 'pro') && (
            <ProMetrics listing={listing} positions={listingPositions} isOwner={isOwner} />
          )}
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
    <details className="rounded-lg border border-gray-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700 inline-flex items-center gap-2">
        Pro metrics
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">для опытных</span>
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
  const avgLeased = listing.avgLeasedPct30d ?? 0

  return (
    <div className="space-y-5">
      {/* Top action bar — primary owner actions (Claim + Manage▾) on the right,
          Lite/Pro view toggle on the left. Moved up from the bottom of the page
          per Eugene 2026-05-15 — owner came here to ACT, not to scroll past
          read-only data first. Convention: Uniswap V3 / OpenSea / Aave all put
          owner actions in the page header. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 flex-wrap">
        {/* Lite / Pro view-mode toggle (orthogonal to listing's providerMode).
            Lite hides advanced analytics; Pro reveals leverage tuning + HF + hit-rate. */}
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shadow-sm">
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

        {/* Primary actions cluster */}
        <div className="flex items-center gap-2">
          {claimableNow > 0.01 && (
            <button
              type="button"
              onClick={() => alert(`Mock: claim ${fmtUSD(claimableNow)} в одной tx`)}
              className="text-sm font-semibold px-3.5 py-1.5 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
            >
              Claim {fmtUSD(claimableNow)}
            </button>
          )}
          <ManageMenu
            isPro={isPro}
            tokenId={listing.tokenId}
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
          Safe: 'bg-gray-50 text-gray-700 border border-gray-200',
          Stable: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          Moderate: 'bg-amber-50 text-amber-900 border border-amber-300',
          'At-risk': 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40',
        }[stability]
        const leasedUSD = listing.totalCapacityUSD - listing.availableCapacityUSD
        const leasedPct = listing.totalCapacityUSD > 0 ? (leasedUSD / listing.totalCapacityUSD) * 100 : 0
        const summary = (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold mb-3">Listing summary</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Min Premium APY
                  <HelpPopover label="Min Premium APY" width="w-64">
                    <p>Минимум, с которого начинается аукцион для трейдеров. Трейдер должен предложить ≥ этой ставки. Если subsidized — ты платишь трейдерам (negative).</p>
                  </HelpPopover>
                </dt>
                <dd className="font-semibold num" style={{ color: subsidized ? 'var(--color-negative-apy)' : undefined }}>
                  {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Uniswap APY
                  <HelpPopover label="Uniswap APY" width="w-64">
                    <p>Realised pool fee APY за последние 30d на текущем range. Это та доходность, которую NFT и так зарабатывал бы на Uniswap без sLiq. На вершину этого аукцион добавляет Premium APY.</p>
                  </HelpPopover>
                </dt>
                <dd className="font-semibold text-gray-900 num">{fmtPct(listing.uniswapApyBps)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Total APY
                  <HelpPopover label="Total APY" width="w-64">
                    <p>Сумма: <strong>min Premium APY + Uniswap APY</strong>. То, на что в сумме можно рассчитывать при текущих условиях аукциона и Uniswap pool yield.</p>
                  </HelpPopover>
                </dt>
                <dd className="font-semibold text-gray-900 num text-base flex items-baseline gap-2 flex-wrap">
                  <span>{fmtPct(totalApyBps)}</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    = {fmtPct(listing.minPremiumApyBps, { signed: subsidized })} Premium + {fmtPct(listing.uniswapApyBps)} Uniswap
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Active positions
                  <HelpPopover label="Active positions" width="w-72">
                    <p>Сколько отдельных трейдер-позиций сейчас открыто на твоём листинге. Каждая платит Premium APY на свою долю notional. <strong>0</strong> = арендаторов нет → надо снизить Min APY или ждать.</p>
                  </HelpPopover>
                </dt>
                <dd className="font-semibold text-gray-900 num">{activeCount}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  LP stability
                  <HelpPopover label="LP stability" width="w-80">
                    <p className="font-semibold mb-1">Унифицированный risk grade</p>
                    <ul className="text-xs space-y-1">
                      <li><strong>Safe</strong> — Conservative (1×), NFT не collateral, ликвидации невозможны.</li>
                      <li><strong>Stable</strong> — Pro с health factor &gt; 70, дистанция до ликвидации большая.</li>
                      <li><strong>Moderate</strong> — Pro, HF 30–70, можно тюнить.</li>
                      <li><strong>At-risk</strong> — Pro, HF &lt; 30, близко к listing-level ликвидации.</li>
                    </ul>
                  </HelpPopover>
                </dt>
                <dd>
                  <span className={'text-[11px] font-semibold px-1.5 py-0.5 rounded ' + stabilityCls}>
                    {stability}
                  </span>
                  {isAdvanced && <span className="text-[11px] text-gray-500 ml-2 num">{listing.providerLeverage}×</span>}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                  Used / Total capacity
                  <HelpPopover label="Used / Total" width="w-72">
                    <p>Сколько из доступной capacity сейчас арендовано трейдерами. <strong>Used</strong> = занято · <strong>Total</strong> = весь capacity (включая amplified leverage). Premium APY идёт только на Used.</p>
                  </HelpPopover>
                </dt>
                <dd className="num flex items-baseline gap-2 mt-0.5">
                  <span className="font-semibold text-gray-900">{fmtUSD(leasedUSD)}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-500">{fmtUSD(listing.totalCapacityUSD)}</span>
                  <span className="text-[11px] text-gray-500">({Math.round(leasedPct)}% used)</span>
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
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
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
                  <HelpPopover label="Health Factor" width="w-72">
                    <p>Aave-style 0–100% scale. Только для Pro с плечом &gt; 1. Чем ниже — тем ближе к listing-level ликвидации. Зелёный &gt; 60%, amber 30–60%, красный &lt; 30%.</p>
                  </HelpPopover>
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionButton
                title={isAdvanced ? 'Update Provider Leverage' : 'Enable Advanced mode'}
                subtitle={`Сейчас: ${isAdvanced ? `at-risk · ${listing.providerLeverage}×` : 'safe · 1×'}`}
                onClick={() => setLeverageOpen(true)}
                tooltipLabel={isAdvanced ? 'Update Leverage' : 'Enable Advanced'}
                tooltipBody={isAdvanced
                  ? 'Provider Leverage 2-100×. Выше = amplified pool под Premium APY, ниже = безопаснее.'
                  : 'Переключиться с Safe · 1× на At-risk · N×. NFT становится collateral. Только для high-conviction LPs.'}
              />
              <ActionButton
                title="Update Min Premium APY"
                subtitle={`Сейчас: ${fmtPct(listing.minPremiumApyBps, { signed: true })}`}
                onClick={() => setUpdateApyOpen(true)}
                tooltipLabel="Update Min APY"
                tooltipBody="Floor для auction. Трейдер должен предложить ≥ этой ставки чтобы зайти. Подними если есть demand, опусти чтобы привлечь арендаторов."
              />
              <ActionButton
                title="Top up liquidity"
                subtitle="Soon — добавить ликвидность к позиции"
                onClick={() => {}}
                disabled
                tooltipLabel="Top up — Soon"
                tooltipBody="Per Kolya 2026-05-14 @01:21:54: margin = NFT, его докинуть нельзя. Но добавить liquidity к позиции — да, фича в плане."
              />
              <ActionButton
                title="Auto-compound Uniswap fees"
                subtitle="Soon — keeper compound на каждом settlement"
                onClick={() => {}}
                disabled
                tooltipLabel="Auto-compound — Soon"
                tooltipBody="Не в текущем sprint. Когда включится — keeper будет автоматически делать collect Uniswap fees и re-добавлять к NFT, без ручных claim/re-deposit."
              />
            </div>
          </div>
        )
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {summary}
            {managePro}
          </div>
        )
      })()}

      {/* Position Info — underlying Uniswap pool facts. Listed-since + NFT id are
          already in the page header above, so we don't duplicate them here. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1">Position info</h3>
          <a
            href={`https://app.uniswap.org/positions/v3/arbitrum/${listing.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[var(--color-role-lp)] hover:underline inline-flex items-center gap-1"
          >
            View on Uniswap →
          </a>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Pool size</dt>
            <dd className="font-semibold text-gray-900 num">{fmtUSD(listing.initialLiquidityUSD)}</dd>
            <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5">
              {(() => {
                const { t0Amt, t1Amt } = splitToTokens(listing.initialLiquidityUSD, listing)
                return t0Amt !== null && t1Amt !== null
                  ? `${fmtToken(t0Amt, listing.pair.token0)} · ${fmtToken(t1Amt, listing.pair.token1)}`
                  : `${fmtUSD(listing.initialLiquidityUSD / 2)} ${listing.pair.token0} · ${fmtUSD(listing.initialLiquidityUSD / 2)} ${listing.pair.token1}`
              })()}
            </dd>
          </div>
          {/* Trader market — derived figure that only exists at leverage > 1.
              Vocabulary matches the List NFT modal (ProPreview): Pool size × Leverage.
              Hidden for Conservative listings (would equal Pool size, redundant)
              and in Lite view (kept clean per call 2026-05-14). */}
          {isPro && isAdvanced && (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                Trader market
                <HelpPopover label="Trader market" width="w-72">
                  <div className="font-semibold mb-1">Trader market = Pool size × Leverage</div>
                  The leveraged exposure traders compete for. Your NFT backs it at
                  the Pool-size amount; traders pay Premium APY on the full
                  Trader-market size. At 1× leverage Trader market = Pool size.
                </HelpPopover>
              </dt>
              <dd className="font-semibold text-gray-900 num">
                {fmtUSD(listing.totalCapacityUSD)}
                <span className="text-[11px] text-gray-500 font-normal ml-1.5">
                  = {fmtUSD(listing.initialLiquidityUSD)} × {listing.providerLeverage}×
                </span>
              </dd>
              <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5">
                {(() => {
                  const { t0Amt, t1Amt } = splitToTokens(listing.totalCapacityUSD, listing)
                  return t0Amt !== null && t1Amt !== null
                    ? `${fmtToken(t0Amt, listing.pair.token0)} · ${fmtToken(t1Amt, listing.pair.token1)}`
                    : `${fmtUSD(listing.totalCapacityUSD / 2)} ${listing.pair.token0} · ${fmtUSD(listing.totalCapacityUSD / 2)} ${listing.pair.token1}`
                })()}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Range</dt>
            <dd className="font-medium text-gray-900 num">{fmtRange(listing.rangeLow, listing.rangeHigh)}</dd>
            <dd className="text-[11px] text-gray-500 num leading-tight mt-0.5">price · {listing.pair.token0}/{listing.pair.token1}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
              Uniswap APY
              <HelpPopover label="Uniswap APY" width="w-64">
                <p>Realized Uniswap fees APY на underlying V3 пуле за последние 30 дней. Это базовая доходность позиции от Uniswap, без учёта sLiq Premium.</p>
              </HelpPopover>
            </dt>
            <dd className="font-semibold text-gray-900 num">{fmtPct(listing.uniswapApyBps)}</dd>
            <dd className="text-[11px] text-gray-500 leading-tight mt-0.5">от Uniswap pool · 30d</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Protocol · fee tier</dt>
            <dd className="font-medium text-gray-900">Uniswap v3 <span className="num">· {fmtFeeTier(listing.feeTierBps)}</span></dd>
            <dd className="text-[11px] text-gray-500 leading-tight mt-0.5 num">NFT #{listing.tokenId}</dd>
          </div>
        </dl>
      </div>

      {/* Fees panel — positive perspective (user feedback 2026-05-15):
          Uniswap → Premium → Total → Accrued/Claimable breakdown → IL. */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold inline-flex items-center gap-1">
            Fees · earnings
            <HelpPopover label="Fees · earnings" width="w-80">
              <p className="font-semibold mb-1">Что заработала позиция</p>
              <p className="mb-1.5">Две статьи дохода LP — Uniswap fees от underlying pool + Premium APY от sLiq trader auction. Каждая в USD и в разбивке по паре активов.</p>
              <p className="mb-1"><strong>Total</strong> — суммарно с момента листинга.</p>
              <p className="mb-1"><strong>Accrued / Claimable</strong> — сколько уже зачислено на твой кошелёк vs сколько можно забрать прямо сейчас (одной tx).</p>
              <p><strong>IL</strong> — оценка impermanent loss vs HODL underlying. Net PnL = Total fees − IL.</p>
            </HelpPopover>
          </h2>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Net PnL (IL-adjusted)</div>
            <div
              className="num font-bold text-xl leading-tight"
              style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
            >
              {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <FeeRow label="Uniswap fees" usd={uniswapFeesTotal} listing={listing} />
          <FeeRow label="Premium APY" usd={premiumFeesTotal} listing={listing} />
          <div className="border-t border-gray-200 mt-2 pt-2" />
          <FeeRow label="Total fees" usd={totalFees} listing={listing} bold />
          {/* Accrued / Claimable breakdown — sub-row under Total */}
          <div className="ml-3 mt-1.5 grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex items-baseline justify-between border-l-2 border-gray-200 pl-2">
              <span className="text-gray-500">Accrued (уже на кошельке)</span>
              <span className="num text-gray-700">{fmtUSD(accruedClaimed)}</span>
            </div>
            <div className="flex items-baseline justify-between border-l-2 pl-2" style={{ borderColor: 'var(--color-role-lp)' }}>
              <span className="text-gray-500">Claimable now</span>
              <span className="num font-semibold" style={{ color: 'var(--color-role-lp)' }}>{fmtUSD(claimableNow)}</span>
            </div>
          </div>
        </div>
        {/* IL line — always shown when negative (it's a real cost the LP needs to see) */}
        {ilProxy < -0.01 && (
          <div className="mt-3 flex items-baseline justify-between text-[11px]">
            <span className="text-gray-600">Impermanent Loss <span className="text-gray-400">vs HODL</span></span>
            <span className="num text-[var(--color-status-danger)]">{fmtUSD(ilProxy)}</span>
          </div>
        )}
        {/* Inline Claim — duplicates the header action by design: same intent,
            different context. Header = «I came here to claim», here = «I'm reading
            the fee breakdown and tap claim from the number I just saw».
            Withdraw moved to header Manage▾ (destructive, doesn't belong next to fees). */}
        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            disabled={claimableNow <= 0.01}
            onClick={() => alert(`Mock: claim ${fmtUSD(claimableNow)} в одной tx`)}
            className={
              'text-sm font-semibold px-4 py-2 rounded transition border ' +
              (claimableNow > 0.01
                ? 'bg-[var(--color-role-lp)] text-white border-[var(--color-role-lp)] hover:opacity-90'
                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed')
            }
          >
            {claimableNow > 0.01 ? `Claim ${fmtUSD(claimableNow)}` : 'Нечего клеймить'}
          </button>
        </div>
        {netPnL < 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
            <div className="text-xs font-semibold text-amber-900 mb-1">💡 Что делать</div>
            <ul className="text-[11px] text-amber-900 space-y-1 leading-snug list-disc list-outside ml-4">
              {hitRate < 50 && (
                <li><strong>Range hit-rate {hitRate}% низкий</strong> — NFT часто out-of-range. Withdraw + re-list через Uniswap с wider range.</li>
              )}
              {hitRate >= 50 && hitRate < 70 && (
                <li>Range hit-rate {hitRate}% — норм, но можно расширить для стабильности fees.</li>
              )}
              {Math.abs(ilProxy) > totalFees && (
                <li><strong>IL превышает заработок</strong> — цена двинулась против range. Если ждёшь mean-reversion, оставь; если нет — закрой через Request withdrawal.</li>
              )}
              {!isAdvanced && (
                <li>Подумай про Pro mode — там Premium APY на amplified pool, больше carry. Но NFT становится collateral.</li>
              )}
              {activeLessees.length === 0 && (
                <li>Нет арендаторов — listing не привлекателен при текущем Min APY. Снизь его.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Position analytics — Pro only. Two complementary signals:
          – Range hit-rate (% time price was inside Uniswap range)
          – Avg leased · 30d (intensity of trader demand — how much of pool was rented on average) */}
      {isPro && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Range hit-rate */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1">
              Range hit-rate · 30d
              <HelpPopover label="Range hit-rate" width="w-64">
                <p>% времени, когда цена была внутри твоего Uniswap range. Низкий hit-rate = NFT часто out-of-range, Uniswap fees не идут. Сигнал расширить range или перелистить.</p>
              </HelpPopover>
            </h3>
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
            {hitRate > 70 ? 'Хорошо — Uniswap fees регулярно начисляются.'
             : hitRate > 40 ? 'Средне — рассмотри расширение range.'
             : 'Низко — NFT часто out-of-range. Withdraw + re-list с новым range.'}
          </p>
        </div>

        {/* Avg leased — utilization */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
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
              className="num font-bold text-lg"
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
      </div>
      )}

      {/* Manage listing · Pro panel moved up next to Listing summary (Eugene 2026-05-15) —
          user switches to Pro specifically to tune leverage / min APY, panel needs to be
          visible without scrolling. See paired layout inside the Listing Summary IIFE above.

          Active lessees block was already removed (call 2026-05-14): «lessees» as a term
          wasn't used — Liquidity Used / Leased % already conveys "how much rented". */}

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
        title="Запрос вывода NFT — подтверди"
        subtitle="Принудительно закрывает всех текущих арендаторов. Тот же NFT (#{listing.tokenId}) возвращается в кошелёк через 2-block keeper settlement — но с текущим P&L (если margin съел часть, NFT придёт с уменьшенной стоимостью)."
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

// ManageMenu — owner-actions dropdown rendered in the OwnerPanel header strip.
// Pro reveals leverage / min APY editors; both modes get Withdraw + Uniswap link.
// Destructive item (Withdraw) sits last + danger-coloured.
function ManageMenu({
  isPro,
  tokenId,
  onUpdateLeverage,
  onUpdateApy,
  onWithdraw,
}: {
  isPro: boolean
  tokenId: number
  onUpdateLeverage: () => void
  onUpdateApy: () => void
  onWithdraw: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-sm font-semibold px-3.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition inline-flex items-center gap-1"
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
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-30 py-1"
        >
          {isPro && (
            <>
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
              <div className="border-t border-gray-100 my-1" />
            </>
          )}
          <a
            href={`https://app.uniswap.org/positions/v3/arbitrum/${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-gray-50 transition"
            role="menuitem"
          >
            <div className="font-medium text-gray-900 inline-flex items-center gap-1">
              View on Uniswap <span aria-hidden="true" className="text-xs">↗</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Source NFT on app.uniswap.org</div>
          </a>
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
        <div className="text-[11px] text-gray-500 num mt-0.5">{subtitle}</div>
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
        {disabled ? 'Soon' : 'Edit'}
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
