// Pools default — LP's listings as cards. Replaces the old stub.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard } from '@/components/ListingCard'
import { connectedWallet, listings } from '@/mocks/data'

export function MyListings() {
  const mine = useMemo(
    () => listings.filter(l => l.owner === connectedWallet.address),
    []
  )

  return (
    <div>
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">My listings</h2>
          <p className="text-sm text-gray-600 mt-1 num">{mine.length} total</p>
        </div>
        <Link
          to="/lp/deposit"
          className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
        >
          + Deposit NFT
        </Link>
      </header>

      {mine.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-600 mb-3">No listings yet. Deposit a Uniswap V3 NFT to list it.</p>
          <Link
            to="/lp/deposit"
            className="inline-block text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
          >
            Deposit NFT
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mine.map(l => (
            <ListingCard key={l.id} listing={l} viewerRole="lp-owner" />
          ))}
        </div>
      )}
    </div>
  )
}
