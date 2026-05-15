// S11 My Listings — LP daily dashboard.
// Mirror trader-side TraderPositions pattern: summary cards · attention banner
// · filter strip · table · pagination. Plus LP-specific: range hit-rate, lessees count,
// IL-aware Net PnL, vs HODL delta.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { connectedWallet, listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'
import { capacityFreePct, getRangeStatus, isSubsidized, pairLabel } from '@/lib/derive'
import { HelpPopover } from '@/components/HelpPopover'
import { useLPDemoState, deriveLPState } from '@/lib/lpDemoState'
import { getWalletNFTsForState, getNonEligibleNFTsForState, PROTOCOL_LABELS, showListingsForState, type WalletNFT } from '@/mocks/walletNFTs'
import type { Listing, DexProtocol } from '@/lib/types'

// Protocol name display — keep short, matches «protocol tabs» convention on /lp/list
function dexLabel(d: DexProtocol): string {
  switch (d) {
    case 'uniswap-v3': return 'Uniswap V3'
    case 'uniswap-v4': return 'Uniswap V4'
    case 'pancakeswap-v3': return 'PancakeSwap'
    case 'gmx': return 'GMX'
    default: return 'Other'
  }
}

type StatusFilter = 'all' | 'earning' | 'waiting' | 'attention'
type SortId = 'pnl-desc' | 'pnl-asc' | 'apy-desc' | 'claimable-desc' | 'activity' | 'tvl-desc' | 'newest'

const PAGE_SIZES = [25, 50, 100, -1] as const

export type MyListingsMode = 'list' | 'positions'

export function MyListings({ mode = 'positions' }: { mode?: MyListingsMode }) {
  const [lpState] = useLPDemoState()
  const { isConnected, hasListings, hasEligibleNFTs } = deriveLPState(lpState)
  const walletNFTs = useMemo(() => getWalletNFTsForState(lpState), [lpState])
  const nonEligibleNFTs = useMemo(() => getNonEligibleNFTsForState(lpState), [lpState])

  // 1.1 Guest — wallet not connected (same hero on both tabs)
  if (!isConnected) {
    return <GuestState />
  }

  // ── /lp/list tab ── (onboarding + eligible NFTs + inline Lite/Pro form) ──
  if (mode === 'list') {
    // 1.2 No NFTs in wallet
    if (!hasEligibleNFTs) {
      // 1.4 case: connected with listings but no more eligible NFTs to list
      if (hasListings) {
        return <AllListedOnListTab />
      }
      // 1.2 pure case: no listings, no eligible NFTs
      return <NoNFTsState />
    }
    // 1.3 / 1.5: eligible NFTs available — inline Lite/Pro form on selection
    return (
      <ListFlowPage
        walletNFTs={walletNFTs}
        nonEligibleNFTs={nonEligibleNFTs}
        hasListings={hasListings}
      />
    )
  }

  // ── /lp/positions tab ── (existing listings table) ──
  if (!hasListings) {
    // 1.2/1.3 case: connected but no positions yet
    return <NoPositionsState hasEligibleNFTs={hasEligibleNFTs} />
  }
  // 1.4 + 1.5: table view
  return <ListingsView />
}

