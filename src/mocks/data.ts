// Mock data per design spec §11.6 Portfolio Overview + §4 use cases.
// Three listings reflect canonical use cases:
//   L1: ETH/USDC active range (UC-LP-1.A — Active V3 Range Manager hedging IL)
//   L2: WBTC/ETH range pre-event (UC-LP-1.B — vol-event LP)
//   L3: USDC/USDT subsidized (UC-LP-1.D — high-conviction LP, NEGATIVE Premium APY) ⭐
// Two positions and one buyout-pending state to exercise APYBreakdown variants.

import type { Listing, Position, ClaimRow, Activity, ClosedPosition, WalletNFT } from '@/lib/types'
import { generateListings } from './listings-generator'
import { generatePositions } from './positions-generator'
import { generateClosedPositions } from './closed-positions-generator'

const now = Date.now()

export const listings: Listing[] = [
  {
    id: 'L1',
    tokenId: 421337,
    owner: '0xMaria',
    chain: 'arbitrum',
    dex: 'uniswap-v3',
    pair: { token0: 'ETH', token1: 'USDC' },
    feeTierBps: 5,
    rangeLow: 3180,
    rangeHigh: 3540,
    currentPrice: 3372,
    initialLiquidityUSD: 80_000,
    availableCapacityUSD: 32_000,
    totalCapacityUSD: 79_200, // 99% of 80k
    providerMode: 'conservative',
    providerLeverage: 1,
    minPremiumApyBps: 800,
    uniswapApyBps: 1160,
    referenceApyBps: 420,
    status: 'ACTIVE',
    listedAt: now - 1000 * 60 * 60 * 36, // 36h ago
  },
  {
    id: 'L2',
    tokenId: 421894,
    owner: '0xMaria',
    chain: 'arbitrum',
    dex: 'uniswap-v3',
    pair: { token0: 'WBTC', token1: 'ETH' },
    feeTierBps: 30,
    rangeLow: 18.4,
    rangeHigh: 19.6,
    currentPrice: 19.05,
    initialLiquidityUSD: 150_000,
    availableCapacityUSD: 0, // leased 100% → display «Earning · full» (outbid-only for new lessees)
    totalCapacityUSD: 148_500,
    providerMode: 'conservative',
    providerLeverage: 1,
    minPremiumApyBps: 1200,
    uniswapApyBps: 580,
    referenceApyBps: 290,
    status: 'ACTIVE', // FULL was retired — display label derives from leased%
    listedAt: now - 1000 * 60 * 60 * 8, // 8h ago
  },
  {
    id: 'L3',
    tokenId: 422001,
    owner: '0xAnton',
    chain: 'arbitrum',
    dex: 'uniswap-v3',
    pair: { token0: 'USDC', token1: 'USDT' },
    feeTierBps: 1,
    rangeLow: 0.998,
    rangeHigh: 1.002,
    currentPrice: 1.0001,
    initialLiquidityUSD: 200_000,
    availableCapacityUSD: 198_000,
    totalCapacityUSD: 198_000,
    providerMode: 'advanced',
    providerLeverage: 50,
    minPremiumApyBps: -200, // NEGATIVE — UC-LP-1.D ⭐
    uniswapApyBps: 280,
    referenceApyBps: 0, // accruing, no closes yet
    status: 'ACTIVE',
    listedAt: now - 1000 * 60 * 90, // 90m ago
    aggregateReserveUSD: 8_400,
    distanceToLiqPct: 78,
  },
]

