// Generator for diverse open positions — Maria's trader workflow demo.
// Mix статусов (OPEN majority, CLOSE_REQUESTED, OUTBID_PENDING, CLOSING),
// размеров, healths, PnL — для rich scan.

import type { Listing, Position, PositionStatus } from '@/lib/types'

const STATUS_POOL: PositionStatus[] = [
  ...Array(10).fill('OPEN' as PositionStatus),
  'CLOSE_REQUESTED', 'CLOSE_REQUESTED',
  'OUTBID_PENDING',
  'CLOSING',
]

function seedRng(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

interface GenOpts {
  listings: Listing[]
  trader: string
  count: number
  startId: number
  now: number
}

export function generatePositions({ listings, trader, count, startId, now }: GenOpts): Position[] {
  const rng = seedRng(123)
  const out: Position[] = []
  // shuffle status pool deterministic
  const statuses = [...STATUS_POOL]
  while (statuses.length < count) statuses.push('OPEN')
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[statuses[i], statuses[j]] = [statuses[j], statuses[i]]
  }

  // Use only ACTIVE listings not owned by trader (FULL retired — full capacity is now a display of ACTIVE+leased=100%)
  const tradableListings = listings.filter(l => l.owner !== trader && l.status === 'ACTIVE')
  if (tradableListings.length === 0) return out

  for (let i = 0; i < count; i++) {
    const listing = tradableListings[Math.floor(rng() * tradableListings.length)]
    const status = statuses[i]
    const subsidized = listing.minPremiumApyBps < 0

    // APY bid: ≥ listing min + 0..5 step
    const apyBps = listing.minPremiumApyBps + Math.floor(rng() * 5) * 100

    // Sizing
    const sizeBucket = rng()
    const notionalUSD = sizeBucket < 0.4
      ? 1_000 + Math.floor(rng() * 20_000) // small
      : sizeBucket < 0.85
      ? 20_000 + Math.floor(rng() * 80_000) // mid
      : 100_000 + Math.floor(rng() * 200_000) // large

    // Margin = notional / leverage where eff lev 5x-1000x
    const effectiveLeverage = 5 + Math.floor(rng() * 195)
    const marginValueUSD = notionalUSD / effectiveLeverage

    // Reserve health: skew toward healthy, but include some risky ones
    const healthRoll = rng()
    let reservePctOfInitial: number
    if (healthRoll < 0.1) reservePctOfInitial = 5 + Math.floor(rng() * 10) // critical 5-15%
    else if (healthRoll < 0.25) reservePctOfInitial = 15 + Math.floor(rng() * 20) // moderate 15-35%
    else reservePctOfInitial = 40 + Math.floor(rng() * 55) // healthy 40-95%
    const reserveUSD = marginValueUSD * (reservePctOfInitial / 100)

    // Accruing
    const pendingRefApyBps = Math.floor(listing.referenceApyBps * (0.5 + rng() * 1.5))
    const pendingPremApyBps = apyBps

    // Opened ago: 1min to 5 days
    const openedAt = now - Math.floor(rng() * 1000 * 60 * 60 * 24 * 5)

    // Margin split — assume 50/50 by value (token0/token1)
    const m0 = (marginValueUSD / 2) / listing.currentPrice
    const m1 = marginValueUSD / 2

    // Entry price: within range, with a slight bias from current
    const entryDriftPct = (rng() - 0.5) * 0.04 // ±2%
    const entryPrice = listing.currentPrice * (1 + entryDriftPct)
    void subsidized

    out.push({
      id: `Pg${startId + i}`,
      listingId: listing.id,
      trader,
      notionalUSD,
      apyBps,
      margin0: m0,
      margin1: m1,
      marginValueUSD,
      reserveUSD,
      reservePctOfInitial,
      effectiveLeverage,
      entryPrice,
      openedAtLeverage: effectiveLeverage + Math.floor(rng() * 30), // opened a bit higher, decayed
      pendingRefApyBps,
      pendingPremApyBps,
      status,
      openedAt,
      closeRequestedAt: status === 'CLOSE_REQUESTED' || status === 'CLOSING'
        ? now - Math.floor(rng() * 1000 * 60 * 5)
        : undefined,
    })
  }
  return out
}
