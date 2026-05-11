// S10 Closed Position P&L — design spec §8 S10 + §11.6
// Read-only post-close result. Surfaces partial-payment status prominently if applicable.

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { closedPositions, listings } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'

export function ClosedPositionDetail() {
  const { id } = useParams<{ id: string }>()
  const closed = useMemo(() => closedPositions.find(p => p.id === id), [id])
  const listing = useMemo(
    () => (closed ? listings.find(l => l.id === closed.listingId) : undefined),
    [closed]
  )

  if (!closed || !listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Closed position not found</h2>
        <Link to="/trader/closed" className="text-sm underline">
          ← Back to Market transactions
        </Link>
      </div>
    )
  }

  const traderReceivedCarry = closed.apyBps < 0
  const totalCostsUSD = closed.referencePaidUSD + closed.premiumPaidUSD + closed.keeperRewardUSD + closed.protocolFeeUSD
  const netPnL = closed.residualUSD - closed.marginPostedUSD

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/" className="hover:underline">
          Portfolio
        </Link>
        <span className="mx-1.5">/</span>
        <Link to="/trader/closed" className="hover:underline">
          Market transactions
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{closed.id}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Closed position {closed.id}
            <span className="text-base text-gray-500 ml-2 font-normal">
              · {closed.pair.token0}/{closed.pair.token1}
            </span>
            <span className="text-xs text-gray-400 ml-2 num">fee {fmtFeeTier(closed.feeTierBps)}</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1 num">
            Opened {fmtTimeAgo(closed.openedAt)} · closed {fmtTimeAgo(closed.closedAt)} · held {closed.durationHours}h
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {closed.paidInFull ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
              Closed · paid in full
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              Closed · partial payment
            </span>
          )}
          <span className="text-[11px] text-gray-500">PnL settled at executeClose pool price</span>
        </div>
      </header>

      {/* Headline PnL */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <span className="text-sm text-gray-500">Net P&L (residual − margin posted)</span>
          <span
            className="text-3xl num font-semibold"
            style={{
              color: netPnL >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)',
            }}
          >
            {netPnL >= 0 ? '+' : '−'}{fmtUSD(Math.abs(netPnL))}
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-600 num">
          Margin posted {fmtUSD(closed.marginPostedUSD)} · Residual returned {fmtUSD(closed.residualUSD)} ·
          Notional {fmtUSD(closed.notionalUSD)} · APY paid{' '}
          <span style={{ color: traderReceivedCarry ? 'var(--color-negative-apy)' : undefined }}>
            {fmtPct(closed.apyBps, { signed: true })}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Settlement breakdown
          </h2>
          <dl className="space-y-2 text-sm">
            <Row k="Margin posted (initial)" v={<span className="num">{fmtUSD(closed.marginPostedUSD)}</span>} />
            <Row
              k="Impermanent profit realized"
              v={
                <span
                  className="num font-medium"
                  style={{ color: closed.impermanentProfitUSD >= 0 ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
                >
                  {closed.impermanentProfitUSD >= 0 ? '+' : '−'}{fmtUSD(Math.abs(closed.impermanentProfitUSD))}
                </span>
              }
            />
            <hr className="border-gray-100 my-2" />
            <Row k="− Reference Fees paid (to LP)" v={<span className="num">−{fmtUSD(closed.referencePaidUSD)}</span>} />
            <Row
              k={traderReceivedCarry ? '+ Premium APY received (from LP)' : '− Premium APY paid (to LP)'}
              v={
                <span
                  className="num"
                  style={{ color: traderReceivedCarry ? 'var(--color-status-success)' : undefined }}
                >
                  {traderReceivedCarry ? '+' : '−'}{fmtUSD(Math.abs(closed.premiumPaidUSD))}
                </span>
              }
            />
            <Row k="− Keeper reward" v={<span className="num">−{fmtUSD(closed.keeperRewardUSD)}</span>} />
            <Row k="− Protocol fee" v={<span className="num">−{fmtUSD(closed.protocolFeeUSD)}</span>} />
            <hr className="border-gray-100 my-2" />
            <Row
              k="= Residual returned to trader"
              v={<span className="num font-semibold">{fmtUSD(closed.residualUSD)}</span>}
            />
          </dl>
        </div>

        <div className="space-y-4">
          {/* Partial-payment warning */}
          {!closed.paidInFull && closed.unpaidUSD !== undefined && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold mb-2 text-amber-900">Partial payment recorded</h3>
              <p className="text-sm text-amber-900 leading-relaxed">
                Your reserve was insufficient to fully cover Reference and Premium owed at settlement. The LP received
                <span className="num font-medium"> {fmtUSD(closed.referencePaidUSD + closed.premiumPaidUSD)} </span>
                of an expected{' '}
                <span className="num font-medium">
                  {fmtUSD(closed.referencePaidUSD + closed.premiumPaidUSD + closed.unpaidUSD)}
                </span>
                .
              </p>
              <p className="text-xs text-amber-800 mt-2">
                Unpaid: <span className="num font-medium">{fmtUSD(closed.unpaidUSD)}</span>. sLiq has no insurance fund —
                the LP NFT Provider absorbs unpaid Reference / Premium APY.
              </p>
            </div>
          )}

          {/* Listing link */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Listing</h3>
            <Link
              to={`/listings/${closed.listingId}`}
              className="text-sm font-medium hover:underline"
            >
              {closed.pair.token0} / {closed.pair.token1}
              <span className="text-xs text-gray-500 ml-2 num">fee {fmtFeeTier(closed.feeTierBps)}</span>
            </Link>
            <p className="text-xs text-gray-500 mt-2 num">
              Held for {closed.durationHours}h · Cost basis ≈ {fmtUSD(totalCostsUSD)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/trader/open?listing=${closed.listingId}`}
                className="text-sm font-medium px-3 py-2 rounded-md border border-[var(--color-role-trader)] text-[var(--color-role-trader)] hover:bg-[var(--color-role-trader-bg)] transition"
              >
                Open new position on same listing
              </Link>
              <Link
                to="/trader/closed"
                className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
              >
                ← All transactions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <dt className="text-gray-600 text-sm">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}