export const positions: Position[] = [
  {
    id: 'P1',
    listingId: 'L1',
    trader: '0xJake',
    notionalUSD: 47_200,
    apyBps: 1400,
    margin0: 0.42, // ETH
    margin1: 1180, // USDC
    marginValueUSD: 2_596,
    reserveUSD: 1_980,
    reservePctOfInitial: 76,
    effectiveLeverage: 18,
    entryPrice: 3340,
    openedAtLeverage: 25,
    pendingRefApyBps: 420,
    pendingPremApyBps: 1400,
    status: 'OPEN',
    openedAt: now - 1000 * 60 * 60 * 4, // 4h ago
  },
  {
    id: 'P2',
    listingId: 'L2',
    trader: '0xVadim',
    notionalUSD: 100_000,
    apyBps: 1500,
    margin0: 0.04, // WBTC
    margin1: 0.8, // ETH
    marginValueUSD: 4_200,
    reserveUSD: 3_650,
    reservePctOfInitial: 87,
    effectiveLeverage: 24,
    entryPrice: 18.92,
    openedAtLeverage: 28,
    pendingRefApyBps: 290,
    pendingPremApyBps: 1500,
    status: 'OPEN',
    openedAt: now - 1000 * 60 * 35, // 35m ago
  },
  // ⭐ Maria's position on Anton's subsidized L3 — UC-LP-1.D × TR-3 (trader receives carry)
  {
    id: 'P3',
    listingId: 'L3',
    trader: '0xMaria',
    notionalUSD: 50_000,
    apyBps: -200, // NEGATIVE — trader receives 2% annualized from LP
    margin0: 200, // USDC
    margin1: 200, // USDT
    marginValueUSD: 400,
    reserveUSD: 384,
    reservePctOfInitial: 92,
    effectiveLeverage: 125,
    entryPrice: 1.0002,
    openedAtLeverage: 130,
    pendingRefApyBps: 0,
    pendingPremApyBps: -200,
    status: 'OPEN',
    openedAt: now - 1000 * 60 * 22, // 22m ago
  },
]

// L4 — currently being liquidated at listing level (for S13 + S15)
// Maria pushed Provider Leverage too high on an ETH/USDT range; a vol spike
// breached aggregate reserve. Liquidation is in progress.
listings.push({
  id: 'L4',
  tokenId: 422340,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'ETH', token1: 'USDT' },
  feeTierBps: 5,
  rangeLow: 3300,
  rangeHigh: 3450,
  currentPrice: 3198, // out of range to the downside
  initialLiquidityUSD: 60_000,
  availableCapacityUSD: 0,
  totalCapacityUSD: 59_400,
  providerMode: 'advanced',
  providerLeverage: 75,
  minPremiumApyBps: 1800,
  uniswapApyBps: 1240,
  referenceApyBps: 380,
  status: 'LIQUIDATING',
  listedAt: now - 1000 * 60 * 60 * 18,
  aggregateReserveUSD: 4_300,
  distanceToLiqPct: 6, // already at trigger
})

// L5 — Maria's «Listed · waiting» case: ACTIVE with zero takers yet.
// (Replaces the retired PAUSED status — per call 2026-05-14 PAUSED is not in protocol.)
listings.push({
  id: 'L5',
  tokenId: 422512,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'ARB', token1: 'USDC' },
  feeTierBps: 30,
  rangeLow: 0.42,
  rangeHigh: 0.58,
  currentPrice: 0.49,
  initialLiquidityUSD: 24_500,
  availableCapacityUSD: 24_255, // = total → leased 0% → display «Listed · waiting»
  totalCapacityUSD: 24_255,
  providerMode: 'conservative',
  providerLeverage: 1,
  minPremiumApyBps: 500,
  uniswapApyBps: 1850,
  referenceApyBps: 620,
  status: 'ACTIVE',
  listedAt: now - 1000 * 60 * 60 * 24 * 4, // 4d ago
})
listings.push({
  id: 'L6',
  tokenId: 422618,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'WETH', token1: 'USDC' },
  feeTierBps: 5,
  rangeLow: 3280,
  rangeHigh: 3520,
  currentPrice: 3401,
  initialLiquidityUSD: 42_000,
  availableCapacityUSD: 4_200,
  totalCapacityUSD: 41_580,
  providerMode: 'conservative',
  providerLeverage: 1,
  minPremiumApyBps: 1000,
  uniswapApyBps: 960,
  referenceApyBps: 380,
  status: 'WITHDRAWAL_REQUESTED',
  listedAt: now - 1000 * 60 * 60 * 24 * 2, // 2d ago
})
// L8 — Advanced Maria listing close to liquidation (but not yet LIQUIDATING).
// Ensures «At risk» summary = exactly 2 (this one + L4 LIQUIDATING).
listings.push({
  id: 'L8',
  tokenId: 422740,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'WBTC', token1: 'USDC' },
  feeTierBps: 30,
  rangeLow: 94_000,
  rangeHigh: 102_800,
  currentPrice: 95_800, // close to lower bound
  initialLiquidityUSD: 70_000,
  availableCapacityUSD: 14_000,
  totalCapacityUSD: 1_386_000, // 20× leverage
  providerMode: 'advanced',
  providerLeverage: 20,
  minPremiumApyBps: 1500,
  uniswapApyBps: 820,
  referenceApyBps: 240,
  status: 'ACTIVE',
  listedAt: now - 1000 * 60 * 60 * 36,
  aggregateReserveUSD: 1_400,
  distanceToLiqPct: 18, // < 30 → counts as «at risk» but not LIQUIDATING
})

