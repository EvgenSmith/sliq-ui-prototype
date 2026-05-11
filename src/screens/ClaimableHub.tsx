// S16 Claimable Hub — design spec §8 S16 + §11.6
// Full screen of all claimable revenue: Uniswap fees, Reference, Premium, plus liquidated-NFT residuals.

import { Link } from 'react-router-dom'
import { claimables, listings } from '@/mocks/data'
import { fmtFeeTier, fmtUSD } from '@/lib/format'

export function ClaimableHub() {
  const claimableTotal = claimables.reduce(
    (sum, c) => sum + c.uniswapFeesUSD + c.refRealizedUSD + c.premRealizedUSD,
    0
  )
  const pendingTotal = claimables.reduce(
    (sum, c) => sum + c.refPendingUSD + c.premPendingUSD,
    0
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Claimable</h1>
        <p className="text-sm text-gray-600 mt-1">
          Realized fees and APY available to claim now. Pending values from open positions are tracked separately.
        </p>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-[var(--color-status-success)]/30 bg-[var(--color-role-lp-bg)] p-5">
          <span className="text-xs text-[var(--color-role-lp)] uppercase tracking-wide font-semibold">
            Realized — claimable now
          </span>
          <div className="text-3xl num font-semibold mt-1" style={{ color: 'var(--color-status-success)' }}>
            {fmtUSD(claimableTotal)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Uniswap fees on tracking liquidity + Reference + Premium from closed positions.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            Pending — settles on close
          </span>
          <div className="text-3xl num font-semibold mt-1 text-gray-600">
            {fmtUSD(pendingTotal)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Accruing on open trader positions. May settle partial if a trader's margin runs out.
          </p>
        </div>
      </div>

      {/* Per-listing table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Listing</th>
              <th className="text-right font-medium px-4 py-2.5">Uniswap</th>
              <th className="text-right font-medium px-4 py-2.5">
                Reference<br />
                <span className="text-gray-400 normal-case font-normal">realized · pending</span>
              </th>
              <th className="text-right font-medium px-4 py-2.5">
                Premium<br />
                <span className="text-gray-400 normal-case font-normal">realized · pending</span>
              </th>
              <th className="text-right font-medium px-4 py-2.5">Claimable</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {claimables.map(c => {
              const listing = listings.find(l => l.id === c.listingId)
              if (!listing) return null
              const rowClaimable = c.uniswapFeesUSD + c.refRealizedUSD + c.premRealizedUSD
              return (
                <tr key={c.listingId} className="border-t border-gray-100">
                  <td className="px-4 py-3.5">
                    <Link to={`/lp/listings/${c.listingId}`} className="font-medium hover:underline">
                      {listing.pair.token0}/{listing.pair.token1}
                    </Link>
                    <span className="text-xs text-gray-500 ml-2 num">{fmtFeeTier(listing.feeTierBps)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right num">{fmtUSD(c.uniswapFeesUSD)}</td>
                  <td className="px-4 py-3.5 text-right num">
                    <span className="font-medium">{fmtUSD(c.refRealizedUSD)}</span>
                    <span className="text-xs text-gray-500"> · {fmtUSD(c.refPendingUSD)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right num">
                    <span className="font-medium">{fmtUSD(c.premRealizedUSD)}</span>
                    <span className="text-xs text-gray-500"> · {fmtUSD(c.premPendingUSD)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right num font-semibold" style={{ color: 'var(--color-status-success)' }}>
                    {fmtUSD(rowClaimable)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      className="text-sm font-medium px-3 py-1.5 rounded border border-[var(--color-status-success)] text-[var(--color-status-success)] hover:bg-[var(--color-role-lp-bg)] transition"
                    >
                      Claim
                    </button>
                  </td>
                </tr>
              )
            })}
            {claimables.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                  Nothing to claim right now.
                </td>
              </tr>
            )}
          </tbody>
          {claimables.length > 1 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Total claimable
                </td>
                <td className="px-4 py-2.5 text-right num font-semibold" style={{ color: 'var(--color-status-success)' }}>
                  {fmtUSD(claimableTotal)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="text-sm font-semibold px-3 py-1.5 rounded bg-[var(--color-status-success)] text-white hover:opacity-90 transition"
                  >
                    Claim all
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        Pending Reference and Premium values from open positions are not shown above — they settle when each position
        closes and may settle partial if a trader's margin runs out. sLiq has no insurance fund.
      </p>
    </div>
  )
}