// ───────── Main listings view — table for /lp/positions (states 1.4 + 1.5) ─────────
function ListingsView() {
  const navigate = useNavigate()
  // Filter / sort state — initial values restored from localStorage (Viktor P3.28
  // «saved filters / views»). Prototype-level: auto-save current combo on every
  // change, restore on next visit. No named-preset UI yet.
  const SAVED_KEY = 'sliq.lp.savedFilter.v1'
  const initialFilter = (() => {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(window.localStorage.getItem(SAVED_KEY) || 'null') as {
      statusFilter: StatusFilter; pairFilter: string; protocolFilter: string; sort: SortId
    } | null } catch { return null }
  })()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter?.statusFilter ?? 'all')
  const [pairFilter, setPairFilter] = useState<string>(initialFilter?.pairFilter ?? 'all')
  const [protocolFilter, setProtocolFilter] = useState<string>(initialFilter?.protocolFilter ?? 'all')
  const [sort, setSort] = useState<SortId>(initialFilter?.sort ?? 'pnl-desc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState<number>(1)
  const [attentionExpanded, setAttentionExpanded] = useState(false)

  // Persist filter combo on change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify({ statusFilter, pairFilter, protocolFilter, sort }))
    } catch { /* ignore quota errors */ }
  }, [statusFilter, pairFilter, protocolFilter, sort])

  // Keyboard shortcut — `/` focuses status filter. Bulk-select / compare-mode
  // retired per Eugene 2026-05-15 (checkbox column was visual noise; Pro-power
  // features deferred).
  const statusFilterRef = useRef<HTMLSelectElement | null>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        statusFilterRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const mine = useMemo(
    () => listings.filter(l => l.owner === connectedWallet.address),
    []
  )

  // Summary
  const summary = useMemo(() => {
    const earningToday = mine.reduce((s, l) => {
      const daily = ((l.lifetimeUniFeesUSD ?? 0) + (l.lifetimePremiumUSD ?? 0) + (l.lifetimeReferenceUSD ?? 0))
      const ageDays = Math.max(1, (Date.now() - l.listedAt) / (1000 * 60 * 60 * 24))
      return s + (daily / ageDays)
    }, 0)
    const totalNetPnL = mine.reduce((s, l) => s + (l.netPnLUSD ?? 0), 0)
    const totalTVL = mine.reduce((s, l) => s + l.initialLiquidityUSD, 0)
    const atRisk = mine.filter(l => l.providerMode === 'advanced' && (l.distanceToLiqPct ?? 100) < 30).length
    const earningCount = mine.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD < l.totalCapacityUSD).length
    const waitingCount = mine.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD >= l.totalCapacityUSD).length
    // Claimable now — aggregated across all active listings (Uniswap fees + Premium + Reference)
    const claimableNow = mine.reduce((s, l) => {
      const uniClaimable = (l.lifetimeUniFeesUSD ?? 0) * 0.18 // mock: ~18% sitting unclaimed
      const premiumClaimable = (l.lifetimePremiumUSD ?? 0) * 0.22
      const refClaimable = (l.lifetimeReferenceUSD ?? 0) * 0.15
      return s + uniClaimable + premiumClaimable + refClaimable
    }, 0)
    return { earningToday, totalNetPnL, totalTVL, atRisk, claimableNow, earningCount, waitingCount }
  }, [mine])

  // Filter
  const filtered = useMemo(() => {
    let out = [...mine]
    if (statusFilter === 'earning') out = out.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD < l.totalCapacityUSD)
    else if (statusFilter === 'waiting') out = out.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD >= l.totalCapacityUSD)
    else if (statusFilter === 'attention') out = out.filter(l => l.providerMode === 'advanced' && (l.distanceToLiqPct ?? 100) < 30)
    if (pairFilter !== 'all') {
      out = out.filter(l => `${l.pair.token0}/${l.pair.token1}` === pairFilter)
    }
    if (protocolFilter !== 'all') {
      out = out.filter(l => l.dex === protocolFilter)
    }

    switch (sort) {
      case 'pnl-desc': out.sort((a, b) => (b.netPnLUSD ?? 0) - (a.netPnLUSD ?? 0)); break
      case 'pnl-asc': out.sort((a, b) => (a.netPnLUSD ?? 0) - (b.netPnLUSD ?? 0)); break
      case 'activity': out.sort((a, b) => {
        // Activity rank — lower = more active = ranks higher in the list.
        //   0 Earning      (ACTIVE, leased>0)
        //   1 Listed       (ACTIVE, leased=0)
        //   2 Withdrawing  (WITHDRAWAL_REQUESTED — transient exit)
        //   3 Liquidating  (in-flight Pro liquidation)
        //   4 Liquidated   (terminal bad)
        //   5 Closed       (terminal neutral)
        const rank = (l: Listing) => {
          if (l.status === 'WITHDRAWN') return 5
          if (l.status === 'LIQUIDATED') return 4
          if (l.status === 'LIQUIDATING') return 3
          if (l.status === 'WITHDRAWAL_REQUESTED') return 2
          if (l.status === 'ACTIVE') {
            const leasedPct = l.totalCapacityUSD > 0 ? ((l.totalCapacityUSD - l.availableCapacityUSD) / l.totalCapacityUSD) * 100 : 0
            return leasedPct > 0.5 ? 0 : 1
          }
          return 99
        }
        const rA = rank(a), rB = rank(b)
        if (rA !== rB) return rA - rB
        // Tie-break by Net PnL desc — within same activity bucket, profitable first.
        return (b.netPnLUSD ?? 0) - (a.netPnLUSD ?? 0)
      }); break
      case 'tvl-desc': out.sort((a, b) => b.initialLiquidityUSD - a.initialLiquidityUSD); break
      case 'apy-desc': out.sort((a, b) =>
        ((b.uniswapApyBps + b.minPremiumApyBps) - (a.uniswapApyBps + a.minPremiumApyBps))
      ); break
      case 'claimable-desc': out.sort((a, b) => (b.claimableNowUSD ?? 0) - (a.claimableNowUSD ?? 0)); break
      case 'newest': out.sort((a, b) => b.listedAt - a.listedAt); break
    }
    return out
  }, [mine, statusFilter, pairFilter, protocolFilter, sort])

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = pageSize === -1 ? 0 : (safePage - 1) * pageSize
  const pageEnd = pageSize === -1 ? filtered.length : pageStart + pageSize
  const visible = filtered.slice(pageStart, pageEnd)

  const myProtocols = useMemo(() => {
    const set = new Set<string>()
    mine.forEach(l => set.add(l.dex))
    return Array.from(set)
  }, [])

  const myPairs = useMemo(() => {
    const set = new Set<string>()
    mine.forEach(l => set.add(`${l.pair.token0}/${l.pair.token1}`))
    return Array.from(set).sort()
  }, [mine])

  const attentionTotal = summary.atRisk
  // Pro vocabulary (HF, At-risk, Liquidation) is gated by ownership of at least one
  // Advanced listing. Lite-only LPs never see liq language → no anxiety about
  // «what's HF? why am I at risk?» (UX audit P0, Eugene 2026-05-15).
  const hasAnyPro = mine.some(l => l.providerMode === 'advanced')

  // (Empty-state early return removed — handled by 1.1-1.3 state branches at the top.)

  return (
    <div>
      <header className="mb-5">
        {/* Claimable banner — aggregated across all listings, top of page (was a separate /lp/claims tab) */}
        {summary.claimableNow > 0.01 && (
          <ClaimableBanner amount={summary.claimableNow} listingsCount={mine.length} />
        )}

        {/* Onboarding banner — collapsed by default */}
        <OnboardingBanner />

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Earning today" subtitle="across all listings" valueColor="success">
            +{fmtUSD(summary.earningToday)}
          </SummaryCard>
          <SummaryCard label="Net PnL" subtitle="IL-aware · since listing" valueColor={summary.totalNetPnL >= 0 ? 'success' : 'danger'}>
            {summary.totalNetPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(summary.totalNetPnL))}
          </SummaryCard>
          <SummaryCard label="Total pool size" subtitle={`${mine.length} listing${mine.length === 1 ? '' : 's'}`} valueColor="neutral">
            {fmtUSD(summary.totalTVL)}
          </SummaryCard>
          {/* «At risk» card only for portfolios with at least one Pro listing.
              Lite-only LPs never have liquidation risk → no need to surface 0/0 anxiety. */}
          {hasAnyPro && (
            <SummaryCard label="At risk" subtitle="Pro listings near liq" valueColor={summary.atRisk > 0 ? 'danger' : 'neutral'}>
              {summary.atRisk}
            </SummaryCard>
          )}
        </div>

        {/* Strip layout (Eugene 2026-05-15 round 6):
              Left  → «Clear filters» — always visible in prototype, even when no
                      filters are active (dims when nothing to clear).
              Right → «N need attention ▾» (when attentionTotal > 0)
            «+ List NFT» dropped — already available as a tab in AppSubNav. */}
        {(() => {
          const filtersActive = statusFilter !== 'all' || pairFilter !== 'all' || protocolFilter !== 'all'
          return (
            <p className="text-xs text-gray-500 num mt-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={!filtersActive}
                onClick={() => {
                  setStatusFilter('all')
                  setPairFilter('all')
                  setProtocolFilter('all')
                }}
                className={
                  filtersActive
                    ? 'text-[var(--color-role-lp)] hover:underline'
                    : 'text-gray-400 cursor-not-allowed'
                }
                title={filtersActive ? 'Reset all filters' : 'No filters active'}
              >
                Clear filters
              </button>
              {attentionTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setAttentionExpanded(e => !e)}
                  className="ml-auto text-[var(--color-status-danger)] font-medium underline decoration-dotted hover:no-underline inline-flex items-center gap-1"
                >
                  {attentionTotal} need attention <span aria-hidden="true">{attentionExpanded ? '▴' : '▾'}</span>
                </button>
              )}
            </p>
          )
        })()}
      </header>

      {/* Attention expandable */}
      {attentionExpanded && attentionTotal > 0 && (
        <div className="mb-3 rounded-lg border border-[var(--color-status-danger)]/40 bg-red-50/60 px-4 py-3 flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--color-status-danger)]">Attention needed</div>
            <ul className="text-xs text-gray-700 mt-1 space-y-0.5 num">
              {summary.atRisk > 0 && (
                <li>
                  <strong>{summary.atRisk}</strong> Advanced listing{summary.atRisk === 1 ? '' : 's'} приближаются к listing-level liquidation — снизь Provider Leverage или закрой
                </li>
              )}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setAttentionExpanded(false)}
            className="text-gray-400 hover:text-gray-600 text-base leading-none flex-shrink-0"
            aria-label="Свернуть"
          >×</button>
        </div>
      )}

      {/* Filter strip */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2">
        {/* Desktop: segmented control */}
        <div className="hidden sm:flex items-center rounded-md border border-gray-300 overflow-hidden">
          {(([
            { id: 'all', label: `All (${mine.length})` },
            { id: 'earning', label: `Earning${summary.earningCount > 0 ? ` (${summary.earningCount})` : ''}` },
            { id: 'waiting', label: `Listed${summary.waitingCount > 0 ? ` (${summary.waitingCount})` : ''}` },
            // Attention chip surfaced only when user owns at least one Pro listing
            // — for Lite-only portfolios «At-risk» concept is irrelevant.
            ...(hasAnyPro ? [{ id: 'attention' as const, label: `Attention${attentionTotal > 0 ? ` (${attentionTotal})` : ''}` }] : []),
          ] as const)).map(o => {
            const active = statusFilter === o.id
            const attentionHot = o.id === 'attention' && attentionTotal > 0
            // Attention chip is the only chip that signals urgency by colour:
            // - hot + active   → red fill, white text  (urgent + filtered)
            // - hot + inactive → red soft fill         (urgent, alerting user)
            // - other chips    → standard segmented control behaviour
            const cls = active
              ? attentionHot
                ? 'bg-[var(--color-status-danger)] text-white font-medium'
                : 'bg-gray-900 text-white font-medium'
              : attentionHot
                ? 'bg-red-50 text-[var(--color-status-danger)] font-medium hover:bg-red-100'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setStatusFilter(o.id)}
                className={'text-xs px-2.5 py-1 transition ' + cls}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        {/* Mobile: status dropdown. Prefix «Status:» so the «All» isn't naked next
            to the other All-prefixed selects (All pairs / All protocols) — Eugene
            2026-05-15: «1й селектор, что за All? Все кто?». */}
        <select
          ref={statusFilterRef}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="sm:hidden rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          aria-label="Filter by status"
        >
          <option value="all">Status: All ({mine.length})</option>
          <option value="earning">Status: Earning{summary.earningCount > 0 ? ` (${summary.earningCount})` : ''}</option>
          <option value="waiting">Status: Listed{summary.waitingCount > 0 ? ` (${summary.waitingCount})` : ''}</option>
          {hasAnyPro && (
            <option value="attention">Status: Attention{attentionTotal > 0 ? ` (${attentionTotal})` : ''}</option>
          )}
        </select>

        {myPairs.length > 1 && (
          <select
            value={pairFilter}
            onChange={e => setPairFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All pairs</option>
            {myPairs.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>
        )}

        {myProtocols.length > 1 && (
          <select
            value={protocolFilter}
            onChange={e => setProtocolFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All protocols</option>
            {myProtocols.map(p => (<option key={p} value={p}>{dexLabel(p as DexProtocol)}</option>))}
          </select>
        )}

        {/* Sort dropdown: left-aligned on mobile (matches the filter selects),
            pushed to the right on sm+ where the filter row has slack space.
            Eugene 2026-05-15: «на мобилке лучше слева». */}
        <div className="sm:ml-auto flex items-center gap-1">
          <span className="text-[11px] text-gray-500">Sort</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortId)}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
          >
            <option value="pnl-desc">PnL ↓</option>
            <option value="pnl-asc">PnL ↑</option>
            <option value="apy-desc">APY ↓</option>
            <option value="claimable-desc">Claimable ↓</option>
            <option value="activity">Activity</option>
            <option value="tvl-desc">Pool size ↓</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar + Compare drawer removed per Eugene 2026-05-15 — bulk-
          select checkboxes were visual noise on web. Pro-power features deferred. */}

      {/* Table */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">No listings match this filter.</p>
        </div>
      ) : (
        <>
          <ListingsTable
            listings={visible}
            hasAnyPro={hasAnyPro}
            onClick={id => navigate(`/listings/${id}`)}
            onClaim={id => {
              const l = listings.find(x => x.id === id)
              if (!l) return
              // TODO: wire up real claim flow — for now mark as claimed in-memory.
              alert(`Mock: claiming ${fmtUSD(l.claimableNowUSD ?? 0)} from ${pairLabel(l)}`)
            }}
          />

          {/* Pagination */}
          {mine.length > Math.min(...PAGE_SIZES.filter(s => s > 0)) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  {PAGE_SIZES.map(s => (<option key={s} value={s}>{s === -1 ? 'All' : s}</option>))}
                </select>
                <span>per page</span>
              </div>
              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="num">
                    {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
                  </span>
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition">←</button>
                  <span className="num font-medium px-1">{safePage} / {totalPages}</span>
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition">→</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Listing-flow content moved to /lp/list tab — this tab is pure positions table */}
    </div>
  )
}

// ───────── /lp/list — Listing flow page ─────────
// States 1.3 + 1.5: wallet has eligible NFTs (and maybe also has listings).
// State 1.3: green "fresh" banner + cards
// State 1.5: ListedSummaryCard (existing positions with statuses, clickable → /lp/positions)
//           + "More NFTs ready to list" cards section below
function ListFlowPage({
  walletNFTs,
  nonEligibleNFTs,
  hasListings,
}: {
  walletNFTs: WalletNFT[]
  nonEligibleNFTs: WalletNFT[]
  hasListings: boolean
}) {
  const [selectedNFT, setSelectedNFT] = useState<WalletNFT | null>(null)
  const myListings = useMemo(
    () => listings.filter(l => l.owner === connectedWallet.address),
    []
  )

  return (
    <div>
      <header className="mb-6">
        {hasListings ? (
          // State 1.5 — show summary of existing listings with statuses
          <ListedSummaryCard listings={myListings} />
        ) : (
          // State 1.3 — fresh user banner. Count of NFTs intentionally NOT here;
          // it lives on the EligibleNFTsSection header next to «(N)» (UX audit P2.23
          // — was duplicated). Banner now tells the user the wallet is recognised
          // and prompts the action.
          <div className="rounded-lg border border-lime-200 bg-lime-50/50 px-4 py-3 flex items-start gap-3">
            <span className="text-lime-700 text-xl leading-none mt-0.5">✓</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">
                Wallet connected · Uniswap V3 NFTs found
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Pick a position to start earning extra carry on top of Uniswap fees.{' '}
                <span className="text-gray-500 num">Pick → Sign → Earn</span>
              </p>
            </div>
          </div>
        )}
      </header>

      <EligibleNFTsSection
        walletNFTs={walletNFTs}
        nonEligibleNFTs={nonEligibleNFTs}
        variant={hasListings ? 'secondary' : 'primary'}
        onSelectNFT={setSelectedNFT}
      />

      {/* Inline Lite/Pro form modal */}
      {selectedNFT && (
        <ListNFTModal nft={selectedNFT} onClose={() => setSelectedNFT(null)} />
      )}
    </div>
  )
}

// ───────── Summary card of existing sLiq positions on /lp/list ─────────
// Shown in state 1.5 (partial). Compact rows per listing with status badge.
// Each row clickable → /lp/listings/:id ; footer link → /lp/positions.
function ListedSummaryCard({ listings: myListings }: { listings: Listing[] }) {
  // Mini-stats: count breakdown by status
  const earningCount = myListings.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD < l.totalCapacityUSD).length
  const waitingCount = myListings.filter(l => l.status === 'ACTIVE' && l.availableCapacityUSD >= l.totalCapacityUSD).length
  const attentionCount = myListings.filter(l => l.providerMode === 'advanced' && (l.distanceToLiqPct ?? 100) < 30).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] text-sm">
        ◈
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">
          Already listed on sLiq · <span className="num">{myListings.length}</span> position{myListings.length === 1 ? '' : 's'}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 num">
          {earningCount > 0 && <>{earningCount} earning</>}
          {waitingCount > 0 && <> · {waitingCount} waiting</>}
          {attentionCount > 0 && <> · <span className="text-[var(--color-status-danger)]">{attentionCount} attention</span></>}
        </div>
      </div>
      <Link
        to="/lp/positions"
        className="shrink-0 text-xs font-medium text-[var(--color-role-lp)] hover:opacity-80 transition"
      >
        View all →
      </Link>
    </div>
  )
}

// ListedSummaryRow removed — ListedSummaryCard compressed to single-line summary
// (Eugene: per-listing detail belongs on /lp/positions, not /lp/list).

// State 1.4 on /lp/list tab — all listed; suggest user to mint more on Uniswap.
function AllListedOnListTab() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <span className="inline-flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-xl bg-lime-50 text-lime-700 text-2xl">
          ✓
        </span>
        <h2 className="text-lg font-semibold text-gray-900">All eligible NFTs are listed</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          Your wallet has no more Uniswap V3 LP NFTs available to list. To add capacity,
          mint a new position on Uniswap — sLiq will detect it automatically.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://app.uniswap.org/positions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            Mint LP on Uniswap <span aria-hidden>↗</span>
          </a>
          <Link
            to="/lp/positions"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-5 py-2.5 text-sm font-medium transition"
          >
            View my listings →
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-gray-400">
          🔒 Provide liquidity &amp; mint NFT directly from sLiq — coming after Beta
        </p>
      </div>
    </div>
  )
}