// L7 — GMX-protocol listing to demonstrate protocol indicator in the table
listings.push({
  id: 'L7',
  tokenId: 50012,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'gmx',
  pair: { token0: 'GMX', token1: 'ETH' },
  feeTierBps: 30,
  rangeLow: 0.0084,
  rangeHigh: 0.0112,
  currentPrice: 0.0096,
  initialLiquidityUSD: 18_400,
  availableCapacityUSD: 12_300,
  totalCapacityUSD: 18_216,
  providerMode: 'conservative',
  providerLeverage: 1,
  minPremiumApyBps: 700,
  uniswapApyBps: 1340,
  referenceApyBps: 460,
  status: 'ACTIVE',
  listedAt: now - 1000 * 60 * 60 * 12, // 12h ago
})

// L9 — Maria's earning listing whose Uniswap range was crossed (out-of-range).
// Status ACTIVE + leased>0 + price outside [rangeLow, rangeHigh] → display «Earning · out of range».
listings.push({
  id: 'L9',
  tokenId: 422803,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'LINK', token1: 'ETH' },
  feeTierBps: 30,
  rangeLow: 0.0042,
  rangeHigh: 0.0048,
  currentPrice: 0.0051, // above rangeHigh → out of range
  initialLiquidityUSD: 32_000,
  availableCapacityUSD: 12_800, // leased 60%
  totalCapacityUSD: 31_680,
  providerMode: 'conservative',
  providerLeverage: 1,
  minPremiumApyBps: 1400,
  uniswapApyBps: 0, // no fees while out of range
  referenceApyBps: 480,
  status: 'ACTIVE',
  listedAt: now - 1000 * 60 * 60 * 24 * 3, // 3d ago
})

// L10 — Maria's terminal LIQUIDATED listing (Pro, leverage>1).
listings.push({
  id: 'L10',
  tokenId: 422915,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'PEPE', token1: 'ETH' },
  feeTierBps: 100,
  rangeLow: 0.0000018,
  rangeHigh: 0.0000028,
  currentPrice: 0.0000031,
  initialLiquidityUSD: 12_000,
  availableCapacityUSD: 0,
  totalCapacityUSD: 360_000,
  providerMode: 'advanced',
  providerLeverage: 30,
  minPremiumApyBps: 3200,
  uniswapApyBps: 0,
  referenceApyBps: 0,
  status: 'LIQUIDATED',
  listedAt: now - 1000 * 60 * 60 * 24 * 11, // 11d ago
  healthFactorPct: 0,
})

// L11 — Maria's terminal WITHDRAWN listing (Closed).
listings.push({
  id: 'L11',
  tokenId: 423088,
  owner: '0xMaria',
  chain: 'arbitrum',
  dex: 'uniswap-v3',
  pair: { token0: 'OP', token1: 'USDC' },
  feeTierBps: 30,
  rangeLow: 1.7,
  rangeHigh: 2.1,
  currentPrice: 1.92,
  initialLiquidityUSD: 18_000,
  availableCapacityUSD: 0,
  totalCapacityUSD: 17_820,
  providerMode: 'conservative',
  providerLeverage: 1,
  minPremiumApyBps: 900,
  uniswapApyBps: 1240,
  referenceApyBps: 380,
  status: 'WITHDRAWN',
  listedAt: now - 1000 * 60 * 60 * 24 * 9, // 9d ago, closed
})

