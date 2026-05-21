// Generator for diverse mock listings — covers all statuses, pair classes, modes, leverages.
// Used to populate Marketplace при 50+ listings для demo пагинации и status legend.

import type { DexProtocol, Listing, ListingStatus, ProviderMode } from '@/lib/types'

const PAIRS: Array<{ pair: { token0: string; token1: string }; basePrice: number; volBucket: 'stable' | 'major' | 'mid' | 'shit' }> = [
  // Stables — small range, stable-coin pairs
  { pair: { token0: 'USDC', token1: 'USDT' }, basePrice: 1.0001, volBucket: 'stable' },
  { pair: { token0: 'DAI', token1: 'USDC' }, basePrice: 0.9998, volBucket: 'stable' },
  { pair: { token0: 'USDC', token1: 'PYUSD' }, basePrice: 1.0002, volBucket: 'stable' },
  { pair: { token0: 'crvUSD', token1: 'USDC' }, basePrice: 0.9996, volBucket: 'stable' },
  // Major — ETH/BTC pairs
  { pair: { token0: 'ETH', token1: 'USDC' }, basePrice: 3372, volBucket: 'major' },
  { pair: { token0: 'WBTC', token1: 'ETH' }, basePrice: 19.05, volBucket: 'major' },
  { pair: { token0: 'WBTC', token1: 'USDC' }, basePrice: 64200, volBucket: 'major' },
  { pair: { token0: 'ETH', token1: 'USDT' }, basePrice: 3370, volBucket: 'major' },
  { pair: { token0: 'cbBTC', token1: 'USDC' }, basePrice: 64190, volBucket: 'major' },
  // Liquid-staked / pegged
  { pair: { token0: 'ETH', token1: 'wstETH' }, basePrice: 0.858, volBucket: 'stable' },
  { pair: { token0: 'cbETH', token1: 'ETH' }, basePrice: 1.024, volBucket: 'stable' },
  { pair: { token0: 'rETH', token1: 'ETH' }, basePrice: 1.105, volBucket: 'stable' },
  // Mid-cap
  { pair: { token0: 'ARB', token1: 'USDC' }, basePrice: 0.78, volBucket: 'mid' },
  { pair: { token0: 'OP', token1: 'USDC' }, basePrice: 1.92, volBucket: 'mid' },
  { pair: { token0: 'LINK', token1: 'ETH' }, basePrice: 0.0042, volBucket: 'mid' },
  { pair: { token0: 'UNI', token1: 'ETH' }, basePrice: 0.0032, volBucket: 'mid' },
  // Shitcoins / long-tail
  { pair: { token0: 'PEPE', token1: 'ETH' }, basePrice: 0.0000023, volBucket: 'shit' },
  { pair: { token0: 'DOGE', token1: 'ETH' }, basePrice: 0.000037, volBucket: 'shit' },
  { pair: { token0: 'SHIB', token1: 'ETH' }, basePrice: 0.0000045, volBucket: 'shit' },
  { pair: { token0: 'MOG', token1: 'ETH' }, basePrice: 0.0000019, volBucket: 'shit' },
]

const FEE_TIERS_BY_VOL: Record<string, number[]> = {
  stable: [1, 5],
  major: [5, 30],
  mid: [30, 100],
  shit: [30, 100],
}

const OWNERS = ['0xMaria', '0xAnton', '0xJake', '0xVadim', '0xKira', '0xLeo', '0xElena', '0xMark', '0xSveta', '0xRosa']

