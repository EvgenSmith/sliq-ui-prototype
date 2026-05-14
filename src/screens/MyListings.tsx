// S11 My Listings — LP daily dashboard.
// Mirror trader-side TraderPositions pattern: summary cards · attention banner
// · filter strip · table · pagination. Plus LP-specific: range hit-rate, lessees count,
// IL-aware Net PnL, vs HODL delta.

import { useMemo, useState } from 'react'
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

type StatusFilter = 'all' | 'earning' | 'paused' | 'attention'
type SortId = 'pnl-desc' | 'pnl-asc' | 'earnings-desc' | 'tvl-desc' | 'hitrate-desc' | 'newest'

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [protocolFilter, setProtocolFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortId>('pnl-desc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState<number>(1)
  const [attentionExpanded, setAttentionExpanded] = useState(false)

  const mine = useMemo(
    () => listings.filter(l => l.owner === connectedWallet.address),
    []
  )

  // Lessee count per listing
  const lesseesByListing = useMemo(() => {
    const map = new Map<string, number>()
    positions.forEach(p => {
      if (p.status === 'OPEN') {
        map.set(p.listingId, (map.get(p.listingId) ?? 0) + 1)
      }
    })
    return map
  }, [])

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
    // Claimable now — aggregated across all active listings (Uniswap fees + Premium + Reference)
    const claimableNow = mine.reduce((s, l) => {
      const uniClaimable = (l.lifetimeUniFeesUSD ?? 0) * 0.18 // mock: ~18% sitting unclaimed
      const premiumClaimable = (l.lifetimePremiumUSD ?? 0) * 0.22
      const refClaimable = (l.lifetimeReferenceUSD ?? 0) * 0.15
      return s + uniClaimable + premiumClaimable + refClaimable
    }, 0)
    return { earningToday, totalNetPnL, totalTVL, atRisk, claimableNow }
  }, [mine])

  // Filter
  const filtered = useMemo(() => {
    let out = [...mine]
    if (statusFilter === 'earning') out = out.filter(l => l.status === 'ACTIVE' || l.status === 'FULL')
    else if (statusFilter === 'paused') out = out.filter(l => l.status === 'PAUSED' || l.status === 'WITHDRAWAL_REQUESTED')
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
      case 'earnings-desc': out.sort((a, b) => {
        const aDaily = ((a.lifetimeUniFeesUSD ?? 0) + (a.lifetimePremiumUSD ?? 0)) / Math.max(1, (Date.now() - a.listedAt) / (1000 * 60 * 60 * 24))
        const bDaily = ((b.lifetimeUniFeesUSD ?? 0) + (b.lifetimePremiumUSD ?? 0)) / Math.max(1, (Date.now() - b.listedAt) / (1000 * 60 * 60 * 24))
        return bDaily - aDaily
      }); break
      case 'tvl-desc': out.sort((a, b) => b.initialLiquidityUSD - a.initialLiquidityUSD); break
      case 'hitrate-desc': out.sort((a, b) => (b.rangeHitRatePct ?? 0) - (a.rangeHitRatePct ?? 0)); break
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
          <SummaryCard label="Total TVL" subtitle={`${mine.length} listing${mine.length === 1 ? '' : 's'}`} valueColor="neutral">
            {fmtUSD(summary.totalTVL)}
          </SummaryCard>
          <SummaryCard label="At risk" subtitle="Advanced near liq" valueColor={summary.atRisk > 0 ? 'danger' : 'neutral'}>
            {summary.atRisk}
          </SummaryCard>
        </div>

        <p className="text-xs text-gray-500 num mt-3">
          {filtered.length} of {mine.length} listings
          {attentionTotal > 0 && (
            <>
              {' '}·{' '}
              <button
                type="button"
                onClick={() => setAttentionExpanded(e => !e)}
                className="text-[var(--color-status-danger)] font-medium underline decoration-dotted hover:no-underline inline-flex items-center gap-1"
              >
                {attentionTotal} need attention <span aria-hidden="true">{attentionExpanded ? '▴' : '▾'}</span>
              </button>
            </>
          )}
          <Link to="/lp/deposit" className="ml-auto float-right text-[var(--color-role-lp)] hover:underline">
            + List NFT
          </Link>
        </p>
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
        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
          {([
            { id: 'all', label: `All (${mine.length})` },
            { id: 'earning', label: 'Earning' },
            { id: 'paused', label: 'Paused' },
            { id: 'attention', label: `Attention${attentionTotal > 0 ? ` (${attentionTotal})` : ''}` },
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
                  (o.id === 'attention' && attentionTotal > 0 && !active ? ' text-[var(--color-status-danger)]' : '')
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

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-500">Sort:</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortId)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            <option value="pnl-desc">Net PnL · high → low</option>
            <option value="pnl-asc">Net PnL · low → high</option>
            <option value="earnings-desc">Earnings/day · high → low</option>
            <option value="tvl-desc">TVL · large → small</option>
            <option value="hitrate-desc">Range hit-rate · high → low</option>
            <option value="newest">Listed (newest)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">No listings match this filter.</p>
        </div>
      ) : (
        <>
          <ListingsTable listings={visible} lesseesByListing={lesseesByListing} onClick={id => navigate(`/listings/${id}`)} />

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
          // State 1.3 — fresh user banner
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
  const earningCount = myListings.filter(l => l.status === 'ACTIVE' || l.status === 'FULL').length
  const pausedCount = myListings.filter(l => l.status === 'PAUSED' || l.status === 'WITHDRAWAL_REQUESTED').length
  const attentionCount = myListings.filter(l => l.providerMode === 'advanced' && (l.distanceToLiqPct ?? 100) < 30).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] text-sm">
          ◈
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">
            Already listed on sLiq · <span className="num">{myListings.length}</span> position{myListings.length === 1 ? '' : 's'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 num">
            {earningCount > 0 && <>{earningCount} earning</>}
            {pausedCount > 0 && <> · {pausedCount} paused</>}
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

      <div className="divide-y divide-gray-100">
        {myListings.slice(0, 4).map(l => (
          <ListedSummaryRow key={l.id} listing={l} />
        ))}
        {myListings.length > 4 && (
          <Link
            to="/lp/positions"
            className="block px-4 py-2 text-center text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
          >
            + {myListings.length - 4} more →
          </Link>
        )}
      </div>
    </div>
  )
}

function ListedSummaryRow({ listing }: { listing: Listing }) {
  const rangeStatus = getRangeStatus(listing)
  const inRange = rangeStatus === 'in-range'
  const isPaused = listing.status === 'PAUSED' || listing.status === 'WITHDRAWAL_REQUESTED'
  const needsAttention = listing.providerMode === 'advanced' && (listing.distanceToLiqPct ?? 100) < 30

  // Status dot color
  const dotColor = needsAttention
    ? 'bg-[var(--color-status-danger)]'
    : isPaused
      ? 'bg-gray-400'
      : inRange
        ? 'bg-[var(--color-status-success)]'
        : 'bg-[var(--color-status-warning)]'

  const statusText = needsAttention
    ? 'Near liquidation'
    : isPaused
      ? 'Paused'
      : inRange
        ? 'In range · earning'
        : 'Out of range'

  // Estimated APR sum from bps
  const apySumPct = ((listing.uniswapApyBps ?? 0) + (listing.referenceApyBps ?? 0)) / 100

  return (
    <Link
      to={`/lp/listings/${listing.id}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition"
    >
      <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor}`} aria-hidden />
      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">
          {pairLabel(listing)}
        </span>
        <span className="text-[10px] font-mono text-gray-500">{fmtFeeTier(listing.feeTierBps)}</span>
        <span className="text-xs text-gray-600">· {statusText}</span>
      </div>
      <div className="text-xs text-gray-700 num">
        {apySumPct > 0 ? fmtPct(apySumPct / 100) : '—'} APR
      </div>
      <span className="text-gray-400 text-xs" aria-hidden>→</span>
    </Link>
  )
}

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
            View my positions →
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
        <h2 className="text-lg font-semibold text-gray-900">No positions on sLiq yet</h2>
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
          <ValueChip n="Your NFT" label="Stays yours · custody preserved" />
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
          {/* Primary CTA: practical path — mint LP on Uniswap, sLiq will detect it */}
          <a
            href="https://app.uniswap.org/positions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            Mint LP on Uniswap <span aria-hidden>↗</span>
          </a>
          <button
            type="button"
            onClick={() => { /* prototype no-op */ }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-5 py-2.5 text-sm font-medium transition"
            title="Re-scan the connected wallet for V3 LP NFTs"
          >
            Re-scan wallet
          </button>
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
      'aerodrome-slipstream': 2,
      'pancake-v3': 3,
      'sushi-v3': 4,
      'maverick': 5,
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
              <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
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
  lesseesByListing,
  onClick,
}: {
  listings: Listing[]
  lesseesByListing: Map<string, number>
  onClick: (id: string) => void
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair · listing</th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Status
                  <HelpPopover label="Listing statuses" width="w-80">
                    <p className="font-semibold mb-2">Listing statuses</p>
                    <ul className="space-y-1.5 text-xs">
                      <li><strong className="text-[var(--color-status-success)]">Active</strong> — listed, traders can rent. Earning Uniswap fees + Premium APY (when rented).</li>
                      <li><strong className="text-[var(--color-status-success)]">Full</strong> — 100% capacity leased. Outbid-only — new traders must beat current Premium APY.</li>
                      <li><strong className="text-gray-700">Paused</strong> — temporarily off-market. No new traders, existing keep paying until close.</li>
                      <li><strong className="text-[var(--color-status-warning)]">Withdrawal pending</strong> — exit requested. 2-block guard before NFT returns to wallet.</li>
                      <li><strong className="text-[var(--color-status-danger)]">Liquidating</strong> — listing-level liquidation in flight (Advanced mode + leverage 1× only).</li>
                      <li><strong className="text-gray-500">Out of range</strong> — Uniswap range crossed by price. No fee accrual until back in range. Orthogonal to listing status.</li>
                    </ul>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  TVL
                  <HelpPopover label="TVL · leased %" width="w-72">
                    <p className="font-semibold mb-1">TVL — Total Value Locked</p>
                    <p>USD value of LP NFT at listing time. Stays constant unless you adjust the position.</p>
                    <p className="font-semibold mt-2 mb-1">Leased %</p>
                    <p>Share of your listed liquidity <strong>currently rented out</strong> by traders. Premium APY accrues only on the leased portion. Higher leased % = more carry.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Net PnL
                  <HelpPopover label="IL-aware Net PnL" width="w-72">
                    <p className="font-semibold mb-1">Net PnL (IL-adjusted)</p>
                    <p>= Uniswap fees + Reference Fees + Premium APY − Impermanent Loss. Это то что Uniswap UI <strong>не показывает</strong> — там только «fees earned» (misleading).</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">
                <span className="inline-flex items-center gap-1 justify-end">
                  Range hit-rate
                  <HelpPopover label="Range hit-rate" width="w-64">
                    <p>% времени когда цена находилась внутри range last 30d. Низкий hit-rate = NFT часто out-of-range = fees not accruing. Sigал rebalance'нуть.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">Lessees</th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Listed</th>
              <th className="text-right font-medium px-3 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {listings.map(l => (
              <ListingRow key={l.id} listing={l} lesseesCount={lesseesByListing.get(l.id) ?? 0} onClick={() => onClick(l.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden rounded-lg border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
        {listings.map(l => (
          <MobileListingRow key={l.id} listing={l} lesseesCount={lesseesByListing.get(l.id) ?? 0} onClick={() => onClick(l.id)} />
        ))}
      </div>
    </>
  )
}

function ListingRow({ listing, lesseesCount, onClick }: { listing: Listing; lesseesCount: number; onClick: () => void }) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const freePct = capacityFreePct(listing)
  const netPnL = listing.netPnLUSD ?? 0
  const dailyEarnings = ((listing.lifetimeUniFeesUSD ?? 0) + (listing.lifetimePremiumUSD ?? 0)) /
    Math.max(1, (Date.now() - listing.listedAt) / (1000 * 60 * 60 * 24))

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="group cursor-pointer transition border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
    >
      <td className="px-4 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-gray-900 group-hover:text-[var(--color-role-lp)] transition">{pairLabel(listing)}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">{fmtFeeTier(listing.feeTierBps)}</span>
          {subsidized && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold">
              you pay
            </span>
          )}
          {listing.providerMode === 'advanced' && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              at-risk · {listing.providerLeverage}×
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-500 font-medium">{dexLabel(listing.dex)}</span>
          <span className="text-gray-300 text-[8px]">·</span>
          <span className="text-[11px] text-gray-500 num">NFT #{listing.tokenId}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <ListingStatusChip status={listing.status} rangeStatus={rangeStatus} />
      </td>
      <td className="px-3 py-3 text-right num">
        <div className="font-medium text-gray-900">{fmtUSD(listing.initialLiquidityUSD)}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {Math.round(100 - freePct)}% leased
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <span className="num font-semibold" style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
          {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
        </span>
        <div className="text-[10px] text-gray-500 num">{dailyEarnings >= 0 ? '+' : '−'}{fmtUSD(Math.abs(dailyEarnings))}/day</div>
      </td>
      <td className="px-3 py-3 text-right num hidden lg:table-cell">
        <span className="font-semibold" style={{ color: (listing.rangeHitRatePct ?? 0) > 70 ? 'var(--color-status-success)' : (listing.rangeHitRatePct ?? 0) > 40 ? 'var(--color-status-warning)' : 'var(--color-status-danger)' }}>
          {listing.rangeHitRatePct ?? 0}%
        </span>
        <div className="text-[10px] text-gray-500">30d</div>
      </td>
      <td className="px-3 py-3 text-right num">
        <span className="font-medium">{lesseesCount}</span>
        <div className="text-[10px] text-gray-500">{listing.status === 'FULL' ? 'full' : 'open'}</div>
      </td>
      <td className="px-3 py-3 text-right num text-xs text-gray-500 hidden lg:table-cell">
        {fmtTimeAgo(listing.listedAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <span className="text-xs font-medium text-[var(--color-role-lp)]">Manage →</span>
      </td>
    </tr>
  )
}

function MobileListingRow({ listing, lesseesCount, onClick }: { listing: Listing; lesseesCount: number; onClick: () => void }) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const netPnL = listing.netPnLUSD ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 transition"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">{pairLabel(listing)}</span>
          <span className="text-[10px] text-gray-500 num">{fmtFeeTier(listing.feeTierBps)}</span>
        </div>
        <span className="num font-semibold" style={{ color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}>
          {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px]">
        <ListingStatusChip status={listing.status} rangeStatus={rangeStatus} tiny />
        {listing.providerMode === 'advanced' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium">{listing.providerLeverage}×</span>
        )}
        {subsidized && (
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold">you pay</span>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] num">
        <div>
          <span className="text-gray-500">TVL</span>
          <div className="font-medium">{fmtUSD(listing.initialLiquidityUSD)}</div>
        </div>
        <div>
          <span className="text-gray-500">Hit-rate</span>
          <div className="font-medium">{listing.rangeHitRatePct ?? 0}%</div>
        </div>
        <div>
          <span className="text-gray-500">Lessees</span>
          <div className="font-medium">{lesseesCount}</div>
        </div>
      </div>
    </button>
  )
}

function ListingStatusChip({ status, rangeStatus, tiny }: { status: string; rangeStatus: 'in-range' | 'out-of-range'; tiny?: boolean }) {
  const sizeCls = tiny ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls

  const data = (() => {
    if (status === 'LIQUIDATING')
      return { label: '💥 liquidating', cls: 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40', tip: 'Listing-level liquidation в процессе' }
    if (status === 'LIQUIDATED') return { label: 'liquidated', cls: 'bg-gray-100 text-gray-700 border border-gray-300', tip: 'Полностью ликвидирован' }
    if (status === 'WITHDRAWAL_REQUESTED') return { label: 'withdrawing', cls: 'bg-amber-50 text-amber-900 border border-amber-300', tip: 'Withdrawal requested' }
    if (status === 'WITHDRAWN') return { label: 'closed', cls: 'bg-gray-100 text-gray-500 border border-gray-300', tip: 'NFT забран' }
    if (status === 'PAUSED') return { label: 'paused', cls: 'bg-gray-50 text-gray-700 border border-gray-300', tip: 'New lessees blocked, existing continue' }
    // Earning states — default LP good case. Neutral (no color noise).
    if (status === 'FULL') return { label: 'earning · full', cls: 'bg-gray-50 text-gray-700 border border-gray-200', tip: 'Capacity занята; existing lessees платят' }
    if (rangeStatus === 'in-range') return { label: 'earning · in range', cls: 'bg-gray-50 text-gray-700 border border-gray-200', tip: 'Uniswap fees начисляются' }
    return { label: 'earning · out of range', cls: 'bg-gray-50 text-gray-500 border border-gray-200', tip: 'Цена вне range — Uniswap fees не идут. Все остальные доходы (Reference / Premium) — продолжают.' }
  })()

  return <span className={baseCls + ' ' + data.cls} title={data.tip}>{data.label}</span>
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
    // Reset for chained listing in same modal
    setStage('configure')
    setMode('lite')
    setLeverage(1)
    setMinApy(1)
    onClose() // close so user picks another NFT from grid
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
              {mode === 'lite' ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Traders compete to rent your liquidity. <strong>1% APY is the floor</strong> — bids only go up from here.
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    You don't need to configure APY — the auction sets the price.
                    Your NFT stays in your control; withdraw any time.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Provider Leverage slider — labels 25× / 75× */}
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
                    <div className="flex justify-between text-[10px] text-gray-500 num mt-0.5">
                      <span>1×</span>
                      <span>25×</span>
                      <span>50×</span>
                      <span>75×</span>
                      <span>100×</span>
                    </div>
                    {leverage > 1 && (
                      <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-start gap-2">
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
                    {/* Presets */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {APY_PRESETS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setMinApy(p)}
                          className={
                            'px-2.5 py-1 text-[11px] font-medium rounded border transition ' +
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

                  {/* Pro-mode read-only preview */}
                  <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1.5">
                    <ParamRow label="Virtual Market" value={fmtUSD(nft.liquidityUSD * effectiveLeverage)} small />
                    <ParamRow label="Real Backing" value={fmtUSD(nft.liquidityUSD)} small />
                    <ParamRow
                      label="Liquidation price"
                      value={leverage > 1 ? `~${liqDistancePct?.toFixed(1)}% from spot` : '— (no liquidation)'}
                      small
                    />
                  </div>
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
                List
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
          </div>
        )}

        {/* SUCCESS stage — listed confirmation */}
        {stage === 'success' && (
          <div className="px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-lime-100 text-lime-700 text-xl">
              ✓
            </div>
            <div className="text-lg font-semibold text-gray-900">NFT listed successfully</div>
            <p className="mt-1 text-xs text-gray-500">
              {nft.pair.token0}/{nft.pair.token1} · {fmtFeeTier(nft.feeTierBps)} · {fmtUSD(nft.liquidityUSD)}
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

function ParamRow({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
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
      <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-role-lp)]/30 text-[var(--color-role-lp)] text-base">
        ◈
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">
          Claimable now:{' '}
          <span className="text-[var(--color-role-lp)] num">+{fmtUSD(amount)}</span>
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          Accumulated Uniswap fees + Premium APY across {listingsCount} listing{listingsCount === 1 ? '' : 's'}.
          Claim sweeps all in a single transaction.
        </div>
      </div>
      <button
        type="button"
        onClick={() => { /* prototype: claim-all stub */ }}
        className="shrink-0 inline-flex items-center gap-2 rounded-md bg-[var(--color-role-lp)] hover:opacity-90 text-white px-4 py-2 text-sm font-semibold transition"
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