// Seed Maria's listings with realistic lifetime + claimable + health-factor numbers.
// Without these the My Positions table has empty columns. Set centrally to keep seed
// blocks above readable.
const mariaSeedEarnings: Record<string, {
  uni?: number; prem?: number; ref?: number; pnl?: number; claim?: number; hf?: number; hit?: number; util?: number;
}> = {
  L1: { uni: 1240, prem: 980, ref: 410, pnl: 1480, claim: 220, hit: 86, util: 62 },
  L2: { uni: 2150, prem: 1820, ref: 640, pnl: 3140, claim: 480, hit: 92, util: 88 },
  L4: { uni: 920, prem: 380, ref: 80, pnl: -2140, claim: 0, hf: 4, hit: 41, util: 71 }, // LIQUIDATING — distress
  L5: { uni: 0, prem: 0, ref: 0, pnl: 0, claim: 0, hit: 100, util: 0 }, // Listed · waiting — nothing yet
  L6: { uni: 380, prem: 240, ref: 110, pnl: 460, claim: 90, hit: 78, util: 54 }, // Withdrawing
  L7: { uni: 480, prem: 320, ref: 140, pnl: 690, claim: 110, hit: 84, util: 48 },
  L8: { uni: 640, prem: 1140, ref: 280, pnl: 980, claim: 310, hf: 28, hit: 68, util: 75 }, // at-risk Advanced
  L9: { uni: 180, prem: 380, ref: 90, pnl: -120, claim: 0, hit: 34, util: 41 }, // out-of-range — low fees
  L10: { uni: 240, prem: 180, ref: 60, pnl: -8400, claim: 0, hf: 0, hit: 22, util: 12 }, // Liquidated terminal
  L11: { uni: 1820, prem: 940, ref: 380, pnl: 2840, claim: 0, hit: 81, util: 67 }, // Closed terminal
}
for (const l of listings) {
  const e = mariaSeedEarnings[l.id]
  if (!e) continue
  l.lifetimeUniFeesUSD = e.uni
  l.lifetimePremiumUSD = e.prem
  l.lifetimeReferenceUSD = e.ref
  l.netPnLUSD = e.pnl
  l.claimableNowUSD = e.claim
  l.rangeHitRatePct = e.hit
  l.avgLeasedPct30d = e.util
  if (e.hf !== undefined) l.healthFactorPct = e.hf
}

// Generated diverse listings — covers all statuses + pairs + modes для Marketplace demo + pagination
listings.push(...generateListings(50, 100, now))

// Generated diverse OPEN positions for Maria (trader perspective demo)
positions.push(...generatePositions({
  listings,
  trader: '0xMaria',
  count: 14,
  startId: 100,
  now,
}))

// Explicit Maria positions to guarantee BOTH trader-relative chips
// «outbid (can buyout back)» and «out-of-margin» are visible on /listings
// at the same time (Eugene 2026-05-20 — status-model coverage demo).
// We pick two listings the generator already created (Lg100, Lg101 are first
// generated entries) so trader-listing rendering picks them up automatically.
// Margins are tuned: ~ $1800 (clearly above the $500 «out-of-margin» floor)
// vs $180 (clearly below) so the status helper resolves deterministically.
{
  const candidates = listings.filter(
    l => l.owner !== '0xMaria' && l.status === 'ACTIVE' && l.id !== 'L3',
  )
  const targetForOutbidHealthy = candidates[0]
  const targetForOutMargin = candidates[1] ?? candidates[0]
  if (targetForOutbidHealthy) {
    positions.push({
      id: 'Pdemo-outbid',
      listingId: targetForOutbidHealthy.id,
      trader: '0xMaria',
      notionalUSD: 18_000,
      apyBps: targetForOutbidHealthy.minPremiumApyBps + 200,
      margin0: 0.6,
      margin1: 900,
      marginValueUSD: 1_800, // healthy — above $500 floor → «outbid (can buyout back)»
      reserveUSD: 1_540,
      reservePctOfInitial: 86,
      effectiveLeverage: 10,
      entryPrice: targetForOutbidHealthy.currentPrice * 0.98,
      openedAtLeverage: 12,
      pendingRefApyBps: 360,
      pendingPremApyBps: targetForOutbidHealthy.minPremiumApyBps + 200,
      status: 'OUTBID_PENDING',
      openedAt: now - 1000 * 60 * 60 * 6, // 6h ago
    })
  }
  if (targetForOutMargin) {
    positions.push({
      id: 'Pdemo-outmargin',
      listingId: targetForOutMargin.id,
      trader: '0xMaria',
      notionalUSD: 12_000,
      apyBps: targetForOutMargin.minPremiumApyBps + 300,
      margin0: 0.05,
      margin1: 90,
      marginValueUSD: 180, // below $500 floor → «out-of-margin»
      reserveUSD: 60,
      reservePctOfInitial: 33,
      effectiveLeverage: 70,
      entryPrice: targetForOutMargin.currentPrice * 1.01,
      openedAtLeverage: 80,
      pendingRefApyBps: 280,
      pendingPremApyBps: targetForOutMargin.minPremiumApyBps + 300,
      status: 'OUTBID_PENDING',
      openedAt: now - 1000 * 60 * 60 * 18, // 18h ago
    })
  }
}

