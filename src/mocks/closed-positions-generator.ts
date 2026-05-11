// Generator for diverse closed positions — public Market Transactions feed.
// Mix of traders, pairs, outcomes (paid/partial/liquidated), durations, sizes.

import type { ClosedPosition, Listing } from '@/lib/types'

function seedRng(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

const TRADER_POOL = [
  '0xJake',
  '0xVadim',
  '0xMaria',
  '0xAnton',
  '0xRogue',
  '0xKai',
  '0xLeo',
  '0xZara',
  '0xMira',
  '0xNoah',
  '0xPhil',
  '0xRuby',
  '0xSami',
  '0xTara',
  '0xUmar',
  '0xVera',
  '0xWyatt',
  '0xYara',
]

interface GenOpts {
  listings: Listing[]
  count: number
  startId: number
  now: number
}

export function generateClosedPositions({ listings, count, startId, now }: GenOpts): ClosedPosition[] {
  const rng = seedRng(7531)
  const out: ClosedPosition[] = []
  const usable = listings.filter(l => l.status !== 'WITHDRAWN')
  if (usable.length === 0) return out

  for (let i = 0; i < count; i++) {
    const listing = usable[Math.floor(rng() * usable.length)]
    const trader = TRADER_POOL[Math.floor(rng() * TRADER_POOL.length)]
    const subsidized = listing.minPremiumApyBps < 0

    const sizeBucket = rng()
    const notionalUSD = sizeBucket < 0.45
      ? 1_000 + Math.floor(rng() * 20_000)
      : sizeBucket < 0.85
      ? 20_000 + Math.floor(rng() * 80_000)
      : 100_000 + Math.floor(rng() * 200_000)

    const effectiveLeverage = 5 + Math.floor(rng() * 195)
    const marginPostedUSD = notionalUSD / effectiveLeverage

    // Hold duration: 1h - 96h
    const durationHours = 1 + Math.floor(rng() * 96)
    const closedAt = now - Math.floor(rng() * 1000 * 60 * 60 * 24 * 14) // up to 14d ago
    const openedAt = closedAt - durationHours * 1000 * 60 * 60

    const apyBps = listing.minPremiumApyBps + Math.floor(rng() * 5) * 100

    // Outcome distribution: 60% paid in full, 25% partial, 10% small win, 5% liquidated-like
    const outcome = rng()
    const ipMultiplier = outcome < 0.4
      ? 0.005 + rng() * 0.05  // good IP move +0.5-5.5% of notional
      : outcome < 0.7
      ? -0.002 + rng() * 0.02 // small change
      : -0.03 + rng() * 0.01 // adverse

    const impermanentProfitUSD = notionalUSD * ipMultiplier
    const refPaidUSD = (notionalUSD * listing.referenceApyBps / 10000) * (durationHours / (365 * 24))
    const premPaidUSD = (notionalUSD * apyBps / 10000) * (durationHours / (365 * 24))
    const keeperRewardUSD = rng() < 0.05 ? marginPostedUSD * 0.01 : 0
    const protocolFeeUSD = 0

    const grossResidual = marginPostedUSD + impermanentProfitUSD - refPaidUSD - premPaidUSD - keeperRewardUSD
    const liquidated = rng() < 0.06 // ~6% liquidation rate в feed (visible terror)
    const paidInFull = !liquidated && grossResidual >= 0 && rng() > 0.18
    const residualUSD = liquidated
      ? 0
      : paidInFull ? Math.max(0, grossResidual) : Math.max(0, grossResidual + (rng() * marginPostedUSD * 0.3))
    const unpaidUSD = paidInFull ? undefined : Math.abs(refPaidUSD + premPaidUSD) * (0.1 + rng() * 0.4)

    // Entry / exit prices around listing's range
    const entryDriftPct = (rng() - 0.5) * 0.06 // ±3%
    const entryPrice = listing.currentPrice * (1 + entryDriftPct)
    // Derive exit price from ipMultiplier sign (positive IP = price moved away from entry, in either direction)
    const moveDirection = rng() < 0.5 ? -1 : 1
    const moveMagnitude = Math.sqrt(Math.abs(ipMultiplier) * 100) / 100 // crude inverse
    const exitPrice = entryPrice * (1 + moveDirection * moveMagnitude)

    out.push({
      id: `PC${startId + i}`,
      listingId: listing.id,
      trader,
      pair: { ...listing.pair },
      feeTierBps: listing.feeTierBps,
      openedAt,
      closedAt,
      durationHours,
      notionalUSD,
      apyBps: subsidized ? listing.minPremiumApyBps : apyBps,
      marginPostedUSD,
      entryPrice,
      exitPrice,
      impermanentProfitUSD,
      referencePaidUSD: refPaidUSD,
      premiumPaidUSD: premPaidUSD,
      keeperRewardUSD,
      protocolFeeUSD,
      residualUSD,
      paidInFull,
      unpaidUSD,
      liquidated,
    })
  }

  // Sort newest first
  out.sort((a, b) => b.closedAt - a.closedAt)
  return out
}
