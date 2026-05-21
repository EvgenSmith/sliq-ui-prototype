// MarketView — aggregated order-book view (Eugene 2026-05-21).
// Built per the 2026-05-18 trader review call + post-meeting reference.
//
// Architecture:
//   • Listings are aggregated by (pair × DEX × feeTierBps × rangeLow × rangeHigh)
//     using strict tick-exact range equality (Kolya: «ренж в тик-в-тик одинаковые
//     риски — иначе математически не сводится»).
//   • Each market is rendered as a card with a header row + 3-pane body:
//     LongPool orders (LP-side) / Active positions (matched) / ShortPool orders
//     (trader-side). On mobile the 3 panes stack vertically in order Long →
//     Active → Short per Kolya's preferred reading order.
//   • Sort: by total Liquidity descending (default — Eugene 2026-05-21).
//   • Filter: pair, fee tier (reuses existing marketplace-constants).
//   • Active panel highlights MY positions with a 🙂 prefix.
//   • Many positions in any pane → aggregate to min / max / count + total
//     liquidity, but always keep MY position visible verbatim.
//
// Naming: «LongPool» / «ShortPool» labels kept as-is for now (Kolya: «давайте
// пока так оставим»), with explicit subtitles «Provide liquidity» / «Open
// position» so a fresh trader can read the intent without protocol jargon.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectedWallet, listings, positions } from '@/mocks/data'
import type { Listing, Position } from '@/lib/types'
import { capacityFreePct, getRangeStatus, isSubsidized, pairLabel } from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtPriceShort, fmtUSD } from '@/lib/format'
import { FEE_TIER_OPTIONS } from '@/lib/marketplace-constants'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import { RangeBar } from '@/components/RangeBar'

// ─── Aggregated market shape ────────────────────────────────────────────
export interface AggregatedMarket {
  key: string                              // pair · feeTier · rangeLow · rangeHigh
  pair: { token0: string; token1: string }
  dex: Listing['dex']
  feeTierBps: number
  rangeLow: number
  rangeHigh: number
  currentPrice: number                     // midpoint of all listings on this range
  inRangePct: number                       // 0..100, distance from range center
  rangeWidthPct: number                    // (high - low) / current * 100
  totalLiquidityUSD: number                // Σ initialLiquidityUSD across listings
  uniswapApyBps: number                    // representative pool APY (avg over listings)
  longPoolOrders: PoolOrder[]              // LP-side orders, sorted desc by Premium APY
  activePositions: ActiveRow[]             // matched LP↔trader pairings
  shortPoolOrders: PoolOrder[]             // trader-side orders, sorted asc by Premium APY
  myInActive: boolean                      // any of my positions in active rows?
  /** Optional demo-card tag (e.g. «populated example», «my position in
   *  LongPool») shown as a chip in the header. */
  demoLabel?: string
  /** Opt-in dense rendering mode for the panes — replaces the head-limit
   *  truncation with internal scroll + sticky header + cumulative depth.
   *  Eugene 2026-05-21 — demoed how 100+ orders render in the populated
   *  demo card. */
  dense?: boolean
}

interface PoolOrder {
  premiumApyBps: number
  liquidityUSD: number
  isMine?: boolean
}

interface ActiveRow {
  premiumApyBps: number
  liquidityUSD: number
  isMine: boolean                          // highlights with 🙂 per Kolya
}

// ─── Aggregation logic ──────────────────────────────────────────────────
export function buildMarkets(allListings: Listing[], allPositions: Position[]): AggregatedMarket[] {
  // Bucket listings by tick-exact (pair × dex × fee × rangeLow × rangeHigh)
  const buckets = new Map<string, Listing[]>()
  for (const l of allListings) {
    if (l.status !== 'ACTIVE') continue        // terminal listings excluded from book
    const k = `${l.pair.token0}/${l.pair.token1}|${l.dex}|${l.feeTierBps}|${l.rangeLow}|${l.rangeHigh}`
    const arr = buckets.get(k) ?? []
    arr.push(l)
    buckets.set(k, arr)
  }

  const out: AggregatedMarket[] = []
  for (const [key, group] of buckets) {
    const sample = group[0]
    const totalLiquidityUSD = group.reduce((s, l) => s + l.initialLiquidityUSD, 0)
    const avgPrice = group.reduce((s, l) => s + l.currentPrice, 0) / group.length
    const avgUniswapApy = Math.round(group.reduce((s, l) => s + l.uniswapApyBps, 0) / group.length)
    const rangeWidthPct = ((sample.rangeHigh - sample.rangeLow) / avgPrice) * 100
    const distFromCenter = Math.abs(avgPrice - (sample.rangeLow + sample.rangeHigh) / 2)
    const halfSpan = (sample.rangeHigh - sample.rangeLow) / 2
    const inRangePct = halfSpan > 0
      ? Math.max(0, Math.min(100, Math.round((1 - distFromCenter / halfSpan) * 100)))
      : 0

    // LongPool orders = listings that aren't fully filled (have available capacity)
    // grouped by their Min Premium APY (their «ask» price).
    const longOrders = new Map<number, number>()
    for (const l of group) {
      if (l.availableCapacityUSD <= 0.01) continue
      const ap = roundBps(l.minPremiumApyBps)
      longOrders.set(ap, (longOrders.get(ap) ?? 0) + l.availableCapacityUSD)
    }
    const longPoolOrders: PoolOrder[] = [...longOrders.entries()]
      .map(([premiumApyBps, liquidityUSD]) => ({ premiumApyBps, liquidityUSD }))
      .sort((a, b) => b.premiumApyBps - a.premiumApyBps)

    // Active positions = trader OPEN positions on any listing in the bucket,
    // grouped by Premium APY they're paying.
    const activeByApy = new Map<number, { liquidityUSD: number; mine: boolean }>()
    for (const l of group) {
      const traderPositions = allPositions.filter(p => p.listingId === l.id && p.status === 'OPEN')
      for (const p of traderPositions) {
        const ap = roundBps(p.apyBps)
        const cur = activeByApy.get(ap) ?? { liquidityUSD: 0, mine: false }
        cur.liquidityUSD += p.notionalUSD
        if (p.trader === connectedWallet.address) cur.mine = true
        activeByApy.set(ap, cur)
      }
    }
    const activePositions: ActiveRow[] = [...activeByApy.entries()]
      .map(([premiumApyBps, v]) => ({
        premiumApyBps,
        liquidityUSD: v.liquidityUSD,
        isMine: v.mine,
      }))
      .sort((a, b) => b.premiumApyBps - a.premiumApyBps)
    const myInActive = activePositions.some(p => p.isMine)

    // ShortPool orders = trader bids willing to take liquidity but not yet
    // matched (mock: derive from OUTBID_PENDING positions + a synthetic
    // negative-APY entry to represent subsidized demand). In a real protocol
    // this is the order-book bottom half maintained on-chain.
    const shortOrders = new Map<number, number>()
    for (const l of group) {
      // Pending: trader was outbid here. Their last bid is still in the book
      // as a willingness-to-pay marker.
      const pending = allPositions.filter(p => p.listingId === l.id && p.status === 'OUTBID_PENDING')
      for (const p of pending) {
        const ap = roundBps(p.apyBps)
        shortOrders.set(ap, (shortOrders.get(ap) ?? 0) + p.notionalUSD)
      }
    }
    // Synthetic — show subsidized demand always so traders can see «LP would
    // need to pay me 10% for me to take this listing». Real protocol would
    // pull these from real on-chain orders.
    if (isSubsidized(sample)) {
      shortOrders.set(sample.minPremiumApyBps, (shortOrders.get(sample.minPremiumApyBps) ?? 0) + totalLiquidityUSD * 0.2)
    }
    const shortPoolOrders: PoolOrder[] = [...shortOrders.entries()]
      .map(([premiumApyBps, liquidityUSD]) => ({ premiumApyBps, liquidityUSD }))
      .sort((a, b) => a.premiumApyBps - b.premiumApyBps)

    out.push({
      key,
      pair: sample.pair,
      dex: sample.dex,
      feeTierBps: sample.feeTierBps,
      rangeLow: sample.rangeLow,
      rangeHigh: sample.rangeHigh,
      currentPrice: avgPrice,
      inRangePct,
      rangeWidthPct,
      totalLiquidityUSD,
      uniswapApyBps: avgUniswapApy,
      longPoolOrders,
      activePositions,
      shortPoolOrders,
      myInActive,
    })
  }
  return out
}

