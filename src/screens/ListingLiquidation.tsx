// S13 LP-side Listing Liquidation view — design spec §8 S13 + F8
// What the LP sees when their listing-level liquidation is in progress.
// Three-stage timeline + pro-rata claims preview + post-finalize claim CTA.

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listingLiquidationState, listings } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'

export function ListingLiquidationView() {
  const { id } = useParams<{ id: string }>()
  const listing = useMemo(() => listings.find(l => l.id === id), [id])
  const state = id ? listingLiquidationState[id] : undefined

  if (!listing || !state) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">No active liquidation</h2>
        <p className="text-sm text-gray-600 mb-4">This listing isn't currently liquidating.</p>
        <Link to="/" className="text-sm underline">
          ← Back to Portfolio
        </Link>
      </div>
    )
  }

  const stage = state.finalized
    ? 'finalized'
    : state.batchProcessed >= state.totalPositions
    ? 'finalizing'
    : state.batchProcessed > 0
    ? 'processing'
    : 'started'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/" className="hover:underline">
          Portfolio
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">
          {listing.pair.token0} / {listing.pair.token1} · Liquidation
        </span>
      </nav>

      {/* Header alert */}
      <div className="mb-6 rounded-lg border border-[var(--color-status-danger)]/40 bg-red-50 p-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-status-danger)]">
            Listing is liquidating
          </h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 font-medium">
            {listing.pair.token0}/{listing.pair.token1} · NFT #{listing.tokenId}
          </span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          Aggregate reserve fell below 10% of initial. With Provider Leverage{' '}
          <span className="num font-medium">{listing.providerLeverage}×</span>, the NFT is being used as collateral
          to settle trader claims. You may receive less than your original NFT — or none of it — at finalization.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Liquidation timeline
          </h2>
          <ol className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
            <Stage
              n={1}
              title="Liquidation started"
              status="done"
              detail={
                <>
                  Triggered <span className="num">{fmtTimeAgo(state.startedAt)}</span> · snapshot price{' '}
                  <span className="num">${state.snapshotPrice.toLocaleString()}</span>
                </>
              }
            />
            <Stage
              n={2}
              title={`Processing batch (${state.batchProcessed}/${state.totalPositions})`}
              status={
                stage === 'processing'
                  ? 'active'
                  : state.batchProcessed >= state.totalPositions
                  ? 'done'
                  : 'queued'
              }
              detail={
                stage === 'processing' ? (
                  <>
                    Keeper iterating positions. Each trader's claim is calculated at the snapshot price.{' '}
                    <span className="num">{state.totalPositions - state.batchProcessed}</span> remaining.
                  </>
                ) : state.batchProcessed >= state.totalPositions ? (
                  <>All snapshot positions processed.</>
                ) : (
                  <>Will start once Step 1 settles.</>
                )
              }
            />
            <Stage
              n={3}
              title="Finalize settlement"
              status={state.finalized ? 'done' : stage === 'finalizing' ? 'active' : 'queued'}
              detail={
                state.finalized ? (
                  <>
                    Liquidation pool distributed pro-rata. Claim your residual NFT below.
                  </>
                ) : (
                  <>
                    Keeper will unwind remaining NFT liquidity, swap to cover token deficits, and compute pro-rata
                    claim ratios.
                  </>
                )
              }
            />
          </ol>

          {/* What you do */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold mb-3">What happens to your NFT</h3>
            <ul className="text-sm text-gray-700 space-y-1.5 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-gray-400 mt-0.5">·</span>
                <span>Active trader positions are settled at the <strong>snapshot price</strong>, not live.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400 mt-0.5">·</span>
                <span>Positive trader claims are paid pro-rata from escrow + margin + (if needed) the NFT liquidity itself.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400 mt-0.5">·</span>
                <span>After finalize, you can call <code className="font-mono text-xs bg-gray-100 px-1 rounded">withdrawLiquidatedNFT</code> to receive whatever is left.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400 mt-0.5">·</span>
                <span>No action is required from you during stages 1–3. Keepers execute autonomously.</span>
              </li>
            </ul>

            {state.finalized ? (
              <button
                type="button"
                className="mt-4 text-sm font-semibold px-4 py-2 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
              >
                Claim residual NFT
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 text-sm font-medium px-4 py-2 rounded-md bg-gray-200 text-gray-400 cursor-not-allowed"
              >
                Claim residual NFT · waiting for finalize
              </button>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Listing snapshot
            </h3>
            <dl className="space-y-1 text-sm">
              <Row k="Pair" v={`${listing.pair.token0}/${listing.pair.token1}`} />
              <Row k="Fee tier" v={<span className="num">{fmtFeeTier(listing.feeTierBps)}</span>} />
              <Row k="Range" v={<span className="num">${listing.rangeLow}–${listing.rangeHigh}</span>} />
              <Row k="Provider Leverage" v={<span className="num">{listing.providerLeverage}×</span>} />
              <Row k="Min Premium APY" v={<span className="num">{fmtPct(listing.minPremiumApyBps, { signed: true })}</span>} />
              <Row k="Aggregate reserve" v={<span className="num">{fmtUSD(listing.aggregateReserveUSD ?? 0)}</span>} />
              <Row
                k="Distance to liq"
                v={
                  <span className="num font-medium" style={{ color: 'var(--color-status-danger)' }}>
                    {listing.distanceToLiqPct ?? 0}%
                  </span>
                }
              />
            </dl>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
              No insurance fund
            </h3>
            <p className="text-xs text-amber-900 leading-relaxed">
              sLiq does not socialize liquidation losses. The LP NFT Provider absorbs any value not covered by the
              liquidation pool. This is the explicit risk of Advanced mode.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Stage({
  n,
  title,
  status,
  detail,
}: {
  n: number
  title: string
  status: 'done' | 'active' | 'queued'
  detail: React.ReactNode
}) {
  const dotBg =
    status === 'done'
      ? 'var(--color-status-success)'
      : status === 'active'
      ? 'var(--color-status-info)'
      : 'oklch(85% 0 0)'
  const dotIcon = status === 'done' ? '✓' : status === 'active' ? '·' : n
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold text-white"
          style={{ background: dotBg }}
        >
          {dotIcon}
        </span>
      </div>
      <div className="flex-1 pb-1">
        <div className="text-sm font-semibold">
          Step {n}. {title}
          <span
            className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium"
            style={{
              background: status === 'done' ? 'var(--color-role-lp-bg)' : status === 'active' ? 'oklch(96% 0.04 240)' : 'oklch(95% 0 0)',
              color:
                status === 'done'
                  ? 'var(--color-status-success)'
                  : status === 'active'
                  ? 'var(--color-status-info)'
                  : 'oklch(50% 0 0)',
            }}
          >
            {status}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </li>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}