// State 1.2/1.3 on /lp/positions tab — no positions yet.
function NoPositionsState({ hasEligibleNFTs }: { hasEligibleNFTs: boolean }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <span className="inline-flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-100 text-gray-400 text-2xl">
          ◯
        </span>
        <h2 className="text-lg font-semibold text-gray-900">No listings on sLiq yet</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          {hasEligibleNFTs
            ? 'Your wallet has eligible LP NFTs ready to list. Head to the List NFT tab to start earning Premium APY.'
            : 'Once you list a Uniswap V3 LP NFT on sLiq, it will appear here with earnings, range status, and claim controls.'}
        </p>
        <div className="mt-6">
          <Link
            to="/lp/list"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            {hasEligibleNFTs ? 'List your first NFT →' : 'Open List NFT tab →'}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ───────── 1.1 Guest state ─────────
function GuestState() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white p-8 md:p-12 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-lime-300 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
          For liquidity providers
        </span>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight max-w-2xl mx-auto">
          Earn extra yield on your Uniswap V3 LP
        </h1>
        <p className="mt-4 text-gray-300 leading-relaxed max-w-2xl mx-auto">
          Plug in your existing LP NFT. Earn <strong className="text-lime-300">+3–7% APR</strong> extra carry from sLiq traders on top of your normal Uniswap fees. <strong className="text-white">2-click exit.</strong>
        </p>
        <div className="mt-8">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-gray-900 px-6 py-3 text-sm font-semibold transition"
            title="Prototype: flip LP demo state to 1.2-1.5 in the dev switcher"
          >
            Connect wallet to start
          </button>
        </div>
        <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
          <ValueChip n="+3–7% APR" label="Premium APY carry" />
          <ValueChip n="Up to 100×" label="Provider Leverage (Pro mode)" />
          {/* Strengthened NFT-custody chip per Eugene 2026-05-15 — Semen's anxiety
              about losing NFT custody is the #1 friction; an explicit «pull back
              anytime» signal beats generic «custody preserved». */}
          <ValueChip n="Pull back anytime" label="NFT stays in your wallet" />
        </div>
      </div>
    </div>
  )
}

function ValueChip({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-left">
      <div className="text-base font-bold text-white">{n}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}

// ───────── 1.2 Connected, no NFTs in wallet ─────────
function NoNFTsState() {
  const shortAddress = `${connectedWallet.address.slice(0, 6)}…${connectedWallet.address.slice(-4)}`
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        {/* Connected-wallet indicator — makes it explicit the empty state is about THIS wallet */}
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] px-3 py-1 text-xs font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)]" />
          Wallet connected · <span className="num">{shortAddress}</span>
        </div>

        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center text-2xl">
          ∅
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          No Uniswap V3 LP NFTs in your wallet
        </h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          We scanned <span className="num text-gray-900">{shortAddress}</span> across all supported chains —
          no V3 LP positions found yet. Mint one on Uniswap and sLiq will detect it automatically.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* Hierarchy swap per UX audit P2.17: Re-scan is sLiq-native primary,
              Mint LP on Uniswap is secondary (off-platform — second click). */}
          <button
            type="button"
            onClick={() => { /* prototype no-op */ }}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-5 py-2.5 text-sm font-medium transition"
            title="Re-scan the connected wallet for V3 LP NFTs"
          >
            Re-scan wallet
          </button>
          <a
            href="https://app.uniswap.org/positions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-5 py-2.5 text-sm font-medium transition"
          >
            Mint LP on Uniswap <span aria-hidden>↗</span>
          </a>
        </div>
        {/* Low-emphasis future-state hint */}
        <p className="mt-4 text-[11px] text-gray-400">
          🔒 Provide liquidity &amp; mint NFT directly from sLiq — coming after Beta
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Supported: Uniswap V3 on Arbitrum · Ethereum · Base · Optimism · Polygon
        </p>
      </div>
    </div>
  )
}

// ───────── 1.3 Connected, has NFTs, no listings ─────────
function FreshUserState({ walletNFTs, nonEligibleNFTs }: { walletNFTs: WalletNFT[]; nonEligibleNFTs: WalletNFT[] }) {
  return (
    <div>
      <header className="mb-6">
        <div className="rounded-lg border border-lime-200 bg-lime-50/50 px-4 py-3 flex items-start gap-3">
          <span className="text-lime-700 text-xl leading-none mt-0.5">✓</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              Wallet connected · {walletNFTs.length} eligible Uniswap V3 NFT{walletNFTs.length === 1 ? '' : 's'} found
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Pick a position to start earning extra carry on top of Uniswap fees.{' '}
              <span className="text-gray-500 num">Pick → Sign → Earn</span>
            </p>
          </div>
        </div>
      </header>
      <EligibleNFTsSection walletNFTs={walletNFTs} nonEligibleNFTs={nonEligibleNFTs} variant="primary" />
    </div>
  )
}

// ───────── Eligible NFTs section ─────────
// When wallet has non-Uniswap-V3 NFTs too, show protocol tabs.
// Active tab renders eligible cards. «Soon» tabs render detected positions + coming-soon banner.
function EligibleNFTsSection({
  walletNFTs,
  nonEligibleNFTs = [],
  variant = 'secondary',
  onSelectNFT,
}: {
  walletNFTs: WalletNFT[]
  nonEligibleNFTs?: WalletNFT[]
  variant?: 'primary' | 'secondary'
  onSelectNFT?: (nft: WalletNFT) => void
}) {
  const allNFTs = [...walletNFTs, ...nonEligibleNFTs]

  // Group by protocol with explicit display order (Uniswap V3 first, then GMX, then Aerodrome, etc.)
  const protocolGroups = useMemo(() => {
    const PROTOCOL_ORDER: Record<string, number> = {
      'uniswap-v3': 0,
      'gmx': 1,
      'pancake-v3': 2,
      'sushi-v3': 3,
      'maverick': 4,
    }
    const map = new Map<string, WalletNFT[]>()
    allNFTs.forEach(n => {
      const arr = map.get(n.protocol) ?? []
      arr.push(n)
      map.set(n.protocol, arr)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      const oa = PROTOCOL_ORDER[a] ?? 99
      const ob = PROTOCOL_ORDER[b] ?? 99
      return oa - ob
    })
  }, [allNFTs])

  const [activeProtocol, setActiveProtocol] = useState<string>('uniswap-v3')
  const activeNFTs = protocolGroups.find(([p]) => p === activeProtocol)?.[1] ?? walletNFTs
  const showTabs = protocolGroups.length > 1
  const isUniswapTab = activeProtocol === 'uniswap-v3'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900">
          {variant === 'primary' ? 'Ready to list' : 'More NFTs ready to list'}
          {isUniswapTab && (
            <span className="ml-2 text-sm text-gray-500 num">({walletNFTs.length})</span>
          )}
        </h2>
        {showTabs && (
          <ProtocolTabs
            groups={protocolGroups}
            active={activeProtocol}
            onChange={setActiveProtocol}
          />
        )}
      </div>

      {isUniswapTab ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeNFTs.map(nft => (
            <EligibleNFTCard key={nft.tokenId} nft={nft} onSelect={onSelectNFT} />
          ))}
        </div>
      ) : (
        <ProtocolComingSoon protocol={activeProtocol} nfts={activeNFTs} />
      )}
    </div>
  )
}