function roundBps(bps: number): number {
  // Round to 1% step (100 bps) to align with the 1%-step input contract.
  return Math.round(bps / 100) * 100
}

// ─── Demo markets ──────────────────────────────────────────────────────
// Persistent example cards pinned at the top of the list (Eugene
// 2026-05-21). Each demonstrates a specific render state so the team
// can see how the card behaves without having to find a real listing
// in that state:
//   1. populated     — exactly one entry in each pane (no «mine»)
//   2. my-long       — my order in LongPool
//   3. my-active     — my matched position in Active
//   4. my-short      — my order in ShortPool
//
// Demos are NOT filterable / sortable — they always render first.
export function buildDemoMarkets(): AggregatedMarket[] {
  const baseEth = (extras: Partial<AggregatedMarket> & { demoLabel: string }): AggregatedMarket => ({
    key: `demo-${extras.demoLabel}`,
    pair: { token0: 'ETH', token1: 'USDC' },
    dex: 'uniswap-v3',
    feeTierBps: 5,
    rangeLow: 3200,
    rangeHigh: 3500,
    currentPrice: 3370,
    inRangePct: 88,
    rangeWidthPct: 9.1,
    totalLiquidityUSD: 0,
    uniswapApyBps: 1240,
    longPoolOrders: [],
    activePositions: [],
    shortPoolOrders: [],
    myInActive: false,
    ...extras,
  })

  // Dense demo — synthesise ~30 unique-APY orders per pane with declining
  // liquidity at the edges (matches what an actively-traded market looks
  // like: thick midbook, thin tails). Eugene 2026-05-21 — «как будет
  // отображаться по 100 заявок в каждом стакане». Demo card opts into
  // `dense` rendering so the panes scroll internally.
  function densePool(centerApyBps: number, direction: 1 | -1, count: number, peakUSD: number): PoolOrder[] {
    const out: PoolOrder[] = []
    for (let i = 0; i < count; i++) {
      const apy = centerApyBps + direction * (i + 1) * 100
      // Bell-ish liquidity — peak near center, decay at edges
      const decay = Math.exp(-Math.pow(i / (count / 2.5), 2))
      out.push({ premiumApyBps: apy, liquidityUSD: Math.round(peakUSD * (0.4 + decay * 0.6)) })
    }
    return out
  }
  function denseActive(centerApyBps: number, count: number, peakUSD: number): ActiveRow[] {
    const out: ActiveRow[] = []
    for (let i = 0; i < count; i++) {
      const apy = centerApyBps + (i - Math.floor(count / 2)) * 100
      const decay = Math.exp(-Math.pow((i - count / 2) / (count / 3), 2))
      out.push({
        premiumApyBps: apy,
        liquidityUSD: Math.round(peakUSD * (0.3 + decay * 0.7)),
        isMine: i === Math.floor(count * 0.55),
      })
    }
    return out
  }

  return [
    baseEth({
      demoLabel: '~100 orders per pane',
      dense: true,
      totalLiquidityUSD: 350_000,
      // LongPool — LP-asks descending. Top of book = highest Premium APY
      // (LP wants more). 30 entries fanning out from 30%.
      longPoolOrders: densePool(3000, -1, 30, 12_000),
      // Active — 25 rows centered around 5% clearing rate. My row inside.
      activePositions: denseActive(500, 25, 9_500),
      // ShortPool — trader-bids ascending. Top of book = lowest Premium APY
      // (trader wants to pay less). 30 entries.
      shortPoolOrders: densePool(400, -1, 30, 11_000).reverse(),
      myInActive: true,
    }),
    baseEth({
      demoLabel: 'my LongPool order',
      totalLiquidityUSD: 22_000,
      longPoolOrders: [
        { premiumApyBps: 1200, liquidityUSD: 6_000 },
        { premiumApyBps: 800, liquidityUSD: 5_000, isMine: true },
      ],
      activePositions: [{ premiumApyBps: 600, liquidityUSD: 7_000, isMine: false }],
      shortPoolOrders: [{ premiumApyBps: 200, liquidityUSD: 4_000 }],
    }),
    baseEth({
      demoLabel: 'my Active position',
      totalLiquidityUSD: 19_500,
      longPoolOrders: [{ premiumApyBps: 900, liquidityUSD: 4_500 }],
      activePositions: [
        { premiumApyBps: 700, liquidityUSD: 5_000, isMine: false },
        { premiumApyBps: 400, liquidityUSD: 7_000, isMine: true },
      ],
      shortPoolOrders: [{ premiumApyBps: 100, liquidityUSD: 3_000 }],
      myInActive: true,
    }),
    baseEth({
      demoLabel: 'my ShortPool order',
      totalLiquidityUSD: 16_000,
      longPoolOrders: [{ premiumApyBps: 1100, liquidityUSD: 5_500 }],
      activePositions: [{ premiumApyBps: 600, liquidityUSD: 4_500, isMine: false }],
      shortPoolOrders: [
        { premiumApyBps: 300, liquidityUSD: 3_000, isMine: true },
        { premiumApyBps: 0, liquidityUSD: 3_000 },
      ],
    }),
  ]
}

