// MarketDetail — drill-in view for a single aggregated market.
//
// Eugene 2026-05-21 — wraps up the Market section («сделай что не доделал»).
// On the marketplace card we show a 3-column summary (Long / Active / Short)
// with a head-truncation tail. The detail page shows the FULL order book
// without aggregation, with vertical стакан visualisation (sells stacked top
// going up, buys stacked bottom going down) per Kolya's mental model from
// the 2026-05-18 call.
//
// Layout:
//   • Header: pair · fee · verified chip · «my position» chip · range scale
//   • Stats strip: total liquidity / range bounds / current price / inrange
//   • Vertical orderbook:
//       — LongPool orders (LP-asks, descending by APY — most expensive top)
//       — clearing rate divider with «Best matched» label
//       — Active positions (matched rows)
//       — clearing rate divider
//       — ShortPool orders (trader-bids, descending by APY)
//     Depth bars scale to the largest liquidity entry across all sides so
//     relative size reads at a glance.
//   • CTAs: Open LongPool (top) + Open ShortPool (bottom). Same modal as
//     the marketplace card uses (re-imported from MarketView).

import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { listings, positions } from '@/mocks/data'
import { isSubsidized } from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtPriceShort, fmtUSD } from '@/lib/format'
import { buildMarkets, type AggregatedMarket } from '@/screens/MarketView'
import { RangeBar } from '@/components/RangeBar'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'

const VERIFIED_ASSETS = new Set([
  'ETH', 'WETH', 'wstETH', 'cbETH', 'rETH',
  'WBTC', 'cbBTC',
  'USDC', 'USDT', 'DAI', 'PYUSD', 'crvUSD',
  'ARB', 'OP', 'LINK', 'UNI',
])

