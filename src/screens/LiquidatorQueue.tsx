// S14 + S15 Liquidator queue — design spec §8 + §11.6
// Permissioned-only screens. S14 lists positions awaiting executeClose.
// S15 lists listings with their 3-stage lifecycle (start/process/finalize).
// "Manual fallback" framing — the standalone keeper is the preferred path.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { connectedWallet, listingLiquidationState, listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD, shortAddr } from '@/lib/format'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'

export function LiquidatorPositions() {
  // Identify positions eligible for executeClose: reserve < 10% of initial OR explicit close request
  const queue = useMemo(
    () => positions.filter(p => p.reservePctOfInitial < 15 || p.status === 'CLOSE_REQUESTED'),
    []
  )
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmPos = queue.find(p => p.id === confirmId)
  const listingFor = (lid: string) => listings.find(l => l.id === lid)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ManualFallbackBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Keeper queue — Positions</h1>
        <p className="text-sm text-gray-600 mt-1">
          {queue.length} position{queue.length === 1 ? '' : 's'} eligible for <code className="font-mono text-xs bg-gray-100 px-1 rounded">executeClose</code>.
        </p>
      </header>

      {!connectedWallet.isPermissionedLiquidator && (
        <NotPermissionedBanner />
      )}

      {queue.length === 0 ? (
        <EmptyState message="No positions in the close queue." />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Position</th>
                <th className="text-left font-medium px-4 py-2.5">Listing</th>
                <th className="text-right font-medium px-4 py-2.5">Reserve</th>
                <th className="text-left font-medium px-4 py-2.5">Trigger</th>
                <th className="text-right font-medium px-4 py-2.5">Reward</th>
                <th className="text-right font-medium px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map(p => {
                const listing = listingFor(p.listingId)
                if (!listing) return null
                const trigger =
                  p.status === 'CLOSE_REQUESTED'
                    ? 'trader requested close'
                    : 'reserve < 10% of initial'
                const reward = p.reserveUSD * 0.005 // 0.5% keeper reward
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 num">
                      <Link to={`/trader/positions/${p.id}`} className="font-medium hover:underline">
                        {p.id}
                      </Link>
                      <span className="text-xs text-gray-500 ml-2">{shortAddr(p.trader)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/listings/${p.listingId}`} className="hover:underline">
                        {listing.pair.token0}/{listing.pair.token1}
                      </Link>
                      <span className="text-xs text-gray-500 ml-2 num">{fmtFeeTier(listing.feeTierBps)}</span>
                    </td>
                    <td className="px-4 py-3 text-right num">
                      <span
                        className="font-medium"
                        style={{
                          color: p.reservePctOfInitial < 10
                            ? 'var(--color-status-danger)'
                            : p.reservePctOfInitial < 25
                            ? 'var(--color-status-warning)'
                            : 'inherit',
                        }}
                      >
                        {p.reservePctOfInitial}%
                      </span>
                      <span className="text-xs text-gray-500 ml-2">{fmtUSD(p.reserveUSD)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{trigger}</td>
                    <td className="px-4 py-3 text-right num">{fmtUSD(reward)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!connectedWallet.isPermissionedLiquidator}
                        onClick={() => setConfirmId(p.id)}
                        className={
                          'text-sm font-medium px-3 py-1.5 rounded transition ' +
                          (connectedWallet.isPermissionedLiquidator
                            ? 'bg-[var(--color-role-liquidator)] text-white hover:opacity-90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                        }
                      >
                        Execute close
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmPos && (
        <HighStakesConfirmModal
          open={!!confirmId}
          title="Execute close — confirm"
          subtitle="Permissioned keeper action. Settlement uses live pool price."
          currentState={[
            { label: 'Position', value: confirmPos.id },
            { label: 'Listing', value: confirmPos.listingId },
            { label: 'Reserve', value: `${confirmPos.reservePctOfInitial}% / ${fmtUSD(confirmPos.reserveUSD)}` },
          ]}
          newState={[
            { label: 'sqrtPriceLimitX96', value: 'TWAP-bounded (default)', deltaTone: 'neutral' },
            { label: 'Deadline', value: 'block.timestamp', deltaTone: 'neutral' },
            { label: 'Keeper reward', value: fmtUSD(confirmPos.reserveUSD * 0.005), deltaTone: 'positive' },
          ]}
          risks={[
            'Settlement uses live Uniswap pool price.',
            'Reference Fees and Premium APY are paid before trader residual.',
            'If reserve is insufficient, residual goes to zero and partial Reference/Premium is recorded.',
          ]}
          irreversibilityNote="Once confirmed, the close is final on the next block."
          confirmType="checkbox"
          confirmButtonLabel="Confirm — Execute close"
          onConfirm={() => setConfirmId(null)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  )
}

export function LiquidatorListings() {
  const liqListings = useMemo(
    () => listings.filter(l => l.status === 'LIQUIDATING' || listingLiquidationState[l.id]),
    []
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ManualFallbackBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Keeper queue — Listings</h1>
        <p className="text-sm text-gray-600 mt-1">
          {liqListings.length} listing{liqListings.length === 1 ? '' : 's'} in the 3-stage liquidation lifecycle.
        </p>
      </header>

      {!connectedWallet.isPermissionedLiquidator && <NotPermissionedBanner />}

      {liqListings.length === 0 ? (
        <EmptyState message="No listings in the liquidation queue." />
      ) : (
        <div className="space-y-4">
          {liqListings.map(l => {
            const state = listingLiquidationState[l.id]
            if (!state) return null
            const stage = state.finalized
              ? 3
              : state.batchProcessed >= state.totalPositions
              ? 3
              : state.batchProcessed > 0
              ? 2
              : 1
            return (
              <div key={l.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <Link
                      to={`/listings/${l.id}/liquidation`}
                      className="text-base font-semibold tracking-tight hover:underline"
                    >
                      {l.pair.token0} / {l.pair.token1}
                      <span className="text-xs text-gray-500 ml-2 num">{fmtFeeTier(l.feeTierBps)}</span>
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5 num">
                      NFT #{l.tokenId} · owner {shortAddr(l.owner)} · started {fmtTimeAgo(state.startedAt)} · snapshot ${state.snapshotPrice.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/30 font-medium">
                    Advanced · {l.providerLeverage}× · LIQUIDATING
                  </span>
                </div>

                {/* 3-stage strip */}
                <ol className="flex items-stretch gap-2 mb-4">
                  <StageStep n={1} title="Start" status={stage > 1 ? 'done' : stage === 1 ? 'active' : 'queued'} />
                  <StageStep
                    n={2}
                    title={`Process batch (${state.batchProcessed}/${state.totalPositions})`}
                    status={stage > 2 ? 'done' : stage === 2 ? 'active' : 'queued'}
                  />
                  <StageStep
                    n={3}
                    title="Finalize"
                    status={state.finalized ? 'done' : stage === 3 ? 'active' : 'queued'}
                  />
                </ol>

                {/* Per-stage CTA */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={stage > 1 || !connectedWallet.isPermissionedLiquidator}
                    className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition"
                  >
                    Start liquidation
                  </button>
                  <button
                    type="button"
                    disabled={stage !== 2 || !connectedWallet.isPermissionedLiquidator}
                    className={
                      'text-sm font-medium px-3 py-1.5 rounded-md transition ' +
                      (stage === 2 && connectedWallet.isPermissionedLiquidator
                        ? 'bg-[var(--color-role-liquidator)] text-white hover:opacity-90'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                    }
                  >
                    Process next batch
                  </button>
                  <button
                    type="button"
                    disabled={stage !== 3 || state.finalized || !connectedWallet.isPermissionedLiquidator}
                    className="text-sm font-medium px-3 py-1.5 rounded-md border border-[var(--color-status-danger)] text-[var(--color-status-danger)] disabled:opacity-50 hover:bg-red-50 transition"
                  >
                    Finalize
                  </button>
                  <Link
                    to={`/listings/${l.id}/liquidation`}
                    className="ml-auto text-sm text-gray-500 underline self-center"
                  >
                    LP-side view →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ManualFallbackBanner() {
  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 flex items-baseline gap-2">
      <span className="font-medium">Manual fallback.</span>
      <span>The standalone keeper process is the preferred path. Use this UI only when the keeper is offline or stuck.</span>
    </div>
  )
}

function NotPermissionedBanner() {
  return (
    <div className="mb-4 rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm">
      <span className="font-medium text-gray-800">Read-only — wallet not in <code className="font-mono text-xs bg-white px-1 py-0.5 rounded border border-gray-200">permissionedLiquidators</code>.</span>
      <span className="text-gray-600 block mt-1">
        Action buttons disabled. Switch to a keeper wallet via <Link to="/settings" className="underline">Settings</Link>.
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}

function StageStep({
  n,
  title,
  status,
}: {
  n: number
  title: string
  status: 'done' | 'active' | 'queued'
}) {
  const color =
    status === 'done'
      ? 'var(--color-status-success)'
      : status === 'active'
      ? 'var(--color-status-info)'
      : 'oklch(75% 0 0)'
  return (
    <div
      className="flex-1 rounded-md border p-2.5 text-xs"
      style={{
        borderColor: color,
        background:
          status === 'done'
            ? 'var(--color-role-lp-bg)'
            : status === 'active'
            ? 'oklch(96% 0.04 240)'
            : 'white',
      }}
    >
      <div className="flex items-center gap-1.5 font-semibold mb-0.5" style={{ color }}>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] text-white"
          style={{ background: color }}>
          {status === 'done' ? '✓' : n}
        </span>
        <span>Step {n}</span>
      </div>
      <div className="text-[11px] text-gray-700">{title}</div>
    </div>
  )
}
