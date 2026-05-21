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
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No markets match current filters.
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
  void getRangeStatus // helper kept for future expansion
  void pairLabel

  // Open LongPool / Open ShortPool — for now, dispatch via custom event or
  // navigate to a per-market detail page (when one ships). For prototype,
  // these CTAs open a basic modal (TODO next pass) — currently log + console.
  function onOpenLongPool() {
    // TODO Phase F — proper modal with margin + leverage + Premium APY ask
    alert(`Open LongPool (Provide liquidity) on ${market.pair.token0}/${market.pair.token1} · ${fmtFeeTier(market.feeTierBps)} · range ${fmtPriceShort(market.rangeLow)}–${fmtPriceShort(market.rangeHigh)}.\n\nFull modal coming next pass.`)
  }
  function onOpenShortPool() {
    // For trader path we already have OpenPositionForm — could route to a
    // representative listing in the bucket so the existing flow handles it.
    alert(`Open ShortPool (Open position) on ${market.pair.token0}/${market.pair.token1} · ${fmtFeeTier(market.feeTierBps)} · range ${fmtPriceShort(market.rangeLow)}–${fmtPriceShort(market.rangeHigh)}.\n\nFull modal coming next pass.`)
    void navigate
  }

  return (
    <div className={'rounded-lg border bg-white ' + (market.myInActive ? 'border-[var(--color-role-lp)]/40' : 'border-gray-200')}>
      {/* Header row */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="inline-flex items-baseline gap-2 flex-wrap">
          <h2 className="text-base font-semibold">
            {market.pair.token0} / {market.pair.token1}
          </h2>
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
          onCta={onOpenLongPool}
          tone="long"
        />
        <ActivePane market={market} />
        <PoolPane
          title="ShortPool orders"
          subtitle="Open position"
          orders={market.shortPoolOrders}
          ctaLabel="Open ShortPool"
          onCta={onOpenShortPool}
          tone="short"
        />
      </div>
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
  tone,
}: {
  title: string
  subtitle: string
  orders: PoolOrder[]
  ctaLabel: string
  onCta: () => void
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
              <tr key={i} className="border-t border-gray-100">
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
function ActivePane({ market }: { market: AggregatedMarket }) {
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
                className={'border-t border-gray-100 ' + (r.isMine ? 'bg-[var(--color-role-lp-bg)]/50' : '')}
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