export function MarketDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const decoded = slug ? decodeURIComponent(slug) : ''

  const market = useMemo(() => {
    const all = buildMarkets(listings, positions)
    return all.find(m => m.key === decoded)
  }, [decoded])

  const [longOpen, setLongOpen] = useState(false)
  const [shortOpen, setShortOpen] = useState(false)
  const [prefillLongApy, setPrefillLongApy] = useState<number | null>(null)
  const [prefillShortApy, setPrefillShortApy] = useState<number | null>(null)

  if (!market) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Market not found</h2>
        <p className="text-sm text-gray-500 mb-4">
          The aggregated market for this URL no longer exists — listings may have
          closed or the range bucket moved.
        </p>
        <Link
          to="/market"
          className="text-sm font-semibold px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
        >
          ← Back to Market
        </Link>
      </div>
    )
  }

  const inRange = market.currentPrice >= market.rangeLow && market.currentPrice <= market.rangeHigh
  const verified = VERIFIED_ASSETS.has(market.pair.token0) && VERIFIED_ASSETS.has(market.pair.token1)

  // Max liquidity across all sides drives the depth-bar scale so visual
  // weight is comparable between Long / Active / Short.
  const allLiquidity = [
    ...market.longPoolOrders.map(o => o.liquidityUSD),
    ...market.activePositions.map(o => o.liquidityUSD),
    ...market.shortPoolOrders.map(o => o.liquidityUSD),
  ]
  const maxLiq = Math.max(1, ...allLiquidity)

  // Clearing rate = midpoint between top-of-book ask and bid (Kolya's
  // «active middle position» definition). Fall back to whichever side
  // exists if the book is one-sided.
  const bestLongAsk = market.longPoolOrders[market.longPoolOrders.length - 1]?.premiumApyBps
  const bestShortBid = market.shortPoolOrders[0]?.premiumApyBps
  const clearingApyBps = bestLongAsk !== undefined && bestShortBid !== undefined
    ? (bestLongAsk + bestShortBid) / 2
    : market.activePositions[0]?.premiumApyBps

  // Subsidized flag — used to render negative-Premium-APY entries in the
  // amber «LP pays you» tone instead of gray.
  void isSubsidized

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/market" className="hover:underline">Market</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">
          {market.pair.token0} / {market.pair.token1}
        </span>
      </nav>

      {/* Header */}
      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="inline-flex items-baseline gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">
              {market.pair.token0} / {market.pair.token1}
            </h1>
            {verified && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 inline-flex items-center gap-1">
                <span aria-hidden>✓</span>verified
              </span>
            )}
            <span className="text-sm text-gray-500">Uniswap v3</span>
            <span className="text-sm font-medium text-gray-600 num">{fmtFeeTier(market.feeTierBps)} fee</span>
            {market.myInActive && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-semibold">
                my position
              </span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              Beta · Pro
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px] num">
          <Stat label="Total liquidity" value={fmtUSD(market.totalLiquidityUSD)} />
          <Stat
            label="Range width"
            value={`${market.rangeWidthPct.toFixed(1)}%`}
            sub={`${fmtPriceShort(market.rangeLow)} – ${fmtPriceShort(market.rangeHigh)}`}
          />
          <Stat label="Current price" value={fmtPriceShort(market.currentPrice)} />
          <Stat
            label="Inrange"
            value={`${market.inRangePct}%`}
            tone={inRange ? 'pos' : 'warn'}
          />
        </dl>

        {/* Range visualisation */}
        <div className="mt-4 max-w-lg">
          <RangeBar
            rangeLow={market.rangeLow}
            rangeHigh={market.rangeHigh}
            currentPrice={market.currentPrice}
          />
        </div>
      </header>

      {/* Clearing rate banner */}
      {clearingApyBps !== undefined && (
        <div className="mb-4 rounded-lg border border-[var(--color-status-success)]/30 bg-[var(--color-role-lp-bg)] px-4 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Clearing Premium APY</div>
            <div className="text-lg font-semibold num text-[var(--color-status-success)]">
              {fmtPct(Math.round(clearingApyBps), { signed: clearingApyBps < 0 })}
            </div>
          </div>
          <div className="text-[11px] text-gray-600 max-w-md text-right">
            {bestLongAsk !== undefined && bestShortBid !== undefined ? (
              <>Midpoint of best LP-ask <span className="num font-medium">{fmtPct(bestLongAsk)}</span> and best Trader-bid <span className="num font-medium">{fmtPct(bestShortBid, { signed: bestShortBid < 0 })}</span>. New positions at this rate match instantly.</>
            ) : (
              <>One side of the book is empty — clearing rate falls back to the best matched Active position. Use Open LongPool / ShortPool to seed the missing side.</>
            )}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => { setPrefillLongApy(null); setLongOpen(true) }}
          className="px-4 py-2.5 rounded-md text-white font-semibold text-sm hover:opacity-90 transition"
          style={{ background: 'var(--color-role-lp)' }}
        >
          Open LongPool · Provide liquidity
        </button>
        <button
          type="button"
          onClick={() => { setPrefillShortApy(null); setShortOpen(true) }}
          className="px-4 py-2.5 rounded-md text-white font-semibold text-sm hover:opacity-90 transition"
          style={{ background: 'var(--color-role-trader)' }}
        >
          Open ShortPool · Open position
        </button>
      </div>

      {/* Full vertical стакан */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Order book</h2>
          <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
            Click any row to open the matching CTA pre-filled
            <HelpPopover label="Vertical orderbook" width="w-80">
              <p className="font-semibold mb-1">Стакан — full book without aggregation</p>
              <p className="mb-1.5">Sells (LongPool asks, LP-side) stacked at the top, descending by Premium APY. Active matched positions in the middle. Buys (ShortPool bids, trader-side) at the bottom, descending by Premium APY. Depth bars scale to the biggest entry across all sides — width reads as relative liquidity.</p>
              <p className="text-[10px] text-gray-500">Negative Premium APY entries (subsidized — LP pays the trader) render with an amber tint.</p>
            </HelpPopover>
          </span>
        </div>

        <BookSection
          title="LongPool orders"
          subtitle="Provide liquidity"
          rows={market.longPoolOrders.map(o => ({
            premiumApyBps: o.premiumApyBps,
            liquidityUSD: o.liquidityUSD,
            isMine: false,
          }))}
          maxLiq={maxLiq}
          tone="long"
          onRowClick={apy => { setPrefillLongApy(apy); setLongOpen(true) }}
        />

        <BookDivider label="Active matched" apyBps={market.activePositions[0]?.premiumApyBps} />

        <BookSection
          title="Active positions"
          subtitle={`Uniswap APY ${fmtPct(market.uniswapApyBps)} — matched cross-rate`}
          rows={market.activePositions}
          maxLiq={maxLiq}
          tone="active"
          onRowClick={apy => { setPrefillShortApy(apy); setShortOpen(true) }}
        />

        <BookDivider label="Best bid" apyBps={bestShortBid} />

        <BookSection
          title="ShortPool orders"
          subtitle="Open position"
          rows={market.shortPoolOrders.map(o => ({
            premiumApyBps: o.premiumApyBps,
            liquidityUSD: o.liquidityUSD,
            isMine: false,
          }))}
          maxLiq={maxLiq}
          tone="short"
          onRowClick={apy => { setPrefillShortApy(apy); setShortOpen(true) }}
        />
      </div>

      {/* Footer hint */}
      <p className="text-[11px] text-gray-500 mt-4">
        Aggregation key: tick-exact (pair × fee tier × range bounds). NFTs with different ranges form their own markets — switch via the Market filter strip.
      </p>

      {/* Action modals — same component used by the summary card, just hosted here */}
      <MarketActionModalShim
        key={`long-${prefillLongApy ?? 'cta'}`}
        open={longOpen}
        side="long"
        market={market}
        prefillApyBps={prefillLongApy}
        onClose={() => setLongOpen(false)}
      />
      <MarketActionModalShim
        key={`short-${prefillShortApy ?? 'cta'}`}
        open={shortOpen}
        side="short"
        market={market}
        prefillApyBps={prefillShortApy}
        onClose={() => setShortOpen(false)}
      />

      <div className="mt-6">
        <button
          type="button"
          onClick={() => navigate('/market')}
          className="text-xs text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to all markets
        </button>
      </div>
    </div>
  )
}

