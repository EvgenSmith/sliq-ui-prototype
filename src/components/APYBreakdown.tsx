// APYBreakdown — design spec §9.6 + §11.6
// STRICT RULE: Realized vs Pending always split. Never summed in a hero number.
// Negative Premium APY (per §12) renders with negative-apy color and "you pay" framing.

import { fmtPct } from '@/lib/format'

interface Props {
  // Realized streams (claimable / settled)
  uniswapApyBps: number
  refRealizedApyBps?: number
  premRealizedApyBps?: number
  // Pending streams (accruing, settles on close)
  refPendingApyBps?: number
  premPendingApyBps?: number
  layout?: 'stacked' | 'compact'
  // For LP-side: indicates this is a listing's posture, where negative Premium = LP pays
  perspective?: 'lp' | 'trader'
}

export function APYBreakdown({
  uniswapApyBps,
  refRealizedApyBps,
  premRealizedApyBps,
  refPendingApyBps,
  premPendingApyBps,
  layout = 'stacked',
  perspective = 'lp',
}: Props) {
  const compact = layout === 'compact'

  const isPremNegative =
    (premRealizedApyBps !== undefined && premRealizedApyBps < 0) ||
    (premPendingApyBps !== undefined && premPendingApyBps < 0)

  return (
    <div className={compact ? 'flex flex-wrap gap-x-4 gap-y-1 text-xs' : 'space-y-1.5 text-sm'}>
      {/* Realized */}
      <Row
        label={compact ? 'Uni' : 'Uniswap APY'}
        value={fmtPct(uniswapApyBps)}
        kind="realized"
        compact={compact}
        sublabel={!compact ? 'real fees on 1% tracking — claimable' : undefined}
      />
      {refRealizedApyBps !== undefined && (
        <Row
          label={compact ? 'Ref (paid)' : 'Reference APY'}
          value={fmtPct(refRealizedApyBps)}
          kind="realized"
          compact={compact}
          sublabel={!compact ? 'realized — paid in last closes' : undefined}
        />
      )}
      {premRealizedApyBps !== undefined && (
        <Row
          label={compact ? 'Prem (paid)' : 'Premium APY'}
          value={fmtPct(premRealizedApyBps, { signed: true })}
          kind="realized"
          isNegative={premRealizedApyBps < 0}
          compact={compact}
          sublabel={
            !compact
              ? premRealizedApyBps < 0
                ? perspective === 'lp'
                  ? 'realized — you paid traders this carry'
                  : 'realized — you received this from LP'
                : 'realized — paid in last closes'
              : undefined
          }
        />
      )}

      {/* Pending */}
      {(refPendingApyBps !== undefined || premPendingApyBps !== undefined) && !compact && (
        <div className="border-t border-gray-200 pt-1.5 mt-2 text-[11px] uppercase tracking-wide text-gray-500">
          Pending — settles on close
        </div>
      )}
      {refPendingApyBps !== undefined && (
        <Row
          label={compact ? 'Ref (acc)' : 'Reference APY'}
          value={fmtPct(refPendingApyBps)}
          kind="pending"
          compact={compact}
          sublabel={!compact ? 'accruing on open positions' : undefined}
        />
      )}
      {premPendingApyBps !== undefined && (
        <Row
          label={compact ? 'Prem (acc)' : 'Premium APY'}
          value={fmtPct(premPendingApyBps, { signed: true })}
          kind="pending"
          isNegative={premPendingApyBps < 0}
          compact={compact}
          sublabel={
            !compact
              ? premPendingApyBps < 0
                ? perspective === 'lp'
                  ? 'accruing — you pay traders this carry'
                  : 'accruing — you receive this from LP'
                : 'accruing — set by auction'
              : undefined
          }
        />
      )}

      {!compact && (
        <p className="text-[11px] text-gray-500 pt-1">
          Pending values may settle partial if trader margin runs out.
          {isPremNegative && (
            <>
              {' '}
              {perspective === 'lp'
                ? 'Negative Premium = you subsidize traders to take this listing.'
                : 'Negative Premium = LP pays you to take this exposure.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  kind,
  isNegative,
  compact,
  sublabel,
}: {
  label: string
  value: string
  kind: 'realized' | 'pending'
  isNegative?: boolean
  compact: boolean
  sublabel?: string
}) {
  const color = isNegative
    ? 'var(--color-negative-apy)'
    : kind === 'realized'
    ? 'var(--color-status-success)'
    : 'oklch(35% 0 0)'

  if (compact) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="text-gray-500">{label}</span>
        <span className="num font-medium" style={{ color }}>
          {value}
        </span>
      </span>
    )
  }

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-gray-700 min-w-[7.5rem]">{label}</span>
      <span className="num font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
      {sublabel && <span className="text-xs text-gray-500">{sublabel}</span>}
    </div>
  )
}
