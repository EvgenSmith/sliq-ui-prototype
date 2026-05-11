// S17 Settings — design spec §8 S17
// Wallet, chain, Core address. Plus dev-only wallet switcher for the prototype.

import { useState } from 'react'
import { WALLET_REGISTRY, connectedWallet } from '@/mocks/data'

const CHAINS = [
  { id: 42161, label: 'Arbitrum One' },
  { id: 1, label: 'Ethereum mainnet' },
  { id: 8453, label: 'Base' },
  { id: 10, label: 'Optimism' },
  { id: 137, label: 'Polygon' },
  { id: 11155111, label: 'Sepolia (testnet)' },
  { id: 31337, label: 'Anvil (local fork)' },
]

export function Settings() {
  const [chainId, setChainId] = useState<number>(42161)
  const [coreAddress, setCoreAddress] = useState<string>(
    () => localStorage.getItem('sliq.coreAddress') ?? '0x'
  )
  const [anvilHelper, setAnvilHelper] = useState<boolean>(
    () => localStorage.getItem('sliq.anvilHelper') === 'true'
  )

  function switchWallet(addr: string) {
    localStorage.setItem('sliq.activeWallet', addr)
    location.href = '/'
  }

  function saveCore() {
    localStorage.setItem('sliq.coreAddress', coreAddress)
    localStorage.setItem('sliq.anvilHelper', String(anvilHelper))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Wallet, chain, and sLiq Core contract address.
        </p>
      </header>

      {/* Wallet */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Connected wallet
        </h2>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="num font-medium">{connectedWallet.label}</span>
          <span className="text-xs text-gray-500">{connectedWallet.persona}</span>
        </div>
        <button
          type="button"
          className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
        >
          Disconnect
        </button>
      </section>

      {/* Dev wallet switcher */}
      <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50/60 p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Dev wallet switcher (prototype only)
          </h2>
          <span className="text-[11px] text-amber-700 font-medium">env-gated in production</span>
        </div>
        <p className="text-xs text-amber-900 mb-4">
          Switch between mocked wallets to test each role-perspective in the UI. Real builds use the injected wallet.
        </p>
        <div className="space-y-2">
          {Object.values(WALLET_REGISTRY).map(w => {
            const active = w.address === connectedWallet.address
            return (
              <button
                key={w.address}
                onClick={() => !active && switchWallet(w.address)}
                disabled={active}
                className={
                  'w-full text-left rounded-md border p-3 transition ' +
                  (active
                    ? 'border-amber-500 bg-amber-100/40 cursor-default'
                    : 'border-amber-200 bg-white hover:border-amber-400 cursor-pointer')
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="num font-medium">{w.label}</span>
                  <div className="flex items-center gap-2">
                    {!w.isWhitelisted && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                        not whitelisted
                      </span>
                    )}
                    {w.isPermissionedLiquidator && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-role-liquidator-bg)] text-[var(--color-role-liquidator)]">
                        keeper
                      </span>
                    )}
                    {active && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                        active
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-amber-900/80 mt-1">{w.persona}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Chain + Core */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Network + contract
        </h2>
        <div>
          <label className="text-sm font-medium block mb-1">Chain</label>
          <select
            value={chainId}
            onChange={e => setChainId(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {CHAINS.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            v1: Uniswap V3 only. Multi-chain on the V3 protocol.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">sLiq Core address</label>
          <input
            type="text"
            value={coreAddress}
            onChange={e => setCoreAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm num font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Override the auto-detected sLiq Core contract for this chain. Stored in localStorage as <code className="font-mono">sliq.coreAddress</code>.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
          <input
            type="checkbox"
            checked={anvilHelper}
            onChange={e => setAnvilHelper(e.target.checked)}
            className="w-4 h-4 accent-gray-700"
          />
          <span>Show Anvil Helper panel</span>
          <span className="text-xs text-gray-500">(local dev only — auto-disabled on mainnet builds)</span>
        </label>

        <button
          type="button"
          onClick={saveCore}
          className="text-sm font-medium px-3 py-2 rounded-md bg-gray-900 text-white hover:opacity-90 transition"
        >
          Save
        </button>
      </section>
    </div>
  )
}