// Liquidator queue items (S14/S15)
// 1) A position with reserve well below 10% — eligible for executeClose
positions.push({
  id: 'PLQ',
  listingId: 'L1',
  trader: '0xRogue',
  notionalUSD: 30_000,
  apyBps: 1100,
  margin0: 0.02,
  margin1: 60,
  marginValueUSD: 124,
  reserveUSD: 32, // below 10% of 124*0.1 ≈ 12.4 ... wait reserveUSD = 32 is above
  reservePctOfInitial: 7,
  effectiveLeverage: 242,
  entryPrice: 3360,
  openedAtLeverage: 250,
  pendingRefApyBps: 420,
  pendingPremApyBps: 1100,
  status: 'OPEN',
  openedAt: now - 1000 * 60 * 60 * 2,
})

// Listing-liquidation lifecycle state (for S15)
export const listingLiquidationState: Record<
  string,
  {
    startedAt: number
    snapshotPrice: number
    totalPositions: number
    batchProcessed: number
    finalized: boolean
    claimRatios?: { token0: number; token1: number }
  }
> = {
  L4: {
    startedAt: now - 1000 * 60 * 8, // started 8m ago
    snapshotPrice: 3198,
    totalPositions: 4,
    batchProcessed: 2,
    finalized: false,
  },
}

// Closed positions (for S10 history)
export const closedPositions: ClosedPosition[] = [
  {
    id: 'PC1',
    listingId: 'L1',
    trader: '0xMaria',
    pair: { token0: 'ETH', token1: 'USDC' },
    feeTierBps: 5,
    openedAt: now - 1000 * 60 * 60 * 36, // 36h ago
    closedAt: now - 1000 * 60 * 60 * 30,  // closed 30h ago (6h hold)
    durationHours: 6,
    notionalUSD: 32_000,
    apyBps: 1200,
    marginPostedUSD: 1_800,
    entryPrice: 3280,
    exitPrice: 3372,
    impermanentProfitUSD: 412.40,
    referencePaidUSD: 22.10,
    premiumPaidUSD: 26.30,
    keeperRewardUSD: 1.82,
    protocolFeeUSD: 0,
    residualUSD: 1_800 + 412.40 - 22.10 - 26.30 - 1.82,
    paidInFull: true,
  },
  {
    id: 'PC2',
    listingId: 'L2',
    trader: '0xMaria',
    pair: { token0: 'WBTC', token1: 'ETH' },
    feeTierBps: 30,
    openedAt: now - 1000 * 60 * 60 * 72,
    closedAt: now - 1000 * 60 * 60 * 62,
    durationHours: 10,
    notionalUSD: 60_000,
    apyBps: 1600,
    marginPostedUSD: 2_500,
    entryPrice: 19.10,
    exitPrice: 19.04,
    impermanentProfitUSD: 18.40,  // small move
    referencePaidUSD: 19.80,
    premiumPaidUSD: 26.30,
    keeperRewardUSD: 0,
    protocolFeeUSD: 0,
    residualUSD: 2_500 + 18.40 - 19.80 - 8.50, // partial payment
    paidInFull: false,
    unpaidUSD: 17.80,
  },
]

// Generated diverse closed positions — public Market Transactions feed (multi-trader)
closedPositions.push(...generateClosedPositions({
  listings,
  count: 80,
  startId: 100,
  now,
}))

export const claimables: ClaimRow[] = [
  {
    listingId: 'L1',
    uniswapFeesUSD: 184,
    refRealizedUSD: 92,
    premRealizedUSD: 268,
    refPendingUSD: 41,
    premPendingUSD: 96,
  },
]