// ─── Stat / book sub-components ────────────────────────────────────────
function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'pos' | 'warn'
}) {
  const color =
    tone === 'pos' ? 'var(--color-status-success)'
    : tone === 'warn' ? 'var(--color-status-warning)'
    : undefined
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</dt>
      <dd className="text-sm font-semibold num" style={color ? { color } : undefined}>{value}</dd>
      {sub && <dd className="text-[10px] text-gray-500 num">{sub}</dd>}
    </div>
  )
}

interface BookRow {
  premiumApyBps: number
  liquidityUSD: number
  isMine: boolean
}

function BookSection({
  title,
  subtitle,
  rows,
  maxLiq,
  tone,
  onRowClick,
}: {
  title: string
  subtitle: string
  rows: BookRow[]
  maxLiq: number
  tone: 'long' | 'short' | 'active'
  onRowClick: (apyBps: number) => void
}) {
  const barColor =
    tone === 'long' ? 'var(--color-role-lp)'
    : tone === 'short' ? 'var(--color-role-trader)'
    : 'var(--color-status-success)'

  return (
    <div className="border-b last:border-b-0 border-gray-100">
      <div className="px-4 py-2 bg-gray-50/40 flex items-baseline justify-between">
        <div>
          <h3 className="text-[12px] font-semibold">{title}</h3>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
        <span className="text-[10px] text-gray-500 num">{rows.length} {rows.length === 1 ? 'order' : 'orders'}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11px] text-gray-500 italic">No orders on this side.</p>
      ) : (
        <table className="w-full text-[11px] num">
          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-medium px-4 py-1.5">Premium APY</th>
              <th className="text-right font-medium px-4 py-1.5">Liquidity</th>
              <th className="text-left font-medium px-4 py-1.5 w-1/2">Depth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const widthPct = Math.max(2, (r.liquidityUSD / maxLiq) * 100)
              const subsidized = r.premiumApyBps < 0
              return (
                <tr
                  key={i}
                  onClick={() => onRowClick(r.premiumApyBps)}
                  className={
                    'border-t border-gray-50 cursor-pointer hover:bg-gray-50 transition ' +
                    (r.isMine ? 'bg-[var(--color-role-lp-bg)]/40' : '')
                  }
                >
                  <td className="px-4 py-1.5">
                    {r.isMine && <span className="mr-1">🙂</span>}
                    <span
                      className="font-medium"
                      style={subsidized ? { color: 'var(--color-negative-apy)' } : undefined}
                    >
                      {fmtPct(r.premiumApyBps, { signed: subsidized })}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium text-gray-900">{fmtUSD(r.liquidityUSD)}</td>
                  <td className="px-4 py-1.5">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, background: barColor, opacity: 0.7 }}
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
  )
}