// Protocol tab row — Uniswap V3 is the only «active» protocol on Beta; others show «Soon».
function ProtocolTabs({
  groups,
  active,
  onChange,
}: {
  groups: [string, WalletNFT[]][]
  active: string
  onChange: (p: string) => void
}) {
  return (
    // Wrapper enables local horizontal scroll on overflow without affecting page layout.
    // Inner inline-flex stays whitespace-nowrap so chips don't wrap.
    <div className="max-w-full overflow-x-auto -mx-1 px-1">
      <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5 whitespace-nowrap">
      {groups.map(([protocol, nfts]) => {
        const label = PROTOCOL_LABELS[protocol as keyof typeof PROTOCOL_LABELS] ?? protocol
        const isActive = active === protocol
        const isUniswap = protocol === 'uniswap-v3'
        return (
          <button
            key={protocol}
            type="button"
            onClick={() => onChange(protocol)}
            className={
              'px-3 py-1.5 text-xs rounded transition font-medium inline-flex items-center gap-1.5 whitespace-nowrap ' +
              (isActive
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-800')
            }
          >
            <span>{label}</span>
            <span className="num text-gray-400">({nfts.length})</span>
            {!isUniswap && (
              <span className="text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Soon
              </span>
            )}
          </button>
        )
      })}
      </div>
    </div>
  )
}

// «Coming soon» tab content — shows detected positions + roadmap message + waitlist-style CTA.
function ProtocolComingSoon({ protocol, nfts }: { protocol: string; nfts: WalletNFT[] }) {
  const label = PROTOCOL_LABELS[protocol as keyof typeof PROTOCOL_LABELS] ?? protocol
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-5 py-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 text-amber-700 text-base">
          ⏳
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">
            {label} support — coming after mainnet
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            sLiq Beta supports Uniswap V3 only ({label} integration is on the roadmap).
            We detected <span className="num font-medium text-gray-900">{nfts.length}</span> position{nfts.length === 1 ? '' : 's'} in your wallet — listed below for transparency.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-3 py-1.5 text-xs font-medium transition whitespace-nowrap"
          title={`Get notified when ${label} integration ships`}
        >
          Notify me
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70">
        {nfts.map(nft => (
          <DetectedNFTCard key={nft.tokenId} nft={nft} />
        ))}
      </div>
    </div>
  )
}

// Read-only card for detected-but-not-supported NFTs. No CTA; visually muted.
function DetectedNFTCard({ nft }: { nft: WalletNFT }) {
  const inRange = nft.rangeStatus === 'in-range'
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {nft.pair.token0}/{nft.pair.token1}
        </span>
        <span className="text-[10px] font-mono text-gray-500">
          {fmtFeeTier(nft.feeTierBps)}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-gray-500 num">
        NFT #{nft.tokenId}
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <Row label="Price range" value={`${nft.priceRange.lower} – ${nft.priceRange.upper}`} />
        <Row
          label="Status"
          value={
            <span className={inRange ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-warning)]'}>
              {inRange ? 'In range' : 'Out of range'}
            </span>
          }
        />
        <Row label="Liquidity" value={fmtUSD(nft.liquidityUSD)} mono />
      </div>
    </div>
  )
}

