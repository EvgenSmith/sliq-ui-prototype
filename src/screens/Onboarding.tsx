// S1 Onboarding — design spec §8 S1 + §11.9
// Role picker + 1-page mental model + risk attestation.
// First-run experience post-whitelist-clear.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Role } from '@/lib/types'

const ROLES: { id: Exclude<Role, 'All' | 'Liquidator'>; label: string; tagline: string; accent: string; bg: string }[] = [
  {
    id: 'LP',
    label: 'LP NFT Provider',
    tagline: 'I hold a Uniswap V3 LP NFT and want extra yield.',
    accent: 'var(--color-role-lp)',
    bg: 'var(--color-role-lp-bg)',
  },
  {
    id: 'Trader',
    label: 'ShortPool Trader',
    tagline: 'I want long-gamma exposure on a specific V3 range.',
    accent: 'var(--color-role-trader)',
    bg: 'var(--color-role-trader-bg)',
  },
]

export function Onboarding() {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Set<Role>>(new Set(['LP']))
  const [accepted, setAccepted] = useState(false)

  function toggleRole(id: Role) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  function complete() {
    if (!accepted || picked.size === 0) return
    // Persist the most-relevant initial mode
    const initial: Role = picked.has('LP') ? 'LP' : 'Trader'
    localStorage.setItem('sliq.activeRole', initial)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Welcome to sLiq Beta version</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          A market for Uniswap V3 liquidity. LP NFT owners list their position; traders bid APY to take impermanent-profit
          exposure. No oracle. No insurance fund. Settlement via market liquidators.
        </p>
      </header>

      {/* Step 1 — Mental model */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          1. The product, in one paragraph
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Deposit a Uniswap V3 LP NFT into sLiq. 1% of the liquidity stays in the pool as a price probe; the other 99%
          becomes a market where traders bid APY for the right to capture impermanent profit. You earn three streams:
          real Uniswap fees on the 1%, Reference Fees synthesized from trader carry, and a Premium APY set by auction.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          On the other side, traders post two-token margin, get up to 1000× leverage on the impermanent-profit payoff,
          and pay LP the carry until they close. Buyout lets a new trader outbid an active position. Settlement happens
          at the actual pool price via Uniswap SwapRouter — there is no oracle.
        </p>
      </section>

      {/* Step 2 — Role pick */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          2. Which role describes you?
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Pick one or both. You can switch modes anytime via the role badge in the header.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map(r => {
            const active = picked.has(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRole(r.id)}
                className={
                  'text-left rounded-lg border p-4 transition ' +
                  (active ? 'border-2 shadow-sm' : 'border border-gray-200 bg-white hover:border-gray-300')
                }
                style={active ? { borderColor: r.accent, background: r.bg } : undefined}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: active ? r.accent : 'inherit' }}>
                    {r.label}
                  </span>
                  {active && (
                    <span style={{ color: r.accent }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M2 8l4 4 8-8" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{r.tagline}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Step 3 — Risk attestation */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          3. Beta acknowledgements
        </h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 leading-relaxed">
          <p className="mb-2 font-medium">By continuing you acknowledge:</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex gap-2">
              <span className="text-amber-700">•</span>
              <span>sLiq is in <strong>closed Beta</strong>. Smart contracts are <strong>audit-pending</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-700">•</span>
              <span>There is <strong>no insurance fund</strong>. Reference and Premium APY can settle partial if a trader's margin runs out.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-700">•</span>
              <span>There is <strong>no oracle</strong>. Settlement uses live Uniswap pool price; multi-block MEV is a real risk.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-700">•</span>
              <span>v1 supports <strong>Uniswap V3 only</strong> (no V4, V2, Bunni, Maverick). Multi-chain on the V3 protocol only.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-700">•</span>
              <span>If you set <strong>Provider Leverage &gt; 1×</strong>, your LP NFT becomes collateral and can be partially or fully liquidated.</span>
            </li>
          </ul>
          <label className="mt-4 pt-3 border-t border-amber-300 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-700"
            />
            <span className="text-sm font-medium">
              I understand. Don't deposit more than I can afford to lose.
            </span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={complete}
          disabled={!accepted || picked.size === 0}
          className={
            'text-sm font-semibold px-4 py-2 rounded-md transition ' +
            (accepted && picked.size > 0
              ? 'bg-gray-900 text-white hover:opacity-90'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed')
          }
        >
          Enter sLiq →
        </button>
        <span className="text-xs text-gray-500">
          {picked.size === 0
            ? 'Pick at least one role.'
            : !accepted
            ? 'Tick the acknowledgement to continue.'
            : 'You can change roles anytime via the header badge.'}
        </span>
      </div>
    </div>
  )
}