// ─── Component ─────────────────────────────────────────────────────────
export function MarketView() {
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [feeTiersOn, setFeeTiersOn] = useState<Set<number>>(
    () => new Set(FEE_TIER_OPTIONS.map(o => o.bps))
  )
  const [rangeStatus, setRangeStatus] = useState<'all' | 'in' | 'out'>('all')
  /** Range width buckets — Eugene 2026-05-21 («ренджи добавить в фильтрацию»).
   * Tight: < 5% — convex IP, high churn, narrow LP risk.
   * Medium: 5-20% — typical major-pair range.
   * Wide: > 20% — passive LP, long-tail / volatile pairs.
   */
  const [rangeWidth, setRangeWidth] = useState<'all' | 'tight' | 'medium' | 'wide'>('all')
  const [dexFilter, setDexFilter] = useState<'all' | Listing['dex']>('all')
  /** Specific range key (`rangeLow|rangeHigh`) — only visible / usable when
   *  a single pair is selected. Eugene 2026-05-21: «ренджей же может быть
   *  много, как такое спроектировать в фильтр» — answer: gate on pair so
   *  the dropdown has bounded options. */
  const [specificRange, setSpecificRange] = useState<string>('all')
  const [sort, setSort] = useState<'liquidity-desc' | 'apy-desc'>('liquidity-desc')
  const [pageSize, setPageSize] = useState<number>(10)
  const [page, setPage] = useState<number>(1)

  const markets = useMemo(() => buildMarkets(listings, positions), [])
  const demos = useMemo(() => buildDemoMarkets(), [])

  const allPairs = useMemo(() => {
    const set = new Set<string>()
    markets.forEach(m => set.add(`${m.pair.token0}/${m.pair.token1}`))
    return Array.from(set).sort()
  }, [markets])

  // Specific ranges for the currently selected pair — sorted by total
  // liquidity desc so the most popular ranges come first in the dropdown.
  const rangesForPair = useMemo(() => {
    if (pairFilter === 'all') return [] as { key: string; label: string; liquidityUSD: number }[]
    const items = markets
      .filter(m => `${m.pair.token0}/${m.pair.token1}` === pairFilter)
      .map(m => ({
        key: `${m.rangeLow}|${m.rangeHigh}`,
        label: `${fmtPriceShort(m.rangeLow)} – ${fmtPriceShort(m.rangeHigh)} · ${m.rangeWidthPct.toFixed(1)}%`,
        liquidityUSD: m.totalLiquidityUSD,
      }))
    // Dedup (same range can appear via multiple fee tiers); pick largest
    // liquidity entry per range key.
    const byKey = new Map<string, { key: string; label: string; liquidityUSD: number }>()
    for (const it of items) {
      const cur = byKey.get(it.key)
      if (!cur || it.liquidityUSD > cur.liquidityUSD) byKey.set(it.key, it)
    }
    return [...byKey.values()].sort((a, b) => b.liquidityUSD - a.liquidityUSD)
  }, [markets, pairFilter])

  // Whenever the pair filter changes, reset the specific-range selection
  // (the previously selected range no longer makes sense for the new pair).
  useEffect(() => { setSpecificRange('all') }, [pairFilter])

  const filtered = useMemo(() => {
    let out = [...markets]
    if (pairFilter !== 'all') {
      out = out.filter(m => `${m.pair.token0}/${m.pair.token1}` === pairFilter)
    }
    out = out.filter(m => feeTiersOn.has(m.feeTierBps))
    if (dexFilter !== 'all') out = out.filter(m => m.dex === dexFilter)
    if (specificRange !== 'all' && pairFilter !== 'all') {
      out = out.filter(m => `${m.rangeLow}|${m.rangeHigh}` === specificRange)
    }
    if (rangeWidth !== 'all') {
      out = out.filter(m => {
        const w = m.rangeWidthPct
        if (rangeWidth === 'tight') return w < 5
        if (rangeWidth === 'medium') return w >= 5 && w <= 20
        return w > 20 // wide
      })
    }
    if (rangeStatus !== 'all') {
      const wantIn = rangeStatus === 'in'
      out = out.filter(m => {
        // Synthesise a Listing-like object for getRangeStatus reuse.
        const inR = m.currentPrice >= m.rangeLow && m.currentPrice <= m.rangeHigh
        return wantIn ? inR : !inR
      })
    }
    switch (sort) {
      case 'liquidity-desc':
        out.sort((a, b) => b.totalLiquidityUSD - a.totalLiquidityUSD)
        break
      case 'apy-desc':
        out.sort((a, b) => {
          // Best Premium APY in active or long pool — what a trader is offered.
          const ax = a.activePositions[0]?.premiumApyBps ?? a.longPoolOrders[0]?.premiumApyBps ?? -Infinity
          const bx = b.activePositions[0]?.premiumApyBps ?? b.longPoolOrders[0]?.premiumApyBps ?? -Infinity
          return bx - ax
        })
        break
    }
    return out
  }, [markets, pairFilter, feeTiersOn, rangeStatus, rangeWidth, dexFilter, specificRange, sort])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-semibold tracking-widest text-[var(--color-status-success)]">Market</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
            Beta · Pro
          </span>
        </div>
        <h1 className="text-2xl font-semibold mt-1">Aggregated positions and orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          {filtered.length} {filtered.length === 1 ? 'market' : 'markets'} · Complete
        </p>
      </header>

      {/* Filter / sort strip. Eugene 2026-05-21 — DEX first («фильтр на
          протокол должен быть первым»), then pair / fee / range filters. */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
        <select
          value={dexFilter}
          onChange={e => setDexFilter(e.target.value as typeof dexFilter)}
          className={selectCls(dexFilter !== 'all')}
          aria-label="DEX protocol"
        >
          <option value="all">All protocols</option>
          <option value="uniswap-v3">Uniswap v3</option>
          <option value="uniswap-v4">Uniswap v4</option>
          <option value="pancakeswap-v3">PancakeSwap v3</option>
          <option value="gmx">GMX</option>
          <option value="other">Other</option>
        </select>

        <select
          value={pairFilter}
          onChange={e => setPairFilter(e.target.value)}
          className={selectCls(pairFilter !== 'all')}
          aria-label="Pair"
        >
          <option value="all">All pairs</option>
          {allPairs.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={feeTiersOn.size === FEE_TIER_OPTIONS.length ? 'all' : Array.from(feeTiersOn)[0]?.toString() ?? 'all'}
          onChange={e => {
            const v = e.target.value
            if (v === 'all') setFeeTiersOn(new Set(FEE_TIER_OPTIONS.map(o => o.bps)))
            else setFeeTiersOn(new Set([Number(v)]))
          }}
          className={selectCls(feeTiersOn.size !== FEE_TIER_OPTIONS.length)}
          aria-label="Fee tier"
        >
          <option value="all">All fee tiers</option>
          {FEE_TIER_OPTIONS.map(opt => (
            <option key={opt.bps} value={opt.bps}>{opt.label}</option>
          ))}
        </select>

        <select
          value={rangeStatus}
          onChange={e => setRangeStatus(e.target.value as typeof rangeStatus)}
          className={selectCls(rangeStatus !== 'all')}
          aria-label="Range status"
        >
          <option value="all">In + out of range</option>
          <option value="in">In range only</option>
          <option value="out">Out of range only</option>
        </select>

        <select
          value={rangeWidth}
          onChange={e => setRangeWidth(e.target.value as typeof rangeWidth)}
          className={selectCls(rangeWidth !== 'all')}
          aria-label="Range width"
        >
          <option value="all">All widths</option>
          <option value="tight">Tight · &lt; 5%</option>
          <option value="medium">Medium · 5–20%</option>
          <option value="wide">Wide · &gt; 20%</option>
        </select>

        {/* Specific-range picker — only visible when a single pair is
            selected (otherwise the option count would explode). Lists the
            actual ranges that exist for that pair, sorted by liquidity. */}
        {pairFilter !== 'all' && rangesForPair.length > 1 && (
          <select
            value={specificRange}
            onChange={e => setSpecificRange(e.target.value)}
            className={selectCls(specificRange !== 'all')}
            aria-label="Specific range for selected pair"
          >
            <option value="all">All {rangesForPair.length} ranges</option>
            {rangesForPair.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
          <span>Sort</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="liquidity-desc">Liquidity ↓ (default)</option>
            <option value="apy-desc">Best Premium APY ↓</option>
          </select>
        </div>
      </div>

      {/* Demo cards — persistent examples pinned above real markets so the
          team can see how each render state behaves (Eugene 2026-05-21). */}
      <div className="space-y-4 mb-4">
        {demos.map(m => (
          <MarketCard key={m.key} market={m} />
        ))}
      </div>

      {/* Pagination meta */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-gray-500">
          <span>
            Showing {pageSize === -1
              ? filtered.length
              : Math.min(filtered.length, (page - 1) * pageSize + 1) + '–' + Math.min(filtered.length, page * pageSize)
            } of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Page size</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={-1}>All</option>
            </select>
          </div>
        </div>
      )}

      {/* Market cards */}
      <div className="space-y-4">
        {(() => {
          if (pageSize === -1) return filtered.map(m => <MarketCard key={m.key} market={m} />)
          const start = (page - 1) * pageSize
          return filtered.slice(start, start + pageSize).map(m => <MarketCard key={m.key} market={m} />)
        })()}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <p className="text-sm text-gray-600 mb-1">No markets match current filters.</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Try a wider pair / fee tier / range selection.
            </p>
            {(pairFilter !== 'all' || feeTiersOn.size !== FEE_TIER_OPTIONS.length || rangeStatus !== 'all' || dexFilter !== 'all' || rangeWidth !== 'all' || specificRange !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setPairFilter('all')
                  setFeeTiersOn(new Set(FEE_TIER_OPTIONS.map(o => o.bps)))
                  setRangeStatus('all')
                  setDexFilter('all')
                  setRangeWidth('all')
                  setSpecificRange('all')
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {(() => {
        if (pageSize === -1 || filtered.length <= pageSize) return null
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
        const safePage = Math.min(page, totalPages)
        return (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="text-xs px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500 num px-2">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="text-xs px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Per-market card ───────────────────────────────────────────────────
function MarketCard({ market }: { market: AggregatedMarket }) {
  const navigate = useNavigate()
  // `inRange` flag no longer surfaced on card header — RangeBar handles it.
  void navigate
  void getRangeStatus
  void pairLabel

  // Action modals.
  const [longOpen, setLongOpen] = useState(false)
  const [shortOpen, setShortOpen] = useState(false)
  const [prefillLongApy, setPrefillLongApy] = useState<number | null>(null)
  const [prefillShortApy, setPrefillShortApy] = useState<number | null>(null)
  // Full-book modal — opened by «tap to expand» footer or pane background.
  const [bookSide, setBookSide] = useState<null | 'long' | 'active' | 'short'>(null)
  function openLongAt(apyBps: number | null) {
    setPrefillLongApy(apyBps)
    setLongOpen(true)
  }
  function openShortAt(apyBps: number | null) {
    setPrefillShortApy(apyBps)
    setShortOpen(true)
  }

  return (
    <div className={'rounded-lg border bg-white ' + (market.myInActive ? 'border-[var(--color-role-lp)]/40' : 'border-gray-200')}>
      {/* Header — chip row + RangeBar visual replacing the text price-range
          strip (Eugene 2026-05-21: «может Price range и inrange показывать
          графичком как на /listings»). */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3 flex-wrap">
        <div className="inline-flex items-baseline gap-2 flex-wrap min-w-0">
          <h2 className="text-base font-semibold">
            <button
              type="button"
              onClick={() => navigate(`/market/${encodeURIComponent(market.key)}`)}
              className="hover:text-[var(--color-role-trader)] hover:underline transition cursor-pointer"
              title="Drill into the full order book for this market"
            >
              {market.pair.token0} / {market.pair.token1}
            </button>
          </h2>
          {/* Verified / unverified chip dropped per Eugene 2026-05-21 — not
              useful as designed; real product will surface this via the
              token-list integration if at all. `isVerifiedPair` helper kept
              below for reference / future re-introduction. */}
          <span className="text-[11px] text-gray-500">Uniswap v3</span>
          <span className="text-[11px] font-medium text-gray-600 num">{fmtFeeTier(market.feeTierBps)} fee</span>
          {market.myInActive && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-semibold">
              my position
            </span>
          )}
          {market.demoLabel && (
            <span
              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-semibold"
              title="Persistent demo card — illustrates one rendering state of the market view."
            >
              demo · {market.demoLabel}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 min-w-0">
          {/* Liquidity-only text now — range width is read off the bar,
              «inrange %» moved inside RangeBar next to current price (Eugene
              2026-05-21). Two signals, not four. */}
          <div className="text-[11px] num text-gray-700">
            <span className="text-gray-500">Liquidity</span>{' '}
            <span className="font-semibold">{fmtUSD(market.totalLiquidityUSD)}</span>
          </div>
          <div className="w-64 max-w-full">
            <RangeBar
              rangeLow={market.rangeLow}
              rangeHigh={market.rangeHigh}
              currentPrice={market.currentPrice}
              inRangePct={market.inRangePct}
            />
          </div>
        </div>
      </div>

      {/* 3-pane body — md+ grid, mobile vertical stack in order Long → Active → Short
          per Kolya 2026-05-18: «сначала лонг пулы с большим премиум, потом
          активные, потом шорт пулы с низким премиум — видно как рынок двигается». */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        <PoolPane
          title="LongPool orders"
          subtitle="Provide liquidity"
          orders={market.longPoolOrders}
          onCta={() => openLongAt(null)}
          onRowClick={apy => openLongAt(apy)}
          onExpand={() => setBookSide('long')}
          tone="long"
        />
        <ActivePane
          market={market}
          onRowClick={apy => openShortAt(apy)}
          onExpand={() => setBookSide('active')}
        />
        <PoolPane
          title="ShortPool orders"
          subtitle="Open position"
          orders={market.shortPoolOrders}
          onCta={() => openShortAt(null)}
          onRowClick={apy => openShortAt(apy)}
          onExpand={() => setBookSide('short')}
          tone="short"
        />
      </div>

      {/* Modals — open from CTA buttons OR row clicks in the panes above. */}
      <MarketActionModal
        key={`long-${prefillLongApy ?? 'cta'}`}
        open={longOpen}
        side="long"
        market={market}
        prefillApyBps={prefillLongApy}
        onClose={() => setLongOpen(false)}
      />
      <MarketActionModal
        key={`short-${prefillShortApy ?? 'cta'}`}
        open={shortOpen}
        side="short"
        market={market}
        prefillApyBps={prefillShortApy}
        onClose={() => setShortOpen(false)}
      />
      <OrderBookModal
        market={market}
        side={bookSide}
        onClose={() => setBookSide(null)}
        onRowClick={apy => {
          if (bookSide === 'long') openLongAt(apy)
          else openShortAt(apy)
          setBookSide(null)
        }}
      />
    </div>
  )
}

// ─── MarketActionModal — Open LongPool / Open ShortPool ─────────────────
// Eugene 2026-05-21 Phase F. Compact form built on HighStakesConfirmModal:
// the action isn't nuclear (existing positions stay protected; trader can
// always close), so we use the same `compact` treatment as Top-up margin
// and Update leverage modals — drops the before/after card / risks list /
// confirm-gating, keeps the X close + Submit footer.
//
// Side semantics:
//   • «long» — trader becomes LP. Protocol mints a V3 NFT at the market's
//     range with the entered Premium APY as the LP-ask (minimum the LP is
//     willing to accept). Margin + leverage form the position size.
//   • «short» — trader takes LP liquidity. Same form, but Premium APY is
//     the trader-bid (what they're willing to PAY). Identical math to the
//     existing /listings/:id Open Position flow, just pre-scoped to the
//     aggregated market.
//
// Defaults:
//   • Margin USD = $1,000 (matches OpenPositionForm).
//   • Leverage = 1000× (Eugene 2026-05-20 «maximally efficient» framing).
//   • Premium APY = sensible bid/ask suggestion derived from the order book
//     (top of book + 1pp for short; bottom of book − 1pp for long).

function MarketActionModal({
  open,
  side,
  market,
  prefillApyBps,
  onClose,
}: {
  open: boolean
  side: 'long' | 'short'
  market: AggregatedMarket
  /** Optional pre-fill from a row click in one of the panes. */
  prefillApyBps?: number | null
  onClose: () => void
}) {
  // Suggested Premium APY based on the order book.
  const suggested = (() => {
    if (side === 'short') {
      const best = market.activePositions[0]?.premiumApyBps
        ?? market.longPoolOrders[0]?.premiumApyBps
        ?? 0
      return best + 100 // outbid top of book by 1pp
    }
    // long: undercut the cheapest LP ask so trader becomes the best provider
    const cheapest = market.longPoolOrders[market.longPoolOrders.length - 1]?.premiumApyBps ?? 100
    return Math.max(100, cheapest - 100)
  })()
  const initialApy = prefillApyBps ?? suggested

  const [marginUSD, setMarginUSD] = useState(1000)
  const [leverage, setLeverage] = useState(1000)
  const [apyBps, setApyBps] = useState(initialApy)

  // Reset state when modal closes (so reopening it gets fresh defaults).
  // The HighStakesConfirmModal also clears its internal state on close;
  // we mirror that here for our own inputs.
  // Note: relying on open→false to reset; consumers re-mount via key if needed.

  const isLong = side === 'long'
  const virtualNotional = marginUSD * leverage
  const apyPct = apyBps / 100

  // Live preview math (same proxies as OpenPositionForm — keep prototype
  // numbers consistent across screens).
  const carryPerHour = (virtualNotional * apyBps / 10000) / 8760
  const carryPerDay = carryPerHour * 24
  const liqDistancePct = (0.9 / leverage) * 100

  const sideMeta = isLong
    ? {
        title: 'Open LongPool',
        subtitle: 'Provide liquidity to this range. Protocol mints a V3 NFT under your address — you earn Uniswap fees + the Premium APY you ask, you carry IL.',
        ctaLabel: 'Confirm — open LongPool',
        accent: 'var(--color-role-lp)',
        apyHint: 'Min Premium APY you accept (LP ask). Lower → more likely to match faster; higher → bigger income when matched.',
      }
    : {
        title: 'Open ShortPool',
        subtitle: 'Open a trader position at this range. You pay Uniswap fees + the Premium APY you bid; you earn Impermanent Profit when price moves.',
        ctaLabel: 'Confirm — open ShortPool',
        accent: 'var(--color-role-trader)',
        apyHint: 'Premium APY you bid (trader pays this). Higher → outbids cheaper LP-asks → faster fill. Lower → cheaper carry but may not fill.',
      }

  return (
    <HighStakesConfirmModal
      open={open}
      compact
      title={sideMeta.title}
      subtitle={sideMeta.subtitle}
      topSlot={(
        <div className="space-y-3">
          {/* Market context — pair + range + current price + Uniswap APY */}
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="font-semibold">
                {market.pair.token0} / {market.pair.token1}
                <span className="text-gray-500 font-normal ml-1">{fmtFeeTier(market.feeTierBps)}</span>
              </span>
              <span className="num text-[var(--color-status-success)] font-semibold">
                Uniswap APY {fmtPct(market.uniswapApyBps)}
              </span>
            </div>
            <div className="num text-[11px] text-gray-600">
              Range <span className="text-gray-900 font-medium">{fmtPriceShort(market.rangeLow)} – {fmtPriceShort(market.rangeHigh)}</span>
              <span className="text-gray-400"> · </span>
              Current <span className="text-gray-900 font-medium">{fmtPriceShort(market.currentPrice)}</span>
            </div>
          </div>

          {/* Margin input — USD with ± + presets */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Margin</label>
              <span className="text-[10px] text-gray-500">USD</span>
            </div>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setMarginUSD(v => Math.max(50, v - 250))}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                aria-label="Decrease margin"
              >−</button>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="number"
                  min={50}
                  step={250}
                  value={marginUSD}
                  onChange={e => setMarginUSD(Math.max(50, Number(e.target.value) || 50))}
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-lp)] focus:outline-none transition text-center"
                />
              </div>
              <button
                type="button"
                onClick={() => setMarginUSD(v => v + 250)}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                aria-label="Increase margin"
              >+</button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[500, 1000, 5000, 10000].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMarginUSD(p)}
                  className={
                    'px-2 py-1.5 text-[11px] font-medium rounded border transition num ' +
                    (marginUSD === p
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500')
                  }
                >${(p / 1000).toFixed(p < 1000 ? 2 : 0)}{p >= 1000 ? 'K' : ''}</button>
              ))}
            </div>
          </div>

          {/* Leverage slider */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Leverage</label>
              <span className="text-sm font-semibold num text-gray-900">{leverage}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={1000}
              step={1}
              value={leverage}
              onChange={e => setLeverage(Number(e.target.value))}
              className="w-full accent-[var(--color-role-trader)]"
            />
            <div className="grid grid-cols-4 gap-0.5 mt-1.5 text-[10px] num text-gray-500">
              {[1, 100, 500, 1000].map(tick => (
                <button
                  key={tick}
                  type="button"
                  onClick={() => setLeverage(tick)}
                  className={
                    'py-0.5 rounded transition ' +
                    (leverage === tick
                      ? 'bg-gray-900 text-white font-semibold'
                      : 'hover:bg-gray-100')
                  }
                >{tick}×</button>
              ))}
            </div>
          </div>

          {/* Premium APY input */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 inline-flex items-center gap-1">
                Premium APY
                <HelpPopover label={isLong ? 'LP ask' : 'Trader bid'} width="w-72">
                  <p>{sideMeta.apyHint}</p>
                </HelpPopover>
              </label>
              <span className="text-[10px] text-gray-500">
                suggested {fmtPct(suggested, { signed: suggested < 0 })}
              </span>
            </div>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setApyBps(v => v - 100)}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
              >−</button>
              <div className="relative flex-1">
                <input
                  type="number"
                  step={1}
                  value={apyPct}
                  onChange={e => setApyBps(Math.round(Number(e.target.value) * 100))}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-trader)] focus:outline-none transition text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
              </div>
              <button
                type="button"
                onClick={() => setApyBps(v => v + 100)}
                className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
              >+</button>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-md border border-gray-200 px-3 py-2.5 space-y-1 text-[11px] num">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Live preview</div>
            <Row k="Virtual notional" v={fmtUSD(virtualNotional)} />
            <Row k="Carry $/h" v={`${isLong ? '+' : '−'}${fmtUSD(carryPerHour)}/h`} tone={isLong ? 'pos' : 'neg'} />
            <Row k="Carry $/day" v={`${isLong ? '+' : '−'}${fmtUSD(carryPerDay)}/d`} tone={isLong ? 'pos' : 'neg'} />
            <Row k="Est. liquidation distance" v={`±${liqDistancePct.toFixed(2)}%`} />
          </div>
        </div>
      )}
      currentState={[]}
      newState={[]}
      risks={[]}
      irreversibilityNote=""
      confirmType="checkbox"
      confirmButtonLabel={sideMeta.ctaLabel}
      onConfirm={() => {
        // TODO wire to actual protocol calls. For prototype, log + close.
        // eslint-disable-next-line no-alert
        alert(
          `${sideMeta.title} confirmed.\n\n` +
          `Pair: ${market.pair.token0}/${market.pair.token1} ${fmtFeeTier(market.feeTierBps)}\n` +
          `Range: ${fmtPriceShort(market.rangeLow)}–${fmtPriceShort(market.rangeHigh)}\n` +
          `Margin: ${fmtUSD(marginUSD)} · Leverage: ${leverage}× → ${fmtUSD(virtualNotional)} notional\n` +
          `Premium APY: ${apyPct.toFixed(2)}%`
        )
        onClose()
      }}
      onCancel={onClose}
    />
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'pos' | 'neg' }) {
  const color =
    tone === 'pos' ? 'var(--color-status-success)'
    : tone === 'neg' ? 'var(--color-status-danger)'
    : undefined
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium" style={color ? { color } : undefined}>{v}</span>
    </div>
  )
}

// ─── Pool pane (Long or Short side) ────────────────────────────────────
function PoolPane({
  title,
  subtitle,
  orders,
  onCta,
  onRowClick,
  onExpand,
  tone,
}: {
  title: string
  subtitle: string
  orders: PoolOrder[]
  onCta: () => void
  onRowClick?: (apyBps: number) => void
  onExpand?: () => void
  tone: 'long' | 'short'
}) {
  const accent = tone === 'long' ? 'var(--color-role-lp)' : 'var(--color-role-trader)'

  // Summary rows — Eugene 2026-05-21 design challenge: no scroll, no
  // truncation-tail. Show the top / median / bottom of book + the user's
  // own order if present. This gives a LP/trader enough to read the
  // distribution shape and their own queue position without scanning a
  // long list. Full list lives in the «tap to expand» modal.
  const summary = useMemo(() => buildPoolSummary(orders), [orders])
  const totalLiquidity = orders.reduce((s, r) => s + r.liquidityUSD, 0)
  const mineRow = summary.mine
  const mineRank = mineRow ? orders.findIndex(r => r === mineRow) + 1 : 0

  return (
    <div className="rounded-md border border-gray-200 p-3 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {/* Button = human-readable CTA («Provide liquidity» / «Open position»).
            Subtitle line («Open LongPool» / «Open ShortPool») dropped per
            Eugene 2026-05-21 — already implied by the «LongPool orders» /
            «ShortPool orders» title. */}
        <button
          type="button"
          onClick={onCta}
          className="text-xs font-semibold px-3 py-1.5 rounded-md text-white hover:opacity-90 transition whitespace-nowrap"
          style={{ background: accent }}
        >
          {subtitle}
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="text-[11px] text-gray-500 mt-2 italic">No orders yet — be first.</p>
      ) : (
        <>
          <SummaryTable
            rows={summary.rows}
            mineRow={mineRow}
            mineRank={mineRank}
            mineTotal={orders.length}
            onRowClick={onRowClick}
            accent={accent}
          />
          {/* Footer hint — clickable to open the full стакан modal. */}
          <button
            type="button"
            onClick={onExpand}
            className="mt-2 text-left text-[10px] text-gray-500 hover:text-gray-900 transition cursor-pointer w-full"
          >
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} · {fmtUSD(totalLiquidity)} total · <span className="font-medium underline decoration-dotted">tap for full book →</span>
          </button>
        </>
      )}
    </div>
  )
}

// ─── Pool summary builder ──────────────────────────────────────────────
// Returns 3 representative rows + the user's row if present. Drives the
// inline pane (Eugene 2026-05-21 design redesign — no scroll inside the
// card, full стакан behind «tap to expand»).
function buildPoolSummary(orders: PoolOrder[]): {
  rows: Array<{ row: PoolOrder; label: string }>
  mine: PoolOrder | undefined
} {
  if (orders.length === 0) return { rows: [], mine: undefined }
  const mine = orders.find(o => o.isMine)
  const nonMine = orders.filter(o => o !== mine)
  const sorted = [...nonMine].sort((a, b) => b.premiumApyBps - a.premiumApyBps)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const median = sorted.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : undefined
  const rows: Array<{ row: PoolOrder; label: string }> = []
  if (top) rows.push({ row: top, label: 'Top' })
  if (median && median !== top && median !== bottom) rows.push({ row: median, label: 'Median' })
  if (bottom && bottom !== top) rows.push({ row: bottom, label: 'Bottom' })
  return { rows, mine }
}

function SummaryTable({
  rows,
  mineRow,
  mineRank,
  mineTotal,
  onRowClick,
  accent,
}: {
  rows: Array<{ row: PoolOrder | ActiveRow; label: string }>
  mineRow: PoolOrder | ActiveRow | undefined
  mineRank: number
  mineTotal: number
  onRowClick?: (apyBps: number) => void
  accent: string
}) {
  void accent
  const handleClick = (apy: number) => {
    onRowClick?.(apy)
  }
  return (
    <table className="w-full text-[11px] num mt-2">
      <thead className="text-[10px] uppercase tracking-wide text-gray-500">
        <tr>
          <th className="text-left font-medium pb-1"></th>
          <th className="text-left font-medium pb-1">Premium APY</th>
          <th className="text-right font-medium pb-1">Liquidity</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ row, label }, i) => (
          <tr
            key={i}
            onClick={onRowClick ? e => { e.stopPropagation(); handleClick(row.premiumApyBps) } : undefined}
            className={
              'border-t border-gray-100 ' +
              (onRowClick ? 'cursor-pointer hover:bg-gray-50 transition' : '')
            }
          >
            <td className="py-1.5 text-[10px] uppercase tracking-wide text-gray-400 w-1/4">{label}</td>
            <td className="py-1.5 text-gray-700">
              {fmtPct(row.premiumApyBps, { signed: row.premiumApyBps < 0 })}
            </td>
            <td className="py-1.5 text-right font-medium text-gray-900">{fmtUSD(row.liquidityUSD)}</td>
          </tr>
        ))}
        {mineRow && (
          <tr
            onClick={onRowClick ? e => { e.stopPropagation(); handleClick(mineRow.premiumApyBps) } : undefined}
            className={
              'border-t-2 border-[var(--color-role-lp)]/40 bg-[var(--color-role-lp-bg)]/40 ' +
              (onRowClick ? 'cursor-pointer hover:bg-[var(--color-role-lp-bg)]/60 transition' : '')
            }
          >
            <td className="py-1.5 text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--color-role-lp)' }}>
              Yours
            </td>
            <td className="py-1.5 text-gray-700">
              {fmtPct(mineRow.premiumApyBps, { signed: mineRow.premiumApyBps < 0 })}
              <span className="ml-1" aria-label="your order">🙂</span>
            </td>
            <td className="py-1.5 text-right font-medium text-gray-900">
              {fmtUSD(mineRow.liquidityUSD)}
              <span className="text-[10px] text-gray-500 font-normal ml-1">#{mineRank} of {mineTotal}</span>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// ─── Active pane (middle column) ───────────────────────────────────────
// Per Kolya 2026-05-18 ~41:00–44:00: «active positions — это пересечение
// двух сторон, sells/buys уже сметчились». Header shows Uniswap APY of the
// range (representative pool yield), body shows matched (Premium APY, Liquidity)
// rows. My position highlighted with 🙂 (Kolya: «со смайликом значит твоя
// позиция»). If many entries — show min / max + my row + aggregated tail.
function ActivePane({
  market,
  onRowClick,
  onExpand,
}: {
  market: AggregatedMarket
  onRowClick?: (apyBps: number) => void
  onExpand?: () => void
}) {
  const rows = market.activePositions
  const summary = useMemo(() => buildActiveSummary(rows), [rows])
  const totalLiquidity = rows.reduce((s, r) => s + r.liquidityUSD, 0)
  const mineRow = summary.mine
  const mineRank = mineRow ? rows.findIndex(r => r === mineRow) + 1 : 0

  return (
    <div className="rounded-md border border-gray-200 p-3 flex flex-col bg-gray-50/30">
      {/* Title + Help icon stacked next to «Active positions», explanation
          text moved into the popover (Eugene 2026-05-21 — «Matched best-bid
          ↔ best-ask строчку убери в тултип, тултип подними к Active»). */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold inline-flex items-center gap-1">
          Active positions
          <HelpPopover label="Active positions" width="w-80">
            <p className="font-semibold mb-1">Matched best-bid ↔ best-ask</p>
            <p className="mb-1.5">Эти позиции уже сматчены: LP-ask пересекся с trader-bid, на них начисляется доходность по средней Uniswap APY этого ренджа. По сути — clearing rate рынка.</p>
            <p className="text-[10px] text-gray-500">Когда позиций много — оставляем строку с минимальным Premium, с максимальным и твою позицию (🙂). Остальное агрегируется в «+N more» с суммарной ликвидностью.</p>
          </HelpPopover>
        </h3>
        <span className="text-[11px] font-semibold num" style={{ color: 'var(--color-status-success)' }}>
          Uniswap APY {fmtPct(market.uniswapApyBps)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-gray-500 mt-2 italic">No matched positions yet.</p>
      ) : (
        <>
          <SummaryTable
            rows={summary.rows}
            mineRow={mineRow}
            mineRank={mineRank}
            mineTotal={rows.length}
            onRowClick={onRowClick}
            accent="var(--color-status-success)"
          />
          <button
            type="button"
            onClick={onExpand}
            className="mt-2 text-left text-[10px] text-gray-500 hover:text-gray-900 transition cursor-pointer w-full"
          >
            {rows.length} matched · {fmtUSD(totalLiquidity)} · <span className="font-medium underline decoration-dotted">tap for full book →</span>
          </button>
        </>
      )}
    </div>
  )
}

// Active variant of the summary builder — same logic as buildPoolSummary
// but returns ActiveRow labels (clearing context).
function buildActiveSummary(rows: ActiveRow[]): {
  rows: Array<{ row: ActiveRow; label: string }>
  mine: ActiveRow | undefined
} {
  if (rows.length === 0) return { rows: [], mine: undefined }
  const mine = rows.find(r => r.isMine)
  const nonMine = rows.filter(r => r !== mine)
  const sorted = [...nonMine].sort((a, b) => b.premiumApyBps - a.premiumApyBps)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const median = sorted.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : undefined
  const out: Array<{ row: ActiveRow; label: string }> = []
  if (top) out.push({ row: top, label: 'Top' })
  if (median && median !== top && median !== bottom) out.push({ row: median, label: 'Clearing' })
  if (bottom && bottom !== top) out.push({ row: bottom, label: 'Bottom' })
  return { rows: out, mine }
}

// ─── Helpers ───────────────────────────────────────────────────────────
function selectCls(active: boolean): string {
  return (
    'text-xs rounded border px-2 py-1 ' +
    (active
      ? 'border-[var(--color-role-trader)] bg-[var(--color-role-trader-bg)]'
      : 'border-gray-300 bg-white')
  )
}

// Verified assets — major curated tokens that get a ✓ chip on the market
// card. Kolya mentioned «верифицированный actif» chip as a trust signal in
// the 2026-05-18 review. Long-tail / unknown tokens stay unbadged so the
// chip means something. Static list for now; production should source from
// a curated token-list (Uniswap default, Coingecko verified, etc.).
const VERIFIED_ASSETS = new Set([
  'ETH', 'WETH', 'wstETH', 'cbETH', 'rETH',
  'WBTC', 'cbBTC',
  'USDC', 'USDT', 'DAI', 'PYUSD', 'crvUSD',
  'ARB', 'OP', 'LINK', 'UNI',
])
function isVerifiedPair(p: { token0: string; token1: string }): boolean {
  return VERIFIED_ASSETS.has(p.token0) && VERIFIED_ASSETS.has(p.token1)
}

// ─── OrderBookModal — full стакан for one side ─────────────────────────
// Eugene 2026-05-21: «по клику на этот блок можно в модальном окне раскрывать
// стакан со всеми». Drill-in surface for the side the user clicked.
//
// Designed for the LP / trader decision: «what Premium APY should I bid?».
// Columns chosen for decision-making, not just data dump:
//   • Premium APY — sorted desc for Long/Active (best ask top); for Short
//     also desc but interpretation flips (best bid for trader = lowest pay).
//   • Liquidity — depth at this single rate.
//   • Cumulative — running sum from top of book; reads as «how much would
//     fill before mine if I price here».
//   • Share — this rate's % of total book.
//   • Depth bar — cumulative bar, visual scan of distribution.
//
// «My» row pinned at top of the table (sticky) when the user already has
// an entry on this side.

function OrderBookModal({
  market,
  side,
  onClose,
  onRowClick,
}: {
  market: AggregatedMarket
  side: null | 'long' | 'active' | 'short'
  onClose: () => void
  onRowClick: (apyBps: number) => void
}) {
  if (!side) return null

  const sideMeta = (() => {
    if (side === 'long') return {
      title: 'LongPool orders · full стакан',
      sub: 'LP-side asks — what providers are willing to accept. Top = highest Premium APY.',
      orders: market.longPoolOrders as Array<PoolOrder | ActiveRow>,
      accent: 'var(--color-role-lp)',
      ctaPrompt: 'Click a row to provide liquidity at that Premium APY.',
    }
    if (side === 'short') return {
      title: 'ShortPool orders · full стакан',
      sub: 'Trader-side bids — what traders are willing to pay. Top = highest Premium APY (best for LP).',
      orders: market.shortPoolOrders as Array<PoolOrder | ActiveRow>,
      accent: 'var(--color-role-trader)',
      ctaPrompt: 'Click a row to open a position at that Premium APY.',
    }
    return {
      title: 'Active positions · full стакан',
      sub: 'Matched LP↔Trader pairings. Premium APY = clearing rate per match. Uniswap APY this range = ' + fmtPct(market.uniswapApyBps) + '.',
      orders: market.activePositions as Array<PoolOrder | ActiveRow>,
      accent: 'var(--color-status-success)',
      ctaPrompt: 'Click a row to open a ShortPool position at that Premium APY.',
    }
  })()

  // Sort desc by Premium APY for stable «top of book at top» semantics
  // across all three sides.
  const sortedAll = [...sideMeta.orders].sort((a, b) => b.premiumApyBps - a.premiumApyBps)
  const mineRow = sortedAll.find(r => 'isMine' in r && r.isMine)
  const sortedNonMine = sortedAll.filter(r => r !== mineRow)
  const totalLiquidity = sortedAll.reduce((s, r) => s + r.liquidityUSD, 0)

  // Cumulative liquidity from top → for the «depth» bar.
  function cumulativeFor(row: PoolOrder | ActiveRow): number {
    let s = 0
    for (const r of sortedAll) {
      s += r.liquidityUSD
      if (r === row) return s
    }
    return totalLiquidity
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">{sideMeta.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition text-xl leading-none"
            >×</button>
          </div>
          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{sideMeta.sub}</p>
          <p className="text-[11px] text-gray-500 mt-2 num">
            {market.pair.token0}/{market.pair.token1} · {fmtFeeTier(market.feeTierBps)} ·
            Range <span className="text-gray-700">{fmtPriceShort(market.rangeLow)} – {fmtPriceShort(market.rangeHigh)}</span> ·
            Price <span className="text-gray-700">{fmtPriceShort(market.currentPrice)}</span>
          </p>
        </header>

        {/* Stats strip */}
        <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/40 flex items-baseline gap-4 text-[11px] num text-gray-700">
          <span><span className="text-gray-500">Orders</span> <span className="font-semibold">{sortedAll.length}</span></span>
          <span><span className="text-gray-500">Total liquidity</span> <span className="font-semibold">{fmtUSD(totalLiquidity)}</span></span>
          {sortedAll.length > 0 && (
            <>
              <span><span className="text-gray-500">Top</span> <span className="font-semibold">{fmtPct(sortedAll[0].premiumApyBps, { signed: sortedAll[0].premiumApyBps < 0 })}</span></span>
              <span><span className="text-gray-500">Bottom</span> <span className="font-semibold">{fmtPct(sortedAll[sortedAll.length - 1].premiumApyBps, { signed: sortedAll[sortedAll.length - 1].premiumApyBps < 0 })}</span></span>
            </>
          )}
        </div>

        {/* Pinned «mine» row banner */}
        {mineRow && (
          <div
            className="px-5 py-2 bg-[var(--color-role-lp-bg)]/50 border-b border-[var(--color-role-lp)]/30 text-[12px] num flex items-baseline justify-between gap-3 cursor-pointer hover:bg-[var(--color-role-lp-bg)]/80 transition"
            onClick={() => onRowClick(mineRow.premiumApyBps)}
          >
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--color-role-lp)' }}>
              Your order 🙂
            </span>
            <span>
              <span className="text-gray-700 font-medium">{fmtPct(mineRow.premiumApyBps, { signed: mineRow.premiumApyBps < 0 })}</span>
              <span className="text-gray-400"> · </span>
              <span className="text-gray-700">{fmtUSD(mineRow.liquidityUSD)}</span>
              <span className="text-gray-400"> · </span>
              <span className="text-gray-500">#{sortedAll.findIndex(r => r === mineRow) + 1} of {sortedAll.length}</span>
            </span>
          </div>
        )}

        {/* Book table — scroll inside the modal body */}
        <div className="overflow-y-auto flex-1">
          {sortedAll.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-500 italic">No orders on this side yet.</p>
          ) : (
            <table className="w-full text-[11px] num">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500 sticky top-0 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)] z-10">
                <tr>
                  <th className="text-left font-medium px-5 py-2">Premium APY</th>
                  <th className="text-right font-medium px-3 py-2">Liquidity</th>
                  <th className="text-right font-medium px-3 py-2">Cumulative</th>
                  <th className="text-right font-medium px-3 py-2">% of book</th>
                  <th className="text-left font-medium px-3 py-2 w-1/4">Depth</th>
                </tr>
              </thead>
              <tbody>
                {sortedNonMine.map((r, i) => {
                  const cum = cumulativeFor(r)
                  const share = (r.liquidityUSD / totalLiquidity) * 100
                  const cumPct = (cum / totalLiquidity) * 100
                  return (
                    <tr
                      key={i}
                      onClick={() => onRowClick(r.premiumApyBps)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-5 py-1.5 text-gray-700 font-medium">{fmtPct(r.premiumApyBps, { signed: r.premiumApyBps < 0 })}</td>
                      <td className="px-3 py-1.5 text-right text-gray-900">{fmtUSD(r.liquidityUSD)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{fmtUSD(cum)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5">
                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(2, cumPct)}%`,
                              background: sideMeta.accent,
                              opacity: 0.65,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="px-5 py-2.5 border-t border-gray-100 text-[10px] text-gray-500 bg-gray-50/40">
          {sideMeta.ctaPrompt}
        </footer>
      </div>
    </div>
  )
}