// PRNG для детерминированных значений
function seedRng(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

export function generateListings(count: number, startId: number, now: number): Listing[] {
  const rng = seedRng(42)
  const out: Listing[] = []
  // Status distribution per call 2026-05-14: only 5 statuses now. FULL/PAUSED are
  // not statuses, they're display-derived (leased%=100 → «Earning · full»; the old
  // PAUSED slot becomes ACTIVE+leased=0% → «Listed · waiting» display).
  // Leased % is encoded later via availableCapacityUSD.
  const statusPool: ListingStatus[] = [
    ...Array(Math.floor(count * 0.79)).fill('ACTIVE' as ListingStatus), // 79% ACTIVE (covers waiting/earning/full via leased%)
    ...Array(Math.floor(count * 0.08)).fill('WITHDRAWAL_REQUESTED' as ListingStatus),
    ...Array(Math.floor(count * 0.05)).fill('LIQUIDATING' as ListingStatus),
    ...Array(Math.floor(count * 0.05)).fill('LIQUIDATED' as ListingStatus),
    ...Array(Math.floor(count * 0.03)).fill('WITHDRAWN' as ListingStatus),
  ]
  while (statusPool.length < count) statusPool.push('ACTIVE')
  // shuffle deterministic
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]]
  }

  // Eugene 2026-05-20: «первые пулы сделай с ETH связанные, не Doge».
  // Bias the first ~15 generated entries to major / stable ETH-related pairs
  // so the marketplace lands on a clean «familiar» first page. Long-tail
  // shitcoins still appear, just deeper in the list.
  const eth_related = PAIRS.filter(
    p => p.volBucket === 'major' || p.volBucket === 'stable',
  )
  for (let i = 0; i < count; i++) {
    const pool = i < 15 ? eth_related : PAIRS
    const pairDef = pool[Math.floor(rng() * pool.length)]
    const fees = FEE_TIERS_BY_VOL[pairDef.volBucket]
    const feeTierBps = fees[Math.floor(rng() * fees.length)]

    // Range width depends on vol bucket
    const widthPct =
      pairDef.volBucket === 'stable'
        ? 0.002 + rng() * 0.004 // 0.2-0.6%
        : pairDef.volBucket === 'major'
        ? 0.04 + rng() * 0.1 // 4-14%
        : pairDef.volBucket === 'mid'
        ? 0.08 + rng() * 0.2 // 8-28%
        : 0.15 + rng() * 0.4 // 15-55% for shitcoins

    const rangeLow = pairDef.basePrice * (1 - widthPct)
    const rangeHigh = pairDef.basePrice * (1 + widthPct)

    // Maybe out of range
    const outOfRange = rng() < 0.18
    const direction = rng() < 0.5 ? -1 : 1
    const currentPrice = outOfRange
      ? pairDef.basePrice * (1 + direction * widthPct * 1.4)
      : pairDef.basePrice * (1 + (rng() - 0.5) * widthPct * 1.5)

    // Mode mix
    const isAdvanced = rng() < 0.35
    const providerMode: ProviderMode = isAdvanced ? 'advanced' : 'conservative'
    const providerLeverage = isAdvanced
      ? (rng() < 0.5 ? 5 + Math.floor(rng() * 20) : 25 + Math.floor(rng() * 75))
      : 1

    // Min APY — sign-aware: most positive, ~5% chance negative (only advanced + stable)
    let minPremiumApyBps: number
    const subsidized = isAdvanced && pairDef.volBucket === 'stable' && rng() < 0.5
    if (subsidized) {
      minPremiumApyBps = -100 * (1 + Math.floor(rng() * 4)) // -1% to -4%
    } else if (pairDef.volBucket === 'stable') {
      minPremiumApyBps = 100 + Math.floor(rng() * 400) // 1-5%
    } else if (pairDef.volBucket === 'major') {
      minPremiumApyBps = 600 + Math.floor(rng() * 1600) // 6-22%
    } else if (pairDef.volBucket === 'mid') {
      minPremiumApyBps = 1200 + Math.floor(rng() * 2400) // 12-36%
    } else {
      minPremiumApyBps = 2000 + Math.floor(rng() * 5000) // 20-70% for shitcoins
    }
    // Round to APY step (100 bps = 1%)
    minPremiumApyBps = Math.round(minPremiumApyBps / 100) * 100

    // Yields based on volBucket
    const uniswapApyBps =
      pairDef.volBucket === 'stable'
        ? 100 + Math.floor(rng() * 500)
        : pairDef.volBucket === 'major'
        ? 500 + Math.floor(rng() * 1500)
        : pairDef.volBucket === 'mid'
        ? 800 + Math.floor(rng() * 2000)
        : 1500 + Math.floor(rng() * 4000)
    const referenceApyBps = Math.floor(uniswapApyBps * (0.3 + rng() * 0.5))

    // Capacity
    const initialLiquidityUSD =
      pairDef.volBucket === 'stable'
        ? 50_000 + Math.floor(rng() * 1_000_000)
        : pairDef.volBucket === 'major'
        ? 30_000 + Math.floor(rng() * 500_000)
        : pairDef.volBucket === 'mid'
        ? 10_000 + Math.floor(rng() * 100_000)
        : 3_000 + Math.floor(rng() * 30_000)
    const totalCapacityUSD = initialLiquidityUSD * 0.99 * providerLeverage
    const status = statusPool[i] ?? 'ACTIVE'
    // Leased distribution for ACTIVE listings now spans the full display spectrum:
    // ~15% sit at 0% (Listed · waiting), ~15% at 100% (Earning · full), the rest partial.
    let filledPct: number
    if (status === 'LIQUIDATING' || status === 'WITHDRAWAL_REQUESTED') {
      filledPct = 0.85 + rng() * 0.1
    } else if (status === 'LIQUIDATED' || status === 'WITHDRAWN') {
      filledPct = 0
    } else {
      const r = rng()
      filledPct = r < 0.15 ? 0 : r > 0.85 ? 1 : 0.05 + rng() * 0.9
    }
    const availableCapacityUSD = totalCapacityUSD * (1 - filledPct)

    const aggregateReserveUSD = isAdvanced
      ? totalCapacityUSD * (0.03 + rng() * 0.15)
      : undefined
    // Distance to liq: at-risk band (< 30) reserved for LIQUIDATING + specific seed listings.
    // Generated Advanced listings stay in safe band 35-95 to avoid bloating «At risk» metric.
    const distanceToLiqPct = isAdvanced
      ? status === 'LIQUIDATING'
        ? Math.floor(rng() * 8)
        : 35 + Math.floor(rng() * 60)
      : undefined

    // Health Factor — Aave-style 0-100, only for leverage>1 (call 2026-05-14 @01:19:48).
    // Inverse-correlated with distanceToLiqPct: closer to liq = lower HF.
    const healthFactorPct = isAdvanced && providerLeverage > 1
      ? status === 'LIQUIDATING'
        ? Math.floor(rng() * 15)
        : Math.max(20, Math.min(98, (distanceToLiqPct ?? 60) + Math.floor(rng() * 10)))
      : undefined

    const owner = OWNERS[Math.floor(rng() * OWNERS.length)]
    const listedAt = now - Math.floor(rng() * 1000 * 60 * 60 * 24 * 7) // up to 7 days ago

    // DEX mix: predominantly Uniswap V3, sprinkle GMX + PancakeSwap для multi-DEX демо
    const dexRoll = rng()
    let dex: DexProtocol = 'uniswap-v3'
    if (dexRoll < 0.08) dex = 'gmx'
    else if (dexRoll < 0.16) dex = 'pancakeswap-v3'
    else if (dexRoll < 0.22) dex = 'uniswap-v4'

    out.push({
      id: `Lg${startId + i}`,
      tokenId: 500_000 + startId + i,
      owner,
      chain: 'arbitrum',
      dex,
      pair: pairDef.pair,
      feeTierBps,
      rangeLow,
      rangeHigh,
      currentPrice,
      initialLiquidityUSD,
      availableCapacityUSD,
      totalCapacityUSD,
      providerMode,
      providerLeverage,
      minPremiumApyBps,
      uniswapApyBps,
      referenceApyBps,
      status,
      listedAt,
      aggregateReserveUSD,
      distanceToLiqPct,
      healthFactorPct,
    })
  }
  return out
}