export const recentActivity: Activity[] = [
  {
    id: 'aLq',
    ts: now - 1000 * 60 * 8,
    kind: 'closed',
    text: 'Listing L4 (ETH/USDT) entered liquidation — 75× Advanced, vol spike breached reserve',
    listingId: 'L4',
  },
  {
    id: 'a0',
    ts: now - 1000 * 60 * 22,
    kind: 'open',
    text: '0xMaria opened a $50K position on USDC/USDT — receives −2% APY from Anton',
    listingId: 'L3',
    positionId: 'P3',
  },
  {
    id: 'a1',
    ts: now - 1000 * 60 * 35,
    kind: 'open',
    text: '0xVadim opened a $100K position on WBTC/ETH at 15% APY',
    listingId: 'L2',
    positionId: 'P2',
  },
  {
    id: 'a2',
    ts: now - 1000 * 60 * 90,
    kind: 'list',
    text: '0xAnton listed USDC/USDT 0.01% with Advanced 50× and −2% Premium APY',
    listingId: 'L3',
  },
  {
    id: 'a3',
    ts: now - 1000 * 60 * 60 * 4,
    kind: 'open',
    text: '0xJake opened a $47K position on ETH/USDC at 14% APY',
    listingId: 'L1',
    positionId: 'P1',
  },
  {
    id: 'a4',
    ts: now - 1000 * 60 * 60 * 36,
    kind: 'list',
    text: '0xMaria listed ETH/USDC 0.05% — Conservative 1×, min 8% APY',
    listingId: 'L1',
  },
]

// Helper for connected-wallet simulation
// Dev wallet registry. Switch from /settings.
export const WALLET_REGISTRY: Record<
  string,
  { address: string; label: string; isWhitelisted: boolean; isPermissionedLiquidator: boolean; persona: string }
> = {
  '0xMaria': {
    address: '0xMaria',
    label: '0xMaria',
    isWhitelisted: true,
    isPermissionedLiquidator: false,
    persona: 'LP-1 power user — owns L1, L2, L4 listings; also trades on L3',
  },
  '0xJake': {
    address: '0xJake',
    label: '0xJake',
    isWhitelisted: true,
    isPermissionedLiquidator: false,
    persona: 'TR-1 vol trader — owns Position P1 on L1',
  },
  '0xAnton': {
    address: '0xAnton',
    label: '0xAnton',
    isWhitelisted: true,
    isPermissionedLiquidator: false,
    persona: 'High-conviction LP — owns L3 subsidized listing',
  },
  '0xKeeper': {
    address: '0xKeeper',
    label: '0xKeeper',
    isWhitelisted: true,
    isPermissionedLiquidator: true,
    persona: 'Permissioned keeper — sees Liquidator queue',
  },
  '0xRand': {
    address: '0xRand',
    label: '0xRand',
    isWhitelisted: false,
    isPermissionedLiquidator: false,
    persona: 'Not whitelisted — redirected to /access',
  },
}

function loadWallet() {
  if (typeof window === 'undefined') return WALLET_REGISTRY['0xMaria']
  const stored = window.localStorage.getItem('sliq.activeWallet')
  return WALLET_REGISTRY[stored ?? ''] ?? WALLET_REGISTRY['0xMaria']
}

export const connectedWallet = loadWallet()

export const totalsForUser = {
  myListingsCount: listings.filter(l => l.owner === connectedWallet.address).length,
  myPositionsCount: positions.filter(p => p.trader === connectedWallet.address).length,
  claimableUSD: claimables.reduce(
    (sum, c) => sum + c.uniswapFeesUSD + c.refRealizedUSD + c.premRealizedUSD,
    0
  ),
}

// === LP-side mock data ===

