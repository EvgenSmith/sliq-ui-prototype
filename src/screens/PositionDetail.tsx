// S9 Position Detail / Manage — full rebuild 2026-05-21 to mirror the LP-side
// «My listing detail» analog (ListingDetail OwnerPanel pattern).
//
// Layout:
//   Breadcrumb
//   Header (pair + state-chip cluster)
//   [State-driven context banners — out-of-range / out-of-margin / awaiting keeper]
//   Position Summary card  — mirrors /trader/positions row layout
//   Price chart (entry / current / range / both liq prices)
//   Manage panel (status-gated):
//     · OPEN              → Add Margin (ETH|USDC|both) · Remove Margin · Bump APY · Take Profit · Close
//     · OUTBID_PENDING    → Buyout back (raise Premium APY) + Close + Withdraw margin
//     · CLOSE_REQUESTED / CLOSING → read-only (banner above)
//   PnL Breakdown card (collapsible expand for raw Escrow / Restore)
//   What-if simulator
//   Competition table (Pro section)
//   Position Pro Metrics (collapsible)
//
// Spec sources:
//   · {sLiq} {prd} trader UI spec – 2026-05-18 §6.4 / §7 (S9 highest-priority rework)
//   · transcript sLiq Trade part 2 prototype review – 2026-05-18 (Kolya, Max)
//   · whitepaper §6 (PnL composition), §9 (HF / liquidation)
//   · card spec resolutions – 2026-05-11 §3 (S9 highest impact)
//
// Right-rail sticky panel removed — LP-analog ListingDetail doesn't use one,
// keeping a single layout shape across LP/trader detail screens.

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD, shortAddr } from '@/lib/format'
import {
  estimateCarryPerHour,
  estimateLiquidationPrice,
  estimateMarginRunwayHours,
  estimatePositionPnL,
  healthColor,
  healthFactor,
  pnlApyOnMargin,
  pnlPctOfMargin,
} from '@/lib/derive'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import { RangeBar } from '@/components/RangeBar'
import { TokenAmountInput } from '@/components/TokenAmountInput'