function BookDivider({ label, apyBps }: { label: string; apyBps?: number }) {
  return (
    <div className="px-4 py-1.5 bg-gray-100/60 flex items-baseline justify-between text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
      <span>{label}</span>
      {apyBps !== undefined && (
        <span className="num">{fmtPct(Math.round(apyBps), { signed: apyBps < 0 })}</span>
      )}
    </div>
  )
}

// ─── Action modal shim ─────────────────────────────────────────────────
// The MarketActionModal proper lives in MarketView.tsx. We re-implement a
// thin shim here so MarketDetail doesn't pull a private internal. Same
// shape, same fields — easier to keep in sync than to crack the export.
function MarketActionModalShim({
  open,
  side,
  market,
  prefillApyBps,
  onClose,
}: {
  open: boolean
  side: 'long' | 'short'
  market: AggregatedMarket
  prefillApyBps?: number | null
  onClose: () => void
}) {
  const suggested = (() => {
    if (side === 'short') {
      const best = market.activePositions[0]?.premiumApyBps
        ?? market.longPoolOrders[0]?.premiumApyBps
        ?? 0
      return best + 100
    }
    const cheapest = market.longPoolOrders[market.longPoolOrders.length - 1]?.premiumApyBps ?? 100
    return Math.max(100, cheapest - 100)
  })()
  const initialApy = prefillApyBps ?? suggested

  const [marginUSD, setMarginUSD] = useState(1000)
  const [leverage, setLeverage] = useState(1000)
  const [apyBps, setApyBps] = useState(initialApy)
  const isLong = side === 'long'
  const virtualNotional = marginUSD * leverage
  const apyPct = apyBps / 100
  const carryPerHour = (virtualNotional * apyBps / 10000) / 8760
  const carryPerDay = carryPerHour * 24
  const liqDistancePct = (0.9 / leverage) * 100
  const sideTitle = isLong ? 'Open LongPool' : 'Open ShortPool'
  const sideSubtitle = isLong
    ? 'Provide liquidity to this range. Protocol mints a V3 NFT under your address — you earn Uniswap fees + the Premium APY you ask, you carry IL.'
    : 'Open a trader position at this range. You pay Uniswap fees + the Premium APY you bid; you earn Impermanent Profit when price moves.'

  return (
    <HighStakesConfirmModal
      open={open}
      compact
      title={sideTitle}
      subtitle={sideSubtitle}
      topSlot={(
        <div className="space-y-3">
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

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Margin</label>
              <span className="text-[10px] text-gray-500">USD</span>
            </div>
            <input
              type="number"
              value={marginUSD}
              onChange={e => setMarginUSD(Math.max(50, Number(e.target.value) || 50))}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded text-center"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Leverage</label>
              <span className="text-sm font-semibold num text-gray-900">{leverage}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={1000}
              value={leverage}
              onChange={e => setLeverage(Number(e.target.value))}
              className="w-full accent-[var(--color-role-trader)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Premium APY</label>
            <div className="relative">
              <input
                type="number"
                value={apyPct}
                onChange={e => setApyBps(Math.round(Number(e.target.value) * 100))}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded text-center"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 px-3 py-2 space-y-1 text-[11px] num">
            <Stat2 k="Virtual notional" v={fmtUSD(virtualNotional)} />
            <Stat2 k="Carry $/h" v={`${isLong ? '+' : '−'}${fmtUSD(carryPerHour)}/h`} />
            <Stat2 k="Carry $/day" v={`${isLong ? '+' : '−'}${fmtUSD(carryPerDay)}/d`} />
            <Stat2 k="Est. liquidation distance" v={`±${liqDistancePct.toFixed(2)}%`} />
          </div>
        </div>
      )}
      currentState={[]}
      newState={[]}
      risks={[]}
      irreversibilityNote=""
      confirmType="checkbox"
      confirmButtonLabel={`Confirm — ${sideTitle.toLowerCase()}`}
      onConfirm={() => {
        // eslint-disable-next-line no-alert
        alert(`${sideTitle} confirmed.\n\nPair: ${market.pair.token0}/${market.pair.token1}\nMargin: ${fmtUSD(marginUSD)}\nLeverage: ${leverage}×\nPremium APY: ${apyPct.toFixed(2)}%`)
        onClose()
      }}
      onCancel={onClose}
    />
  )
}

function Stat2({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium">{v}</span>
    </div>
  )
}
