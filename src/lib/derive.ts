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

// === Trader card / detail metric helpers ===
// Spec sources:
//   · whitepaper §9.3 (HF), §6 (PnL composition)
//   · {sLiq} {prd} trader UI spec – 2026-05-18 (P2 R-032/033/034)
//   · trader call transcripts 2026-05-18

// HF = R_Σ(t) / (0.10 · R_Σ(0)). reservePctOfInitial encodes (R_Σ(t)/R_Σ(0))·100,
// so HF = reservePctOfInitial / 10. HF=1.0 ⇔ liquidation threshold.
export function healthFactor(p: Position): number {
  return p.reservePctOfInitial / 10
}

// Band thresholds — not locked in spec (whitepaper only fixes HF=1.0 as the
// liquidation line). Conservative bands for the prototype.
export function healthBand(hf: number): 'red' | 'amber' | 'green' {
  if (hf < 1.1) return 'red'
  if (hf < 1.5) return 'amber'
  return 'green'
}
export function healthColor(hf: number): string {
  const band = healthBand(hf)
  return band === 'red'
    ? 'var(--color-status-danger)'
    : band === 'amber'
    ? 'var(--color-status-warning)'
    : 'var(--color-status-success)'
}

// PnL trio components — % of margin and APY-on-margin (P2 R-033/034: «к марже,
// не к notional»).
export function pnlPctOfMargin(p: Position, pnl: number): number {
  return (pnl / Math.max(1, p.marginValueUSD)) * 100
}
export function pnlApyOnMargin(p: Position, pnl: number): number {
  const hoursOpen = Math.max(0.5, (Date.now() - p.openedAt) / 3_600_000)
  const m = Math.max(1, p.marginValueUSD)
  return (pnl / m) * (8760 / hoursOpen) * 100
}

