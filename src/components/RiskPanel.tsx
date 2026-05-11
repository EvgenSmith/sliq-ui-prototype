// RiskPanel — design spec §9.4 + §11.5
// Live, leverage-aware risk surface. 5 rows + expandable explainer.

import { useState } from 'react'
import { fmtUSD } from '@/lib/format'

interface Props {
  context: 'lp-listing' | 'trader-position' | 'preview'
  aggregateReserveUSD: number
  distanceToLiqPct: number
  stress: { label: string; reserveAfter: number; triggers: boolean }[]
  traderClaimsUSD: number
  // For preview-mode (in deposit / open wizard) — show what-if labels
  previewLabel?: string
}

export function RiskPanel({
  context,
  aggregateReserveUSD,
  distanceToLiqPct,
  stress,
  traderClaimsUSD,
  previewLabel,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const reserveColor =
    distanceToLiqPct < 25
      ? 'var(--color-status-danger)'
      : distanceToLiqPct < 50
      ? 'var(--color-status-warning)'
      : 'var(--color-status-success)'

  const heading = context === 'lp-listing'
    ? 'Advanced — listing risk'
    : context === 'trader-position'
    ? 'Position risk'
    : 'Risk preview'

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200">
        <h3 className="text-sm font-semibold text-amber-900">{heading}</h3>
        {previewLabel && (
          <span className="text-xs text-amber-800">{previewLabel}</span>
        )}
      </header>

      <dl className="px-4 py-3 space-y-2 text-sm">
        <Row
          label="Aggregate reserve"
          sub="token0 + token1, USD-equivalent at current pool price"
          value={fmtUSD(aggregateReserveUSD)}
        />
        <Row
          label="Distance to liquidation"
          sub="% of reserve remaining before listing-level liquidation triggers"
          value={
            <span className="num font-medium" style={{ color: reserveColor }}>
              {distanceToLiqPct.toFixed(0)}%
            </span>
          }
        />
        <Row
          label="Stress test ±20% price"
          sub="Reserve remaining if pool price moves +20% / −20% from now"
          value={
            <div className="flex flex-col items-end gap-0.5 text-xs">
              {stress.map(s => (
                <span
                  key={s.label}
                  className={s.triggers ? 'text-[var(--color-status-danger)] num' : 'text-gray-700 num'}
                >
                  {s.label}: {fmtUSD(s.reserveAfter)}
                  {s.triggers && ' · would trigger'}
                </span>
              ))}
            </div>
          }
        />
        <Row
          label="Trader claims at current price"
          sub="Aggregate Reference + Premium owed if every position closed now"
          value={fmtUSD(traderClaimsUSD)}
        />
      </dl>

      <div className="border-t border-amber-200">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left px-4 py-2 text-xs text-amber-900 hover:bg-amber-100/50 transition flex items-center justify-between"
          aria-expanded={expanded}
        >
          <span className="font-medium">What happens if liquidation triggers</span>
          <span className="text-amber-700">{expanded ? '−' : '+'}</span>
        </button>
        {expanded && (
          <div className="px-4 pb-3 text-xs text-amber-900 leading-relaxed">
            Listing-level liquidation runs in three steps: snapshot, batch settle, finalize. The protocol unwinds remaining
            NFT liquidity, builds a liquidation pool, pays trader claims pro-rata, and returns whatever NFT remains to you
            via <code className="font-mono text-[11px] bg-amber-100 px-1 rounded">withdrawLiquidatedNFT</code>. You may receive
            less than your original NFT, or none of it.
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  sub,
  value,
}: {
  label: string
  sub?: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <dt className="text-gray-800">{label}</dt>
        {sub && <span className="text-[11px] text-gray-500 block leading-snug">{sub}</span>}
      </div>
      <dd className="text-right whitespace-nowrap text-gray-900 num font-medium pt-0.5">
        {typeof value === 'string' ? <span className="num">{value}</span> : value}
      </dd>
    </div>
  )
}