function EligibleNFTCard({ nft, onSelect }: { nft: WalletNFT; onSelect?: (nft: WalletNFT) => void }) {
  const inRange = nft.rangeStatus === 'in-range'
  return (
    <div className="rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {nft.pair.token0}/{nft.pair.token1}
        </span>
        <span className="text-[10px] font-mono text-gray-500">
          {fmtFeeTier(nft.feeTierBps)}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-gray-500 num">
        NFT #{nft.tokenId}
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <Row label="Price range" value={`${nft.priceRange.lower} – ${nft.priceRange.upper}`} />
        <Row
          label="Status"
          value={
            <span className={inRange ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-warning)]'}>
              {inRange ? 'In range' : 'Out of range'}
            </span>
          }
        />
        <Row label="Liquidity" value={fmtUSD(nft.liquidityUSD)} mono />
        <Row label="Unclaimed fees" value={fmtUSD(nft.unclaimedFeesUSD)} mono />
        <Row label="Uniswap APR (24h)" value={fmtPct(nft.uniswapAprPct / 100)} mono />
      </div>

      <button
        type="button"
        onClick={() => onSelect?.(nft)}
        className="mt-4 w-full text-center text-sm font-medium bg-[var(--color-role-lp)] hover:opacity-90 text-white rounded-md py-2 transition"
      >
        + List on sLiq
      </button>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 ${mono ? 'num' : ''}`}>{value}</span>
    </div>
  )
}

// ───────── 1.4 All listed footer ─────────
function AllListedFooter() {
  return (
    <section className="mt-10 pt-8 border-t border-gray-200">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 flex items-start gap-3">
        <span className="text-gray-400 text-lg leading-none mt-0.5">✓</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">
            All eligible NFTs are listed
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            To add more capacity on sLiq, mint a new LP position on Uniswap — it will appear here automatically.
          </p>
        </div>
        <a
          href="https://app.uniswap.org/positions"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-3 py-1.5 text-xs font-medium transition"
        >
          Open Uniswap <span aria-hidden>↗</span>
        </a>
      </div>
    </section>
  )
}

// === Components ===

function ListingsTable({
  listings,
  hasAnyPro,
  onClick,
  onClaim,
}: {
  listings: Listing[]
  hasAnyPro: boolean
  onClick: (id: string) => void
  onClaim: (id: string) => void
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair · NFT</th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Status
                  <HelpPopover label="Статусы листинга" width="w-80">
                    <p className="font-semibold mb-2">Статусы листинга (final spec)</p>
                    <ul className="space-y-1.5 text-xs">
                      <li><strong className="text-emerald-700">Earning</strong> — арендаторы есть, Premium APY идёт на занятую долю.</li>
                      <li><strong className="text-gray-700">Listed</strong> — залистен, арендаторов пока нет (0% leased). Снизь min Premium APY чтобы привлечь.</li>
                      <li><strong className="text-amber-800">Withdrawing</strong> — запрошен вывод, 2-блочный guard.</li>
                      <li><strong className="text-[var(--color-status-danger)]">Liquidating</strong> — listing-level ликвидация в процессе (Pro + плечо&gt;1).</li>
                      <li><strong className="text-gray-500">Liquidated</strong> / <strong className="text-gray-500">Closed</strong> — терминальные.</li>
                    </ul>
                    <p className="mt-2 text-[11px] text-gray-500"><strong>Out of range</strong> — ортогональный sub-badge, появляется на любом активном статусе, когда цена вышла из Uniswap range.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Pool size
                  <HelpPopover label="Pool size · Leased %" width="w-72">
                    <p className="font-semibold mb-1">Pool size</p>
                    <p>USD-стоимость LP NFT (позиции в Uniswap pool) на момент листинга. Не меняется, пока ты не изменишь саму позицию.</p>
                    <p className="font-semibold mt-2 mb-1">Leased % (под суммой)</p>
                    <p>Доля пула, которая сейчас арендована трейдерами. Premium APY начисляется только на занятую долю.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden md:table-cell">
                <span className="inline-flex items-center gap-1 justify-end">
                  APY
                  <HelpPopover label="APY (Uniswap + Premium)" width="w-72">
                    <p className="font-semibold mb-1">Total APY = Uniswap baseline + Premium</p>
                    <p>Uniswap fees от underlying pool + Premium APY, который платят арендаторы на занятую долю. Сверху — сумма (bold); ниже — разбивка <span className="num">Uni · Prem</span>.</p>
                  </HelpPopover>
                </span>
              </th>
              {/* HF column rendered only when portfolio has at least one Pro listing —
                  for Lite-only LPs the column would always show «—» and create
                  «у меня чего-то не хватает» anxiety (UX audit P0). */}
              {hasAnyPro && (
                <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Health
                    <HelpPopover label="Health Factor (только Pro)" width="w-72">
                      <p>Aave-style шкала 0–100%. Показывается только для Pro-листингов с плечом &gt; 1. Чем ниже — тем ближе к listing-level ликвидации. Зелёный &gt; 60%, amber 30–60%, красный &lt; 30%.</p>
                    </HelpPopover>
                  </span>
                </th>
              )}
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Net PnL
                  <HelpPopover label="Net PnL с учётом IL" width="w-72">
                    <p className="font-semibold mb-1">Net PnL (IL-adjusted)</p>
                    <p>= Uniswap fees + Reference Fees + Premium APY − Impermanent Loss. То, что Uniswap UI <strong>не показывает</strong> — там только «fees earned» (misleading).</p>
                  </HelpPopover>
                </span>
              </th>
              {/* Fees column lifted to lg-only (was sm+). On md we collapse to just the
                  Claimable sub-line inside Net PnL cell — keeps the row scannable. */}
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">
                <span className="inline-flex items-center gap-1 justify-end">
                  Fees
                  <HelpPopover label="Fees" width="w-72">
                    <p className="font-semibold mb-1">Накопленные / доступные для claim</p>
                    <p>Верхняя строка — gross-fees, заработанные с момента листинга (Uniswap baseline + Premium APY).</p>
                    <p className="mt-1.5">Нижняя — то, что прямо сейчас можно забрать (settled, не реинвестировано autocompound'ом).</p>
                    <p className="mt-1.5 text-[11px] text-gray-500">В отличие от Net PnL — здесь без вычета IL. Это «сколько ты заработал», без коррекции на убыток от движения цены.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {listings.map(l => (
              <ListingRow
                key={l.id}
                listing={l}
                hasAnyPro={hasAnyPro}
                onClick={() => onClick(l.id)}
                onClaim={onClaim}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — each row a distinct rounded card with gap between, per Eugene
          2026-05-15. Was a single container with divide-y splitting flat rows;
          new pattern reads as «tap-into-this-card», not «row in a table». */}
      <div className="md:hidden space-y-2">
        {listings.map(l => (
          <MobileListingRow key={l.id} listing={l} onClick={() => onClick(l.id)} onClaim={onClaim} />
        ))}
      </div>
    </>
  )
}

function ListingRow({ listing, hasAnyPro, onClick, onClaim }: {
  listing: Listing
  hasAnyPro: boolean
  onClick: () => void
  onClaim: (id: string) => void
}) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const leasedPct = 100 - capacityFreePct(listing)
  const netPnL = listing.netPnLUSD ?? 0
  const dailyEarnings = ((listing.lifetimeUniFeesUSD ?? 0) + (listing.lifetimePremiumUSD ?? 0)) /
    Math.max(1, (Date.now() - listing.listedAt) / (1000 * 60 * 60 * 24))
  const claimable = listing.claimableNowUSD ?? 0
  const grossEarned = (listing.lifetimeUniFeesUSD ?? 0) + (listing.lifetimePremiumUSD ?? 0) + (listing.lifetimeReferenceUSD ?? 0)
  const uniApy = listing.uniswapApyBps / 100
  const premApy = listing.minPremiumApyBps / 100
  const totalApy = uniApy + premApy
  const isPro = listing.providerMode === 'advanced' && listing.providerLeverage > 1
  const hf = listing.healthFactorPct
  const isTerminal = listing.status === 'LIQUIDATED' || listing.status === 'WITHDRAWN'

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="group cursor-pointer transition border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
    >
      {/* 1. Pair · NFT — risk chips merged into a single «Risk» chip
            (subsidized + at-risk previously rendered as two separate chips,
            cognitive overload per UX audit P1). Single chip handles all 4 cases:
              • neither      → no chip
              • subsidized   → «Subsidized» (amber low-key)
              • at-risk      → «Pro N×» (amber)
              • both         → «Sub · Pro N×» (amber, both signals) */}
      <td className="px-4 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-gray-900 group-hover:text-[var(--color-role-lp)] transition">{pairLabel(listing)}</span>
          <span className="text-[10px] text-gray-500 num">{fmtFeeTier(listing.feeTierBps)}</span>
          {/* Risk chip — always rendered. «No Risk» gray for Conservative; amber
              «Risk N×» / «Subsidized» / «Sub · Risk N×» otherwise. Eugene
              2026-05-15: у позиций без плеча всегда видим No Risk сереньким. */}
          {(() => {
            const advanced = listing.providerMode === 'advanced'
            const cls = (subsidized || advanced)
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-gray-50 text-gray-500 border-gray-200'
            const label = subsidized && advanced
              ? `Sub · Risk ${listing.providerLeverage}×`
              : subsidized
              ? 'Subsidized'
              : advanced
              ? `Risk ${listing.providerLeverage}×`
              : 'No Risk'
            return (
              <span className={'text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-medium num ' + cls}>
                {label}
              </span>
            )
          })()}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-500 font-medium">{dexLabel(listing.dex)}</span>
          <span className="text-gray-300 text-[8px]">·</span>
          <span className="text-[11px] text-gray-500 num">NFT #{listing.tokenId}</span>
        </div>
      </td>
      {/* 2. Status */}
      <td className="px-3 py-3">
        <ListingStatusChip status={listing.status} leasedPct={leasedPct} rangeStatus={rangeStatus} />
      </td>
      {/* 3. Pool size + Leased % (merged — leased shown as compact sub-line, no bar to keep row tight) */}
      <td className="px-3 py-3 text-right num">
        <div className="font-medium text-gray-900">{fmtUSD(listing.initialLiquidityUSD)}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{Math.round(leasedPct)}% leased</div>
      </td>
      {/* 5. APY (Uniswap + Premium) */}
      <td className="px-3 py-3 text-right num hidden md:table-cell">
        {isTerminal ? (
          <span className="text-gray-300">—</span>
        ) : (
          <>
            <div className="font-semibold text-gray-900">{totalApy.toFixed(1)}%</div>
            <div className="text-[10px] text-gray-500 mt-0.5 leading-tight num">
              {uniApy.toFixed(1)}% {premApy >= 0 ? '+' : '−'} {Math.abs(premApy).toFixed(1)}%
            </div>
          </>
        )}
      </td>
      {/* 6. Health + distance-to-liq (Pro) — single cell, two-line.
            Main: HF %  ·  Sub: distance to liq % (Viktor P3.26 — at-a-glance
            risk pair). Conservative rows show «—». */}
      {hasAnyPro && (
        <td className="px-3 py-3 text-right num hidden lg:table-cell">
          {isPro && hf !== undefined ? (
            <>
              <span
                className="font-semibold"
                style={{
                  color: hf > 60
                    ? 'var(--color-status-success)'
                    : hf > 30
                    ? 'var(--color-status-warning)'
                    : 'var(--color-status-danger)',
                }}
              >
                {hf}%
              </span>
              {listing.distanceToLiqPct !== undefined && (
                <div className="text-[10px] mt-0.5 font-normal" style={{
                  color: listing.distanceToLiqPct < 5
                    ? 'var(--color-status-danger)'
                    : listing.distanceToLiqPct < 15
                    ? 'var(--color-status-warning)'
                    : 'var(--color-text-muted, #6b7280)',
                }}>
                  −{listing.distanceToLiqPct.toFixed(1)}% to liq
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
      )}
      {/* 7. Net PnL + 7d sparkline — promoted to visual anchor (text-base font-bold).
            Mini-sparkline (Viktor P3.29) — shows the recent earnings trend so
            «затухающие» листинги стучатся сами без drill-in. */}
      <td className="px-3 py-3 text-right">
        <span className="num font-bold text-base" style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
          {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
        </span>
        {!isTerminal && (
          <div className="text-[10px] text-gray-500 num">{dailyEarnings >= 0 ? '+' : '−'}{fmtUSD(Math.abs(dailyEarnings))}/day</div>
        )}
        {/* On md only — show Claimable inline (Fees column hidden until lg). */}
        {claimable > 0.01 && (
          <div className="lg:hidden text-[10px] num mt-0.5" style={{ color: 'var(--color-role-lp)' }}>
            +{fmtUSD(claimable)} claimable
          </div>
        )}
      </td>
      {/* 8. Fees — gross earned (top) + claimable now (bottom, LP-color). lg-only now. */}
      <td className="px-3 py-3 text-right hidden lg:table-cell">
        <div className="num font-medium text-gray-700">{fmtUSD(grossEarned)}</div>
        <div className="text-[10px] num mt-0.5 leading-tight" style={{ color: claimable > 0.01 ? 'var(--color-role-lp)' : 'var(--color-text-muted, #9ca3af)' }}>
          {claimable > 0.01 ? `+${fmtUSD(claimable)}` : '—'}
        </div>
      </td>
      {/* 9. Action — two square buttons: Claim (disabled when nothing to claim) + Manage */}
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            disabled={claimable <= 0.01 || isTerminal}
            onClick={e => { e.stopPropagation(); onClaim(listing.id) }}
            title={
              isTerminal
                ? 'Терминальный статус — клеймить нечего'
                : claimable > 0.01
                ? `Забрать ${fmtUSD(claimable)} accrued fees`
                : 'Сейчас нечего клеймить'
            }
            className={
              'text-xs font-semibold px-2 py-1 rounded num transition border ' +
              (claimable > 0.01 && !isTerminal
                ? 'bg-[var(--color-role-lp)] text-white border-[var(--color-role-lp)] hover:opacity-90'
                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed')
            }
          >
            Claim
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClick() }}
            title="Открыть карточку листинга"
            className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
          >
            Manage
          </button>
        </div>
      </td>
    </tr>
  )
}

function MobileListingRow({ listing, onClick, onClaim }: { listing: Listing; onClick: () => void; onClaim: (id: string) => void }) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const leasedPct = 100 - capacityFreePct(listing)
  const netPnL = listing.netPnLUSD ?? 0
  const claimable = listing.claimableNowUSD ?? 0
  const grossEarned = (listing.lifetimeUniFeesUSD ?? 0) + (listing.lifetimePremiumUSD ?? 0) + (listing.lifetimeReferenceUSD ?? 0)
  const uniApy = listing.uniswapApyBps / 100
  const premApy = listing.minPremiumApyBps / 100
  const totalApy = uniApy + premApy
  const isPro = listing.providerMode === 'advanced' && listing.providerLeverage > 1
  const hf = listing.healthFactorPct
  const isTerminal = listing.status === 'LIQUIDATED' || listing.status === 'WITHDRAWN'

  return (
    // Card per listing — distinct rounded border + subtle shadow + own border-radius.
    // Eugene 2026-05-15 mobile review: previously rows shared one container divided
    // by hairline; new pattern reads as «tap into this card», not «row in a list».
    <div className="w-full px-4 py-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow hover:border-gray-300 transition">
      {/* Outer wrapper is a div+role=button (not <button>) because HelpPopover
          renders an inner <button>; nested buttons = invalid HTML. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold truncate">{pairLabel(listing)}</span>
            <span className="text-[10px] text-gray-500 num">{fmtFeeTier(listing.feeTierBps)}</span>
            {/* Single card-level info popover. Enlarged tap target (HelpPopover now
                18px) per Eugene 2026-05-15. */}
            <span onClick={e => e.stopPropagation()}>
              <HelpPopover label="Card metrics — explained" width="w-72" size="lg">
                <p className="font-semibold mb-1.5">What's on this card</p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed">
                  <li><strong>Pool size</strong> — USD value locked in your NFT at listing time.</li>
                  <li><strong>% leased</strong> — share of your liquidity currently rented out by traders. Premium APY accrues only on the leased portion.</li>
                  <li><strong>Total APY</strong> — Uniswap fees baseline + Premium APY (auction floor). Breakdown shown as sub-line.</li>
                  {isPro && <li><strong>HF</strong> (in the chip row) — Aave-style 0–100 Health Factor. Only for Pro+leverage&gt;1. Below 30 = close to listing-level liquidation.</li>}
                  <li><strong>Fees</strong> — lifetime gross earned · green +$ = claimable now in one tx.</li>
                  <li><strong>+/− $</strong> (top-right) — Net PnL since listing, IL-adjusted vs HODL.</li>
                </ul>
                <p className="text-[11px] text-gray-500 mt-2 leading-snug">Tap (ⓘ) next to the chip row for the status / risk vocabulary.</p>
              </HelpPopover>
            </span>
          </div>
          <span className="num font-semibold" style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
            {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
          </span>
        </div>
        {/* Chip row — status · risk chip · HF inline (Eugene 2026-05-15: «перенести
            в строку со статусом и плечом HF, вместо Health под APY»). HF sits as
            its own colored chip next to leverage. */}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px]">
          <ListingStatusChip status={listing.status} leasedPct={leasedPct} rangeStatus={rangeStatus} tiny />
          {(() => {
            const advanced = listing.providerMode === 'advanced'
            const cls = (subsidized || advanced)
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-gray-50 text-gray-500 border-gray-200'
            const label = subsidized && advanced
              ? `Sub · Risk ${listing.providerLeverage}×`
              : subsidized
              ? 'Subsidized'
              : advanced
              ? `Risk ${listing.providerLeverage}×`
              : 'No Risk'
            return (
              <span className={'text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-medium num ' + cls}>
                {label}
              </span>
            )
          })()}
          {isPro && hf !== undefined && (
            <span
              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium num inline-flex items-center gap-1 border"
              style={{
                color: hf > 60 ? 'var(--color-status-success)' : hf > 30 ? 'var(--color-status-warning)' : 'var(--color-status-danger)',
                background: hf > 60 ? 'rgba(16,185,129,0.08)' : hf > 30 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                borderColor: hf > 60 ? 'rgba(16,185,129,0.30)' : hf > 30 ? 'rgba(245,158,11,0.30)' : 'rgba(239,68,68,0.30)',
              }}
            >
              HF {hf}%
            </span>
          )}
          {/* Chip-vocabulary tooltip — separate (i) at the end of the chip row.
              Status + Risk + HF labels explained in one focused popover, so the
              main card tooltip stays compact (Eugene 2026-05-15). */}
          <span onClick={e => e.stopPropagation()} className="inline-flex">
            <HelpPopover label="Chips legend" width="w-72">
              <p className="font-semibold mb-1.5">Status</p>
              <ul className="space-y-1 text-[11px] leading-relaxed">
                <li><strong className="text-emerald-700">Earning</strong> — арендаторы есть, Premium APY идёт.</li>
                <li><strong className="text-gray-700">Listed</strong> — залистен, арендаторов пока нет (0% leased).</li>
                <li><strong className="text-amber-800">Withdrawing</strong> — запрошен вывод, 2-блочный guard.</li>
                <li><strong className="text-[var(--color-status-danger)]">Liquidating</strong> — ликвидация в процессе (Pro + плечо&gt;1).</li>
                <li><strong className="text-gray-500">Liquidated / Closed</strong> — терминальные.</li>
                <li className="text-gray-500"><strong>Out of range</strong> — sub-badge: цена за Uniswap-range.</li>
              </ul>
              <p className="font-semibold mt-3 mb-1.5">Risk</p>
              <ul className="space-y-1 text-[11px] leading-relaxed">
                <li><strong className="text-gray-500">No Risk</strong> — Conservative (1×), NFT не collateral.</li>
                <li><strong className="text-amber-800">Risk N×</strong> — Pro с плечом, NFT под collateral.</li>
                <li><strong className="text-amber-800">Subsidized</strong> — negative Premium APY (LP платит трейдерам).</li>
              </ul>
              {isPro && (
                <>
                  <p className="font-semibold mt-3 mb-1.5">HF</p>
                  <p className="text-[11px] leading-relaxed text-gray-600">Aave-style 0–100 Health Factor. Below 30 = close to listing-level liquidation. Only for Pro+leverage&gt;1.</p>
                </>
              )}
            </HelpPopover>
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] num">
          <div>
            <span className="text-gray-500">Pool size</span>
            <div className="font-medium">{fmtUSD(listing.initialLiquidityUSD)}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{Math.round(leasedPct)}% leased</div>
          </div>
          <div>
            <span className="text-gray-500">Total APY</span>
            <div className="font-medium">{isTerminal ? '—' : `${totalApy.toFixed(1)}%`}</div>
            {/* Under Total APY — breakdown как на десктопе: «X.X% + Y.Y%» без слов
                «Uni»/«Prem» (Eugene 2026-05-15 mobile review — короче, читается
                так же как на вебе). */}
            {!isTerminal && (
              <div className="text-[10px] text-gray-500 mt-0.5 num">
                {uniApy.toFixed(1)}% {premApy >= 0 ? '+' : '−'} {Math.abs(premApy).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Fees</span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-gray-700">{fmtUSD(grossEarned)}</span>
              <span className="text-[10px] num" style={{ color: claimable > 0.01 ? 'var(--color-role-lp)' : '#9ca3af' }}>
                {claimable > 0.01 ? `+${fmtUSD(claimable)}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Action row — Withdraw NFT left, Claim right (Eugene 2026-05-15: Manage→Withdraw,
          accent stays on Claim). The whole card is already tap-to-drill-in, so Manage
          button was redundant; Withdraw NFT is an actual destructive action LP might
          want without scrolling into detail. */}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            if (isTerminal) return
            const ok = window.confirm(`Withdraw ${pairLabel(listing)} NFT?\n\nThis force-closes any active lessees and returns the NFT to your wallet after a 2-block guard. (Mock)`)
            if (ok) alert(`Mock: Withdraw flow initiated for ${pairLabel(listing)}.`)
          }}
          disabled={isTerminal}
          className={
            'inline-flex items-center justify-center text-xs font-semibold px-2 py-1.5 rounded border transition ' +
            (isTerminal
              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 text-gray-800 bg-white hover:bg-gray-50')
          }
        >
          Withdraw NFT
        </button>
        <button
          type="button"
          disabled={claimable <= 0.01 || isTerminal}
          onClick={e => { e.stopPropagation(); onClaim(listing.id) }}
          className={
            'inline-flex items-center justify-center text-xs font-semibold px-2 py-1.5 rounded num transition border ' +
            (claimable > 0.01 && !isTerminal
              ? 'bg-[var(--color-role-lp)] text-white border-[var(--color-role-lp)]'
              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed')
          }
        >
          Claim
        </button>
      </div>
    </div>
  )
}