// «Hours of runway» — if price stays flat, how many hours until reserve is
// burned by carry. Useful KPI for trader to decide whether to top up margin
// proactively (P1 R-020, P2 R-046).
//
// reserveUSD / (carry $/h). When carry is negative (LP pays trader = subsidy)
// or near-zero, runway is infinite — we return null and the UI can render «∞».
export function estimateMarginRunwayHours(p: Position): number | null {
  const carry = estimateCarryPerHour(p)
  if (carry <= 0) return null
  return p.reserveUSD / carry
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

// Net APY (trader perspective) — what the trader expects to take home
// annualised at this listing's parameters. Signed value: positive means the
// position is currently set up to earn; negative means premium burn is
// expected to exceed payoff at current pool conditions.
//
// Eugene 2026-05-20: this is the marketplace ranking signal — «как заработок
// позиции, чтобы позиция была интересно и её можно было взять» (ТЗ §3.1 +
// P1 R-016). ТЗ §11 OQ-2 flagged the «Total APY» name as confusable with the
// LP-side «Premium + Uniswap» additive — we use «Net APY» on trader-side
// to avoid the collision.
//
// CURRENT FORMULA — ILLUSTRATIVE: uniswapApyBps (pool's realised yield) is
// used as a proxy for the trader's Impermanent Profit APY at this range.
// Real formula will plug in implied volatility × leverage when the protocol
// surfaces it. Per ТЗ §3.4 (P1 R-068) every IP-based figure carries a
// «historical, not predictive» caveat — surfacing UI must reflect that.
export function getNetApyBps(listing: Listing): number {
  return listing.uniswapApyBps - listing.minPremiumApyBps
}

// Split a USD amount into the pair's two token amounts at midprice
// (Uniswap V3 in-range ≈ 50/50). Returns null amounts for non-USD-quoted
// pairs (consumers fall back to USD-split display).
//
// Eugene 2026-05-20: lifted out of ListingDetail.tsx + TradeListingDetail.tsx
// (duplicate definitions left over from soft-split) so the marketplace table
// can also consume it for the per-asset Pool-size breakdown.
const STABLE_TOKENS = new Set(['USDC', 'USDT', 'DAI', 'PYUSD', 'crvUSD'])
export function splitToTokens(usd: number, listing: Listing): { t0Amt: number | null; t1Amt: number | null } {
  const half = usd / 2
  const t0IsUSD = STABLE_TOKENS.has(listing.pair.token0)
  const t1IsUSD = STABLE_TOKENS.has(listing.pair.token1)
  if (t1IsUSD) return { t0Amt: half / Math.max(listing.currentPrice, 1e-12), t1Amt: half }
  if (t0IsUSD) return { t0Amt: half, t1Amt: half * listing.currentPrice }
  return { t0Amt: null, t1Amt: null }
}

// Trader-relative listing status — what the current viewer (a trader) can
// DO with this listing, not just what the listing is.
//
// Eugene 2026-05-20: «У заявок от LP в сторону трейдеров... спроектируй
// статусную модель». The marketplace surface needs to surface every possible
// state with the right CTA, because trader actions diverge sharply by state.
//
// Resolution priority (top wins):
//   1. Listing-level terminal states (liquidating / liquidated / withdrawn / closing)
//   2. I have a position AND was outbid AND my margin is too low → out-of-margin
//   3. I have a position AND was outbid AND my margin is ok → outbid (can buyout back)
//   4. I have a position AND available capacity > 0 → open-and-mine
//   5. I have a position (no outbid, no available) → my-position
//   6. No my-position AND available <= 0 → full-buyout-only
//   7. Default → open
// Out-of-range is an overlay sub-modifier on 4-7 (active states), set
// separately so the chip can stack «open · out of range».

export type TraderListingChip =
  | 'open'
  | 'open-and-mine'
  | 'full-buyout-only'
  | 'my-position'
  | 'outbid'
  | 'out-of-margin'
  | 'closing'
  | 'liquidating'
  | 'liquidated'
  | 'withdrawn'

export type TraderCtaKind =
  | 'open'           // Open a new position on this listing
  | 'buyout'         // Take over an incumbent's slot (Premium APY higher)
  | 'manage'         // Drill into my position to manage it
  | 'add'            // Add more to my existing position (available > 0)
  | 'buyout-back'    // Re-buyout my own slot from whoever outbid me
  | 'top-up-margin'  // Out-of-margin: deposit more before I can buyout back
  | 'view'           // Read-only (terminal states)

export interface TraderListingStatus {
  chip: TraderListingChip
  outOfRange: boolean   // overlay sub-modifier for active states
  ctaPrimary: TraderCtaKind
  ctaSecondary?: TraderCtaKind
  /** True when the listing is not actionable (terminal or LP-exit). */
  terminal: boolean
}

// Out-of-margin threshold — when the trader was outbid and their remaining
// margin is below this $ floor, we surface «out-of-margin» instead of plain
// «outbid» (CTA flips from «buyout back» to «top up margin»). Heuristic; will
// be replaced by protocol-level «minimum buyout reserve» when that ships.
const OUT_OF_MARGIN_THRESHOLD_USD = 500

export function getTraderListingStatus(
  listing: Listing,
  allPositions: Position[],
  traderAddress: string,
): TraderListingStatus {
  // Terminal listing-level states win over everything else.
  if (listing.status === 'LIQUIDATING') {
    return { chip: 'liquidating', outOfRange: false, ctaPrimary: 'view', terminal: true }
  }
  if (listing.status === 'LIQUIDATED') {
    return { chip: 'liquidated', outOfRange: false, ctaPrimary: 'view', terminal: true }
  }
  if (listing.status === 'WITHDRAWN') {
    return { chip: 'withdrawn', outOfRange: false, ctaPrimary: 'view', terminal: true }
  }
  if (listing.status === 'WITHDRAWAL_REQUESTED') {
    return { chip: 'closing', outOfRange: false, ctaPrimary: 'view', terminal: true }
  }

  const myActive = allPositions.find(
    p => p.listingId === listing.id
      && p.trader === traderAddress
      && (p.status === 'OPEN' || p.status === 'CLOSE_REQUESTED' || p.status === 'OUTBID_PENDING')
  )
  const outOfRange = getRangeStatus(listing) === 'out-of-range'
  const hasAvailable = listing.availableCapacityUSD > 0.01

  // I have a position — branch by outbid + margin state.
  if (myActive) {
    if (myActive.status === 'OUTBID_PENDING') {
      const lowMargin = (myActive.marginValueUSD ?? 0) < OUT_OF_MARGIN_THRESHOLD_USD
      if (lowMargin) {
        return {
          chip: 'out-of-margin',
          outOfRange,
          ctaPrimary: 'top-up-margin',
          ctaSecondary: 'view',
          terminal: false,
        }
      }
      return {
        chip: 'outbid',
        outOfRange,
        ctaPrimary: 'buyout-back',
        ctaSecondary: 'top-up-margin',
        terminal: false,
      }
    }
    // Active position, no outbid
    if (hasAvailable) {
      return {
        chip: 'open-and-mine',
        outOfRange,
        ctaPrimary: 'manage',
        ctaSecondary: 'add',
        terminal: false,
      }
    }
    return { chip: 'my-position', outOfRange, ctaPrimary: 'manage', terminal: false }
  }

  // No position. Branch by available capacity.
  if (!hasAvailable) {
    return { chip: 'full-buyout-only', outOfRange, ctaPrimary: 'buyout', terminal: false }
  }
  return { chip: 'open', outOfRange, ctaPrimary: 'open', terminal: false }
}
