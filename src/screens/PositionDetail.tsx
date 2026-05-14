// S9 Position Detail / Manage — design spec §5 (card spec v2)
// Trader manages live position: monitor PnL, add/remove margin, request close.
// Layout per spec:
//   Header → Price chart → Action panel → PnL decomposition → What-if simulator → Competition → Pro metrics
//   Right rail (sticky): Live PnL · Carry $/h · Liq prices (both) · Margin · Time held · Outbid risk

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD, shortAddr } from '@/lib/format'
import { estimateCarryPerHour, estimateLiquidationPrice, estimatePositionPnL } from '@/lib/derive'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'

export function PositionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const position = useMemo(() => positions.find(p => p.id === id), [id])
  const listing = useMemo(
    () => (position ? listings.find(l => l.id === position.listingId) : undefined),
    [position]
  )

  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [addAmount, setAddAmount] = useState<number>(0)
  const [addTwoToken, setAddTwoToken] = useState<boolean>(false)
  const [addTok0, setAddTok0] = useState<number>(0)
  const [addTok1, setAddTok1] = useState<number>(0)
  const [removeAmount, setRemoveAmount] = useState<number>(0)
  const [whatIfMove, setWhatIfMove] = useState<number>(0) // % move slider (-X to +X)
  const [bumpApyOpen, setBumpApyOpen] = useState(false)
  const [newApyPct, setNewApyPct] = useState<number>(0)

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

  // Derived live metrics
  const livePnL = estimatePositionPnL(position)
  const carryPerHour = estimateCarryPerHour(position)
  const liq = estimateLiquidationPrice(position, listing.currentPrice)
  const priceChangePct = ((listing.currentPrice - position.entryPrice) / position.entryPrice) * 100
  const liqDownDistPct = ((listing.currentPrice - liq.down) / listing.currentPrice) * 100
  const liqUpDistPct = ((liq.up - listing.currentPrice) / listing.currentPrice) * 100

  // Decomposed PnL
  const minutesOpen = (Date.now() - position.openedAt) / 60_000
  const accruedRefUSD = (position.notionalUSD * position.pendingRefApyBps / 10000 / 365 / 1440) * minutesOpen
  const accruedPremUSD = (position.notionalUSD * position.pendingPremApyBps / 10000 / 365 / 1440) * minutesOpen
  const grossIPUSD = position.notionalUSD * 0.0008 * (Math.sin(position.openedAt) * 0.5 + 0.5)

  // Pair-aware what-if range (per decision Q5)
  const pair = `${listing.pair.token0}/${listing.pair.token1}`
  const whatIfRange = pair.includes('USDC/USDT') ? 0.5 : pair.includes('USDC') || pair.includes('USDT') ? 5 : 5
  const movePct = whatIfMove / 100
  const whatIfPrice = position.entryPrice * (1 + movePct)
  const whatIfIP = position.notionalUSD * movePct * movePct / 2
  const whatIfNet = whatIfIP - accruedRefUSD - accruedPremUSD

  // Outbid risk — find other positions on same listing
  const otherPositions = positions.filter(p => p.listingId === position.listingId && p.id !== position.id && p.status === 'OPEN')
  const highestOtherBid = otherPositions.length > 0 ? Math.max(...otherPositions.map(p => p.apyBps)) : 0
  const outbidRisk: 'safe' | 'medium' | 'high' = position.apyBps > highestOtherBid + 200
    ? 'safe'
    : position.apyBps > highestOtherBid
    ? 'medium'
    : 'high'

  const maxRemovableUSD = Math.max(0, position.marginValueUSD - position.marginValueUSD * 0.15)
  const traderReceivesCarry = position.apyBps < 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/trader/positions" className="hover:underline">My Positions</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/listings/${listing.id}`} className="hover:underline">{pair}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">Position {position.id}</span>
      </nav>

      {/* Header */}
      <header className="mb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">
            {pair} · <span className="text-gray-500 num">{position.id}</span>
          </h1>
          <span className="text-xs text-gray-500 num">Uniswap v3 · {fmtFeeTier(listing.feeTierBps)}</span>
          <PositionStatusBadge status={position.status} />
          {traderReceivesCarry && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold">
              LP pays you
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1 num">
          Entry <span className="font-medium text-gray-800">{fmtPriceShort(position.entryPrice)}</span>
          {' '}→ now{' '}
          <span className="font-medium text-gray-800">{fmtPriceShort(listing.currentPrice)}</span>
          {' '}
          <span
            className="font-semibold"
            style={{ color: priceChangePct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
          >
            ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
          </span>
          <span className="mx-2 text-gray-300">·</span>
          opened {fmtTimeAgo(position.openedAt)}
          <span className="mx-2 text-gray-300">·</span>
          leverage <span className="font-medium text-gray-800">{position.effectiveLeverage}×</span>
          <span className="text-gray-400"> / opened {position.openedAtLeverage}×</span>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <section className="lg:col-span-2 space-y-5">

          {/* Price chart with markers */}
          <PriceChart
            entry={position.entryPrice}
            current={listing.currentPrice}
            rangeLow={listing.rangeLow}
            rangeHigh={listing.rangeHigh}
            liqDown={liq.down}
            liqUp={liq.up}
          />

          {/* Action panel — main controls */}
          {position.status === 'OPEN' ? (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-base font-semibold">Manage position</h2>

              {/* Add / Remove margin side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add */}
                <div>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <label className="text-sm font-medium inline-flex items-center gap-1">
                      + Margin
                      <HelpPopover label="Зачем добавлять маржу" width="w-72">
                        <p className="font-semibold mb-1">Добавить маржу</p>
                        <p>Увеличит margin, ликвидация отодвинется дальше от текущей цены. Effective leverage снизится. Полезно если цена приближается к liq границе но ты ждёшь mean-reversion.</p>
                      </HelpPopover>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddTwoToken(t => !t)}
                      className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
                    >
                      {addTwoToken ? '← USD' : '2-token'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1.5">отодвинет ликвидацию</p>
                  {!addTwoToken ? (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={addAmount || ''}
                          onChange={e => setAddAmount(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm num"
                        />
                        <span className="text-xs text-gray-500 self-center">USD</span>
                        <button
                          type="button"
                          disabled={addAmount <= 0}
                          className={
                            'text-sm font-medium px-3 py-2 rounded-md transition ' +
                            (addAmount > 0
                              ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                          }
                        >
                          Add
                        </button>
                      </div>
                      {addAmount > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1.5 num">
                          Liq distance: {liqDownDistPct.toFixed(1)}% → ~{((liqDownDistPct * (position.marginValueUSD + addAmount)) / position.marginValueUSD).toFixed(1)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500">{listing.pair.token0}</label>
                          <input
                            type="number"
                            value={addTok0 || ''}
                            onChange={e => setAddTok0(Math.max(0, Number(e.target.value)))}
                            placeholder="0"
                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm num"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">{listing.pair.token1}</label>
                          <input
                            type="number"
                            value={addTok1 || ''}
                            onChange={e => setAddTok1(Math.max(0, Number(e.target.value)))}
                            placeholder="0"
                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm num"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={addTok0 <= 0 && addTok1 <= 0}
                        className={
                          'mt-2 w-full text-sm font-medium px-3 py-2 rounded-md transition ' +
                          (addTok0 > 0 || addTok1 > 0
                            ? 'bg-[var(--color-role-lp)] text-white hover:opacity-90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                        }
                      >
                        Add
                      </button>
                    </>
                  )}
                </div>

                {/* Remove */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="text-sm font-medium inline-flex items-center gap-1">
                      − Margin (excess)
                      <HelpPopover label="Зачем снимать маржу" width="w-80">
                        <p className="font-semibold mb-1">Снять лишнюю маржу</p>
                        <p className="mb-1">Если позиция в плюсе и reserve вырос — лишнюю маржу можно вернуть на кошелёк <strong>не закрывая позицию</strong>. Capital остаётся работать в других сделках.</p>
                        <p className="text-[11px] text-gray-500">Минимум reserve = 15% от initial margin (буфер перед liquidation triggerом).</p>
                      </HelpPopover>
                    </label>
                    <span className="text-[11px] text-gray-500 num">max ≈ {fmtUSD(maxRemovableUSD)}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={removeAmount || ''}
                      onChange={e => setRemoveAmount(Math.min(Math.max(0, Number(e.target.value)), maxRemovableUSD))}
                      placeholder="0"
                      max={maxRemovableUSD}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm num"
                    />
                    <span className="text-xs text-gray-500 self-center">USD</span>
                    <button
                      type="button"
                      disabled={removeAmount <= 0 || removeAmount > maxRemovableUSD}
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
                  {removeAmount > maxRemovableUSD && (
                    <p className="text-[11px] text-[var(--color-status-danger)] mt-1.5">
                      Слишком много — резерв упадёт ниже liquidation trigger.
                    </p>
                  )}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Update APY bid — anti-outbid protection */}
              <div className="rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold inline-flex items-center gap-1">
                      Update Premium APY
                      <HelpPopover label="Зачем поднимать ставку" width="w-80">
                        <p className="font-semibold mb-1">Защита от outbid</p>
                        <p className="mb-1">Если кто-то готов платить выше — он перекупит твою позицию. Чтобы защитить — подними свою ставку до того как другой trader это сделает.</p>
                        <p className="text-[11px] text-gray-500">Минус: ты сам начнёшь платить больше carry. Плюс: incumbent slot защищён.</p>
                      </HelpPopover>
                    </h3>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Текущая ставка: <span className="num font-medium">{fmtPct(position.apyBps)}</span>
                      {outbidRisk === 'high' && (
                        <span className="ml-2 text-[var(--color-status-danger)]">⚠️ Кто-то ставит выше — риск outbid</span>
                      )}
                      {outbidRisk === 'medium' && (
                        <span className="ml-2 text-amber-700">Кто-то близко — подними чтобы избежать риска</span>
                      )}
                      {outbidRisk === 'safe' && (
                        <span className="ml-2 text-gray-500">Ставка надёжная — менять не обязательно</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewApyPct((position.apyBps + 100) / 100)
                      setBumpApyOpen(true)
                    }}
                    className="text-sm font-medium px-3 py-1.5 rounded-md border border-amber-700 text-amber-900 bg-white hover:bg-amber-100 transition whitespace-nowrap"
                  >
                    Bump APY
                  </button>
                </div>
              </div>

              {/* Request close — primary destructive action */}
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold">Request close</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Закрытие на следующем блоке Arbitrum по текущей цене Uniswap. Отменить нельзя.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  disabled={closing}
                  className="text-sm font-semibold px-4 py-2 rounded-md border border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-red-50 transition disabled:opacity-50"
                >
                  {closing ? 'awaiting keeper…' : 'Close position'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
              <p className="text-sm text-gray-700">
                Позиция в состоянии <strong>{position.status}</strong> — действия недоступны. Жди исполнения keeper'ом.
              </p>
            </div>
          )}

          {/* PnL decomposition */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold">PnL breakdown</h2>
              <span
                className="num font-bold text-xl"
                style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))} <span className="text-xs font-medium text-gray-500">net</span>
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <BreakdownRow
                label="Gross Impermanent Profit"
                hint={`Цена двинулась ${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}% от entry`}
                value={
                  <span className="num font-medium text-[var(--color-status-success)]">
                    +{fmtUSD(grossIPUSD)}
                  </span>
                }
              />
              {(() => {
                const premPerHour = (position.notionalUSD * position.pendingPremApyBps / 10000) / 8760
                const refPerHour = (position.notionalUSD * position.pendingRefApyBps / 10000) / 8760
                return (
                  <>
                    <BreakdownRow
                      label="Carry paid · Premium APY"
                      hint={`${fmtPct(position.pendingPremApyBps, { signed: true })} APY · ${(premPerHour < 0 ? '+' : '−')}${fmtUSD(Math.abs(premPerHour))}/h × ${(minutesOpen / 60).toFixed(1)}h held`}
                      value={<span className="num text-[var(--color-status-danger)]">−{fmtUSD(Math.abs(accruedPremUSD))}</span>}
                    />
                    <BreakdownRow
                      label="Carry paid · Reference Fees"
                      hint={`${fmtPct(position.pendingRefApyBps)} APY · −${fmtUSD(refPerHour)}/h × ${(minutesOpen / 60).toFixed(1)}h held`}
                      value={<span className="num text-[var(--color-status-danger)]">−{fmtUSD(accruedRefUSD)}</span>}
                    />
                  </>
                )
              })()}
            </div>
            <hr className="border-gray-100 my-2.5" />
            <div className="space-y-1.5 text-sm">
              <BreakdownRow
                label="Net Live PnL (estimate)"
                value={
                  <span
                    className="num font-bold"
                    style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                  >
                    {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))}
                  </span>
                }
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-snug">
              Финальное число определится на close по live-цене Uniswap. Carry начисляется ежесекундно — числа здесь обновляются каждый блок.
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
                <MetricBlock
                  label="Gross IP"
                  value={`+${fmtUSD(whatIfIP)}`}
                  tone="success"
                />
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

          {/* Competition / Outbid risk */}
          {otherPositions.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-semibold">Other positions on this listing ({otherPositions.length})</h2>
                <OutbidRiskBadge level={outbidRisk} myApy={position.apyBps} highestOther={highestOtherBid} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left font-medium pb-2">Trader</th>
                    <th className="text-right font-medium pb-2">Notional</th>
                    <th className="text-right font-medium pb-2">APY paid</th>
                    <th className="text-right font-medium pb-2">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {otherPositions.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2 num text-xs">{shortAddr(p.trader)}</td>
                      <td className="py-2 text-right num">{fmtUSD(p.notionalUSD)}</td>
                      <td className="py-2 text-right num font-medium">
                        <span
                          className={p.apyBps > position.apyBps ? 'text-[var(--color-status-danger)] font-semibold' : ''}
                          title={p.apyBps > position.apyBps ? 'Выше твоей ставки — может перекупить' : ''}
                        >
                          {fmtPct(p.apyBps, { signed: true })}
                        </span>
                      </td>
                      <td className="py-2 text-right num text-xs text-gray-500">{fmtTimeAgo(p.openedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-500 mt-3 leading-snug">
                Если кто-то предложит LP'у больший Premium APY чем твой — он перекупит позицию принудительно.
                Твоя маржа + накопленный PnL вернутся.
              </p>
            </div>
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-3">
          {/* Live PnL big */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 sticky top-20">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Live PnL</div>
            <div
              className="text-2xl num font-bold mt-1"
              style={{ color: livePnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
            >
              {livePnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(livePnL))}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              если закроешься сейчас (~estimate)
            </div>

            <hr className="border-gray-100 my-3" />

            {/* Carry */}
            <div className="space-y-2">
              <RightRailRow label="Carry / hour">
                <span
                  className="num font-semibold"
                  style={{ color: carryPerHour < 0 ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
                >
                  {carryPerHour < 0 ? '+' : '−'}{fmtUSD(Math.abs(carryPerHour))}/h
                </span>
              </RightRailRow>

              {/* Liquidation prices — both */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Liquidation</div>
                <div className="space-y-1 text-xs num">
                  <div className="flex justify-between">
                    <span className="text-gray-600">↓ down at</span>
                    <span
                      className="font-semibold"
                      style={{ color: liqDownDistPct < 2 ? 'var(--color-status-danger)' : liqDownDistPct < 5 ? 'var(--color-status-warning)' : 'var(--color-status-success)' }}
                    >
                      {fmtPriceShort(liq.down)} <span className="font-normal">(−{liqDownDistPct.toFixed(2)}%)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">↑ up at</span>
                    <span
                      className="font-semibold"
                      style={{ color: liqUpDistPct < 2 ? 'var(--color-status-danger)' : liqUpDistPct < 5 ? 'var(--color-status-warning)' : 'var(--color-status-success)' }}
                    >
                      {fmtPriceShort(liq.up)} <span className="font-normal">(+{liqUpDistPct.toFixed(2)}%)</span>
                    </span>
                  </div>
                </div>
              </div>

              <RightRailRow label="Margin posted">
                <span className="num">{fmtUSD(position.marginValueUSD)}</span>
              </RightRailRow>
              <RightRailRow label="Reserve">
                <span className="num">{position.reservePctOfInitial}% · {fmtUSD(position.reserveUSD)}</span>
              </RightRailRow>
              <RightRailRow label="Held">
                <span className="num">{(minutesOpen / 60).toFixed(1)}h · {fmtTimeAgo(position.openedAt)}</span>
              </RightRailRow>
              <RightRailRow label="Outbid risk">
                <OutbidRiskBadge level={outbidRisk} myApy={position.apyBps} highestOther={highestOtherBid} compact />
              </RightRailRow>
            </div>

            <hr className="border-gray-100 my-3" />

            <div className="text-[10px] text-gray-500 space-y-0.5">
              <div>Position ID: <span className="num text-gray-700">{position.id}</span></div>
              <div>
                Listing:{' '}
                <Link to={`/listings/${listing.id}`} className="text-[var(--color-role-trader)] hover:underline num">
                  {listing.id} ↗
                </Link>
              </div>
            </div>
          </div>

          {/* Position-level Pro Metrics — для опытных */}
          <PositionProMetrics
            position={position}
            listing={listing}
            grossIP={grossIPUSD}
            accruedCarry={accruedRefUSD + accruedPremUSD}
          />
        </aside>
      </div>

      {/* Bump APY modal */}
      <HighStakesConfirmModal
        open={bumpApyOpen}
        title="Update Premium APY — confirm"
        subtitle="Подняв собственную ставку, ты делаешь позицию устойчивой к outbid'ам, но платишь больше carry годовых."
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
          'Действие irreversible — ставку нельзя снизить обратно ниже текущего minimum.',
          'Other traders могут всё равно перебить более высокой ставкой.',
        ]}
        irreversibilityNote="Bump APY срабатывает на следующем блоке Arbitrum."
        confirmType="checkbox"
        confirmButtonLabel="Confirm bump"
        onConfirm={() => setBumpApyOpen(false)}
        onCancel={() => setBumpApyOpen(false)}
      />

      <HighStakesConfirmModal
        open={closeOpen}
        title="Close position — confirm"
        subtitle="Закрытие исполнится на следующем блоке Arbitrum по текущей цене Uniswap. Отменить нельзя."
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
          'Reference Fees + Premium APY списываются перед твоим residual.',
          'Если маржи недостаточно — residual может быть нулевой.',
        ]}
        irreversibilityNote="Как только закрытие подхватят (обычно следующий блок) — отменить нельзя."
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
    OUTBID_PENDING: { label: 'forced close', cls: 'bg-amber-50 text-amber-900 border-amber-300', tip: 'Перекуплена другим трейдером' },
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

function RightRailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      {children}
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

        {/* PnL attribution (replaces toy greeks) */}
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