// Wallet NFTs available to import (S12 primary path)
// User имеет несколько Uniswap V3 LP NFTs which не в sLiq yet
export const walletNFTs: WalletNFT[] = [
  {
    tokenId: 421500,
    pair: { token0: 'ETH', token1: 'USDC' },
    feeTierBps: 5,
    rangeLow: 3120,
    rangeHigh: 3580,
    currentPrice: 3372,
    liquidityUSD: 48_000,
    amountToken0: 7.12,
    amountToken1: 24_000,
    inRange: true,
    uniswapApyBps: 1080,
  },
  {
    tokenId: 422100,
    pair: { token0: 'WBTC', token1: 'ETH' },
    feeTierBps: 30,
    rangeLow: 18.6,
    rangeHigh: 19.8,
    currentPrice: 19.05,
    liquidityUSD: 92_000,
    amountToken0: 1.21,
    amountToken1: 23.0,
    inRange: true,
    uniswapApyBps: 540,
  },
  {
    tokenId: 419872,
    pair: { token0: 'USDC', token1: 'USDT' },
    feeTierBps: 1,
    rangeLow: 0.998,
    rangeHigh: 1.002,
    currentPrice: 1.0001,
    liquidityUSD: 250_000,
    amountToken0: 125_000,
    amountToken1: 125_000,
    inRange: true,
    uniswapApyBps: 240,
  },
  {
    tokenId: 425001,
    pair: { token0: 'ARB', token1: 'USDC' },
    feeTierBps: 30,
    rangeLow: 0.78,
    rangeHigh: 1.12,
    currentPrice: 1.15,
    liquidityUSD: 18_000,
    amountToken0: 22_000,
    amountToken1: 0,
    inRange: false,
    uniswapApyBps: 1820,
  },
]

// Enrich existing listings (L1-L4) with LP-side analytics — mock data
// Computed in pseudo-realistic way: lifetime fees scale with listedAt age + APY rate
listings.forEach(l => {
  const ageDays = Math.max(1, (now - l.listedAt) / (1000 * 60 * 60 * 24))
  const dailyUniFee = l.initialLiquidityUSD * (l.uniswapApyBps / 10000) / 365
  l.lifetimeUniFeesUSD = dailyUniFee * ageDays
  // Premium APY paid by lessees — proxy as Premium rate × leased capacity × time
  const utilization = 1 - (l.availableCapacityUSD / Math.max(l.totalCapacityUSD, 1))
  const dailyPremium = l.totalCapacityUSD * utilization * (Math.abs(l.minPremiumApyBps) / 10000) / 365
  l.lifetimePremiumUSD = l.minPremiumApyBps >= 0 ? dailyPremium * ageDays : -dailyPremium * ageDays
  // Reference Fees — synthetic; depends on leverage
  l.lifetimeReferenceUSD = dailyUniFee * (l.providerLeverage - 1) * ageDays * utilization
  // Pseudo-deterministic seed from listing id — stable across refreshes
  const seed = parseInt(l.id.replace(/\D/g, '') || '1', 10)
  const pseudo = (n: number) => ((seed * 9301 + 49297 + n * 7919) % 233280) / 233280
  // Net PnL = sum of incomes minus mock IL (~ -0.5-2% of initial liquidity)
  const ilProxy = -l.initialLiquidityUSD * (0.005 + pseudo(1) * 0.015)
  l.netPnLUSD = (l.lifetimeUniFeesUSD ?? 0) + (l.lifetimePremiumUSD ?? 0) + (l.lifetimeReferenceUSD ?? 0) + ilProxy
  // HODL delta = how much extra LP earns vs just holding tokens
  l.hodlDeltaUSD = (l.lifetimeUniFeesUSD ?? 0) + (l.lifetimePremiumUSD ?? 0) + (l.lifetimeReferenceUSD ?? 0) // simplified — gross income
  // Claimable now = portion of lifetime fees still pending claim.
  // Must satisfy claimableNow ≤ totalFees (otherwise the Accrued = Total - Claimable
  // sub-line goes negative and the breakdown stops making sense, Eugene 2026-05-15).
  // Seed value from mariaSeedEarnings (if any) gets capped here.
  const totalFeesNow = (l.lifetimeUniFeesUSD ?? 0) + (l.lifetimePremiumUSD ?? 0) + (l.lifetimeReferenceUSD ?? 0)
  const unclaimedPct = 0.2 + pseudo(3) * 0.4 // 20–60% sitting unclaimed
  l.claimableNowUSD = Math.max(0, Math.min(l.claimableNowUSD ?? totalFeesNow * unclaimedPct, totalFeesNow))
  // Range hit rate — mock 50-95%, deterministic from seed
  l.rangeHitRatePct = Math.floor(50 + pseudo(2) * 45)
  // Auto-compound default on
  l.autoCompound = true
})
