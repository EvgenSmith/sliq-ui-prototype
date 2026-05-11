// S2 Portfolio Overview — design spec §8 (S2) + §11.6
// Default landing post-wallet-connect. Aggregates LP + Trader + Claimable + Activity.
// Mode-agnostic. RoleBadge = "All" by default; switching narrows the view.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard } from '@/components/ListingCard'
import {
  claimables,
  connectedWallet,
  listings,
  positions,
  recentActivity,
  totalsForUser,
} from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'
import type { Role } from '@/lib/types'

interface Props {
  activeRole: Role
}

export function PortfolioOverview({ activeRole }: Props) {
  const myListings = useMemo(
    () => listings.filter(l => l.owner === connectedWallet.address),
    []
  )
  const myPositions = useMemo(
    () => positions.filter(p => p.trader === connectedWallet.address),
    []
  )
  const claimableTotal = totalsForUser.claimableUSD

  const showLP = activeRole === 'All' || activeRole === 'LP'
  const showTrader = activeRole === 'All' || activeRole === 'Trader'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Page title */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-gray-600 num mt-1">
          {myListings.length} listings · {myPositions.length} positions ·{' '}
          {fmtUSD(claimableTotal)} claimable
        </p>
      </header>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          to="/listings"
          className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
        >
          Browse listings
        </Link>
        <Link
          to="/lp/deposit"
          className="text-sm font-medium px-3 py-2 rounded-md border border-[var(--color-role-lp)] text-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)] transition"
        >
          Deposit NFT
        </Link>
        <Link
          to="/trader/open"
          className="text-sm font-medium px-3 py-2 rounded-md border border-[var(--color-role-trader)] text-[var(--color-role-trader)] hover:bg-[var(--color-role-trader-bg)] transition"
        >
          Open position
        </Link>
      </div>

      {/* My Listings */}
      {showLP && (
        <Section
          title="My Listings"
          accent="var(--color-role-lp)"
          count={myListings.length}
          empty="No listings yet. Deposit a Uniswap V3 NFT to list it."
          emptyCta={{ label: 'Deposit NFT', to: '/lp/deposit' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myListings.map(l => (
              <ListingCard key={l.id} listing={l} viewerRole="lp-owner" />
            ))}
          </div>
        </Section>
      )}

      {/* My Positions */}
      {showTrader && (
        <Section
          title="My Positions"
          accent="var(--color-role-trader)"
          count={myPositions.length}
          empty="No positions yet. Browse listings to open one."
          emptyCta={{ label: 'Browse listings', to: '/listings' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myPositions.map(p => {
              const listing = listings.find(l => l.id === p.listingId)!
              return <PositionRow key={p.id} position={p} pair={listing.pair} feeTierBps={listing.feeTierBps} />
            })}
          </div>
        </Section>
      )}

      {/* Claimable */}
      {(activeRole === 'All' || activeRole === 'LP') && (
        <Section
          title="Claimable"
          accent="var(--color-status-success)"
          count={claimables.length}
          empty="Nothing to claim right now."
        >
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium pb-2">Listing</th>
                  <th className="text-right font-medium pb-2">Uniswap</th>
                  <th className="text-right font-medium pb-2">Reference</th>
                  <th className="text-right font-medium pb-2">Premium</th>
                  <th className="text-right font-medium pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {claimables.map(c => {
                  const listing = listings.find(l => l.id === c.listingId)!
                  return (
                    <tr key={c.listingId} className="border-t border-gray-100">
                      <td className="py-3">
                        <Link to={`/lp/listings/${c.listingId}`} className="font-medium hover:underline">
                          {listing.pair.token0}/{listing.pair.token1}
                        </Link>
                        <span className="text-xs text-gray-500 ml-2">{fmtFeeTier(listing.feeTierBps)}</span>
                      </td>
                      <td className="text-right num py-3">{fmtUSD(c.uniswapFeesUSD)}</td>
                      <td className="text-right num py-3">{fmtUSD(c.refRealizedUSD)}</td>
                      <td className="text-right num py-3">{fmtUSD(c.premRealizedUSD)}</td>
                      <td className="text-right py-3">
                        <button className="text-sm font-medium px-2.5 py-1 rounded border border-[var(--color-status-success)] text-[var(--color-status-success)] hover:bg-[var(--color-role-lp-bg)] transition">
                          Claim
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3">
              Pending Reference and Premium values from open positions are <em>not</em> shown here — they settle when each
              position closes and may settle partial.
            </p>
          </div>
        </Section>
      )}

      {/* Recent Activity */}
      <Section title="Recent Activity">
        <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {recentActivity.map(a => (
            <li key={a.id} className="px-4 py-3 flex items-baseline justify-between gap-4 text-sm">
              <span className="text-gray-700">{a.text}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap num">{fmtTimeAgo(a.ts)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({
  title,
  accent,
  count,
  children,
  empty,
  emptyCta,
}: {
  title: string
  accent?: string
  count?: number
  children: React.ReactNode
  empty?: string
  emptyCta?: { label: string; to: string }
}) {
  const isEmpty = count === 0 && empty
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold tracking-tight" style={accent ? { color: accent } : undefined}>
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-gray-500 num">{count}</span>
        )}
      </div>
      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm text-gray-600 mb-3">{empty}</p>
          {emptyCta && (
            <Link
              to={emptyCta.to}
              className="inline-block text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition"
            >
              {emptyCta.label}
            </Link>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function PositionRow({
  position,
  pair,
  feeTierBps,
}: {
  position: import('@/lib/types').Position
  pair: { token0: string; token1: string }
  feeTierBps: number
}) {
  return (
    <Link
      to={`/trader/positions/${position.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-base font-semibold tracking-tight">
            {pair.token0} / {pair.token1}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            fee {fmtFeeTier(feeTierBps)} · {position.effectiveLeverage}× effective
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30">
          {position.status === 'OPEN' ? 'Open' : position.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-gray-500">Notional</dt>
        <dd className="text-right num font-medium">{fmtUSD(position.notionalUSD)}</dd>
        <dt className="text-gray-500">Margin</dt>
        <dd className="text-right num">{fmtUSD(position.marginValueUSD)}</dd>
        <dt className="text-gray-500">APY paid</dt>
        <dd className="text-right num font-medium" style={{
          color: position.apyBps < 0 ? 'var(--color-negative-apy)' : 'inherit',
        }}>
          {fmtPct(position.apyBps, { signed: true })}
        </dd>
        <dt className="text-gray-500">Reserve</dt>
        <dd className="text-right num">
          {fmtUSD(position.reserveUSD)}{' '}
          <span className="text-xs text-gray-500">({position.reservePctOfInitial}%)</span>
        </dd>
      </dl>
    </Link>
  )
}
