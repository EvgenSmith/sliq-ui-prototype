// Derived helpers for Listing display per design spec §1.3 + Marketplace redesign.

import type { Listing, Position } from '@/lib/types'

export type RangeStatus = 'in-range' | 'out-of-range'

export function getRangeStatus(listing: Listing): RangeStatus {
  return listing.currentPrice >= listing.rangeLow && listing.currentPrice <= listing.rangeHigh
    ? 'in-range'
    : 'out-of-range'
}

export function capacityFreePct(listing: Listing): number {
  if (listing.totalCapacityUSD <= 0) return 0
  return (listing.availableCapacityUSD / listing.totalCapacityUSD) * 100
}

export function capacityUsedPct(listing: Listing): number {
  return 100 - capacityFreePct(listing)
}

export function isSubsidized(listing: Listing): boolean {
  return listing.minPremiumApyBps < 0
}

// Range midpoint distance — for sort option 4 (price near center → max convexity)
export function distanceToRangeMidpointBps(listing: Listing): number {
  const midpoint = (listing.rangeLow + listing.rangeHigh) / 2
  const halfWidth = (listing.rangeHigh - listing.rangeLow) / 2
  if (halfWidth <= 0) return Infinity
  return Math.abs(listing.currentPrice - midpoint) / halfWidth // 0 = at center, 1 = at edge
}

// Pair label utility
export function pairLabel(listing: Listing): string {
  return `${listing.pair.token0} / ${listing.pair.token1}`
}

// Outbid opportunity — Kolya's vision: traders pay above-min Premium APY чтобы перебить
// существующую позицию с положительным estimated PnL и захватить convex profit мгновенно
// на следующем блоке. Surface это в Marketplace как highlight.
export interface OutbidOpportunity {
  bestPositivePnlUSD: number          // максимальный PnL среди incumbent positions
  positionsCount: number              // сколько incumbent positions на листинге
  weakestApyBps: number               // нижняя цена входа — что нужно перебить
  totalCapturablePnlUSD: number       // сумма положительных PnL (если перебить всё)
}

// Liquidation price (USD) — derived from current reserve.
// Mock model: distanceToLiqBps = reservePct × 10 (so reserve 100% → ±10% range, 10% → at-price).
// Real protocol uses square-law convex IP against reserveUSD; this is UX-grade approximation.
export function estimateLiquidationPrice(p: Position, currentPrice: number): { down: number; up: number } {
  const distancePct = Math.max(0.1, (p.reservePctOfInitial / 100) * 10) // 0.1% min
  const delta = currentPrice * (distancePct / 100)
  return { down: currentPrice - delta, up: currentPrice + delta }
}

// Total carry trader pays per hour (dollar-denominated)
export function estimateCarryPerHour(p: Position): number {
  // Premium APY paid on notional × 1
  const prem = (p.notionalUSD * p.pendingPremApyBps / 10000) / 8760
  // Reference fees paid on notional × leverage (synthetic on 99% slice)
  const ref = (p.notionalUSD * p.pendingRefApyBps / 10000) / 8760
  return prem + ref
}

export function estimatePositionPnL(p: Position): number {
  // Mirrored from TraderPositions — pseudo-deterministic mock convex IP.
  const ip = p.notionalUSD * 0.0008 * (Math.sin(p.openedAt) * 0.5 + 0.5)
  const minutesOpen = (Date.now() - p.openedAt) / 60_000
  const refAccrued = (p.notionalUSD * p.pendingRefApyBps / 10000 / 365 / 1440) * minutesOpen
  const premAccrued = (p.notionalUSD * p.pendingPremApyBps / 10000 / 365 / 1440) * minutesOpen
  return ip - refAccrued - premAccrued
}

export function getOutbidOpportunity(
  listing: Listing,
  positionsOnListing: Position[]
): OutbidOpportunity | null {
  if (listing.status !== 'ACTIVE') return null
  if (positionsOnListing.length === 0) return null

  const open = positionsOnListing.filter(p => p.status === 'OPEN')
  if (open.length === 0) return null

  let bestPnl = 0
  let totalPositivePnl = 0
  let weakestApyBps = Infinity

  for (const p of open) {
    const pnl = estimatePositionPnL(p)
    if (pnl > bestPnl) bestPnl = pnl
    if (pnl > 0) totalPositivePnl += pnl
    if (p.apyBps < weakestApyBps) weakestApyBps = p.apyBps
  }

  if (bestPnl <= 0) return null

  return {
    bestPositivePnlUSD: bestPnl,
    positionsCount: open.length,
    weakestApyBps: weakestApyBps === Infinity ? listing.minPremiumApyBps : weakestApyBps,
    totalCapturablePnlUSD: totalPositivePnl,
  }
}

// Auction-heat signal — surfaces when incumbent lessees are paying meaningfully
// above the listing's Min Premium APY floor. Tells the LP they're under-pricing
// and can raise the floor to capture the spread.
//
// Eugene 2026-05-15 — labels: «↑ +6.5pp» in the table, «Median bid 18.5%» on
// the detail page. No words («Auction hot» / «Underpriced» considered, dropped
// — the arrow + delta is self-explanatory).
//
// Trigger: median of OPEN lessee bids ≥ floor + 300 bps. Single threshold
// handles both regular floors and subsidized (negative-floor) listings.
//
// Returns null when no signal — no open lessees, or spread under 3pp.
export function getAuctionHeat(
  listing: Listing,
  allPositions: Position[],
): { medianApyBps: number; deltaBps: number; sampleSize: number } | null {
  const openBids = allPositions
    .filter(p => p.listingId === listing.id && p.status === 'OPEN')
    .map(p => p.apyBps)
    .sort((a, b) => a - b)
  if (openBids.length === 0) return null
  const mid = Math.floor(openBids.length / 2)
  const medianApyBps = openBids.length % 2 === 0
    ? (openBids[mid - 1] + openBids[mid]) / 2
    : openBids[mid]
  const deltaBps = medianApyBps - listing.minPremiumApyBps
  if (deltaBps < 300) return null
  return { medianApyBps, deltaBps, sampleSize: openBids.length }
}
