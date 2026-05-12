// S3 Listings Marketplace — full v2 редизайн per Жень round-2 feedback.
// - Pagination (25/50/all per page)
// - Status legend below filter strip
// - "LP pays trader" filter label (clearer than "Subsidized only")
// - Stacked APY cell (in ListingsTable)
// - OWNED chip prominent + non-owned default
// - DEX under pair (in ListingsTable)
// - All status chips covered

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HelpPopover } from '@/components/HelpPopover'
import { ListingsTable } from '@/components/ListingsTable'
import { closedPositions, connectedWallet, listings, positions } from '@/mocks/data'
import {
  capacityFreePct,
  distanceToRangeMidpointBps,
  getOutbidOpportunity,
  getRangeStatus,
  isSubsidized,
  type OutbidOpportunity,
} from '@/lib/derive'
import {
  FEE_TIER_OPTIONS,
  LOCKED_STRINGS,
  SORT_OPTIONS,
  type SortId,
} from '@/lib/marketplace-constants'
import { fmtUSD } from '@/lib/format'

const PAGE_SIZES = [25, 50, 100, -1] as const // -1 = all

export function ListingsMarketplace() {
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [feeTiersOn, setFeeTiersOn] = useState<Set<number>>(
    () => new Set(FEE_TIER_OPTIONS.map(o => o.bps))
  )
  const [mode, setMode] = useState<'all' | 'conservative' | 'advanced'>('all')
  const [rangeStatus, setRangeStatus] = useState<'all' | 'in' | 'out'>('all')
  const [subsidizedOnly, setSubsidizedOnly] = useState(false)
  const [outbidOnly, setOutbidOnly] = useState(false)
  const [hideOwned, setHideOwned] = useState(false)
  const [sort, setSort] = useState<SortId>('apy-desc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState<number>(1)

  const allPairs = useMemo(() => {
    const set = new Set<string>()
    listings.forEach(l => set.add(`${l.pair.token0}/${l.pair.token1}`))
    return Array.from(set).sort()
  }, [])

  // Outbid opportunities — Kolya's vision: highlight listings where incumbent positions
  // have positive estimated PnL ripe to be captured by a higher Premium APY bid.
  const outbidByListing = useMemo(() => {
    const map = new Map<string, OutbidOpportunity>()
    for (const l of listings) {
      const positionsOnListing = positions.filter(p => p.listingId === l.id)
      const opp = getOutbidOpportunity(l, positionsOnListing)
      if (opp) map.set(l.id, opp)
    }
    return map
  }, [])

  const outbidStats = useMemo(() => {
    let total = 0
    let bestSingle = 0
    outbidByListing.forEach(o => {
      total += o.totalCapturablePnlUSD
      if (o.bestPositivePnlUSD > bestSingle) bestSingle = o.bestPositivePnlUSD
    })
    return { count: outbidByListing.size, total, bestSingle }
  }, [outbidByListing])

  const filtered = useMemo(() => {
    let out = [...listings]

    if (pairFilter !== 'all') {
      out = out.filter(l => `${l.pair.token0}/${l.pair.token1}` === pairFilter)
    }
    out = out.filter(l => feeTiersOn.has(l.feeTierBps))
    if (mode !== 'all') out = out.filter(l => l.providerMode === mode)
    if (rangeStatus !== 'all') {
      out = out.filter(l => {
        const rs = getRangeStatus(l)
        return rangeStatus === 'in' ? rs === 'in-range' : rs === 'out-of-range'
      })
    }
    if (subsidizedOnly) out = out.filter(l => isSubsidized(l))
    if (outbidOnly) out = out.filter(l => outbidByListing.has(l.id))
    if (hideOwned) out = out.filter(l => l.owner !== connectedWallet.address)

    switch (sort) {
      case 'outbid-desc':
        out.sort((a, b) => {
          const aOpp = outbidByListing.get(a.id)?.bestPositivePnlUSD ?? -1
          const bOpp = outbidByListing.get(b.id)?.bestPositivePnlUSD ?? -1
          return bOpp - aOpp
        })
        break
      case 'apy-desc':
        out.sort((a, b) => b.minPremiumApyBps - a.minPremiumApyBps)
        break
      case 'apy-asc':
        out.sort((a, b) => a.minPremiumApyBps - b.minPremiumApyBps)
        break
      case 'capacity-desc':
        out.sort((a, b) => capacityFreePct(b) - capacityFreePct(a))
        break
      case 'time-desc':
        out.sort((a, b) => b.listedAt - a.listedAt)
        break
      case 'midpoint-asc':
        out.sort((a, b) => distanceToRangeMidpointBps(a) - distanceToRangeMidpointBps(b))
        break
      case 'fee-asc':
        out.sort((a, b) => a.feeTierBps - b.feeTierBps)
        break
    }
    return out
  }, [pairFilter, feeTiersOn, mode, rangeStatus, subsidizedOnly, outbidOnly, hideOwned, sort, outbidByListing])

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = pageSize === -1 ? 0 : (safePage - 1) * pageSize
  const pageEnd = pageSize === -1 ? filtered.length : pageStart + pageSize
  const visible = filtered.slice(pageStart, pageEnd)

  const activeFilterCount =
    (pairFilter !== 'all' ? 1 : 0) +
    (feeTiersOn.size !== FEE_TIER_OPTIONS.length ? 1 : 0) +
    (mode !== 'all' ? 1 : 0) +
    (rangeStatus !== 'all' ? 1 : 0) +
    (subsidizedOnly ? 1 : 0) +
    (outbidOnly ? 1 : 0) +
    (hideOwned ? 1 : 0)

  function resetFilters() {
    setPairFilter('all')
    setFeeTiersOn(new Set(FEE_TIER_OPTIONS.map(o => o.bps)))
    setMode('all')
    setRangeStatus('all')
    setSubsidizedOnly(false)
    setOutbidOnly(false)
    setHideOwned(false)
  }
  const ownedCount = listings.filter(l => l.owner === connectedWallet.address).length

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong>С плечом до 1000× зайди в чужую LP позицию на Uniswap.</strong>{' '}
          <span className="text-gray-600">Любое движение цены пары — твой профит, неважно куда; чем сильнее движение, тем больше зарабатываешь.</span>
        </p>
        <p className="text-xs text-gray-500 mt-1.5">
          У тебя есть Uniswap V3 LP NFT?{' '}
          <Link to="/lp/deposit" className="text-gray-600 hover:text-gray-900 underline decoration-gray-300 hover:decoration-gray-600 underline-offset-2">
            Принеси сюда — заработай extra Premium APY поверх обычных Uniswap fees →
          </Link>
        </p>

        {/* Slim onboarding banner — "what can I do as a trader?" */}
        <OnboardingBanner />
      </header>

      {/* Filter strip — все uniform selectors */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
        {/* Pair */}
        <select
          value={pairFilter}
          onChange={e => { setPairFilter(e.target.value); setPage(1) }}
          className={selectCls(pairFilter !== 'all')}
          aria-label="Pair"
        >
          <option value="all">All pairs</option>
          {allPairs.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Fee tier — single-select (all / single bps) */}
        <select
          value={feeTiersOn.size === FEE_TIER_OPTIONS.length ? 'all' : Array.from(feeTiersOn)[0]?.toString() ?? 'all'}
          onChange={e => {
            const v = e.target.value
            if (v === 'all') setFeeTiersOn(new Set(FEE_TIER_OPTIONS.map(o => o.bps)))
            else setFeeTiersOn(new Set([Number(v)]))
            setPage(1)
          }}
          className={selectCls(feeTiersOn.size !== FEE_TIER_OPTIONS.length)}
          aria-label="Fee tier"
        >
          <option value="all">All fee tiers</option>
          {FEE_TIER_OPTIONS.map(o => (
            <option key={o.bps} value={o.bps}>Fee {o.label}</option>
          ))}
        </select>

        {/* Listing stability (was LP risk / Mode) */}
        <select
          value={mode}
          onChange={e => { setMode(e.target.value as typeof mode); setPage(1) }}
          className={selectCls(mode !== 'all')}
          aria-label="Listing stability"
        >
          <option value="all">All stability</option>
          <option value="conservative">Safe · 1×</option>
          <option value="advanced">At-risk · &gt;1×</option>
        </select>

        {/* Range status */}
        <select
          value={rangeStatus}
          onChange={e => { setRangeStatus(e.target.value as typeof rangeStatus); setPage(1) }}
          className={selectCls(rangeStatus !== 'all')}
          aria-label="Price in range"
        >
          <option value="all">In + Out of range</option>
          <option value="in">In range only</option>
          <option value="out">Out of range only</option>
        </select>

        {/* Special toggles */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={subsidizedOnly}
            onChange={e => { setSubsidizedOnly(e.target.checked); setPage(1) }}
            className="w-3.5 h-3.5 accent-[var(--color-negative-apy)]"
          />
          <span className="text-gray-700">LP pays me</span>
          <HelpPopover label="Что значит «LP платит мне»?">
            <p className="mb-2 font-semibold text-amber-900">⚠️ Это обычно stable-пары — большого PnL не жди</p>
            <p className="mb-2 text-xs">
              LP с уверенностью что цена <strong>не двинется</strong> (типа USDC/USDT) даёт тебе carry, чтобы ты взял его листинг.
              Он зарабатывает на Reference Fees × своё плечо, а тебе платит фиксированный negative APY.
            </p>
            <p className="mb-1 mt-3 font-semibold text-gray-900">Что получаешь ты</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 text-xs">
              <li>Carry в свой карман пока сидишь (например +2% годовых на virtual notional).</li>
              <li>Если цена <strong>всё-таки двинется</strong> — IP profit сверху. Но шанс этого на стейблах низкий.</li>
              <li>Если маржа просядет — обычная ликвидация (как и на любом другом листинге).</li>
            </ul>
            <p className="text-xs mt-2 text-amber-900">
              <strong>Когда брать:</strong> ты ставишь на breakdown стейбла (peg-loss, depeg-rumor). Иначе — это <strong>boring carry</strong>, не gambling setup.
            </p>
          </HelpPopover>
        </label>

        {ownedCount > 0 && (
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={hideOwned}
              onChange={e => { setHideOwned(e.target.checked); setPage(1) }}
              className="w-3.5 h-3.5 accent-[var(--color-role-lp)]"
            />
            <span className="text-gray-700">Hide my listings</span>
          </label>
        )}

        {/* Counts + reset moved into filter strip */}
        <span className="text-[11px] text-gray-500 num ml-1">
          {filtered.length} of {listings.length}
          {ownedCount > 0 && <> · {ownedCount} mine</>}
          {activeFilterCount > 0 && (
            <>
              {' '}·{' '}
              <button type="button" onClick={resetFilters} className="underline hover:text-gray-700">
                reset {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
              </button>
            </>
          )}
        </span>

        {/* Sort always at right edge */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-500">Sort:</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortId)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            aria-label="Sort listings"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status descriptions + glossary moved to inline tooltips on column headers + status chips. */}

      {/* Outbid-opportunity banner — Kolya's vision, прижат к таблице */}
      {outbidStats.count > 0 && (
        <OutbidBanner
          count={outbidStats.count}
          totalPnl={outbidStats.total}
          bestSingle={outbidStats.bestSingle}
          active={outbidOnly || sort === 'outbid-desc'}
          onActivate={() => {
            setOutbidOnly(true)
            setSort('outbid-desc')
            setPage(1)
          }}
          onClear={() => {
            setOutbidOnly(false)
            setSort('apy-desc')
          }}
        />
      )}

      {/* Body */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h2 className="text-base font-semibold mb-1">{LOCKED_STRINGS.emptyFiltered.title}</h2>
          <p className="text-sm text-gray-600 mb-4">{LOCKED_STRINGS.emptyFiltered.body}</p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition"
          >
            {LOCKED_STRINGS.emptyFiltered.cta}
          </button>
        </div>
      ) : (
        <>
          <ListingsTable listings={visible} connectedAddress={connectedWallet.address} outbidByListing={outbidByListing} />

          {/* Pagination footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                aria-label="Page size"
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
                  className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                  className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
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

function selectCls(active: boolean): string {
  return (
    'rounded border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-200 num transition ' +
    (active ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-300 text-gray-700')
  )
}

function OnboardingBanner() {
  const KEY = 'sliq.mkt.onboardingState'
  const [state, setState] = useState<'expanded' | 'collapsed' | 'hidden'>(() => {
    if (typeof window === 'undefined') return 'collapsed'
    const stored = localStorage.getItem(KEY) as 'expanded' | 'collapsed' | 'hidden' | null
    return stored ?? 'collapsed' // default collapsed — returning trader не нужен banner
  })

  function setStateAndStore(next: 'expanded' | 'collapsed' | 'hidden') {
    setState(next)
    if (typeof window !== 'undefined') localStorage.setItem(KEY, next)
  }

  // Live stats from closed positions feed — outcome-focused (social proof)
  const stats = useMemo(() => {
    const last24h = Date.now() - 1000 * 60 * 60 * 24
    const recent = closedPositions.filter(c => c.closedAt >= last24h)
    const profitable = recent.filter(c => c.residualUSD - c.marginPostedUSD > 0)
    const totalPnl = recent.reduce((s, c) => s + (c.residualUSD - c.marginPostedUSD), 0)
    const top = recent
      .map(c => ({ pnl: c.residualUSD - c.marginPostedUSD, pair: c.pair, trader: c.trader }))
      .sort((a, b) => b.pnl - a.pnl)[0]
    return {
      total: recent.length,
      profitable: profitable.length,
      totalPnl,
      top,
    }
  }, [])

  if (state === 'hidden') {
    return (
      <button
        type="button"
        onClick={() => setStateAndStore('expanded')}
        className="text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted mt-2"
      >
        Как это работает →
      </button>
    )
  }
  if (state === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setStateAndStore('expanded')}
        className="mt-3 w-full md:w-auto inline-flex items-center gap-3 text-xs text-gray-700 hover:text-gray-900 rounded-md border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-3 py-2 transition group"
      >
        <span className="font-semibold">📊 За 24h:</span>
        <span className="num">
          <span className="font-semibold text-gray-900">{stats.total}</span> закрытий ·{' '}
          <span style={{ color: stats.totalPnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }} className="font-semibold">
            {stats.totalPnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(stats.totalPnl))}
          </span> total
          {stats.top && stats.top.pnl > 0 && (
            <>
              {' '}· top{' '}
              <span className="text-[var(--color-status-success)] font-semibold">+{fmtUSD(stats.top.pnl)}</span> on{' '}
              <span className="font-medium">{stats.top.pair.token0}/{stats.top.pair.token1}</span>
            </>
          )}
        </span>
        <span className="text-gray-900 font-medium group-hover:underline ml-auto">Как это работает →</span>
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Как заработать на sLiq
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStateAndStore('collapsed')}
            className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* 24h stats banner внутри expanded */}
      <div className="px-4 py-2 border-b border-gray-200 bg-white text-[11px] text-gray-600 num flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-gray-800">📊 За последние 24h:</span>
        <span>{stats.total} закрытий</span>
        <span>·</span>
        <span style={{ color: stats.totalPnl >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }} className="font-semibold">
          {stats.totalPnl >= 0 ? '+' : '−'}{fmtUSD(Math.abs(stats.totalPnl))} total PnL
        </span>
        <span>·</span>
        <span>{stats.profitable}/{stats.total} в плюсе</span>
        {stats.top && stats.top.pnl > 0 && (
          <>
            <span>·</span>
            <span>
              top trade{' '}
              <span className="font-semibold text-[var(--color-status-success)]">+{fmtUSD(stats.top.pnl)}</span>{' '}
              on <span className="font-medium">{stats.top.pair.token0}/{stats.top.pair.token1}</span>
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Left: plain mechanics */}
        <div className="p-4 space-y-2 text-xs text-gray-700 leading-snug">
          <p className="font-semibold text-gray-900 text-sm">Как это работает</p>
          <p>
            <span className="font-medium">1.</span> Выбираешь листинг (одна LP позиция на Uniswap V3).
          </p>
          <p>
            <span className="font-medium">2.</span> Ставишь margin (например $1K) и плечо (до 1000×). Получаешь virtual notional до $1M.
          </p>
          <p>
            <span className="font-medium">3.</span> Когда цена пары движется — ты <strong>забираешь impermanent profit</strong> от движения, с плечом.
          </p>
          <p>
            <span className="font-medium">4.</span> Платишь LP carry (Premium APY) + Reference Fees (~Uniswap baseline × leverage) пока сидишь.
          </p>
          <p className="text-[10px] text-gray-500 pt-1">
            ⚠️ Если твоя маржа просядет ниже 10% от начальной — позиция ликвидируется, маржа потеряна. Stop Loss / Take Profit в Beta пока нет — закрытие всегда по текущей цене Uniswap на следующем блоке.
          </p>
        </div>

        {/* Right: mini calculator widget */}
        <PnLEstimator />
      </div>
    </div>
  )
}

function PnLEstimator() {
  const [margin, setMargin] = useState(1000)
  const [leverage, setLeverage] = useState(100)
  const [move, setMove] = useState(1)
  const [premiumApy, setPremiumApy] = useState(15) // % annualized typical mid-range carry
  const notional = margin * leverage
  // Convex IP approximation: PnL ≈ notional × (move%)² / 2
  const movePct = move / 100
  const grossPnl = notional * movePct * movePct / 2

  // Carry in $/day: Premium APY on notional (+ ~Reference fees ≈ 0.3% × leverage ≈ small)
  const carryPerDay = notional * (premiumApy / 100) / 365
  const carryPer24h = carryPerDay // 24h hold

  // Breakeven move = sqrt(2 × carry / notional) — when convex IP = carry
  const breakevenMovePct = Math.sqrt(2 * carryPer24h / notional) * 100

  // Liquidation distance: rough proxy = 1 / leverage × 100, capped sensibly
  // (margin loses 100% of itself in adverse move; with reserve 10% trigger ≈ 0.9/lev)
  const liqDistancePct = (0.9 / leverage) * 100

  const netPnL24h = grossPnl - carryPer24h

  return (
    <div className="p-4 bg-white">
      <p className="font-semibold text-gray-900 text-sm mb-2">PnL estimate</p>
      <div className="space-y-2 text-xs">
        <Field label="Margin">
          <input
            type="number"
            min={100}
            value={margin}
            onChange={e => setMargin(Math.max(100, Number(e.target.value) || 0))}
            className="num w-24 rounded border border-gray-300 px-2 py-1 text-xs text-right"
          />
          <span className="text-gray-500 text-[11px]">USD</span>
        </Field>
        <Field label="Leverage">
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            className="flex-1 accent-[var(--color-role-trader)]"
          />
          <span className="num w-14 text-right font-semibold text-gray-800">{leverage}×</span>
        </Field>
        <Field label="Premium">
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={premiumApy}
            onChange={e => setPremiumApy(Number(e.target.value))}
            className="flex-1 accent-[var(--color-role-trader)]"
          />
          <span className="num w-14 text-right font-semibold text-gray-800">{premiumApy}% APY</span>
        </Field>
        <Field label="Move">
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={move}
            onChange={e => setMove(Number(e.target.value))}
            className="flex-1 accent-[var(--color-role-trader)]"
          />
          <span className="num w-14 text-right font-semibold text-gray-800">±{move.toFixed(1)}%</span>
        </Field>

        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1 num">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-gray-500">Virtual notional</span>
            <span className="font-medium text-gray-700">{fmtUSD(notional)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-gray-600">If price moves ±{move.toFixed(1)}% in 24h</span>
            <span
              className="text-base font-bold"
              style={{ color: netPnL24h >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
            >
              {netPnL24h >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL24h))}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-[10px] text-gray-500">
            <span>= +{fmtUSD(grossPnl)} IP − {fmtUSD(carryPer24h)} carry over 24h</span>
          </div>
        </div>

        <div className="mt-1 pt-2 border-t border-gray-200 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] num">
          <div>
            <span className="text-gray-500">Breakeven move (24h)</span>
            <div className="font-semibold text-gray-800">±{breakevenMovePct.toFixed(2)}%</div>
          </div>
          <div>
            <span className="text-gray-500">Liquidation at</span>
            <div className="font-semibold text-[var(--color-status-danger)]">±{liqDistancePct.toFixed(2)}%</div>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 leading-tight pt-1">
          ⚠️ Приблизительная оценка. Если рынок не двинется за 24h — потеряешь carry. Если двинется против тебя сильнее liq-distance — позиция ликвидируется (margin потеряна).
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600 w-16 flex-shrink-0">{label}</span>
      {children}
    </div>
  )
}

function OutbidBanner({
  count,
  totalPnl,
  bestSingle,
  active,
  onActivate,
  onClear,
}: {
  count: number
  totalPnl: number
  bestSingle: number
  active: boolean
  onActivate: () => void
  onClear: () => void
}) {
  const KEY = 'sliq.mkt.outbidBannerCollapsed'
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(KEY) === '1'
  })
  function toggle() {
    setCollapsed(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        if (next) localStorage.setItem(KEY, '1')
        else localStorage.removeItem(KEY)
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="mb-3 w-full flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 hover:bg-amber-100 transition text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">🎯</span>
          <span className="text-xs font-semibold text-amber-900 truncate">
            {count} outbid {count === 1 ? 'opportunity' : 'opportunities'}
          </span>
          <span className="text-[11px] text-amber-700 num truncate">
            · best +{fmtUSD(bestSingle)} · total ≈ +{fmtUSD(totalPnl)}
          </span>
        </span>
        <span className="text-amber-700 text-xs flex-shrink-0 inline-flex items-center gap-1">
          <span className="hidden sm:inline">expand</span>
          <span aria-hidden="true">▾</span>
        </span>
      </button>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">🎯</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-amber-900 text-sm">
              {count} outbid {count === 1 ? 'opportunity' : 'opportunities'}
            </span>
            <span className="text-[11px] text-amber-700 num">
              best +{fmtUSD(bestSingle)} · total ≈ +{fmtUSD(totalPnl)} capturable
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-snug mt-1 max-w-3xl">
            На этих листингах кто-то уже сидит и <strong>в плюсе</strong>. Предложи LP'у carry выше —
            твою конкуренцию закроют на следующем блоке по текущей цене Uniswap, и ты заходишь вместо неё со своим плечом.
            Тот трейдер получает свою маржу + накопленный PnL обратно, ты — позицию.
          </p>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Где видно PnL: <strong>🎯 +$X</strong> бэйдж в строке листинга (лучший потенциал), полная таблица всех позиций — внутри карточки листинга (тап на строку).
          </p>
          <div className="mt-2 flex items-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium px-2.5 py-1 rounded border border-amber-700 text-amber-900 bg-white hover:bg-amber-100 transition"
              >
                Show all listings
              </button>
            ) : (
              <button
                type="button"
                onClick={onActivate}
                className="text-xs font-medium px-2.5 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 transition"
              >
                Show outbid-only
              </button>
            )}
            <HelpPopover label="Как работает «перекуп»" width="w-80">
              <p className="font-semibold mb-1">Как перекупить чужую позицию</p>
              <p className="mb-2">
                Когда листинг занят полностью — зайти можно только <strong>перекупив</strong> чью-то позицию.
                Предложи LP'у Premium APY <strong>выше</strong> ставки текущего трейдера.
                На следующем блоке Arbitrum:
              </p>
              <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 text-[11px]">
                <li>Прошлый трейдер закрывается по текущей цене пары на Uniswap.</li>
                <li>Ему возвращают маржу + накопленный PnL.</li>
                <li>Открывается твоя позиция с твоим размером и плечом.</li>
              </ul>
              <p className="text-[11px]">
                <strong>Зачем:</strong> если позиция уже в плюсе +$1.2K — значит рынок движется. Ты входишь от текущей цены и забираешь следующее движение со своим плечом. Прошлый трейдер уже получил свой PnL и вышел.
              </p>
              <p className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                Минус: ты платишь carry чуть выше его ставки. Плюс: входишь без ожидания пары, рынок уже двинулся.
              </p>
            </HelpPopover>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="text-amber-700 hover:text-amber-900 text-[11px] font-medium flex-shrink-0 inline-flex items-center gap-1 underline decoration-dotted decoration-amber-400 hover:decoration-amber-700"
          aria-label="Collapse"
        >
          collapse
          <span aria-hidden="true">▴</span>
        </button>
      </div>
    </div>
  )
}

