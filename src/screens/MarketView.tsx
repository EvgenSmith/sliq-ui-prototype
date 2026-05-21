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

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectedWallet, listings, positions } from '@/mocks/data'
import type { Listing, Position } from '@/lib/types'
import { capacityFreePct, getRangeStatus, isSubsidized, pairLabel } from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtPriceShort, fmtUSD } from '@/lib/format'
import { FEE_TIER_OPTIONS } from '@/lib/marketplace-constants'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'

// ─── Aggregated market shape ────────────────────────────────────────────
interface AggregatedMarket {
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
  myInActive: boolean                      // any Maria position in active rows?
}

interface PoolOrder {
  premiumApyBps: number
  liquidityUSD: number
}

interface ActiveRow {
  premiumApyBps: number
  liquidityUSD: number
  isMine: boolean                          // highlights with 🙂 per Kolya
}

// ─── Aggregation logic ──────────────────────────────────────────────────
function buildMarkets(allListings: Listing[], allPositions: Position[]): AggregatedMarket[] {
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

// ─── Component ─────────────────────────────────────────────────────────
export function MarketView() {
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [feeTiersOn, setFeeTiersOn] = useState<Set<number>>(
    () => new Set(FEE_TIER_OPTIONS.map(o => o.bps))
  )
  const [rangeStatus, setRangeStatus] = useState<'all' | 'in' | 'out'>('all')
  const [sort, setSort] = useState<'liquidity-desc' | 'apy-desc'>('liquidity-desc')

  const markets = useMemo(() => buildMarkets(listings, positions), [])

  const allPairs = useMemo(() => {
    const set = new Set<string>()
    markets.forEach(m => set.add(`${m.pair.token0}/${m.pair.token1}`))
    return Array.from(set).sort()
  }, [markets])

  const filtered = useMemo(() => {
    let out = [...markets]
    if (pairFilter !== 'all') {
      out = out.filter(m => `${m.pair.token0}/${m.pair.token1}` === pairFilter)
    }
    out = out.filter(m => feeTiersOn.has(m.feeTierBps))
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
  }, [markets, pairFilter, feeTiersOn, rangeStatus, sort])

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

      {/* Filter / sort strip */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
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

      {/* Market cards */}
      <div className="space-y-4">
        {filtered.map(m => (
          <MarketCard key={m.key} market={m} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <p className="text-sm text-gray-600 mb-1">No markets match current filters.</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Try a wider pair / fee tier / range selection.
            </p>
            {(pairFilter !== 'all' || feeTiersOn.size !== FEE_TIER_OPTIONS.length || rangeStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setPairFilter('all')
                  setFeeTiersOn(new Set(FEE_TIER_OPTIONS.map(o => o.bps)))
                  setRangeStatus('all')
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Per-market card ───────────────────────────────────────────────────
function MarketCard({ market }: { market: AggregatedMarket }) {
  const navigate = useNavigate()
  const inRange = market.currentPrice >= market.rangeLow && market.currentPrice <= market.rangeHigh
  void navigate
  void getRangeStatus
  void pairLabel

  // Phase F — Open LongPool / ShortPool modals.
  // Click-row-prefill (this commit) — clicking any row in a pool pane opens
  // the matching modal with that row's Premium APY pre-filled, so the trader
  // can act on what they saw without re-entering numbers.
  const [longOpen, setLongOpen] = useState(false)
  const [shortOpen, setShortOpen] = useState(false)
  const [prefillLongApy, setPrefillLongApy] = useState<number | null>(null)
  const [prefillShortApy, setPrefillShortApy] = useState<number | null>(null)
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
      {/* Header row */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="inline-flex items-baseline gap-2 flex-wrap">
          <h2 className="text-base font-semibold">
            {market.pair.token0} / {market.pair.token1}
          </h2>
          {isVerifiedPair(market.pair) && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 inline-flex items-center gap-1"
              title="Both tokens in the pair are on the curated verified-asset list."
            >
              <span aria-hidden>✓</span>verified
            </span>
          )}
          <span className="text-[11px] text-gray-500">Uniswap v3</span>
          <span className="text-[11px] font-medium text-gray-600 num">{fmtFeeTier(market.feeTierBps)} fee</span>
          {market.myInActive && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-semibold">
              my position
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-3 flex-wrap text-[11px] num text-gray-700">
          <span><span className="text-gray-500">Liquidity</span> <span className="font-semibold">{fmtUSD(market.totalLiquidityUSD)}</span></span>
          <span className="text-gray-300">·</span>
          <span><span className="text-gray-500">Price range</span> <span className="font-medium">({market.rangeWidthPct.toFixed(1)}%)</span> <span className="font-semibold">{fmtPriceShort(market.rangeLow)} – {fmtPriceShort(market.rangeHigh)}</span></span>
          <span className="text-gray-300">·</span>
          <span><span className="text-gray-500">Price</span> <span className="font-semibold">{fmtPriceShort(market.currentPrice)}</span></span>
          <span className="text-gray-300">·</span>
          <span><span className="text-gray-500">Inrange</span> <span className="font-medium" style={{ color: inRange ? 'var(--color-status-success)' : 'var(--color-status-warning)' }}>({market.inRangePct}%)</span></span>
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
          ctaLabel="Open LongPool"
          onCta={() => openLongAt(null)}
          onRowClick={apy => openLongAt(apy)}
          tone="long"
        />
        <ActivePane market={market} onRowClick={apy => openShortAt(apy)} />
        <PoolPane
          title="ShortPool orders"
          subtitle="Open position"
          orders={market.shortPoolOrders}
          ctaLabel="Open ShortPool"
          onCta={() => openShortAt(null)}
          onRowClick={apy => openShortAt(apy)}
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
  ctaLabel,
  onCta,
  onRowClick,
  tone,
}: {
  title: string
  subtitle: string
  orders: PoolOrder[]
  ctaLabel: string
  onCta: () => void
  onRowClick?: (apyBps: number) => void
  tone: 'long' | 'short'
}) {
  const accent = tone === 'long' ? 'var(--color-role-lp)' : 'var(--color-role-trader)'
  // Show top N rows; if more, aggregate into «N more · $X total» footer.
  const HEAD_LIMIT = 5
  const headRows = orders.slice(0, HEAD_LIMIT)
  const tailRows = orders.slice(HEAD_LIMIT)
  const tailLiquidity = tailRows.reduce((s, r) => s + r.liquidityUSD, 0)

  return (
    <div className="rounded-md border border-gray-200 p-3 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-white hover:opacity-90 transition whitespace-nowrap"
          style={{ background: accent }}
        >
          {ctaLabel}
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="text-[11px] text-gray-500 mt-2 italic">No orders yet — be first.</p>
      ) : (
        <table className="w-full text-[11px] num mt-2">
          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-medium pb-1">Premium APY</th>
              <th className="text-right font-medium pb-1">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {headRows.map((r, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(r.premiumApyBps) : undefined}
                className={
                  'border-t border-gray-100 ' +
                  (onRowClick ? 'cursor-pointer hover:bg-gray-50 transition' : '')
                }
                title={onRowClick ? `Click to ${tone === 'long' ? 'provide liquidity' : 'open position'} at this Premium APY` : undefined}
              >
                <td className="py-1.5 text-gray-700">{fmtPct(r.premiumApyBps, { signed: r.premiumApyBps < 0 })}</td>
                <td className="py-1.5 text-right font-medium text-gray-900">{fmtUSD(r.liquidityUSD)}</td>
              </tr>
            ))}
            {tailRows.length > 0 && (
              <tr className="border-t border-gray-100 bg-gray-50/50">
                <td className="py-1.5 text-[10px] text-gray-500 italic">+{tailRows.length} more</td>
                <td className="py-1.5 text-right text-[10px] text-gray-500">{fmtUSD(tailLiquidity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
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
}: {
  market: AggregatedMarket
  onRowClick?: (apyBps: number) => void
}) {
  const rows = market.activePositions
  const HEAD_LIMIT = 5
  let visibleRows: ActiveRow[] = []
  let tailRows: ActiveRow[] = []
  if (rows.length <= HEAD_LIMIT) {
    visibleRows = rows
  } else {
    // Always keep min, max, and my position; fill rest by highest liquidity.
    const min = rows[rows.length - 1]
    const max = rows[0]
    const mine = rows.filter(r => r.isMine)
    const middle = rows
      .filter(r => r !== min && r !== max && !r.isMine)
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, Math.max(0, HEAD_LIMIT - 2 - mine.length))
    const set = new Set<ActiveRow>([max, ...mine, ...middle, min])
    visibleRows = [...set].sort((a, b) => b.premiumApyBps - a.premiumApyBps)
    tailRows = rows.filter(r => !set.has(r))
  }
  const tailLiquidity = tailRows.reduce((s, r) => s + r.liquidityUSD, 0)

  return (
    <div className="rounded-md border border-gray-200 p-3 flex flex-col bg-gray-50/30">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold">Active positions</h3>
        <span className="text-[11px] font-semibold num" style={{ color: 'var(--color-status-success)' }}>
          Uniswap APY {fmtPct(market.uniswapApyBps)}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 inline-flex items-center gap-1">
        Matched best-bid ↔ best-ask
        <HelpPopover label="Active positions" width="w-80">
          <p className="font-semibold mb-1">Cross-rate of the order book</p>
          <p className="mb-1.5">Эти позиции уже сматчены: LP-ask пересекся с trader-bid, на них начисляется доходность по средней Uniswap APY этого ренджа. По сути — clearing rate рынка.</p>
          <p className="text-[10px] text-gray-500">Когда позиций много — оставляем строку с минимальным Premium, с максимальным и твою позицию (🙂). Остальное агрегируется в «+N more» с суммарной ликвидностью.</p>
        </HelpPopover>
      </p>

      {rows.length === 0 ? (
        <p className="text-[11px] text-gray-500 mt-2 italic">No matched positions yet.</p>
      ) : (
        <table className="w-full text-[11px] num mt-1">
          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-medium pb-1">Premium APY</th>
              <th className="text-right font-medium pb-1">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(r.premiumApyBps) : undefined}
                className={
                  'border-t border-gray-100 ' +
                  (r.isMine ? 'bg-[var(--color-role-lp-bg)]/50 ' : '') +
                  (onRowClick ? 'cursor-pointer hover:bg-gray-50 transition' : '')
                }
                title={onRowClick ? 'Click to open ShortPool at this Premium APY' : undefined}
              >
                <td className="py-1.5 text-gray-700">
                  {r.isMine && <span className="mr-1">🙂</span>}
                  {fmtPct(r.premiumApyBps, { signed: r.premiumApyBps < 0 })}
                </td>
                <td className="py-1.5 text-right font-medium text-gray-900">{fmtUSD(r.liquidityUSD)}</td>
              </tr>
            ))}
            {tailRows.length > 0 && (
              <tr className="border-t border-gray-100 bg-gray-50/50">
                <td className="py-1.5 text-[10px] text-gray-500 italic">+{tailRows.length} more matched</td>
                <td className="py-1.5 text-right text-[10px] text-gray-500">{fmtUSD(tailLiquidity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
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
