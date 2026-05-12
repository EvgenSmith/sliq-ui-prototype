// Public Market Transactions feed — все closed positions от всех trader'ов.
// v1 reference pattern: wallet column, full ledger of settlements.
// "Mine only" toggle filters to connected wallet; default = public.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { closedPositions, connectedWallet } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD, shortAddr } from '@/lib/format'
import type { ClosedPosition } from '@/lib/types'
import { CopyAddress } from '@/components/CopyAddress'
import { HelpPopover } from '@/components/HelpPopover'

type OutcomeFilter = 'all' | 'clean' | 'margin-call' | 'liquidated' | 'profit' | 'loss'
type SortId = 'closed-desc' | 'closed-asc' | 'pnl-desc' | 'pnl-asc' | 'notional-desc' | 'move-desc'
type Timeframe = '24h' | '7d' | '30d' | 'all'

const PAGE_SIZES = [25, 50, 100, -1] as const

export function ClosedPositionsList() {
  const [mineOnly, setMineOnly] = useState(false)
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [traderFilter, setTraderFilter] = useState<string>('all')
  const [timeframe, setTimeframe] = useState<Timeframe>('all')
  const [sort, setSort] = useState<SortId>('closed-desc')
  const [pageSize, setPageSize] = useState<number>(50)
  const [page, setPage] = useState<number>(1)

  const allPairs = useMemo(() => {
    const set = new Set<string>()
    closedPositions.forEach(c => set.add(`${c.pair.token0}/${c.pair.token1}`))
    return Array.from(set).sort()
  }, [])

  const filtered = useMemo(() => {
    let out = [...closedPositions]
    const now = Date.now()
    const tfMs: Record<Timeframe, number> = {
      '24h': 1000 * 60 * 60 * 24,
      '7d': 1000 * 60 * 60 * 24 * 7,
      '30d': 1000 * 60 * 60 * 24 * 30,
      all: Infinity,
    }
    if (timeframe !== 'all') out = out.filter(c => c.closedAt >= now - tfMs[timeframe])
    if (mineOnly) out = out.filter(c => c.trader === connectedWallet.address)
    if (traderFilter !== 'all') out = out.filter(c => c.trader === traderFilter)
    if (pairFilter !== 'all') {
      out = out.filter(c => `${c.pair.token0}/${c.pair.token1}` === pairFilter)
    }
    if (outcomeFilter === 'clean') out = out.filter(c => c.paidInFull && !c.liquidated)
    else if (outcomeFilter === 'margin-call') out = out.filter(c => !c.paidInFull && !c.liquidated)
    else if (outcomeFilter === 'liquidated') out = out.filter(c => c.liquidated === true)
    else if (outcomeFilter === 'profit') out = out.filter(c => c.residualUSD - c.marginPostedUSD > 0)
    else if (outcomeFilter === 'loss') out = out.filter(c => c.residualUSD - c.marginPostedUSD < 0)

    switch (sort) {
      case 'closed-desc':
        out.sort((a, b) => b.closedAt - a.closedAt)
        break
      case 'closed-asc':
        out.sort((a, b) => a.closedAt - b.closedAt)
        break
      case 'pnl-desc':
        out.sort((a, b) => (b.residualUSD - b.marginPostedUSD) - (a.residualUSD - a.marginPostedUSD))
        break
      case 'pnl-asc':
        out.sort((a, b) => (a.residualUSD - a.marginPostedUSD) - (b.residualUSD - b.marginPostedUSD))
        break
      case 'notional-desc':
        out.sort((a, b) => b.notionalUSD - a.notionalUSD)
        break
      case 'move-desc':
        out.sort((a, b) => {
          const moveA = Math.abs((a.exitPrice - a.entryPrice) / a.entryPrice)
          const moveB = Math.abs((b.exitPrice - b.entryPrice) / b.entryPrice)
          return moveB - moveA
        })
        break
    }
    return out
  }, [mineOnly, outcomeFilter, pairFilter, traderFilter, timeframe, sort])

  // Aggregate stats for the visible filter set
  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((s, c) => s + c.notionalUSD, 0)
    const liquidatedCount = filtered.filter(c => c.liquidated).length
    const marginCallCount = filtered.filter(c => !c.paidInFull && !c.liquidated).length
    const profitCount = filtered.filter(c => c.residualUSD - c.marginPostedUSD > 0).length
    return { totalVolume, liquidatedCount, marginCallCount, profitCount }
  }, [filtered])

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = pageSize === -1 ? 0 : (safePage - 1) * pageSize
  const pageEnd = pageSize === -1 ? filtered.length : pageStart + pageSize
  const visible = filtered.slice(pageStart, pageEnd)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-gray-700 max-w-3xl leading-relaxed">
          <strong>Публичный feed всех закрытых позиций.</strong>{' '}
          Кто открыл, на какой паре, насколько двинулась цена, сколько заработал. Это твоё learning material —
          смотри что работает, где случаются margin call'ы, кого ликвидировало.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 num">
          <span>
            <span className="font-semibold text-gray-900">{filtered.length}</span> closes
          </span>
          <span>·</span>
          <span>volume {fmtUSD(stats.totalVolume)}</span>
          <span>·</span>
          <span>
            <span className="text-[var(--color-status-success)] font-medium">{stats.profitCount}</span> profitable
          </span>
          {stats.marginCallCount > 0 && (
            <>
              <span>·</span>
              <span>
                <span className="text-amber-800 font-medium">{stats.marginCallCount}</span> margin call
              </span>
            </>
          )}
          {stats.liquidatedCount > 0 && (
            <>
              <span>·</span>
              <span>
                <span className="text-[var(--color-status-danger)] font-semibold">💥 {stats.liquidatedCount}</span> liquidated
              </span>
            </>
          )}
        </div>
      </header>

      {/* Filter strip */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
        {/* Timeframe */}
        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
          {(['24h', '7d', '30d', 'all'] as const).map(tf => {
            const active = timeframe === tf
            return (
              <button
                key={tf}
                type="button"
                onClick={() => { setTimeframe(tf); setPage(1) }}
                className={
                  'text-xs px-2.5 py-1 transition num ' +
                  (active ? 'bg-gray-900 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50')
                }
              >
                {tf}
              </button>
            )
          })}
        </div>

        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
          {([
            { id: 'all', label: 'All' },
            { id: 'profit', label: 'Profit' },
            { id: 'loss', label: 'Loss' },
            { id: 'clean', label: 'Clean close' },
            { id: 'margin-call', label: 'Margin call' },
            { id: 'liquidated', label: 'Liquidated' },
          ] as const).map(o => {
            const active = outcomeFilter === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => { setOutcomeFilter(o.id); setPage(1) }}
                className={
                  'text-xs px-2.5 py-1 transition ' +
                  (active ? 'bg-gray-900 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50') +
                  (o.id === 'liquidated' && !active ? ' text-[var(--color-status-danger)]' : '')
                }
              >
                {o.label}
              </button>
            )
          })}
        </div>

        <select
          value={pairFilter}
          onChange={e => { setPairFilter(e.target.value); setPage(1) }}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          aria-label="Filter by pair"
        >
          <option value="all">All pairs</option>
          {allPairs.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <label className="ml-1 flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={e => { setMineOnly(e.target.checked); setPage(1) }}
            className="w-3.5 h-3.5 accent-[var(--color-role-trader)]"
          />
          <span className="text-gray-700">Mine only ({shortAddr(connectedWallet.address)})</span>
        </label>

        {traderFilter !== 'all' && (
          <button
            type="button"
            onClick={() => { setTraderFilter('all'); setPage(1) }}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition inline-flex items-center gap-1.5"
          >
            <span>filter: {shortAddr(traderFilter)}</span>
            <span aria-hidden="true">×</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-500">Sort:</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortId)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <option value="closed-desc">Newest first</option>
            <option value="closed-asc">Oldest first</option>
            <option value="pnl-desc">PnL · high → low</option>
            <option value="pnl-asc">PnL · low → high</option>
            <option value="notional-desc">Notional · large → small</option>
            <option value="move-desc">Price move · biggest first</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-600 mb-3">No closes match this filter.</p>
          <button
            type="button"
            onClick={() => {
              setMineOnly(false)
              setOutcomeFilter('all')
              setPairFilter('all')
              setTraderFilter('all')
              setTimeframe('all')
            }}
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <FeedTable rows={visible} myAddress={connectedWallet.address} onTraderClick={addr => { setTraderFilter(addr); setPage(1) }} />

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>
                    {s === -1 ? 'All' : s}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="num">
                  {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition"
                  aria-label="Previous page"
                >
                  ←
                </button>
                <span className="num font-medium px-1">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition"
                  aria-label="Next page"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FeedTable({ rows, myAddress, onTraderClick }: { rows: ClosedPosition[]; myAddress: string; onTraderClick: (addr: string) => void }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair</th>
              <th className="text-left font-medium px-3 py-2.5">Trader</th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Notional
                  <HelpPopover label="Что такое Notional" width="w-80">
                    <p className="font-semibold mb-1">Virtual notional position size</p>
                    <p className="mb-1.5">Размер виртуальной позиции = margin × leverage. Это <strong>не</strong> реальные деньги, которые trader положил — это amount on which IP / carry начисляются.</p>
                    <p className="text-[11px] text-gray-500">Например: trader положил $1K margin × 100× плечо = $100K virtual notional. 1% движение цены → $1K IP. Carry платится годовых на этот $100K.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden md:table-cell">Entry → Exit</th>
              <th className="text-right font-medium px-3 py-2.5">% move</th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Held</th>
              <th className="text-right font-medium px-3 py-2.5">Net PnL</th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Result
                  <HelpPopover label="Какие бывают исходы" width="w-96">
                    <p className="font-semibold mb-2">Чем закончилась позиция</p>
                    <ul className="space-y-2 text-[11px] leading-snug">
                      <li>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 mr-1.5">clean close</span>
                        Trader закрылся сам (или его перекупили), все carry-debt был выплачен LP из reserve. <strong>Standard happy path.</strong>
                      </li>
                      <li>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1.5">margin call</span>
                        Reserve иссяк во время close — accrued Premium/Reference не полностью покрыли из margin. LP недополучил часть carry (нет insurance fund — это design choice). Trader получил остаток residual. Не ликвидация, но messy ending.
                      </li>
                      <li>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 mr-1.5">💥 liquidated</span>
                        Reserve упал ниже 10% от initial во время holding (adverse price move + carry burn). Keeper triggered ликвидацию — margin полностью потеряна. Самый плохой исход для trader.
                      </li>
                    </ul>
                    <p className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                      Net PnL может быть positive даже на margin call (если IP &gt; carry до момента когда reserve иссяк). На liquidated — Net PnL = −margin.
                    </p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">Closed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const net = c.residualUSD - c.marginPostedUSD
              const isMine = c.trader === myAddress
              const movePct = ((c.exitPrice - c.entryPrice) / c.entryPrice) * 100
              return (
                <tr
                  key={c.id}
                  className={
                    'border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition ' +
                    (c.liquidated ? 'bg-red-50/40' : isMine ? 'bg-blue-50/30' : '')
                  }
                >
                  <td className="px-4 py-3">
                    <Link to={`/trader/closed/${c.id}`} className="block group">
                      <span className="font-medium text-gray-900 group-hover:text-[var(--color-role-trader)] transition">
                        {c.pair.token0} / {c.pair.token1}
                      </span>
                      <span className="text-[11px] text-gray-500 num ml-2">{fmtFeeTier(c.feeTierBps)}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 num text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: addressColor(c.trader) }} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => onTraderClick(c.trader)}
                        className={
                          'hover:underline ' +
                          (isMine ? 'font-semibold text-[var(--color-role-trader)]' : 'text-gray-700')
                        }
                        title="Filter feed by this trader"
                      >
                        {shortAddr(c.trader)}
                      </button>
                      <CopyAddress address={c.trader} />
                      {isMine && (
                        <span className="text-[9px] uppercase tracking-wide font-semibold text-[var(--color-role-trader)]">you</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right num text-gray-700">{fmtUSD(c.notionalUSD)}</td>
                  <td className="px-3 py-3 text-right num text-[11px] text-gray-600 hidden md:table-cell">
                    {fmtPriceShort(c.entryPrice)} → {fmtPriceShort(c.exitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right num">
                    <span
                      className="font-semibold"
                      style={{ color: Math.abs(movePct) >= 0.1 ? 'oklch(20% 0 0)' : 'var(--color-gray-400)' }}
                    >
                      {movePct >= 0 ? '+' : ''}{movePct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right num text-xs text-gray-500 hidden lg:table-cell">
                    {c.durationHours}h
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className="num font-semibold"
                      style={{ color: net >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                    >
                      {net >= 0 ? '+' : '−'}{fmtUSD(Math.abs(net))}
                    </span>
                    <div className="text-[10px] text-gray-500 num leading-tight">
                      {fmtPct(c.apyBps, { signed: true })} APY paid
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {c.liquidated ? (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 font-semibold whitespace-nowrap cursor-help"
                        title="Резерв упал ниже 10% — ликвидация. Margin потеряна."
                      >
                        💥 liquidated
                      </span>
                    ) : c.paidInFull ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium whitespace-nowrap">
                        clean close
                      </span>
                    ) : (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium cursor-help whitespace-nowrap"
                        title={c.unpaidUSD ? `${fmtUSD(c.unpaidUSD)} carry недоплачен LP — резерв иссяк до полной оплаты` : 'Резерв иссяк во время close, carry недоплачен'}
                      >
                        margin call
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right num text-xs text-gray-500">{fmtTimeAgo(c.closedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked */}
      <div className="md:hidden rounded-lg border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
        {rows.map(c => {
          const net = c.residualUSD - c.marginPostedUSD
          const isMine = c.trader === myAddress
          const movePct = ((c.exitPrice - c.entryPrice) / c.entryPrice) * 100
          return (
            <Link
              key={c.id}
              to={`/trader/closed/${c.id}`}
              className={
                'block px-4 py-3 ' +
                (c.liquidated ? 'bg-red-50/40' : isMine ? 'bg-blue-50/30' : 'bg-white')
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">{c.pair.token0} / {c.pair.token1}</span>
                  <span className="text-[11px] text-gray-500 num">{fmtFeeTier(c.feeTierBps)}</span>
                </div>
                <span
                  className="num font-semibold text-base"
                  style={{ color: net >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                >
                  {net >= 0 ? '+' : '−'}{fmtUSD(Math.abs(net))}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] num text-gray-600">
                {fmtPriceShort(c.entryPrice)} → {fmtPriceShort(c.exitPrice)}{' '}
                <span className="font-semibold text-gray-900">({movePct >= 0 ? '+' : ''}{movePct.toFixed(2)}%)</span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] num text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: addressColor(c.trader) }} aria-hidden="true" />
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); onTraderClick(c.trader) }}
                    className={isMine ? 'font-semibold text-[var(--color-role-trader)]' : ''}
                  >
                    {shortAddr(c.trader)}
                  </button>
                  <CopyAddress address={c.trader} />
                  {isMine && <span className="text-[9px] uppercase font-semibold">you</span>}
                </span>
                <span>·</span>
                <span>{fmtUSD(c.notionalUSD)}</span>
                <span>·</span>
                <span>{c.durationHours}h</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                {c.liquidated ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 font-semibold">
                    💥 liquidated
                  </span>
                ) : c.paidInFull ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
                    clean close
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium">
                    margin call
                  </span>
                )}
                <span className="text-[10px] text-gray-500 num">{fmtTimeAgo(c.closedAt)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

function fmtPriceShort(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toExponential(2)}`
}

function addressColor(addr: string): string {
  let hash = 0
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `oklch(60% 0.14 ${hue})`
}
