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
import { getWalletNFTsForState, showListingsForState, type WalletNFT } from '@/mocks/walletNFTs'
import type { Listing } from '@/lib/types'

type StatusFilter = 'all' | 'earning' | 'paused' | 'attention'
type SortId = 'pnl-desc' | 'pnl-asc' | 'earnings-desc' | 'tvl-desc' | 'hitrate-desc' | 'newest'

const PAGE_SIZES = [25, 50, 100, -1] as const

export function MyListings() {
  const [lpState] = useLPDemoState()
  const { isConnected, hasListings, hasEligibleNFTs } = deriveLPState(lpState)
  const walletNFTs = useMemo(() => getWalletNFTsForState(lpState), [lpState])

  // 1.1 Guest — wallet not connected
  if (!isConnected) {
    return <GuestState />
  }

  // 1.2 Connected · no NFTs in wallet · no listings
  if (!hasEligibleNFTs && !hasListings) {
    return <NoNFTsState />
  }

  // 1.3 Connected · has NFTs · no listings
  if (hasEligibleNFTs && !hasListings) {
    return <FreshUserState walletNFTs={walletNFTs} />
  }

  // 1.4 + 1.5 — connected with listings (table render below)
  return <ListingsView walletNFTs={hasEligibleNFTs ? walletNFTs : []} allListed={!hasEligibleNFTs} />
}

// ───────── Main listings view (used for states 1.4 + 1.5) ─────────
function ListingsView({ walletNFTs, allListed }: { walletNFTs: WalletNFT[]; allListed: boolean }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pairFilter, setPairFilter] = useState<string>('all')
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
    return { earningToday, totalNetPnL, totalTVL, atRisk }
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
  }, [mine, statusFilter, pairFilter, sort])

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = pageSize === -1 ? 0 : (safePage - 1) * pageSize
  const pageEnd = pageSize === -1 ? filtered.length : pageStart + pageSize
  const visible = filtered.slice(pageStart, pageEnd)

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
        {/* Onboarding banner — collapsed by default */}
        <OnboardingBanner />

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
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
            + Deposit NFT
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

      {/* State 1.5 — eligible NFTs section after existing listings */}
      {walletNFTs.length > 0 && (
        <section className="mt-10 pt-8 border-t border-gray-200">
          <EligibleNFTsSection walletNFTs={walletNFTs} />
        </section>
      )}

      {/* State 1.4 — all deployed footer */}
      {allListed && walletNFTs.length === 0 && (
        <AllListedFooter />
      )}
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
          Plug in your existing LP NFT. Earn <strong className="text-lime-300">+3–7% APR</strong> extra carry from sLiq traders on top of your normal Uniswap fees. <strong className="text-white">2-click exit, ~4 sec on Arbitrum.</strong>
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
          <ValueChip n="Up to 100×" label="Provider Leverage (Advanced)" />
          <ValueChip n="2-click exit" label="~4 sec on Arbitrum" />
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
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center text-2xl">
          ∅
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No Uniswap V3 LP NFTs found</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          sLiq wraps Uniswap V3 LP NFTs to let you earn extra Premium APY on top of Uniswap fees.
          To get started, mint an LP position on Uniswap first — sLiq will detect it automatically.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://app.uniswap.org/positions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            Open Uniswap <span aria-hidden>↗</span>
          </a>
          <button
            type="button"
            onClick={() => { /* prototype no-op */ }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-5 py-2.5 text-sm font-medium transition"
            title="Re-scan the connected wallet for V3 LP NFTs"
          >
            Refresh balance
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          Supported: Uniswap V3 LP positions on Arbitrum, Ethereum, Base, Optimism, Polygon
        </p>
      </div>
    </div>
  )
}

// ───────── 1.3 Connected, has NFTs, no listings ─────────
function FreshUserState({ walletNFTs }: { walletNFTs: WalletNFT[] }) {
  return (
    <div>
      <header className="mb-6">
        <div className="rounded-lg border border-lime-200 bg-lime-50/50 px-4 py-3 flex items-start gap-3">
          <span className="text-lime-700 text-xl leading-none mt-0.5">✓</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              Wallet connected · {walletNFTs.length} eligible NFT{walletNFTs.length === 1 ? '' : 's'} found
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Pick a position to wrap into sLiq. Conservative 1× is default — no liquidation risk.
            </p>
          </div>
        </div>
      </header>
      <EligibleNFTsSection walletNFTs={walletNFTs} variant="primary" />
    </div>
  )
}

// ───────── Eligible NFTs section (used in 1.3 & 1.5) ─────────
function EligibleNFTsSection({ walletNFTs, variant = 'secondary' }: { walletNFTs: WalletNFT[]; variant?: 'primary' | 'secondary' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          {variant === 'primary' ? 'Ready to list' : 'More NFTs ready to list'}
          <span className="ml-2 text-sm text-gray-500 num">({walletNFTs.length})</span>
        </h2>
        {variant === 'secondary' && (
          <span className="text-xs text-gray-500">
            in your wallet · not yet on sLiq
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {walletNFTs.map(nft => (
          <EligibleNFTCard key={nft.tokenId} nft={nft} />
        ))}
      </div>
    </div>
  )
}

function EligibleNFTCard({ nft }: { nft: WalletNFT }) {
  const inRange = nft.rangeStatus === 'in-range'
  return (
    <Link
      to="/lp/deposit"
      className="block rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition p-4"
    >
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

      <div className="mt-4 w-full text-center text-sm font-medium bg-[var(--color-role-lp)] hover:opacity-90 text-white rounded-md py-2 transition">
        + List on sLiq
      </div>
    </Link>
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
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-right font-medium px-3 py-2.5">TVL</th>
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
        <div className="text-[11px] text-gray-500 num mt-0.5">
          NFT #{listing.tokenId}
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
