// LPFlowSelector — design spec §9.3 + §11.6 S5/S6/S7
// Toggle between Conservative (1×) and Advanced (>1×).
// In "gate" mode (initial entry to Advanced), surfaces a 3-step risk attestation
// before allowing the user to proceed.

import { useState } from 'react'
import type { ProviderMode } from '@/lib/types'

interface Props {
  value: ProviderMode
  onChange: (next: ProviderMode) => void
  // When true, switching to Advanced requires the gate (checkbox + RiskPanel scroll)
  // before the parent can render leverage controls.
  gateOnEnterAdvanced?: boolean
  gateUnlocked?: boolean             // parent supplies after gate completed
  onRequestAdvancedGate?: () => void // parent opens HighStakesConfirmModal
}

export function LPFlowSelector({
  value,
  onChange,
  gateOnEnterAdvanced = true,
  gateUnlocked = false,
  onRequestAdvancedGate,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-gray-300 overflow-hidden">
        <ModeOption
          active={value === 'conservative'}
          accent="var(--color-role-lp)"
          accentBg="var(--color-role-lp-bg)"
          onClick={() => onChange('conservative')}
          label="Conservative"
          tagline="1×"
          desc="Your NFT stays withdrawable."
        />
        <ModeOption
          active={value === 'advanced'}
          accent="oklch(55% 0.15 60)"
          accentBg="oklch(96% 0.04 80)"
          onClick={() => {
            if (gateOnEnterAdvanced && !gateUnlocked && value !== 'advanced') {
              onRequestAdvancedGate?.()
              return
            }
            onChange('advanced')
          }}
          label="Advanced"
          tagline="up to 100×"
          desc="Your NFT becomes collateral."
          badge={gateOnEnterAdvanced && !gateUnlocked ? 'gated' : undefined}
        />
      </div>

      {value === 'conservative' && (
        <p className="text-xs text-gray-600">
          Listing-level liquidation cannot reduce your NFT. Worst case = unpaid Reference/Premium (Reserve absorbs first).
          You can switch to Advanced later.
        </p>
      )}

      {value === 'advanced' && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-medium">Advanced mode active.</span>{' '}
          NFT is collateral on this listing. Listing-level liquidation can reduce or remove it.
          Read the risk panel below before confirming any leverage value.
        </div>
      )}
    </div>
  )
}

function ModeOption({
  active,
  accent,
  accentBg,
  onClick,
  label,
  tagline,
  desc,
  badge,
}: {
  active: boolean
  accent: string
  accentBg: string
  onClick: () => void
  label: string
  tagline: string
  desc: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={'flex-1 px-4 py-3 text-left transition ' + (active ? '' : 'bg-white hover:bg-gray-50')}
      style={active ? { background: accentBg } : undefined}
      aria-pressed={active}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold" style={{ color: active ? accent : 'oklch(20% 0 0)' }}>
          {label}
        </span>
        <span className="text-xs text-gray-500 num">{tagline}</span>
        {badge && (
          <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
    </button>
  )
}