export function PositionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  void navigate
  const position = useMemo(() => positions.find(p => p.id === id), [id])
  const listing = useMemo(
    () => (position ? listings.find(l => l.id === position.listingId) : undefined),
    [position]
  )

  // Modal / form state
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [bumpApyOpen, setBumpApyOpen] = useState(false)
  const [buyoutBackOpen, setBuyoutBackOpen] = useState(false)
  const [newApyPct, setNewApyPct] = useState<number>(0)

  // Add Margin — ETH | USDC | both pattern matching the Open modal
  type MarginMode = 't0' | 't1' | 'both'
  const [marginMode, setMarginMode] = useState<MarginMode>('t0')
  const [addT0, setAddT0] = useState<number>(0)
  const [addT1, setAddT1] = useState<number>(0)

  // Remove Margin
  const [removeAmount, setRemoveAmount] = useState<number>(0)

  // Take Profit
  const [tpPriceStr, setTpPriceStr] = useState<string>('')
  const [tpSet, setTpSet] = useState<boolean>(false)

  // What-if
  const [whatIfMove, setWhatIfMove] = useState<number>(0)

  if (!position || !listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Position not found</h2>
        <Link to="/trader/positions" className="text-sm underline">
          ← Back to My Positions
        </Link>
      </div>
    )
  }

  const price = Math.max(listing.currentPrice, 1e-12)

  // Add-margin derived totals — for «both» mode we need t0 amount converted
  // to USD at current pool price plus raw t1 amount.
  const addUSD = (() => {
    if (marginMode === 't0') return addT0 * price
    if (marginMode === 't1') return addT1
    return addT0 * price + addT1
  })()
  function switchMarginMode(next: MarginMode) {
    if (next === marginMode) return
    const v = addUSD
    if (next === 't0') { setAddT0(v / price); setAddT1(0) }
    else if (next === 't1') { setAddT0(0); setAddT1(v) }
    else { setAddT0((v / 2) / price); setAddT1(v / 2) }
    setMarginMode(next)
  }
  function setAddTotal(usd: number) {
    if (marginMode === 't0') { setAddT0(usd / price); setAddT1(0) }
    else if (marginMode === 't1') { setAddT0(0); setAddT1(usd) }
    else { setAddT0((usd / 2) / price); setAddT1(usd / 2) }
  }

  // Derived live metrics
  const livePnL = estimatePositionPnL(position)
  const pnlPct = pnlPctOfMargin(position, livePnL)
  const pnlApy = pnlApyOnMargin(position, livePnL)
  const carryPerHour = estimateCarryPerHour(position)
  const liq = estimateLiquidationPrice(position, listing.currentPrice)
  const priceChangePct = ((listing.currentPrice - position.entryPrice) / position.entryPrice) * 100
  const liqDownDistPct = ((listing.currentPrice - liq.down) / listing.currentPrice) * 100
  const liqUpDistPct = ((liq.up - listing.currentPrice) / listing.currentPrice) * 100
  const closerLiq = Math.abs(listing.currentPrice - liq.down) < Math.abs(listing.currentPrice - liq.up) ? liq.down : liq.up
  const closerLiqDirection = closerLiq < listing.currentPrice ? '↓' : '↑'
  const closerLiqDistance = Math.abs((closerLiq - listing.currentPrice) / listing.currentPrice) * 100
  const hf = healthFactor(position)
  const hfCol = healthColor(hf)
  const runwayHours = estimateMarginRunwayHours(position)
  const inRange = listing.currentPrice >= listing.rangeLow && listing.currentPrice <= listing.rangeHigh

  // Decomposed PnL
  const minutesOpen = (Date.now() - position.openedAt) / 60_000
  const hoursOpen = minutesOpen / 60
  const accruedUniswapUSD = (position.notionalUSD * position.pendingRefApyBps / 10000 / 365 / 1440) * minutesOpen
  const accruedPremUSD = (position.notionalUSD * position.pendingPremApyBps / 10000 / 365 / 1440) * minutesOpen
  const grossIPUSD = position.notionalUSD * 0.0008 * (Math.sin(position.openedAt) * 0.5 + 0.5)
  const protocolFeesUSD = position.notionalUSD * 0.0005  // mock: 5 bps of notional
  const closeCostUSD = 2.5  // mock keeper fee estimate

  // What-if
  const pair = `${listing.pair.token0}/${listing.pair.token1}`
  const whatIfRange = pair.includes('USDC/USDT') ? 0.5 : pair.includes('USDC') || pair.includes('USDT') ? 5 : 5
  const movePct = whatIfMove / 100
  const whatIfPrice = position.entryPrice * (1 + movePct)
  const whatIfIP = position.notionalUSD * movePct * movePct / 2
  const whatIfNet = whatIfIP - accruedUniswapUSD - accruedPremUSD

  // Outbid context — other open positions on same listing
  const otherPositions = positions.filter(p => p.listingId === position.listingId && p.id !== position.id && p.status === 'OPEN')
  const highestOtherBid = otherPositions.length > 0 ? Math.max(...otherPositions.map(p => p.apyBps)) : 0
  const outbidRisk: 'safe' | 'medium' | 'high' = position.apyBps > highestOtherBid + 200
    ? 'safe'
    : position.apyBps > highestOtherBid
    ? 'medium'
    : 'high'

  // Status-derived flags
  const isOpen = position.status === 'OPEN'
  const isOutbidPending = position.status === 'OUTBID_PENDING'
  const isCloseRequested = position.status === 'CLOSE_REQUESTED'
  const isClosing = position.status === 'CLOSING'
  // «Out of margin» — outbid AND reserve insufficient to bump above incumbent
  // with at least 1 day of runway (P2 R-008/009/010 — distinct from outbid, NOT a liquidation).
  const minBumpCarryPerHour = (position.notionalUSD * (highestOtherBid + 100) / 10000) / 8760
  const isOutOfMargin = isOutbidPending && position.reserveUSD < minBumpCarryPerHour * 24
  const maxRemovableUSD = Math.max(0, position.marginValueUSD - position.marginValueUSD * 0.15)
  const traderReceivesCarry = position.apyBps < 0
  const premiumPct = position.apyBps / 100
  const uniswapPct = position.pendingRefApyBps / 100
  const totalRentPct = premiumPct + uniswapPct

  // Take Profit price guidance
  const tpPriceNum = tpPriceStr === '' ? 0 : Number(tpPriceStr)
  const tpDistancePct = tpPriceNum > 0 ? ((tpPriceNum - listing.currentPrice) / listing.currentPrice) * 100 : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/trader/positions" className="hover:underline">My Positions</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/listings/${listing.id}`} className="hover:underline">{pair}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">Position {position.id}</span>
      </nav>

      {/* Header — compact, chip cluster (LP-analog pattern) */}
      <header className="mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">
            {pair}
            <span className="text-gray-400 num font-normal text-base ml-2">{position.id}</span>
          </h1>
          <span className="text-xs text-gray-500 num">Uniswap v3 · {fmtFeeTier(listing.feeTierBps)}</span>
          <PositionStatusBadge status={position.status} />
          {(isOpen || isOutbidPending) && (
            <span
              className={
                'text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ' +
                (inRange
                  ? 'bg-[var(--color-status-success)]/10 text-[var(--color-status-success)] border-[var(--color-status-success)]/30'
                  : 'bg-amber-50 text-amber-800 border-amber-300')
              }
            >
              {inRange ? 'in range' : 'out of range'}
            </span>
          )}
          {isOutOfMargin && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 font-semibold">
              out of margin
            </span>
          )}
          {traderReceivesCarry && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold">
              LP pays you
            </span>
          )}
        </div>
      </header>

      {/* State-driven context banners (Eugene 2026-05-21: «действия при разном статусе») */}
      {!inRange && (isOpen || isOutbidPending) && (
        <Banner
          tone="amber"
          title="Out of range — IP не копится"
          body="Цена вышла за LP-range. Impermanent Profit не аккумулируется, но Premium APY всё равно списывается ежесекундно (P2 R-013). Дождись возврата цены либо закройся."
        />
      )}
      {isOutOfMargin && (
        <Banner
          tone="danger"
          title="Out of margin — не ликвидация"
          body="Тебя перекупили + резерва не хватает на возврат позиции. Это НЕ ликвидация — маржу не потерял. Сначала Top up margin, потом Buyout back (поднять Premium APY выше incumbent)."
        />
      )}
      {isCloseRequested && (
        <Banner
          tone="blue"
          title="Awaiting keeper"
          body="Запрос на закрытие отправлен. Keeper подхватит на следующем блоке Arbitrum. Менять маржу нельзя; отменить тоже."
        />
      )}
      {isClosing && (
        <Banner
          tone="blue"
          title="Settling…"
          body="Keeper считает финальный residual. Через 1-2 блока позиция уйдёт в Closed positions."
        />
      )}

      {/* Position summary card — analog LP «Listing summary», trader-side */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left — Size + Range visual + Entry → Now */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Position size</div>
              <div className="num text-xl font-semibold">{fmtUSD(position.notionalUSD)}</div>
              <div className="text-[11px] text-gray-500 num">
                {position.openedAtLeverage}× nominal
                {position.effectiveLeverage !== position.openedAtLeverage && (
                  <> · <span className="text-gray-700">{position.effectiveLeverage}× effective</span></>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Range</div>
              <RangeBar
                rangeLow={listing.rangeLow}
                rangeHigh={listing.rangeHigh}
                currentPrice={listing.currentPrice}
              />
            </div>
            <div className="text-xs num text-gray-700">
              Entry <span className="font-medium">{fmtPriceShort(position.entryPrice)}</span>
              {' '}→ now{' '}
              <span className="font-medium">{fmtPriceShort(listing.currentPrice)}</span>
              {' '}
              <span
                className="font-semibold"
                style={{ color: priceChangePct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Middle — PnL trio + Rate paid */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold inline-flex items-center gap-1">
                Live PnL
                <HelpPopover label="PnL trio" width="w-80" size="lg">
                  <p className="text-[11px] mb-1.5">Net = Impermanent Profit − Uniswap fees accrued − Premium APY accrued − protocol fees.</p>
                  <p className="text-[11px] mb-1.5">% и APY считаются <strong>к марже</strong>, не к notional (P2 R-033/034).</p>
                  <p className="text-[10px] text-gray-500">Финальное число определится на close по live-цене Uniswap.</p>
                </HelpPopover>
              </div>
              <div
                className="num text-2xl font-bold leading-tight"
                style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))}
              </div>
              <div
                className="text-xs num font-medium"
                style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}% margin · {pnlApy >= 0 ? '+' : ''}{pnlApy.toFixed(1)}% APY
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold inline-flex items-center gap-1">
                Rate paid
                <HelpPopover label="Rate trader pays" width="w-72">
                  <p>Premium APY (твоя ставка) + Uniswap baseline = «цена аренды» позиции. Зафиксировано при открытии; меняется только если ты сам сделаешь Bump APY.</p>
                </HelpPopover>
              </div>
              <div className="text-sm num">
                <span className="font-semibold" style={{ color: totalRentPct < 0 ? 'var(--color-negative-apy)' : undefined }}>
                  {totalRentPct >= 0 ? '' : '−'}{Math.abs(totalRentPct).toFixed(2)}%
                </span>
                <span className="text-gray-500 text-[11px] ml-1">
                  ({premiumPct >= 0 ? '' : '−'}{Math.abs(premiumPct).toFixed(2)} Premium + {uniswapPct.toFixed(2)} Uniswap)
                </span>
              </div>
              <div className="text-[11px] text-gray-500 num">
                Carry {carryPerHour < 0 ? '+' : '−'}{fmtUSD(Math.abs(carryPerHour))}/h
              </div>
            </div>
          </div>

          {/* Right — Health + Liquidation + Runway */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold inline-flex items-center gap-1">
                Health Factor
                <HelpPopover label="HF + bands" width="w-80" size="lg">
                  <p className="text-[11px] mb-2"><span className="num">HF = R_Σ(t) / (0.10 · R_Σ(0))</span>. HF=1.0 — точка ликвидации.</p>
                  <p className="text-[11px]">Бэнды: <span style={{ color: 'var(--color-status-success)' }}>🟢 ≥1.5</span> · <span style={{ color: 'var(--color-status-warning)' }}>🟡 1.1–1.5</span> · <span style={{ color: 'var(--color-status-danger)' }}>🔴 &lt;1.1</span></p>
                </HelpPopover>
              </div>
              <div className="num text-2xl font-bold leading-tight" style={{ color: hfCol }}>{hf.toFixed(2)}</div>
              <div className="relative h-1.5 mt-1 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max(2, Math.min(100, (hf / 3) * 100))}%`, background: hfCol }}
                />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5">Liquidation</div>
              <div className="text-xs num space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-gray-500">↓ down</span>
                  <span className="font-semibold" style={{ color: liqDownDistPct < 2 ? 'var(--color-status-danger)' : liqDownDistPct < 5 ? 'var(--color-status-warning)' : 'var(--color-status-success)' }}>
                    {fmtPriceShort(liq.down)} <span className="font-normal">(−{liqDownDistPct.toFixed(2)}%)</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-gray-500">↑ up</span>
                  <span className="font-semibold" style={{ color: liqUpDistPct < 2 ? 'var(--color-status-danger)' : liqUpDistPct < 5 ? 'var(--color-status-warning)' : 'var(--color-status-success)' }}>
                    {fmtPriceShort(liq.up)} <span className="font-normal">(+{liqUpDistPct.toFixed(2)}%)</span>
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold inline-flex items-center gap-1">
                Margin runway
                <HelpPopover label="Runway" width="w-72">
                  <p>Сколько часов до ликвидации, <strong>если цена не двинется</strong> (только carry-burn). Полезно решить — top up сейчас или подождать.</p>
                </HelpPopover>
              </div>
              <div className="text-sm num">
                {runwayHours === null
                  ? <span className="text-[var(--color-status-success)] font-semibold">∞ (LP subsidizes you)</span>
                  : <><span className="font-semibold">{runwayHours.toFixed(1)}h</span> <span className="text-[11px] text-gray-500">({(runwayHours / 24).toFixed(1)}d)</span></>}
              </div>
            </div>
          </div>
        </div>

        {/* Meta line — held + IDs */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-baseline justify-between gap-3 flex-wrap text-[11px] text-gray-500 num">
          <span>Held <span className="text-gray-700">{hoursOpen.toFixed(1)}h</span> · opened {fmtTimeAgo(position.openedAt)}</span>
          <span>
            Margin <span className="text-gray-700">{fmtUSD(position.marginValueUSD)}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            Reserve <span className="text-gray-700">{position.reservePctOfInitial}% · {fmtUSD(position.reserveUSD)}</span>
          </span>
          <span>
            Listing <Link to={`/listings/${listing.id}`} className="text-[var(--color-role-trader)] hover:underline">{listing.id} ↗</Link>
          </span>
        </div>
      </section>

      {/* Price chart with markers */}
      <PriceChart
        entry={position.entryPrice}
        current={listing.currentPrice}
        rangeLow={listing.rangeLow}
        rangeHigh={listing.rangeHigh}
        liqDown={liq.down}
        liqUp={liq.up}
      />

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column — Manage + PnL + What-if */}
        <section className="lg:col-span-2 space-y-5">
          {/* Manage panel — only when position is actionable (OPEN) */}
          {isOpen && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-base font-semibold">Manage position</h2>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  disabled={closing}
                  className="text-sm font-semibold px-4 py-2 rounded-md border border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-red-50 transition disabled:opacity-50"
                >
                  {closing ? 'awaiting keeper…' : 'Close position'}
                </button>
              </div>

              {/* Add Margin — mode buttons (ETH | USDC | both) match Open modal */}
              <div className="rounded-md border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                  <label className="text-sm font-semibold inline-flex items-center gap-1">
                    + Add Margin
                    <HelpPopover label="Зачем добавлять маржу" width="w-72">
                      <p className="font-semibold mb-1">Top up margin</p>
                      <p>Reserve вырастет → ликвидация отодвинется. Effective leverage снизится. Полезно если HF приближается к 1.0.</p>
                    </HelpPopover>
                  </label>
                  <div className="inline-flex rounded border border-gray-300 overflow-hidden text-[10px]">
                    <button
                      type="button"
                      onClick={() => switchMarginMode('t0')}
                      className={'px-2 py-0.5 ' + (marginMode === 't0' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
                    >{listing.pair.token0}</button>
                    <button
                      type="button"
                      onClick={() => switchMarginMode('t1')}
                      className={'px-2 py-0.5 border-l border-gray-300 ' + (marginMode === 't1' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
                    >{listing.pair.token1}</button>
                    <button
                      type="button"
                      onClick={() => switchMarginMode('both')}
                      className={'px-2 py-0.5 border-l border-gray-300 ' + (marginMode === 'both' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
                    >both</button>
                  </div>
                </div>

                {marginMode !== 'both' && (
                  <TokenAmountInput
                    symbol={marginMode === 't0' ? listing.pair.token0 : listing.pair.token1}
                    amount={marginMode === 't0' ? addT0 : addT1}
                    onChange={v => marginMode === 't0' ? setAddT0(v) : setAddT1(v)}
                    usdEquiv={marginMode === 't0' ? addT0 * price : addT1}
                    stepHint={marginMode === 't0' ? 0.1 : 250}
                    decimals={marginMode === 't0' ? 4 : 2}
                  />
                )}
                {marginMode === 'both' && (
                  <div className="space-y-2">
                    <TokenAmountInput
                      symbol={listing.pair.token0}
                      amount={addT0}
                      onChange={setAddT0}
                      usdEquiv={addT0 * price}
                      stepHint={0.1}
                      decimals={4}
                    />
                    <TokenAmountInput
                      symbol={listing.pair.token1}
                      amount={addT1}
                      onChange={setAddT1}
                      usdEquiv={addT1}
                      stepHint={250}
                      decimals={2}
                    />
                    <div className="flex items-baseline justify-between text-[10px] num pt-0.5 border-t border-gray-100">
                      <span className="text-gray-500">Total margin add</span>
                      <span className="text-gray-900 font-semibold">{fmtUSD(addUSD)}</span>
                    </div>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {[250, 500, 1000, 5000].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAddTotal(p)}
                      className={
                        'px-2 py-1.5 text-[11px] font-medium rounded border transition num ' +
                        (Math.abs(addUSD - p) < 0.5
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500')
                      }
                    >${(p / 1000).toFixed(p < 1000 ? 2 : 0)}{p >= 1000 ? 'K' : ''}</button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAddTotal(25_000)}
                    className="px-2 py-1.5 text-[11px] font-semibold rounded border border-gray-900 text-gray-900 hover:bg-gray-50 transition num"
                    title="Pull max balance from wallet (~$25K)"
                  >Max</button>
                </div>

                {addUSD > 0 && (
                  <div className="mt-2 text-[11px] text-gray-600 num">
                    Liq distance: <span className="font-medium">{closerLiqDistance.toFixed(1)}%</span>
                    {' '}→{' '}
                    <span className="font-semibold text-[var(--color-status-success)]">
                      ~{((closerLiqDistance * (position.marginValueUSD + addUSD)) / position.marginValueUSD).toFixed(1)}%
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={addUSD <= 0}
                  onClick={() => alert(`Mock: add ${fmtUSD(addUSD)} margin (${marginMode === 'both' ? `${addT0.toFixed(4)} ${listing.pair.token0} + ${addT1.toFixed(2)} ${listing.pair.token1}` : marginMode === 't0' ? `${addT0.toFixed(4)} ${listing.pair.token0}` : `${addT1.toFixed(2)} ${listing.pair.token1}`})`)}
                  className={
                    'mt-3 w-full text-sm font-semibold px-3 py-2 rounded-md transition ' +
                    (addUSD > 0
                      ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  }
                >
                  Add {addUSD > 0 ? fmtUSD(addUSD) : 'margin'}
                </button>
              </div>

              {/* Remove Margin */}
              <div className="rounded-md border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm font-semibold inline-flex items-center gap-1">
                    − Remove Margin
                    <HelpPopover label="Withdraw excess margin" width="w-72">
                      <p>Если позиция в плюсе — лишнюю маржу можно вернуть на кошелёк <strong>не закрывая позицию</strong>. Минимум 15% от initial остаётся как буфер.</p>
                    </HelpPopover>
                  </label>
                  <span className="text-[11px] text-gray-500 num">max {fmtUSD(maxRemovableUSD)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={removeAmount || ''}
                    onChange={e => setRemoveAmount(Math.min(Math.max(0, Number(e.target.value)), maxRemovableUSD))}
                    placeholder="0"
                    max={maxRemovableUSD}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm num focus:outline-none focus:border-gray-500"
                  />
                  <span className="text-xs text-gray-500 self-center">USD</span>
                  <button
                    type="button"
                    disabled={removeAmount <= 0 || removeAmount > maxRemovableUSD}
                    onClick={() => alert(`Mock: remove ${fmtUSD(removeAmount)} margin`)}
                    className={
                      'text-sm font-medium px-3 py-2 rounded-md border transition ' +
                      (removeAmount > 0 && removeAmount <= maxRemovableUSD
                        ? 'border-gray-900 text-gray-900 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed')
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Bump APY — anti-outbid (defensive) */}
              <div className={'rounded-md border p-4 ' + (outbidRisk === 'high' ? 'border-[var(--color-status-danger)]/40 bg-red-50/30' : outbidRisk === 'medium' ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200')}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold inline-flex items-center gap-1">
                      Bump Premium APY
                      <HelpPopover label="Зачем поднимать ставку" width="w-80">
                        <p className="font-semibold mb-1">Защита от outbid</p>
                        <p>Если incumbent bid выше твоего — тебя могут перекупить. Подними свою ставку → защитишь slot. Платить будешь больше carry.</p>
                      </HelpPopover>
                    </h3>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Текущая: <span className="num font-medium">{fmtPct(position.apyBps)}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      Highest other: <span className="num font-medium">{highestOtherBid > 0 ? fmtPct(highestOtherBid) : '—'}</span>
                      {outbidRisk === 'high' && (
                        <span className="ml-2 text-[var(--color-status-danger)] font-medium">⚠️ риск outbid</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewApyPct((position.apyBps + 100) / 100)
                      setBumpApyOpen(true)
                    }}
                    className="text-sm font-medium px-3.5 py-1.5 rounded-md border border-gray-900 text-gray-900 bg-white hover:bg-gray-50 transition whitespace-nowrap"
                  >
                    Bump APY
                  </button>
                </div>
              </div>

              {/* Take Profit — auto-close at target (P2 R-050 v1 scope) */}
              <div className="rounded-md border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold inline-flex items-center gap-1">
                    🎯 Set Take Profit
                    <HelpPopover label="TP — auto-close" width="w-80">
                      <p className="font-semibold mb-1">Take Profit</p>
                      <p className="mb-1">Keeper закроет позицию автоматически когда цена достигнет target. PnL зафиксируется по live-цене Uniswap на следующем блоке после события.</p>
                      <p className="text-[11px] text-gray-500">Можно отменить или изменить пока цена не дошла до target.</p>
                    </HelpPopover>
                  </h3>
                  {tpSet && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      armed at {fmtPriceShort(tpPriceNum)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      value={tpPriceStr}
                      onChange={e => setTpPriceStr(e.target.value)}
                      placeholder={`e.g. ${(listing.currentPrice * 1.05).toFixed(2)}`}
                      className="w-full pl-7 pr-3 py-2 text-sm num border border-gray-300 rounded focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={tpPriceNum <= 0}
                    onClick={() => {
                      setTpSet(true)
                      alert(`Mock: Take Profit armed at ${fmtPriceShort(tpPriceNum)} (${tpDistancePct >= 0 ? '+' : ''}${tpDistancePct.toFixed(2)}% from now)`)
                    }}
                    className={
                      'text-sm font-medium px-3 py-2 rounded-md border transition whitespace-nowrap ' +
                      (tpPriceNum > 0
                        ? 'border-gray-900 text-gray-900 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed')
                    }
                  >
                    {tpSet ? 'Update TP' : 'Set TP'}
                  </button>
                  {tpSet && (
                    <button
                      type="button"
                      onClick={() => { setTpSet(false); setTpPriceStr('') }}
                      className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {tpPriceNum > 0 && !tpSet && (
                  <p className="mt-1.5 text-[11px] text-gray-500 num">
                    Distance from now: <span className="font-medium" style={{ color: tpDistancePct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
                      {tpDistancePct >= 0 ? '+' : ''}{tpDistancePct.toFixed(2)}%
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buyout-back panel — only for OUTBID_PENDING */}
          {isOutbidPending && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-base font-semibold">Buyout back</h2>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Withdraw margin & give up slot
                </button>
              </div>
              <p className="text-sm text-gray-700">
                Перебить incumbent (highest bid <span className="num font-semibold">{fmtPct(highestOtherBid)}</span>) — выставить свой Premium APY выше, чтобы вернуть позицию. Carry увеличится, но slot защищён.
              </p>
              {isOutOfMargin ? (
                <div className="rounded-md border border-[var(--color-status-danger)]/40 bg-red-50/40 p-3 text-sm">
                  <strong className="text-[var(--color-status-danger)]">Top up margin first.</strong>
                  {' '}Текущего резерва не хватит на bump'нутую ставку даже на 1 day runway. Сначала добавь маржу (выше на странице есть форма) → потом возвращайся сюда.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewApyPct((highestOtherBid + 100) / 100)
                    setBuyoutBackOpen(true)
                  }}
                  className="w-full text-sm font-semibold px-4 py-2 rounded-md bg-[var(--color-role-trader)] text-white hover:opacity-90 transition"
                >
                  Bump APY to {((highestOtherBid + 100) / 100).toFixed(2)}% → Buyout back
                </button>
              )}
            </div>
          )}

          {/* PnL breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold">PnL breakdown</h2>
              <span
                className="num font-bold text-xl"
                style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))}
                <span className="text-xs font-medium text-gray-500 ml-1">net</span>
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <BreakdownRow
                label="Gross Impermanent Profit"
                hint={`Цена двинулась ${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}% от entry`}
                value={<span className="num font-medium text-[var(--color-status-success)]">+{fmtUSD(grossIPUSD)}</span>}
              />
              <BreakdownRow
                label="Premium APY accrued"
                hint={`${fmtPct(position.pendingPremApyBps, { signed: true })} × ${hoursOpen.toFixed(1)}h held`}
                value={<span className="num text-[var(--color-status-danger)]">−{fmtUSD(Math.abs(accruedPremUSD))}</span>}
              />
              <BreakdownRow
                label="Uniswap fees accrued"
                hint={`${fmtPct(position.pendingRefApyBps)} × ${hoursOpen.toFixed(1)}h held`}
                value={<span className="num text-[var(--color-status-danger)]">−{fmtUSD(accruedUniswapUSD)}</span>}
              />
              <BreakdownRow
                label="Protocol fees"
                hint="0.05% от notional · charged on open + on close"
                value={<span className="num text-[var(--color-status-danger)]">−{fmtUSD(protocolFeesUSD)}</span>}
              />
              <BreakdownRow
                label="Close cost (est.)"
                hint="Keeper fee + swap slippage estimate"
                value={<span className="num text-gray-500">−{fmtUSD(closeCostUSD)}</span>}
              />
            </div>
            <hr className="border-gray-100 my-2.5" />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">Net Live PnL (estimate)</span>
              <span
                className="num font-bold"
                style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))}
              </span>
            </div>
            <details className="mt-3 border-t border-gray-100 pt-2">
              <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700">
                Show raw Escrow / Restore obligation (advanced)
              </summary>
              <div className="mt-2 space-y-1 text-[11px] text-gray-600 num">
                <BreakdownRow
                  label="Available Escrow"
                  hint="Total token-amount sitting under the trader-position escrow at current pool price"
                  value={<span>{fmtUSD(position.marginValueUSD + grossIPUSD)}</span>}
                />
                <BreakdownRow
                  label="Restore obligation"
                  hint="What gets returned to the LP at close (margin equivalent at entry-price)"
                  value={<span>{fmtUSD(position.marginValueUSD)}</span>}
                />
                <p className="text-[10px] text-gray-500 leading-snug pt-1">
                  Delta = Available − Restore = <strong>{fmtUSD(grossIPUSD)}</strong> Impermanent Profit (before carry/fees). Broken out here for symmetry with on-chain accounting (P2 R-030/031).
                </p>
              </div>
            </details>
            <p className="text-[10px] text-gray-500 mt-2 leading-snug">
              Финальное число определится на close по live-цене Uniswap. Carry начисляется ежесекундно.
            </p>
          </div>

          {/* What-if simulator */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold mb-3">What-if simulator</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">Price moves</span>
                <input
                  type="range"
                  min={-whatIfRange}
                  max={whatIfRange}
                  step={whatIfRange / 50}
                  value={whatIfMove}
                  onChange={e => setWhatIfMove(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-role-trader)]"
                />
                <span className="num font-semibold text-sm w-16 text-right">
                  {whatIfMove >= 0 ? '+' : ''}{whatIfMove.toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 num text-sm">
                <MetricBlock label="Price target" value={fmtPriceShort(whatIfPrice)} />
                <MetricBlock label="Gross IP" value={`+${fmtUSD(whatIfIP)}`} tone="success" />
                <MetricBlock
                  label="Net PnL est."
                  value={`${whatIfNet >= 0 ? '+' : '−'}${fmtUSD(Math.abs(whatIfNet))}`}
                  tone={whatIfNet >= 0 ? 'success' : 'danger'}
                />
              </div>
              {Math.abs(whatIfPrice - position.entryPrice) > Math.abs(liq.down - position.entryPrice) && (
                <p className="text-[11px] text-[var(--color-status-danger)] mt-1.5">
                  ⚠️ При таком движении позиция ликвидируется до этой цены — реальный PnL = −margin.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Right column — recap card + competition + pro metrics */}
        <aside className="space-y-3">
          {/* Closest liq recap (small reminder of summary card) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Closest liquidation</div>
            <div className="num text-xl font-bold leading-tight" style={{ color: hfCol }}>
              {fmtPriceShort(closerLiq)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: hfCol }}>
              {closerLiqDirection} {closerLiqDistance.toFixed(2)}% from now
            </div>
            <hr className="border-gray-100 my-3" />
            <div className="text-[11px] num text-gray-600 space-y-1">
              <div>Margin posted: <span className="text-gray-900 font-medium">{fmtUSD(position.marginValueUSD)}</span></div>
              <div>Reserve: <span className="text-gray-900 font-medium">{position.reservePctOfInitial}% · {fmtUSD(position.reserveUSD)}</span></div>
              <div>
                Outbid risk: <OutbidRiskBadge level={outbidRisk} myApy={position.apyBps} highestOther={highestOtherBid} compact />
              </div>
            </div>
          </div>

          {/* Competition table — when others on the listing */}
          {otherPositions.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold">Other positions ({otherPositions.length})</h3>
                <OutbidRiskBadge level={outbidRisk} myApy={position.apyBps} highestOther={highestOtherBid} compact />
              </div>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left font-medium pb-1.5">Trader</th>
                    <th className="text-right font-medium pb-1.5">Notional</th>
                    <th className="text-right font-medium pb-1.5">APY</th>
                  </tr>
                </thead>
                <tbody>
                  {otherPositions.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-1.5 num">{shortAddr(p.trader)}</td>
                      <td className="py-1.5 text-right num">{fmtUSD(p.notionalUSD)}</td>
                      <td className="py-1.5 text-right num font-medium">
                        <span
                          className={p.apyBps > position.apyBps ? 'text-[var(--color-status-danger)] font-semibold' : ''}
                          title={p.apyBps > position.apyBps ? 'Выше твоей ставки — может перекупить' : ''}
                        >
                          {fmtPct(p.apyBps, { signed: true })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-500 mt-2 leading-snug">
                Если кто-то предложит LP'у больший Premium APY — он перекупит позицию принудительно. Маржу + накопленный PnL вернут.
              </p>
            </div>
          )}

          {/* Pro metrics — collapsible */}
          <PositionProMetrics
            position={position}
            listing={listing}
            grossIP={grossIPUSD}
            accruedCarry={accruedUniswapUSD + accruedPremUSD}
          />
        </aside>
      </div>

      {/* Modals */}
      <HighStakesConfirmModal
        open={bumpApyOpen}
        compact
        title="Update Premium APY — confirm"
        subtitle="Подняв собственную ставку, ты делаешь позицию устойчивой к outbid'ам, но платишь больше carry."
        currentState={[
          { label: 'Position', value: position.id },
          { label: 'Current APY', value: fmtPct(position.apyBps) },
          { label: 'Highest other bid', value: highestOtherBid > 0 ? fmtPct(highestOtherBid) : '—' },
        ]}
        newState={[
          { label: 'New APY', value: `${newApyPct.toFixed(2)}%`, deltaTone: newApyPct * 100 > position.apyBps ? 'negative' : 'neutral' },
          {
            label: 'Δ Carry / hour',
            value: `~${(((newApyPct * 100 - position.apyBps) / 10000 * position.notionalUSD / 8760)).toFixed(2)} USD`,
            deltaTone: 'negative',
          },
        ]}
        risks={[
          'Carry payment увеличится — caused by your own bid.',
          'Other traders могут всё равно перебить более высокой ставкой.',
        ]}
        irreversibilityNote="Bump APY срабатывает на следующем блоке Arbitrum. Ставку нельзя снизить обратно ниже текущего minimum."
        confirmType="checkbox"
        confirmButtonLabel="Confirm bump"
        onConfirm={() => setBumpApyOpen(false)}
        onCancel={() => setBumpApyOpen(false)}
      />

      <HighStakesConfirmModal
        open={buyoutBackOpen}
        compact
        title="Buyout back — confirm"
        subtitle="Поднять Premium APY выше incumbent и вернуть позицию. Carry увеличится."
        currentState={[
          { label: 'Position', value: position.id },
          { label: 'Status', value: 'outbid' },
          { label: 'Highest incumbent bid', value: fmtPct(highestOtherBid) },
        ]}
        newState={[
          { label: 'Your new APY', value: `${newApyPct.toFixed(2)}%`, deltaTone: 'negative' },
          { label: 'Slot restored', value: 'yes', deltaTone: 'positive' },
        ]}
        risks={[
          'Можно снова быть перекуплен ещё более высокой ставкой.',
          'Carry payment вырастет до новой ставки.',
        ]}
        irreversibilityNote="Bump срабатывает на следующем блоке."
        confirmType="checkbox"
        confirmButtonLabel="Confirm buyout back"
        onConfirm={() => setBuyoutBackOpen(false)}
        onCancel={() => setBuyoutBackOpen(false)}
      />

      <HighStakesConfirmModal
        open={closeOpen}
        compact
        title="Close position — confirm"
        subtitle="Закрытие на следующем блоке Arbitrum по live-цене Uniswap."
        currentState={[
          { label: 'Position', value: position.id },
          { label: 'Notional', value: fmtUSD(position.notionalUSD) },
          { label: 'Entry → now', value: `${fmtPriceShort(position.entryPrice)} → ${fmtPriceShort(listing.currentPrice)}` },
          { label: 'Margin', value: fmtUSD(position.marginValueUSD) },
        ]}
        newState={[
          { label: 'Close price', value: 'current Uniswap', deltaTone: 'neutral' },
          {
            label: 'Est. residual',
            value: fmtUSD(position.marginValueUSD + livePnL),
            deltaTone: livePnL >= 0 ? 'positive' : 'negative',
          },
        ]}
        risks={[
          'Закрытие по live-цене Uniswap — slippage реальный.',
          'Uniswap fees + Premium APY accrued списываются перед residual.',
          'Если маржи недостаточно — residual может быть нулевой.',
        ]}
        irreversibilityNote="После того как закрытие подхватят — отменить нельзя."
        confirmType="checkbox"
        confirmButtonLabel="Confirm close"
        onConfirm={() => {
          setCloseOpen(false)
          setClosing(true)
        }}
        onCancel={() => setCloseOpen(false)}
      />
    </div>
  )
}

// === Components ===

// Banner — context strip used at the top of the page for state-driven
// notices (out-of-range / out-of-margin / awaiting keeper / settling).
function Banner({ tone, title, body }: { tone: 'amber' | 'danger' | 'blue'; title: string; body: string }) {
  const cls =
    tone === 'danger'
      ? 'border-[var(--color-status-danger)]/40 bg-red-50/50 text-[var(--color-status-danger)]'
      : tone === 'amber'
      ? 'border-amber-300 bg-amber-50/50 text-amber-900'
      : 'border-blue-200 bg-blue-50/50 text-blue-900'
  return (
    <div className={'mb-4 rounded-md border px-4 py-2.5 ' + cls}>
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs mt-0.5 opacity-90">{body}</p>
    </div>
  )
}

function PriceChart({
  entry,
  current,
  rangeLow,
  rangeHigh,
  liqDown,
  liqUp,
}: {
  entry: number
  current: number
  rangeLow: number
  rangeHigh: number
  liqDown: number
  liqUp: number
}) {
  // Compute Y-domain — extend a bit past liq bounds
  const allValues = [entry, current, rangeLow, rangeHigh, liqDown, liqUp]
  const minY = Math.min(...allValues) * 0.995
  const maxY = Math.max(...allValues) * 1.005
  const yRange = maxY - minY

  // Generate fake 24h price path through entry → current
  const points = useMemo(() => {
    const arr: Array<{ x: number; y: number }> = []
    const n = 30
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      // smooth interp from entry to current with sinusoidal noise
      const y = entry + (current - entry) * t + (Math.sin(t * 7 + entry) * yRange * 0.04)
      arr.push({ x: t * 100, y })
    }
    return arr
  }, [entry, current, yRange])

  const yToPx = (y: number) => 100 - ((y - minY) / yRange) * 100

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${yToPx(p.y)}`).join(' ')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold">Price · 24h</h2>
        <span className="text-[11px] text-gray-500">mock data for prototype</span>
      </div>
      <div className="relative w-full" style={{ aspectRatio: '4 / 1.4' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          {/* Range zone */}
          <rect
            x="0"
            y={yToPx(rangeHigh)}
            width="100"
            height={yToPx(rangeLow) - yToPx(rangeHigh)}
            fill="var(--color-role-lp)"
            opacity="0.07"
          />
          {/* Range bounds */}
          <line x1="0" y1={yToPx(rangeHigh)} x2="100" y2={yToPx(rangeHigh)} stroke="var(--color-role-lp)" strokeOpacity="0.4" strokeDasharray="1,1" strokeWidth="0.3" />
          <line x1="0" y1={yToPx(rangeLow)} x2="100" y2={yToPx(rangeLow)} stroke="var(--color-role-lp)" strokeOpacity="0.4" strokeDasharray="1,1" strokeWidth="0.3" />
          {/* Liq down (red dashed) */}
          <line x1="0" y1={yToPx(liqDown)} x2="100" y2={yToPx(liqDown)} stroke="var(--color-status-danger)" strokeDasharray="2,1" strokeWidth="0.3" />
          {/* Liq up */}
          <line x1="0" y1={yToPx(liqUp)} x2="100" y2={yToPx(liqUp)} stroke="var(--color-status-danger)" strokeDasharray="2,1" strokeWidth="0.3" />
          {/* Price path */}
          <path d={pathD} fill="none" stroke="oklch(40% 0 0)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          {/* Entry marker */}
          <circle cx="0" cy={yToPx(entry)} r="0.8" fill="oklch(40% 0 0)" />
          {/* Current marker */}
          <circle cx="100" cy={yToPx(current)} r="1.2" fill="var(--color-role-trader)" />
        </svg>
        {/* Labels — absolute positioned */}
        <div className="absolute right-1 text-[9px] num text-[var(--color-role-trader)] font-semibold" style={{ top: `${yToPx(current)}%`, transform: 'translateY(-50%)' }}>
          ▶ {fmtPriceShort(current)}
        </div>
        <div className="absolute left-1 text-[9px] num text-gray-600" style={{ top: `${yToPx(entry)}%`, transform: 'translateY(-50%)' }}>
          entry {fmtPriceShort(entry)}
        </div>
        <div className="absolute right-1 text-[9px] num text-[var(--color-status-danger)]" style={{ top: `${yToPx(liqDown)}%`, transform: 'translateY(-50%)' }}>
          liq ↓ {fmtPriceShort(liqDown)}
        </div>
        <div className="absolute right-1 text-[9px] num text-[var(--color-status-danger)]" style={{ top: `${yToPx(liqUp)}%`, transform: 'translateY(-50%)' }}>
          liq ↑ {fmtPriceShort(liqUp)}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[var(--color-role-trader)]"></span>current price</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-700"></span>entry</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-1 border-b-2 border-dashed border-[var(--color-role-lp)]"></span>LP range</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-1 border-b-2 border-dashed border-[var(--color-status-danger)]"></span>liquidation</span>
      </div>
    </div>
  )
}

function PositionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; tip: string }> = {
    OPEN: { label: 'open', cls: 'bg-gray-50 text-gray-700 border-gray-200', tip: 'Активна, начисляет PnL и carry' },
    CLOSE_REQUESTED: { label: 'awaiting keeper', cls: 'bg-blue-50 text-blue-800 border-blue-200', tip: 'Ждёт keeper для закрытия' },
    CLOSING: { label: 'settling…', cls: 'bg-blue-50 text-blue-800 border-blue-200', tip: 'Keeper считает финальный residual' },
    OUTBID_PENDING: { label: 'outbid', cls: 'bg-amber-50 text-amber-900 border-amber-300', tip: 'Перекуплена другим трейдером — можешь Buyout back если хватает маржи' },
  }
  const d = map[status] ?? { label: status.toLowerCase(), cls: 'bg-gray-100 text-gray-700 border-gray-300', tip: '' }
  return (
    <span className={'text-xs px-2 py-0.5 rounded-full font-medium border cursor-help ' + d.cls} title={d.tip}>
      {d.label}
    </span>
  )
}

function OutbidRiskBadge({
  level,
  myApy,
  highestOther,
  compact,
}: {
  level: 'safe' | 'medium' | 'high'
  myApy: number
  highestOther: number
  compact?: boolean
}) {
  const cfg = {
    safe: { emoji: '🟢', label: 'safe', cls: 'text-[var(--color-status-success)]', tip: `Твоя ставка ${fmtPct(myApy)} существенно выше ${fmtPct(highestOther)} — outbid маловероятен.` },
    medium: { emoji: '🟡', label: 'medium', cls: 'text-amber-700', tip: `Кто-то ставит ${fmtPct(highestOther)} — близко к твоим ${fmtPct(myApy)}. Risk of outbid: medium.` },
    high: { emoji: '🔴', label: 'high', cls: 'text-[var(--color-status-danger)]', tip: `Активный бид ${fmtPct(highestOther)} ≥ твоего ${fmtPct(myApy)}. Тебя могут перекупить на следующем блоке.` },
  }[level]
  if (compact) {
    return (
      <span className={'text-xs font-medium cursor-help ' + cfg.cls} title={cfg.tip}>
        {cfg.emoji} {cfg.label}
      </span>
    )
  }
  return (
    <span className={'text-xs font-medium cursor-help inline-flex items-center gap-1 ' + cfg.cls} title={cfg.tip}>
      {cfg.emoji} Outbid risk: {cfg.label}
    </span>
  )
}

function BreakdownRow({ label, hint, value }: { label: string; hint?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <div className="text-[10px] text-gray-500 leading-tight">{hint}</div>}
      </div>
      <div>{value}</div>
    </div>
  )
}

function MetricBlock({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger' | 'default'
}) {
  const color =
    tone === 'success'
      ? 'var(--color-status-success)'
      : tone === 'danger'
      ? 'var(--color-status-danger)'
      : undefined
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide leading-tight">{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function PositionProMetrics({
  position,
  listing,
  grossIP,
  accruedCarry,
}: {
  position: import('@/lib/types').Position
  listing: import('@/lib/types').Listing
  grossIP: number
  accruedCarry: number
}) {
  // Vol estimates (mocked — derived from listing range)
  const rangeWidthPct = ((listing.rangeHigh - listing.rangeLow) / listing.currentPrice) * 100
  const ivProxy = rangeWidthPct * 0.6
  const seed = parseInt(position.id.replace(/\D/g, '') || '0') + 31
  const realizedVolSinceEntry = ivProxy * (0.5 + (seed % 9) / 15)
  // Theta = real carry decay rate ($/h)
  const theta = accruedCarry / Math.max(0.5, (Date.now() - position.openedAt) / 3_600_000)
  // IP/Carry ratio
  const ipCarryRatio = grossIP / Math.max(0.01, accruedCarry)

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold hover:text-gray-700 inline-flex items-center gap-2">
        Pro metrics
        <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">advanced</span>
      </summary>

      <div className="mt-3 space-y-3 text-xs">
        {/* Vol context */}
        <div className="rounded border border-gray-200 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5 inline-flex items-center gap-1">
            Vol context
            <HelpPopover label="Формулы vol" width="w-72">
              <p className="font-semibold mb-1">Vol derivation</p>
              <p className="mb-1"><strong>Realized since entry</strong> = σ(log returns) на swap-events Uniswap pool с openedAt по now.</p>
              <p><strong>IV (LP-implied)</strong> ≈ rangeWidth × 0.6 — наша эвристика. Не market-implied.</p>
            </HelpPopover>
          </div>
          <div className="grid grid-cols-2 gap-2 num">
            <ProRow label="Realized since entry" value={`${realizedVolSinceEntry.toFixed(2)}%`} />
            <ProRow label="IV (LP-implied)" value={`${ivProxy.toFixed(2)}%`} />
          </div>
        </div>

        {/* PnL attribution */}
        <div className="rounded border border-gray-200 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">PnL attribution</div>
          <div className="space-y-1 num">
            <ProRow label="Gross IP" value={`+${fmtUSD(grossIP)}`} tone="success" />
            <ProRow label="Carry paid" value={`−${fmtUSD(accruedCarry)}`} tone="danger" />
            <ProRow label="Θ carry rate" value={`−${fmtUSD(theta)}/h`} tone="danger" />
            <ProRow
              label="IP / Carry ratio"
              value={`${ipCarryRatio.toFixed(2)}×`}
              tone={ipCarryRatio > 1 ? 'success' : 'danger'}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            Ratio &gt; 1× = IP покрывает carry. &lt; 1× = ты в минусе если закроешься сейчас.
          </p>
        </div>

        {/* Greeks placeholder — coming in v2 */}
        <div className="rounded border border-gray-200 bg-gray-50/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Greeks (Δ, Γ) — coming in v2</div>
          <p className="text-[10px] text-gray-500 leading-snug">
            Implementation pending — proper V3 LP NFT math + hedge size suggestion. Hide лучше чем wrong-math estimates.
          </p>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-1">
          <button
            type="button"
            onClick={() => alert('CSV export — в проде. Mock: position history + P&L attribution.')}
            className="text-[10px] font-medium px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            ↓ Export CSV
          </button>
          <p className="text-[10px] text-gray-400 leading-snug">
            <strong>Data sources:</strong> vol → Uniswap V3 subgraph swap events · carry rate → live position state · greeks → client-side V3 math (TBD).
          </p>
        </div>
      </div>
    </details>
  )
}

function ProRow({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'var(--color-status-success)' : tone === 'danger' ? 'var(--color-status-danger)' : undefined
  return (
    <div>
      <div className="text-[10px] text-gray-500 leading-tight">{label}</div>
      <div className="font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

function fmtPriceShort(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toExponential(2)}`
}