// Status display — final spec per Eugene 2026-05-15 «final status spec»:
//   ACTIVE leased=0   → Listed      (gray)       — sLiq-native verb («I listed it»);
//                                                  «Idle» retired (too technical, читалось
//                                                  как «сломалось»).
//   ACTIVE leased>0   → Earning     (green)      — leased% lives in Pool size sub-line.
//   WITHDRAWAL_REQUE… → Withdrawing (amber)      — transient, 2-block guard.
//   LIQUIDATING       → Liquidating (red)        — «At Risk» retired (too vague — в момент
//                                                  ликвидации это уже не «риск», а сам процесс).
//   LIQUIDATED        → Liquidated  (gray-red)   — terminal, Pro only.
//   WITHDRAWN         → Closed      (gray)       — terminal.
//   Out-of-range — orthogonal sub-badge, может висеть на любом active-варианте.
type StatusDisplay = { label: string; cls: string; tip: string }
// CompareDrawer + Sparkline7d removed per Eugene 2026-05-15 — bulk-select
// retired, sparkline was visually misread as a stray dash. P3 Pro features
// deferred until there's an explicit Pro-power surface to host them.

function statusDisplay(status: string, leasedPct: number): StatusDisplay {
  if (status === 'LIQUIDATING')
    return { label: 'Liquidating', cls: 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40', tip: 'Listing-level ликвидация в процессе. Только Pro + плечо > 1.' }
  if (status === 'LIQUIDATED')
    return { label: 'Liquidated', cls: 'bg-red-50/60 text-red-900/70 border border-red-200', tip: 'Терминальный — NFT ликвидирован. Residual (если остался) можно claim.' }
  if (status === 'WITHDRAWAL_REQUESTED')
    return { label: 'Withdrawing', cls: 'bg-amber-50 text-amber-900 border border-amber-300', tip: 'Вывод запрошен — 2-блочный guard перед возвратом NFT в кошелёк.' }
  if (status === 'WITHDRAWN')
    return { label: 'Closed', cls: 'bg-gray-100 text-gray-500 border border-gray-300', tip: 'Терминальный — NFT возвращён в кошелёк.' }
  // ACTIVE — two display variants by leased%. 100%-full no longer gets its own chip
  // (the «leased %» sub-line in Pool size cell carries that signal).
  if (leasedPct <= 0.5)
    return { label: 'Listed', cls: 'bg-gray-50 text-gray-700 border border-gray-200', tip: 'Залистен, арендаторов пока нет. Снизь min Premium APY чтобы привлечь трейдеров.' }
  return { label: 'Earning', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200', tip: 'Зарабатывает: Uniswap fees + Premium APY на занятую долю.' }
}

function ListingStatusChip({ status, leasedPct, rangeStatus, tiny }: { status: string; leasedPct: number; rangeStatus: 'in-range' | 'out-of-range'; tiny?: boolean }) {
  // Pill-shaped chips (rounded-full) — visually distinct from buttons which use
  // rounded (sharper corners). Eugene 2026-05-15: «форма тегов похожа на форму
  // кнопок внизу карточки, давай эти теги другой формы сделаем — округлые?».
  const sizeCls = tiny ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls
  const data = statusDisplay(status, leasedPct)
  const showOutOfRange = rangeStatus === 'out-of-range' && (status === 'ACTIVE' || status === 'WITHDRAWAL_REQUESTED')
  return (
    <span className="inline-flex items-center gap-1">
      <span className={baseCls + ' ' + data.cls} title={data.tip}>{data.label}</span>
      {showOutOfRange && (
        <span
          className={'whitespace-nowrap rounded-full font-medium cursor-help bg-amber-50 text-amber-900 border border-amber-200 ' + sizeCls}
          title="Цена вышла из Uniswap range — Uniswap fees не начисляются. Premium APY продолжает идти."
        >
          out of range
        </span>
      )}
    </span>
  )
}

// ───────── List NFT modal — Lite + Pro toggle + post-listing success ─────────
type ListStage = 'configure' | 'signing' | 'success'
const APY_PRESETS = [10, 20, 30, 50, 100]

function ListNFTModal({ nft, onClose }: { nft: WalletNFT; onClose: () => void }) {
  const [stage, setStage] = useState<ListStage>('configure')
  const [mode, setMode] = useState<'lite' | 'pro'>('lite')
  const [leverage, setLeverage] = useState<number>(1)
  const [minApy, setMinApy] = useState<number>(1)

  const isPro = mode === 'pro'
  const effectiveLeverage = isPro ? leverage : 1
  const effectiveMinApy = isPro ? minApy : 1
  // Mock liq-price: spot ± range/leverage (per call @38:50)
  const liqDistancePct = effectiveLeverage > 1 ? (2 / effectiveLeverage) * 100 : null

  function handleSubmit() {
    setStage('signing')
    // Simulate wallet signature + tx mining
    setTimeout(() => setStage('success'), 1400)
  }

  function handleListAnother() {
    // Reset modal to configure stage and keep it open — user picks next NFT
    // from grid behind. UX audit P2.22: closing then re-opening dropped scroll
    // position. Caller of the modal owns the "next NFT" selection; we just
    // close and let them re-open with a new one.
    setStage('configure')
    setMode('lite')
    setLeverage(1)
    setMinApy(1)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={stage === 'configure' ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — only on configure stage */}
        {stage === 'configure' && (
          <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  List {nft.pair.token0}/{nft.pair.token1}
                </h3>
                <span className="text-[10px] font-mono text-gray-500">{fmtFeeTier(nft.feeTierBps)}</span>
              </div>
              <div className="text-[11px] text-gray-500 num mt-0.5">
                NFT #{nft.tokenId} · {fmtUSD(nft.liquidityUSD)} liquidity
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none transition"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* CONFIGURE stage — Lite / Pro tabs + body */}
        {stage === 'configure' && (
          <>
            <div className="px-5 pt-4">
              <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 p-0.5 w-full">
                <button
                  type="button"
                  onClick={() => setMode('lite')}
                  className={
                    'flex-1 px-3 py-1.5 text-xs rounded transition font-medium ' +
                    (mode === 'lite' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')
                  }
                >
                  Lite <span className="text-[10px] text-gray-400 ml-1">recommended</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('pro')}
                  className={
                    'flex-1 px-3 py-1.5 text-xs rounded transition font-medium ' +
                    (mode === 'pro' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')
                  }
                >
                  Pro <span className="text-[10px] text-gray-400 ml-1">advanced</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {/* Pool info card — Lite shows pool size + defaults; Pro adapts APY to current minApy */}
              <PoolInfoCard nft={nft} mode={mode} currentMinApy={effectiveMinApy} />

              {mode === 'lite' ? (
                <div className="mt-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>Sit back — traders pay you to rent your liquidity.</strong>{' '}
                    Bids start at 1% and only climb. NFT stays in your wallet; withdraw any time.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {/* Provider Leverage slider — clickable ticks at 25/50/75/100 + Max button */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700">Provider Leverage</label>
                      <span className="text-sm font-semibold num text-gray-900">{leverage}×</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={leverage}
                      onChange={e => setLeverage(Number(e.target.value))}
                      className="w-full accent-[var(--color-role-lp)]"
                    />
                    {/* Clickable tick row */}
                    <div className="grid grid-cols-5 gap-0.5 mt-1.5">
                      {[1, 25, 50, 75, 100].map(tick => (
                        <button
                          key={tick}
                          type="button"
                          onClick={() => setLeverage(tick)}
                          className={
                            'text-[10px] num py-0.5 rounded transition ' +
                            (leverage === tick
                              ? 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] font-semibold'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
                          }
                        >
                          {tick}×
                        </button>
                      ))}
                    </div>
                    {/* Amber «Liquidation risk applies» warning hidden on mobile per
                        Eugene 2026-05-15 — duplicates the danger-coloured Liquidation
                        price line inside the ProPreview block below. Desktop keeps
                        the inline warning for extra emphasis next to the slider. */}
                    {leverage > 1 && (
                      <div className={
                        'hidden sm:flex mt-2 text-[11px] rounded px-3 py-2 items-start gap-2 ' +
                        // >25× escalates to red — danger semantics for high-stakes
                        // leverage (UX audit P2.16). amber reserved for 2-25×.
                        (leverage > 25
                          ? 'text-[var(--color-status-danger)] bg-red-50 border border-[var(--color-status-danger)]/40'
                          : 'text-amber-700 bg-amber-50 border border-amber-200')
                      }>
                        <span>⚠️</span>
                        <div>
                          <strong>Liquidation risk applies.</strong> At {leverage}× your liquidation triggers
                          when the pool moves ~<span className="num">{liqDistancePct?.toFixed(1)}%</span> against your range.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Min APY input — +/- buttons + presets */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700">Min Premium APY</label>
                      <span className="text-[10px] text-gray-500">Default: 1%</span>
                    </div>
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => setMinApy(v => Math.max(1, v - 1))}
                        className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                        aria-label="Decrease by 1%"
                      >
                        −
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={minApy}
                          onChange={e => setMinApy(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-lp)] focus:outline-none transition text-center"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMinApy(v => v + 1)}
                        className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
                        aria-label="Increase by 1%"
                      >
                        +
                      </button>
                    </div>
                    {/* Presets — bumped to py-2 (≥36px target) so touch on mobile
                        is reliable (UX audit P2.15). grid-cols-5 keeps row stable
                        when copy wraps to longer locale. */}
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {APY_PRESETS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setMinApy(p)}
                          className={
                            'px-2.5 py-2 text-[11px] font-medium rounded border transition ' +
                            (minApy === p
                              ? 'bg-[var(--color-role-lp-bg)] border-[var(--color-role-lp)] text-[var(--color-role-lp)]'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900')
                          }
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pro-mode read-only preview (leverage-driven, token-pair format) */}
                  <ProPreview nft={nft} leverage={leverage} liqDistancePct={liqDistancePct} minApyPct={minApy} />
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-5 py-2 text-sm font-semibold transition"
              >
                {mode === 'lite' ? 'List' : `List (${leverage}×, ${effectiveMinApy}%)`}
              </button>
            </div>
          </>
        )}

        {/* SIGNING stage — waiting for wallet signature */}
        {stage === 'signing' && (
          <div className="px-6 py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-gray-100 text-gray-500">
              <svg width="22" height="22" viewBox="0 0 24 24" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeOpacity="0.2" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-base font-semibold text-gray-900">Listing your NFT…</div>
            <p className="mt-1 text-xs text-gray-500">Confirm the signature in your wallet.</p>
            {/* Custody reassurance — Semen's #1 anxiety per persona audit (P2.18).
                One line, не клиширует, факт: NFT не уходит, escrow rights only. */}
            <p className="mt-3 text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed">
              NFT остаётся под твоим контролем. sLiq получает право управлять листингом —
              отзыв в 1 клик через Withdraw.
            </p>
          </div>
        )}

        {/* SUCCESS stage — listed confirmation */}
        {stage === 'success' && (
          <div className="px-6 py-8 text-center relative">
            {/* Close button — top right */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none transition"
              aria-label="Close"
            >
              ×
            </button>
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-lime-100 text-lime-700 text-xl">
              ✓
            </div>
            <div className="text-lg font-semibold text-gray-900">NFT listed successfully</div>
            <p className="mt-1 text-xs text-gray-500">
              {nft.pair.token0}/{nft.pair.token1} · {fmtFeeTier(nft.feeTierBps)} ·{' '}
              {PROTOCOL_LABELS[nft.protocol] ?? nft.protocol} · {fmtUSD(nft.liquidityUSD)}
              {' · '}
              {mode === 'lite' ? '1× · 1% min APY' : `${leverage}× · ${effectiveMinApy}% min APY`}
            </p>
            <p className="mt-4 text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
              Your NFT is now available for traders. You'll start earning carry as soon as someone rents it.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link
                to="/lp/positions"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-5 py-2.5 text-sm font-semibold transition"
              >
                View in My Listings
              </Link>
              <button
                type="button"
                onClick={handleListAnother}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-5 py-2.5 text-sm font-medium transition"
              >
                List another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Mock USD prices (prototype only — real impl reads from oracle / pool quote)
const TOKEN_USD_PRICE: Record<string, number> = {
  WETH: 2260, ETH: 2260, USDC: 1, USDT: 1, DAI: 1,
  WBTC: 98_000, BTC: 98_000,
  wstETH: 2410, stETH: 2310,
  ARB: 0.50, GMX: 28, CAKE: 2.50, AERO: 1.05, BNB: 600, OP: 1.80,
}

// Format token amount with sensible precision based on magnitude.
function fmtTokenAmount(amount: number): string {
  if (amount === 0) return '0'
  if (amount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (amount >= 0.0001) return amount.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return amount.toExponential(2)
}

// Compute token-pair amounts from liquidityUSD using mock USD prices (real impl reads from NFT metadata).
function poolTokenAmounts(nft: WalletNFT, multiplier = 1) {
  const halfUsd = nft.liquidityUSD / 2
  const price0 = TOKEN_USD_PRICE[nft.pair.token0] ?? 1
  const price1 = TOKEN_USD_PRICE[nft.pair.token1] ?? 1
  return {
    amount0: (halfUsd / price0) * multiplier,
    amount1: (halfUsd / price1) * multiplier,
    halfUsd: halfUsd * multiplier,
    totalUsd: nft.liquidityUSD * multiplier,
  }
}

// Pool info card — shown in both Lite and Pro modes.
// Lite: full breakdown incl. Pool size + Provider Leverage default + APY.
// Pro: Protocol / Range + APY breakdown only. Pool size moves to ProPreview at bottom (alongside Trader market).
function PoolInfoCard({
  nft,
  mode,
  currentMinApy,
}: {
  nft: WalletNFT
  mode: 'lite' | 'pro'
  currentMinApy: number
}) {
  const { amount0, amount1, halfUsd } = poolTokenAmounts(nft)
  const isLite = mode === 'lite'
  const uniApr = nft.uniswapAprPct
  const premiumFloor = isLite ? 1 : currentMinApy
  const totalApr = uniApr + premiumFloor

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-1.5">
      <ParamRow
        label="Protocol"
        value={PROTOCOL_LABELS[nft.protocol] ?? nft.protocol}
        small
      />
      <ParamRow
        label="Range"
        value={`${nft.priceRange.lower} – ${nft.priceRange.upper}`}
        small
      />

      {/* Pool size — Lite only (Pro shows it in bottom ProPreview alongside Trader market).
          2-line right-aligned per Eugene 2026-05-15: token0 / token1 each on own row,
          flush right. Previously was one long line with `·` separator that wrapped
          awkwardly on mobile. */}
      {isLite && (
        <ParamRow
          label="Pool size"
          value={
            <span className="inline-flex flex-col items-end leading-tight">
              <span>{fmtTokenAmount(amount0)} {nft.pair.token0}{' '}<span className="text-gray-500 font-normal">({fmtUSD(halfUsd)})</span></span>
              <span>{fmtTokenAmount(amount1)} {nft.pair.token1}{' '}<span className="text-gray-500 font-normal">({fmtUSD(halfUsd)})</span></span>
            </span>
          }
          small
        />
      )}

      {/* APY breakdown — divider for visual separation */}
      <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-1.5">
        <ParamRow
          label="Uniswap APY"
          value={<span className="num">{uniApr.toFixed(1)}%</span>}
          small
        />
        <ParamRow
          label={
            <span className="inline-flex items-center gap-1">
              Premium APY
              <HelpPopover label="Premium APY" width="w-72">
                <p className="font-semibold mb-1">Premium APY</p>
                <p>The carry traders pay you to rent your liquidity. Set by a continuous auction: you set a minimum (the floor), traders bid above it.</p>
                <p className="mt-1.5">This is your <strong>extra yield on top of Uniswap fees</strong> — the reason LPs migrate to sLiq.</p>
              </HelpPopover>
            </span>
          }
          value={
            <span className="text-[var(--color-role-lp)] font-semibold num">
              from {premiumFloor}%
            </span>
          }
          small
        />
        <ParamRow
          label={<span className="font-medium text-gray-900">Total APY</span>}
          value={
            <span className="text-gray-900 font-bold num">
              from {totalApr.toFixed(1)}%
            </span>
          }
          small
        />
      </div>

      {/* Provider Leverage — Lite shows default 1× with (i); Pro hides (controlled via slider) */}
      {isLite && (
        <div className="border-t border-gray-200 pt-1.5 mt-1.5">
          <ParamRow
            label={
              <span className="inline-flex items-center gap-1">
                Provider Leverage
                <HelpPopover label="Provider Leverage" width="w-72">
                  <p className="font-semibold mb-1">Provider Leverage</p>
                  <p>Amplifies your earnings — and your risk.</p>
                  <p className="mt-1.5"><strong>1× (Lite default)</strong> — your liquidity is rented 1:1. <strong>No liquidation risk</strong> from price moves; you only face standard Uniswap IL.</p>
                  <p className="mt-1.5"><strong>2×–100× (Pro)</strong> — your liquidity is multiplied for trader rental. You earn N× the Premium APY, but if the pool moves against your range, the position can be liquidated.</p>
                </HelpPopover>
              </span>
            }
            value={<span>1× <span className="text-gray-500 font-normal">— no liquidation</span></span>}
            small
          />
        </div>
      )}
    </div>
  )
}

// Pro-mode preview — Pool size (real, what's in the NFT) + Trader market (leveraged, what traders trade against) + Liq price.
// Order is real → derived, matching Lite's «Pool size» term for consistency.
// PoolInfoCard hides Pool size in Pro mode (lives here instead, no duplication).
function ProPreview({
  nft,
  leverage,
  liqDistancePct,
  minApyPct,
}: {
  nft: WalletNFT
  leverage: number
  liqDistancePct: number | null
  minApyPct: number
}) {
  const real = poolTokenAmounts(nft, 1)
  const virt = poolTokenAmounts(nft, leverage)
  // Projected APY estimate — Viktor (P3.32): nobody shows a yield-estimate during
  // listing, but it's the answer to «what does my chosen config actually pay».
  // Approximation: Uniswap_APR baseline + Premium floor × leverage × utilization
  // (assume 60% mock utilization for the estimate). Best-effort, marked «est.».
  const baseUni = nft.uniswapAprPct
  const premMultiplied = minApyPct * leverage * 0.6
  const projectedApy = baseUni + premMultiplied
  return (
    <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1.5">
      <ParamRow
        label="Pool size"
        value={
          <span className="inline-flex flex-col items-end leading-tight">
            <span>{fmtTokenAmount(real.amount0)} {nft.pair.token0}{' '}<span className="text-gray-500 font-normal">({fmtUSD(real.halfUsd)})</span></span>
            <span>{fmtTokenAmount(real.amount1)} {nft.pair.token1}{' '}<span className="text-gray-500 font-normal">({fmtUSD(real.halfUsd)})</span></span>
          </span>
        }
        small
      />
      <ParamRow
        label={
          <span className="inline-flex items-center gap-1">
            Trader market
            <HelpPopover label="What is Trader market" width="w-72">
              <div className="font-semibold mb-1">Trader market = Pool size × Leverage</div>
              The leveraged exposure traders compete for. Your NFT backs it at the
              Pool-size amount; traders pay Premium APY on the full Trader-market size.
              At 1× leverage Trader market = Pool size (no liquidation).
            </HelpPopover>
          </span>
        }
        value={
          <span className="inline-flex flex-col items-end leading-tight">
            <span>{fmtTokenAmount(virt.amount0)} {nft.pair.token0}{' '}<span className="text-gray-500 font-normal">({fmtUSD(virt.halfUsd)})</span></span>
            <span>{fmtTokenAmount(virt.amount1)} {nft.pair.token1}{' '}<span className="text-gray-500 font-normal">({fmtUSD(virt.halfUsd)})</span></span>
          </span>
        }
        small
      />
      <ParamRow
        label="Liquidation price"
        value={
          leverage > 1
            ? <span className="text-[var(--color-status-danger)] font-semibold">~{liqDistancePct?.toFixed(1)}% from spot</span>
            : <span>— (no liquidation)</span>
        }
        small
      />
      {/* Projected APY estimate (P3.32) — assumes 60% trader utilisation of the
          Trader-market. Best-effort yield preview before listing. */}
      <ParamRow
        label={
          <span className="inline-flex items-center gap-1">
            Projected APY (est.)
            <HelpPopover label="Projected APY estimate" width="w-72">
              <p className="font-semibold mb-1">Rough yield preview</p>
              <p>= Uniswap APR + Min Premium APY × Leverage × ~60% utilization.</p>
              <p className="mt-1.5">Real outcome depends on actual auction clearing rate and trader demand. Utilization can be 0–100%.</p>
            </HelpPopover>
          </span>
        }
        value={<span className="text-[var(--color-role-lp)] font-bold num">~{projectedApy.toFixed(1)}%</span>}
        small
      />
    </div>
  )
}

function ParamRow({ label, value, small }: { label: React.ReactNode; value: React.ReactNode; small?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${small ? 'text-[11px]' : 'text-xs'}`}>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 num">{value}</span>
    </div>
  )
}

// Aggregated claimable across all listings — was on a separate /lp/claims tab; now lives here.
// Hidden when nothing to claim (cleaner default).
function ClaimableBanner({ amount, listingsCount }: { amount: number; listingsCount: number }) {
  return (
    <div className="mb-4 rounded-lg border border-[var(--color-role-lp)]/30 bg-[var(--color-role-lp-bg)] px-4 py-3 flex items-center gap-3">
      {/* Icon: hidden on mobile to free horizontal space; we want headline + button
          on one row even on narrow screens (Eugene 2026-05-15). */}
      <span className="hidden sm:inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-role-lp)]/30 text-[var(--color-role-lp)] text-base">
        ◈
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">
          Claimable now:{' '}
          <span className="text-[var(--color-role-lp)] num">+{fmtUSD(amount)}</span>
        </div>
        {/* Mobile: terse label-style line. Desktop: full explanation. Same data,
            different density. «Claim sweeps all in a single tx» line dropped on
            mobile — the action verb lives on the button itself. */}
        <div className="text-xs text-gray-600 mt-0.5 sm:hidden num">
          All fees across {listingsCount} listing{listingsCount === 1 ? '' : 's'} in 1 tx
        </div>
        <div className="text-xs text-gray-600 mt-0.5 hidden sm:block">
          Accumulated Uniswap fees + Premium APY across {listingsCount} listing{listingsCount === 1 ? '' : 's'}.
          Claim sweeps all in a single transaction.
        </div>
      </div>
      <button
        type="button"
        onClick={() => { /* prototype: claim-all stub */ }}
        className="shrink-0 inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-3 py-2 sm:px-4 text-sm font-semibold transition"
      >
        Claim all
      </button>
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
    valueColor === 'success' ? 'var(--color-status-success)'
    : valueColor === 'danger' ? 'var(--color-status-danger)'
    : 'oklch(20% 0 0)'
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-right">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold leading-tight">{label}</div>
      <div className="text-lg num font-semibold mt-0.5" style={{ color }}>{children}</div>
      {subtitle && <div className="text-[10px] text-gray-500 num leading-tight mt-0.5">{subtitle}</div>}
    </div>
  )
}

function OnboardingBanner() {
  const KEY = 'sliq.mylistings.onboardingState'
  const [state, setState] = useState<'expanded' | 'collapsed'>(() => {
    if (typeof window === 'undefined') return 'expanded'
    const stored = localStorage.getItem(KEY) as 'expanded' | 'collapsed' | null
    return stored ?? 'expanded' // first-time visitor → expanded; sticky preference after
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
        className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 transition"
      >
        <span className="font-medium">How to maximize your earnings on sLiq</span>
        <span className="text-gray-400">›</span>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Как максимизировать earnings на sLiq
        </span>
        <button
          type="button"
          onClick={() => setStateAndStore('collapsed')}
          className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
        >Hide</button>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        <Step n={1} title="Следи за range hit-rate" body="Если &lt; 50% — твоя NFT часто out-of-range, fees не идут. Withdraw + re-list с новым range через Uniswap." />
        <Step n={2} title="Подними Min APY если есть demand" body="Когда lessees покупают листинг с premium выше твоего floor — рынок готов платить больше. Подними floor для maximize earnings." />
        <Step n={3} title="Advanced N× — только high-conviction" body="Provider Leverage 2-100× амплифицирует Reference Fees pool но делает NFT collateralized. Vol-event может привести к listing-level liq." />
      </ol>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="px-4 py-3 flex gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center mt-0.5">{n}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-600 leading-snug mt-0.5" dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  )
}
