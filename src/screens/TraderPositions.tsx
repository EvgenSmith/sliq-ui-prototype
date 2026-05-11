// Trader · My positions — full v2 redesign per Жень round 3.
// Rich at-a-glance scan для trader workflow:
//   - Position ID + pair + DEX/fee chips
//   - Status chip with tooltip
//   - Notional / Live PnL (sign-colored) / Reserve health bar
//   - APY paid (Premium + Reference accruing)
//   - Effective leverage / Opened time
//   - Onboarding banner ("What you can do")
//   - Click row → /trader/positions/:id (S9) — all actions live there
//   - Health-critical rows highlighted

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { closedPositions, connectedWallet, listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'
import { estimateCarryPerHour, estimateLiquidationPrice, pairLabel } from '@/lib/derive'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import type { ClosedPosition, DexProtocol, Position, PositionStatus } from '@/lib/types'

type StatusFilter = 'all' | 'open' | 'close-requested' | 'attention'
type SortId = 'health-asc' | 'pnl-desc' | 'pnl-asc' | 'notional-desc' | 'opened-desc'

const OPEN_STATUSES: PositionStatus[] = ['OPEN', 'CLOSE_REQUESTED', 'CLOSING', 'OUTBID_PENDING']
const PAGE_SIZES = [25, 50, 100, -1] as const // -1 = all

export function TraderPositions() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortId>('health-asc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState<number>(1)
  const [closedPageSize, setClosedPageSize] = useState<number>(25)
  const [closedPage, setClosedPage] = useState<number>(1)
  const [closeRequestFor, setCloseRequestFor] = useState<Position | null>(null)
  const [showClosed, setShowClosed] = useState(true)

  // Filter to OPEN positions only (closed shown отдельной секцией ниже)
  const mine = useMemo(
    () => positions.filter(p => p.trader === connectedWallet.address && OPEN_STATUSES.includes(p.status)),
    []
  )
  const mineClosed = useMemo(
    () => closedPositions.filter(c => c.trader === connectedWallet.address),
    []
  )

  // Summary — open unrealized + today realized + margin-at-risk
  const summary = useMemo(() => {
    const openPnl = mine.reduce((sum, p) => sum + estimatedPnL(p), 0)
    const closedPnlAll = mineClosed.reduce((sum, c) => sum + (c.residualUSD - c.marginPostedUSD), 0)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayClosed = mineClosed.filter(c => c.closedAt >= todayStart.getTime())
    const todayPnl = todayClosed.reduce((s, c) => s + (c.residualUSD - c.marginPostedUSD), 0) + openPnl
    const marginAtRisk = mine.reduce((sum, p) => sum + p.marginValueUSD, 0)
    const carryPerHour = mine.reduce((sum, p) => sum + estimateCarryPerHour(p), 0)
    return {
      openPnl,
      closedPnlAll,
      todayPnl,
      todayCount: todayClosed.length,
      total: openPnl + closedPnlAll,
      marginAtRisk,
      carryPerHour,
    }
  }, [mine, mineClosed])

  // Pair list from listings referenced by my open positions
  const myPairs = useMemo(() => {
    const set = new Set<string>()
    mine.forEach(p => {
      const l = listings.find(l => l.id === p.listingId)
      if (l) set.add(`${l.pair.token0}/${l.pair.token1}`)
    })
    return Array.from(set).sort()
  }, [mine])

  const filtered = useMemo(() => {
    let out = [...mine]
    if (statusFilter === 'open') out = out.filter(p => p.status === 'OPEN')
    else if (statusFilter === 'close-requested') out = out.filter(p => p.status === 'CLOSE_REQUESTED' || p.status === 'CLOSING')
    else if (statusFilter === 'attention') out = out.filter(p => p.reservePctOfInitial < 25 || p.status === 'OUTBID_PENDING')
    if (pairFilter !== 'all') {
      out = out.filter(p => {
        const l = listings.find(l => l.id === p.listingId)
        return l && `${l.pair.token0}/${l.pair.token1}` === pairFilter
      })
    }

    // Sort
    switch (sort) {
      case 'health-asc':
        out.sort((a, b) => a.reservePctOfInitial - b.reservePctOfInitial)
        break
      case 'pnl-desc':
        out.sort((a, b) => estimatedPnL(b) - estimatedPnL(a))
        break
      case 'pnl-asc':
        out.sort((a, b) => estimatedPnL(a) - estimatedPnL(b))
        break
      case 'notional-desc':
        out.sort((a, b) => b.notionalUSD - a.notionalUSD)
        break
      case 'opened-desc':
        out.sort((a, b) => b.openedAt - a.openedAt)
        break
    }
    return out
  }, [mine, statusFilter, pairFilter, sort])

  const criticalCount = mine.filter(p => p.reservePctOfInitial < 25).length
  const outbidCount = mine.filter(p => p.status === 'OUTBID_PENDING').length
  const closeReqCount = mine.filter(p => p.status === 'CLOSE_REQUESTED' || p.status === 'CLOSING').length
  const attentionTotal = criticalCount + outbidCount
  const [attentionExpanded, setAttentionExpanded] = useState(false)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        {/* Onboarding banner — содержит intro + warning + steps */}
        <OnboardingBanner />

        {/* Summary cards: Today / Total / Margin at risk */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SummaryCard label="Today" subtitle={`${summary.todayCount} closes + open`} valueColor={summary.todayPnl >= 0 ? 'success' : 'danger'}>
            {summary.todayPnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(summary.todayPnl))}
          </SummaryCard>
          <SummaryCard label="Total PnL" subtitle="unrealized + realized" valueColor={summary.total >= 0 ? 'success' : 'danger'}>
            {summary.total >= 0 ? '+' : '−'}{fmtUSD(Math.abs(summary.total))}
          </SummaryCard>
          <SummaryCard label="Margin at risk" subtitle={`carry ${fmtUSD(summary.carryPerHour)}/h`} valueColor="neutral">
            {fmtUSD(summary.marginAtRisk)}
          </SummaryCard>
        </div>

        <p className="text-xs text-gray-500 num mt-3">
          {filtered.length} of {mine.length} open · {mineClosed.length} closed
          {attentionTotal > 0 && (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                onClick={() => setAttentionExpanded(e => !e)}
                className="text-[var(--color-status-danger)] font-medium underline decoration-dotted hover:no-underline inline-flex items-center gap-1"
              >
                {attentionTotal} need attention <span aria-hidden="true">{attentionExpanded ? '▴' : '▾'}</span>
              </button>
            </>
          )}
          {closeReqCount > 0 && (
            <>
              {' '}· <span className="text-blue-700">{closeReqCount} closing</span>
            </>
          )}
        </p>
      </header>

      {mine.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-600 mb-3">No open positions yet. Go to Marketplace and pick a listing.</p>
          <Link
            to="/listings"
            className="inline-block text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--color-role-trader)] text-white hover:opacity-90 transition"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <>
          {/* Attention details — expandable когда есть critical/outbid позиции */}
          {attentionExpanded && attentionTotal > 0 && (
            <div className="mb-3 rounded-lg border border-[var(--color-status-danger)]/40 bg-red-50/60 px-4 py-3 flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-status-danger)]">
                  Attention needed
                </div>
                <ul className="text-xs text-gray-700 mt-1 space-y-0.5 num">
                  {criticalCount > 0 && (
                    <li>
                      <strong>{criticalCount}</strong> position{criticalCount === 1 ? '' : 's'} приближаются к ликвидации (резерв &lt; 25%) — донеси маржу или закрой
                    </li>
                  )}
                  {outbidCount > 0 && (
                    <li>
                      <strong>{outbidCount}</strong> position{outbidCount === 1 ? '' : 's'} перекуплены другим трейдером — закрытие на следующем блоке, residual вернётся
                    </li>
                  )}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setAttentionExpanded(false)}
                className="text-gray-400 hover:text-gray-600 text-base leading-none flex-shrink-0"
                aria-label="Свернуть"
              >
                ×
              </button>
            </div>
          )}

          {/* Filter strip */}
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
              {([
                { id: 'all', label: `All (${mine.length})` },
                { id: 'open', label: 'Open' },
                { id: 'close-requested', label: 'Closing' },
                { id: 'attention', label: `Attention${criticalCount > 0 ? ` (${criticalCount})` : ''}` },
              ] as const).map(o => {
                const active = statusFilter === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setStatusFilter(o.id)}
                    className={
                      'text-xs px-2.5 py-1 transition ' +
                      (active ? 'bg-gray-900 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50') +
                      (o.id === 'attention' && criticalCount > 0 && !active ? ' text-[var(--color-status-danger)]' : '')
                    }
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>

            {myPairs.length > 1 && (
              <select
                value={pairFilter}
                onChange={e => setPairFilter(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-200"
                aria-label="Filter by pair"
              >
                <option value="all">All pairs</option>
                {myPairs.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-gray-500">Sort:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortId)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="health-asc">Reserve health (low → high)</option>
                <option value="pnl-desc">PnL (high → low)</option>
                <option value="pnl-asc">PnL (low → high)</option>
                <option value="notional-desc">Notional (large → small)</option>
                <option value="opened-desc">Opened (newest)</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-600">No positions match this filter.</p>
            </div>
          ) : (
            <>
              <PositionsTable
                positions={(() => {
                  if (pageSize === -1) return filtered
                  const start = (Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize))) - 1) * pageSize
                  return filtered.slice(start, start + pageSize)
                })()}
                onClick={id => navigate(`/trader/positions/${id}`)}
                onRequestClose={p => setCloseRequestFor(p)}
              />

              {/* Pagination — visible если позиций больше одной страницы */}
              {filtered.length > Math.min(...PAGE_SIZES.filter(s => s > 0)) && (() => {
                const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
                const safePage = Math.min(page, totalPages)
                const pageStart = pageSize === -1 ? 0 : (safePage - 1) * pageSize
                const pageEnd = pageSize === -1 ? filtered.length : pageStart + pageSize
                return (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Show</span>
                      <select
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        {PAGE_SIZES.map(s => (
                          <option key={s} value={s}>{s === -1 ? 'All' : s}</option>
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
                        <span className="num font-medium px-1">{safePage} / {totalPages}</span>
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
                )
              })()}
            </>
          )}

          {/* Closed section — v1 pattern: closed live в той же странице */}
          {mineClosed.length > 0 && (
            <section className="mt-10">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Closed positions</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {mineClosed.length} settled · realized P&L (paid in full / partial / liquidated) — counted in Total above
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClosed(s => !s)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted"
                >
                  {showClosed ? 'Hide' : 'Show'}
                </button>
              </div>
              {showClosed && (() => {
                const cTotalPages = closedPageSize === -1 ? 1 : Math.max(1, Math.ceil(mineClosed.length / closedPageSize))
                const cSafePage = Math.min(closedPage, cTotalPages)
                const cStart = closedPageSize === -1 ? 0 : (cSafePage - 1) * closedPageSize
                const cEnd = closedPageSize === -1 ? mineClosed.length : cStart + closedPageSize
                const cVisible = mineClosed.slice(cStart, cEnd)
                return (
                  <>
                    <ClosedTable
                      closed={cVisible}
                      onClick={id => navigate(`/trader/closed/${id}`)}
                    />
                    {mineClosed.length > Math.min(...PAGE_SIZES.filter(s => s > 0)) && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>Show</span>
                          <select
                            value={closedPageSize}
                            onChange={e => { setClosedPageSize(Number(e.target.value)); setClosedPage(1) }}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                          >
                            {PAGE_SIZES.map(s => (
                              <option key={s} value={s}>{s === -1 ? 'All' : s}</option>
                            ))}
                          </select>
                          <span>per page</span>
                        </div>
                        {closedPageSize !== -1 && cTotalPages > 1 && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="num">
                              {cStart + 1}–{Math.min(cEnd, mineClosed.length)} of {mineClosed.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setClosedPage(p => Math.max(1, p - 1))}
                              disabled={cSafePage <= 1}
                              className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition"
                              aria-label="Previous page"
                            >
                              ←
                            </button>
                            <span className="num font-medium px-1">{cSafePage} / {cTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setClosedPage(p => Math.min(cTotalPages, p + 1))}
                              disabled={cSafePage >= cTotalPages}
                              className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition"
                              aria-label="Next page"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </section>
          )}
        </>
      )}

      {/* Inline close request modal */}
      <HighStakesConfirmModal
        open={!!closeRequestFor}
        title="Close position — confirm"
        subtitle="Закрытие исполнится на следующем блоке Arbitrum по текущей цене Uniswap. Отменить после подтверждения нельзя."
        currentState={
          closeRequestFor
            ? [
                { label: 'Position', value: closeRequestFor.id },
                { label: 'Notional', value: fmtUSD(closeRequestFor.notionalUSD) },
                { label: 'Margin', value: `${closeRequestFor.reservePctOfInitial}% / ${fmtUSD(closeRequestFor.reserveUSD)}` },
              ]
            : []
        }
        newState={[
          { label: 'Close price', value: 'current Uniswap', deltaTone: 'neutral' },
          {
            label: 'Est. residual',
            value: closeRequestFor ? fmtUSD(closeRequestFor.marginValueUSD + estimatedPnL(closeRequestFor)) : '—',
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
        onConfirm={() => setCloseRequestFor(null)}
        onCancel={() => setCloseRequestFor(null)}
      />
    </div>
  )
}

function SummaryCard({
  label,
  subtitle,
  valueColor,
  children,
}: {
  label: string
  subtitle?: string
  valueColor: 'success' | 'danger' | 'neutral'
  children: React.ReactNode
}) {
  const color =
    valueColor === 'success'
      ? 'var(--color-status-success)'
      : valueColor === 'danger'
      ? 'var(--color-status-danger)'
      : 'oklch(20% 0 0)'
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-right">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold leading-tight">{label}</div>
      <div className="text-lg num font-semibold mt-0.5" style={{ color }}>
        {children}
      </div>
      {subtitle && <div className="text-[10px] text-gray-500 num leading-tight mt-0.5">{subtitle}</div>}
    </div>
  )
}

function estimatedPnL(p: Position): number {
  // Mock convex IP, very rough. Real path uses Uniswap V3 math.
  const ip = p.notionalUSD * 0.0008 * (Math.sin(p.openedAt) * 0.5 + 0.5) // pseudo-deterministic
  const minutesOpen = (Date.now() - p.openedAt) / 60_000
  const refAccrued = (p.notionalUSD * p.pendingRefApyBps / 10000 / 365 / 1440) * minutesOpen
  const premAccrued = (p.notionalUSD * p.pendingPremApyBps / 10000 / 365 / 1440) * minutesOpen
  return ip - refAccrued - premAccrued
}

function PositionsTable({
  positions: ps,
  onClick,
  onRequestClose,
}: {
  positions: Position[]
  onClick: (id: string) => void
  onRequestClose: (p: Position) => void
}) {
  return (
    <>
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair · entry → now</th>
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-right font-medium px-3 py-2.5">Notional</th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Live PnL
                  <HelpPopover label="Что значит Live PnL" width="w-72">
                    <p className="font-semibold mb-1">Live PnL (оценка)</p>
                    <p className="mb-1">PnL = Impermanent Profit − Reference Fees − Premium APY − close cost.</p>
                    <p>Окончательное число определится при close по цене Pool на следующем блоке. Может быть partial если резерв иссяк.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Liq @ price
                  <HelpPopover label="Liquidation price" width="w-72">
                    <p className="font-semibold mb-1">Цена ликвидации</p>
                    <p>Если цена Pool достигнет этой границы — позиция закроется автоматически, margin потеряна. Чем дальше — тем безопаснее.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Carry $/h
                  <HelpPopover label="Carry в долларах в час" width="w-72">
                    <p className="font-semibold mb-1">Сколько горит на холде</p>
                    <p className="mb-1">Premium APY + Reference Fees, конвертировано в $/час на твой notional. Это что ты <strong>платишь</strong> LP пока сидишь.</p>
                    <p className="text-[11px] text-gray-500">Если отрицательно — наоборот, LP <strong>платит тебе</strong> (subsidized листинг).</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Leverage now / opened</th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Opened</th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Action
                  <HelpPopover label="Что показывается в Action" width="w-96">
                    <p className="font-semibold mb-2">Что бывает в этой колонке</p>
                    <p className="mb-2 text-[11px]">Зависит от статуса позиции — определяет какие действия доступны прямо сейчас.</p>

                    <p className="font-semibold mt-3 mb-1.5 text-gray-900">Active states (можно действовать)</p>
                    <ul className="space-y-1.5 text-[11px] leading-snug">
                      <li>
                        <span className="inline-flex items-center gap-1 mr-1">
                          <span className="inline-block px-1.5 py-0.5 rounded border border-[var(--color-role-lp)] text-[var(--color-role-lp)] text-[9px] font-medium">+ Margin</span>
                          <span className="inline-block px-1.5 py-0.5 rounded border border-[var(--color-status-danger)] text-[var(--color-status-danger)] text-[9px] font-medium">Close</span>
                        </span>
                        <strong>OPEN</strong> — позиция работает, накапливает PnL/carry. Добавь маржу (защитить от ликвидации) или закрой по цене Uniswap.
                      </li>
                    </ul>

                    <p className="font-semibold mt-3 mb-1.5 text-gray-900">Pending states (action недоступен — ждём keeper)</p>
                    <ul className="space-y-1.5 text-[11px] leading-snug">
                      <li>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-blue-700 bg-blue-50 border border-blue-200 mr-1 num">awaiting keeper</span>
                        <strong>CLOSE_REQUESTED</strong> — ты отправил запрос на закрытие, keeper подхватит на следующем блоке. Маржу больше менять нельзя.
                      </li>
                      <li>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-blue-700 bg-blue-50 border border-blue-200 mr-1 num">settling…</span>
                        <strong>CLOSING</strong> — keeper уже считает финальный residual. Через 1-2 блока станет «closed» — переедет в Closed positions ниже.
                      </li>
                      <li>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-800 bg-amber-50 border border-amber-300 mr-1 num">forced close</span>
                        <strong>OUTBID_PENDING</strong> — другой трейдер перекупил твою позицию (предложил LP'у carry выше твоего). Закроют принудительно по pool-price; накопленный PnL + маржа вернутся на твой кошелёк.
                      </li>
                    </ul>

                    <p className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-500 leading-snug">
                      Если позиция полностью закрылась — она исчезает из этой таблицы и появляется в Closed positions ниже на странице со статусом <strong>clean close</strong>, <strong>margin call</strong> или <strong>💥 liquidated</strong>.
                    </p>
                  </HelpPopover>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ps.map(p => (
              <DesktopRow
                key={p.id}
                position={p}
                onClick={() => onClick(p.id)}
                onRequestClose={() => onRequestClose(p)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden rounded-lg border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
        {ps.map(p => (
          <MobileRow
            key={p.id}
            position={p}
            onClick={() => onClick(p.id)}
            onRequestClose={() => onRequestClose(p)}
          />
        ))}
      </div>
    </>
  )
}

function ClosedTable({
  closed,
  onClick,
}: {
  closed: ClosedPosition[]
  onClick: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Position · listing</th>
            <th className="text-left font-medium px-3 py-2.5">Outcome</th>
            <th className="text-right font-medium px-3 py-2.5">Notional</th>
            <th className="text-right font-medium px-3 py-2.5">APY</th>
            <th className="text-right font-medium px-3 py-2.5">Held</th>
            <th className="text-right font-medium px-3 py-2.5">Net PnL</th>
            <th className="text-right font-medium px-3 py-2.5">Closed</th>
          </tr>
        </thead>
        <tbody>
          {closed.map(c => {
            const net = c.residualUSD - c.marginPostedUSD
            return (
              <tr
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={() => onClick(c.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick(c.id)
                  }
                }}
                className="cursor-pointer transition border-b border-gray-100 last:border-b-0 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 focus:ring-1 focus:ring-[var(--color-role-trader)]/40 focus:ring-inset"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PairIcons pair={c.pair} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="num text-[11px] text-gray-500">{c.id}</span>
                        <span className="font-medium text-gray-900">
                          {c.pair.token0} / {c.pair.token1}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 num">{fmtFeeTier(c.feeTierBps)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {c.paidInFull ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
                      paid in full
                    </span>
                  ) : (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium cursor-help"
                      title={c.unpaidUSD ? `${fmtUSD(c.unpaidUSD)} unpaid — sLiq has no insurance fund` : ''}
                    >
                      partial payment
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right num text-gray-700">{fmtUSD(c.notionalUSD)}</td>
                <td className="px-3 py-3 text-right num">
                  <span
                    className="font-medium"
                    style={{ color: c.apyBps < 0 ? 'var(--color-negative-apy)' : undefined }}
                  >
                    {fmtPct(c.apyBps, { signed: true })}
                  </span>
                </td>
                <td className="px-3 py-3 text-right num text-xs text-gray-500">{c.durationHours}h</td>
                <td className="px-3 py-3 text-right">
                  <span
                    className="num font-semibold"
                    style={{ color: net >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                  >
                    {net >= 0 ? '+' : '−'}{fmtUSD(Math.abs(net))}
                  </span>
                </td>
                <td className="px-3 py-3 text-right num text-xs text-gray-500">{fmtTimeAgo(c.closedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DesktopRow({
  position,
  onClick,
  onRequestClose,
}: {
  position: Position
  onClick: () => void
  onRequestClose: () => void
}) {
  const listing = listings.find(l => l.id === position.listingId)
  if (!listing) return null

  const pnl = estimatedPnL(position)
  const liq = estimateLiquidationPrice(position, listing.currentPrice)
  const carryPerHour = estimateCarryPerHour(position)
  const isCritical = position.reservePctOfInitial < 25
  const rowBg = isCritical ? 'bg-red-50/30' : ''
  const traderReceivesCarry = position.apyBps < 0
  const priceChangePct = ((listing.currentPrice - position.entryPrice) / position.entryPrice) * 100
  // Pick closer liq side (one is on each direction; trader cares about whichever's closer)
  const closerLiq = Math.abs(listing.currentPrice - liq.down) < Math.abs(listing.currentPrice - liq.up) ? liq.down : liq.up
  const liqDistancePct = Math.abs((closerLiq - listing.currentPrice) / listing.currentPrice) * 100
  const liqColor =
    liqDistancePct < 2
      ? 'var(--color-status-danger)'
      : liqDistancePct < 5
      ? 'var(--color-status-warning)'
      : 'var(--color-status-success)'

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={
        'group cursor-pointer transition border-b border-gray-100 last:border-b-0 ' +
        rowBg +
        ' hover:bg-gray-50 focus:outline-none focus:bg-gray-50 focus:ring-1 focus:ring-[var(--color-role-trader)]/40 focus:ring-inset'
      }
    >
      {/* Pair + entry → now price */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PairIcons pair={listing.pair} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 group-hover:text-[var(--color-role-trader)] transition truncate">
                {pairLabel(listing)}
              </span>
              {traderReceivesCarry && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold whitespace-nowrap">
                  LP платит тебе
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] num">
              <span className="text-gray-500">
                {fmtPriceShort(position.entryPrice)} → <span className="font-semibold text-gray-800">{fmtPriceShort(listing.currentPrice)}</span>
              </span>
              <span
                className="font-semibold"
                style={{ color: priceChangePct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <DexChip dex={listing.dex} />
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
                {fmtFeeTier(listing.feeTierBps)}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        <PositionStatusChip status={position.status} />
      </td>

      {/* Notional */}
      <td className="px-3 py-3 text-right num text-gray-900 font-medium">{fmtUSD(position.notionalUSD)}</td>

      {/* Live PnL */}
      <td className="px-3 py-3 text-right">
        <span
          className="num font-semibold"
          style={{ color: pnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
        >
          {pnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(pnl))}
        </span>
        <div className="text-[10px] text-gray-500 num leading-tight mt-0.5">
          margin {fmtUSD(position.marginValueUSD)}
        </div>
      </td>

      {/* Liquidation price */}
      <td className="px-3 py-3 text-right">
        <div className="num font-semibold" style={{ color: liqColor }}>
          {fmtPriceShort(closerLiq)}
        </div>
        <div className="text-[10px] num leading-tight mt-0.5" style={{ color: liqColor }}>
          {liqDistancePct.toFixed(1)}% away
        </div>
      </td>

      {/* Carry $/h */}
      <td className="px-3 py-3 text-right">
        <div
          className="num font-semibold"
          style={{ color: carryPerHour < 0 ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
        >
          {carryPerHour < 0 ? '+' : '−'}{fmtUSD(Math.abs(carryPerHour))}<span className="text-[10px] text-gray-500">/h</span>
        </div>
        <div className="text-[10px] text-gray-500 num leading-tight mt-0.5">
          {fmtPct(position.apyBps, { signed: true })} + Ref {fmtPct(position.pendingRefApyBps)}
        </div>
      </td>

      {/* Leverage now / opened */}
      <td className="px-3 py-3 text-right num text-gray-700 hidden lg:table-cell">
        <span className="font-semibold">{position.effectiveLeverage}×</span>
        <span className="text-[10px] text-gray-500"> / {position.openedAtLeverage}×</span>
      </td>

      {/* Opened */}
      <td className="px-3 py-3 text-right num text-xs text-gray-500 hidden lg:table-cell">
        {fmtTimeAgo(position.openedAt)}
      </td>

      {/* Action */}
      <td className="px-3 py-3 text-right">
        {position.status === 'OPEN' ? (
          <div className="inline-flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onClick() // navigate to S9 — Add margin lives there
              }}
              className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)] transition whitespace-nowrap"
              title="Добавить маржу к позиции. Ликвидация отодвинется дальше от текущей цены, риск снизится."
            >
              + Margin
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onRequestClose()
              }}
              className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-red-50 transition"
              title="Запросить закрытие позиции. Исполнится на следующем блоке Arbitrum по текущей цене Uniswap. Carry до момента закрытия списан, residual вернётся на твой кошелёк."
            >
              Close
            </button>
          </div>
        ) : position.status === 'CLOSE_REQUESTED' ? (
          <span
            className="text-xs text-blue-700 num cursor-help"
            title="Ты отправил запрос на закрытие. Keeper подхватит на следующем блоке Arbitrum. Маржу больше менять нельзя; отменить тоже."
          >
            awaiting keeper
          </span>
        ) : position.status === 'CLOSING' ? (
          <span
            className="text-xs text-blue-700 num cursor-help"
            title="Keeper уже считает финальный residual. Через 1-2 блока позиция уйдёт в Closed positions."
          >
            settling…
          </span>
        ) : position.status === 'OUTBID_PENDING' ? (
          <span
            className="text-xs text-amber-800 num cursor-help"
            title="Другой трейдер предложил LP'у carry выше твоего и перекупил позицию. Закроют принудительно по текущей цене Uniswap; маржу + накопленный PnL вернут на твой кошелёк."
          >
            forced close
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  )
}

function MobileRow({
  position,
  onClick,
  onRequestClose,
}: {
  position: Position
  onClick: () => void
  onRequestClose: () => void
}) {
  const listing = listings.find(l => l.id === position.listingId)
  if (!listing) return null

  const pnl = estimatedPnL(position)
  const liq = estimateLiquidationPrice(position, listing.currentPrice)
  const carryPerHour = estimateCarryPerHour(position)
  const isCritical = position.reservePctOfInitial < 25
  const rowBg = isCritical ? 'bg-red-50/30' : 'bg-white hover:bg-gray-50'
  const priceChangePct = ((listing.currentPrice - position.entryPrice) / position.entryPrice) * 100
  const closerLiq = Math.abs(listing.currentPrice - liq.down) < Math.abs(listing.currentPrice - liq.up) ? liq.down : liq.up
  const liqDistancePct = Math.abs((closerLiq - listing.currentPrice) / listing.currentPrice) * 100
  const liqColor =
    liqDistancePct < 2
      ? 'var(--color-status-danger)'
      : liqDistancePct < 5
      ? 'var(--color-status-warning)'
      : 'var(--color-status-success)'

  return (
    <button
      type="button"
      onClick={onClick}
      className={'w-full text-left px-4 py-3 transition active:bg-gray-100 ' + rowBg}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PairIcons pair={listing.pair} compact />
          <span className="font-semibold text-base truncate">{pairLabel(listing)}</span>
        </div>
        <div className="text-right num flex-shrink-0">
          <div
            className="font-semibold text-base"
            style={{ color: pnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
          >
            {pnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(pnl))}
          </div>
          <div className="text-[10px] text-gray-500">notional {fmtUSD(position.notionalUSD)}</div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[11px] num">
        <span className="text-gray-500">
          {fmtPriceShort(position.entryPrice)} → <span className="font-semibold text-gray-800">{fmtPriceShort(listing.currentPrice)}</span>
        </span>
        <span
          className="font-semibold"
          style={{ color: priceChangePct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
        >
          {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <PositionStatusChip status={position.status} tiny />
        <DexChip dex={listing.dex} />
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
          {fmtFeeTier(listing.feeTierBps)}
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
          {position.effectiveLeverage}×
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] num">
        <div>
          <span className="text-gray-500">liq @</span>{' '}
          <span className="font-semibold" style={{ color: liqColor }}>{fmtPriceShort(closerLiq)}</span>{' '}
          <span style={{ color: liqColor }}>({liqDistancePct.toFixed(1)}% away)</span>
        </div>
        <div className="text-right">
          <span className="text-gray-500">carry</span>{' '}
          <span className="font-semibold" style={{ color: carryPerHour < 0 ? 'var(--color-negative-apy)' : undefined }}>
            {carryPerHour < 0 ? '+' : '−'}{fmtUSD(Math.abs(carryPerHour))}/h
          </span>
        </div>
      </div>

      {position.status === 'OPEN' && (
        <div className="mt-2 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onClick()
            }}
            className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)] transition"
          >
            + Margin
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onRequestClose()
            }}
            className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-red-50 transition"
          >
            Close
          </button>
        </div>
      )}
    </button>
  )
}

function PositionStatusChip({ status, tiny }: { status: PositionStatus; tiny?: boolean }) {
  const sizeCls = tiny ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls

  switch (status) {
    case 'OPEN':
      return (
        <span
          className={baseCls + ' bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30'}
          title="Position is open and accruing APY. Tap to manage margin or request close."
        >
          open
        </span>
      )
    case 'CLOSE_REQUESTED':
      return (
        <span
          className={baseCls + ' bg-blue-50 text-blue-800 border border-blue-200'}
          title="You requested close. Keeper executes на next block at pool price. Cannot be cancelled."
        >
          close requested
        </span>
      )
    case 'CLOSING':
      return (
        <span
          className={baseCls + ' bg-blue-50 text-blue-800 border border-blue-200'}
          title="Keeper is settling now. Final residual computed."
        >
          closing
        </span>
      )
    case 'OUTBID_PENDING':
      return (
        <span
          className={baseCls + ' bg-amber-50 text-amber-900 border border-amber-300'}
          title="Another trader bid higher Premium APY. Your position will close at next block; your reserve will be returned."
        >
          outbid pending
        </span>
      )
    default:
      return null
  }
}

// Helpers — moved here so ClosedTable above can use them
export function PairIcons({ pair, compact }: { pair: { token0: string; token1: string }; compact?: boolean }) {
  const size = compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]'
  return (
    <div className="relative flex flex-shrink-0">
      <span
        className={'inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-white ' + size}
        style={{ background: stringToColor(pair.token0) }}
        aria-hidden="true"
      >
        {pair.token0.slice(0, 1)}
      </span>
      <span
        className={'inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-white -ml-1.5 ' + size}
        style={{ background: stringToColor(pair.token1) }}
        aria-hidden="true"
      >
        {pair.token1.slice(0, 1)}
      </span>
    </div>
  )
}

function DexChip({ dex }: { dex: DexProtocol }) {
  const map: Record<DexProtocol, { name: string; version: string; versionBg: string; versionText: string }> = {
    'uniswap-v3': { name: 'Uniswap', version: 'v3', versionBg: 'bg-[#bef264] border-[#a3e635]/60', versionText: 'text-gray-900' },
    'uniswap-v4': { name: 'Uniswap', version: 'v4', versionBg: 'bg-pink-200 border-pink-300/60', versionText: 'text-pink-900' },
    'pancakeswap-v3': { name: 'PancakeSwap', version: 'v3', versionBg: 'bg-amber-200 border-amber-300/60', versionText: 'text-amber-900' },
    gmx: { name: 'GMX', version: '', versionBg: '', versionText: '' },
    other: { name: 'Other', version: '', versionBg: '', versionText: '' },
  }
  const m = map[dex]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium">
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{m.name}</span>
      {m.version && (
        <span className={'px-1.5 py-0.5 rounded font-semibold ' + m.versionBg + ' ' + m.versionText}>{m.version}</span>
      )}
    </span>
  )
}

function fmtPriceShort(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toExponential(2)}`
}

function stringToColor(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `oklch(58% 0.13 ${hue})`
}

function OnboardingBanner() {
  const KEY = 'sliq.mypositions.onboardingState'
  const [state, setState] = useState<'expanded' | 'collapsed'>(() => {
    if (typeof window === 'undefined') return 'collapsed'
    const stored = localStorage.getItem(KEY) as 'expanded' | 'collapsed' | 'hidden' | null
    // Migrate legacy 'hidden' → 'collapsed'
    return stored === 'expanded' ? 'expanded' : 'collapsed'
  })
  function setStateAndStore(next: 'expanded' | 'collapsed') {
    setState(next)
    if (typeof window !== 'undefined') localStorage.setItem(KEY, next)
  }

  if (state === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setStateAndStore('expanded')}
        className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 transition"
      >
        <span className="font-medium">What you can do with open positions</span>
        <span className="text-gray-400">›</span>
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Что я могу делать с открытыми позициями
        </span>
        <button
          type="button"
          onClick={() => setStateAndStore('collapsed')}
          className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
        >
          Hide
        </button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        <Step
          n={1}
          title="Следи за ликвидацией"
          body="В колонке «Liq @ price» — цена, при которой тебя закроют автоматически и маржу потеряешь. Чем дальше она от текущей — тем безопаснее. Опасные строки подсвечены красным."
        />
        <Step
          n={2}
          title="Добавь маржи если нужно"
          body="Кнопка «+ Margin» в строке — увеличит твою маржу, ликвидация отодвинется дальше. Снять лишнее тоже можно — внутри карточки позиции."
        />
        <Step
          n={3}
          title="Закрой по цене Uniswap"
          body="Кнопка «Close» — закрытие на следующем блоке Arbitrum по текущей цене пары на Uniswap. Если другой трейдер предложит LP'у больший carry — он перекупит твою позицию принудительно, маржу и накопленный PnL ты получишь обратно."
        />
      </ol>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="px-4 py-3 flex gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-600 leading-snug mt-0.5">{body}</div>
      </div>
    </div>
  )
}
