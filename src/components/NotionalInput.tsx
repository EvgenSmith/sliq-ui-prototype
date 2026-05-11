// NotionalInput — design spec §9.5
// Replaces raw uint128 liquidity input. Bidirectional preview between token0 / token1 / USD.
// Raw liquidity surfaced as read-only derived line.

import { useMemo, useState } from 'react'

type Mode = 'token0' | 'token1' | 'USD'

interface Props {
  pair: { token0: string; token1: string }
  currentPrice: number      // token1 per token0
  feeTierBps: number
  // For LP-side preview: pass tracking liquidity capacity ($)
  // For Trader open: pass available capacity ($)
  capacityUSD?: number
  value: number             // amount in current mode
  mode: Mode
  onChange: (next: { mode: Mode; amount: number }) => void
  label?: string
  helper?: string
  error?: string
}

export function NotionalInput({
  pair,
  currentPrice,
  capacityUSD,
  value,
  mode,
  onChange,
  label = 'Position size',
  helper = 'Enter the size you want to long-gamma. We convert this to liquidity units for you.',
  error,
}: Props) {
  // Derive equivalents
  const equivalents = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) {
      return { token0: 0, token1: 0, usd: 0, liquidity: 0 }
    }
    let usd = 0
    if (mode === 'USD') usd = value
    else if (mode === 'token0') usd = value * currentPrice
    else usd = value
    // Pseudo-liquidity for display (real calc would use V3 math).
    // For prototype, show a pseudo value scaled to USD.
    const liquidity = Math.round(usd * 31.622776) // rough scale to feel like uint128
    return {
      token0: usd / currentPrice,
      token1: usd,
      usd,
      liquidity,
    }
  }, [value, mode, currentPrice])

  const overCapacity = capacityUSD !== undefined && equivalents.usd > capacityUSD

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        <ModeToggle
          pair={pair}
          mode={mode}
          onChange={next => {
            // Convert current value to new mode
            let newAmount = value
            if (mode === next) return
            if (mode === 'USD' && next === 'token0') newAmount = value / currentPrice
            else if (mode === 'USD' && next === 'token1') newAmount = value
            else if (mode === 'token0' && next === 'USD') newAmount = value * currentPrice
            else if (mode === 'token0' && next === 'token1') newAmount = value * currentPrice
            else if (mode === 'token1' && next === 'USD') newAmount = value
            else if (mode === 'token1' && next === 'token0') newAmount = value / currentPrice
            onChange({ mode: next, amount: newAmount })
          }}
        />
      </div>

      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange({ mode, amount: Number(e.target.value) })}
          placeholder="0"
          className={
            'w-full rounded-md border bg-white px-3 py-2.5 text-base num font-medium ' +
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-role-trader)]/30 ' +
            (error || overCapacity
              ? 'border-[var(--color-status-danger)]'
              : 'border-gray-300')
          }
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          {mode === 'USD' ? 'USD' : mode === 'token0' ? pair.token0 : pair.token1}
        </span>
      </div>

      {/* Bidirectional preview */}
      {value > 0 && (
        <div className="mt-2 text-xs text-gray-600 space-y-1 num">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">≈</span>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end">
              {mode !== 'USD' && (
                <span>
                  ${equivalents.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              )}
              {mode !== 'token0' && (
                <span>
                  {equivalents.token0.toLocaleString('en-US', { maximumFractionDigits: 4 })} {pair.token0}
                </span>
              )}
              {mode !== 'token1' && (
                <span>
                  {equivalents.token1.toLocaleString('en-US', { maximumFractionDigits: 0 })} {pair.token1}
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between">
            <span>Liquidity (uint128)</span>
            <span>≈ {equivalents.liquidity.toLocaleString()}</span>
          </div>
          {capacityUSD !== undefined && (
            <div className="text-[11px] text-gray-500 flex items-center justify-between">
              <span>Of available capacity</span>
              <span>
                ${capacityUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status row */}
      {(error || overCapacity || helper) && (
        <p
          className={
            'mt-2 text-xs ' +
            (error || overCapacity ? 'text-[var(--color-status-danger)]' : 'text-gray-500')
          }
        >
          {error
            ? error
            : overCapacity
            ? `Over available capacity. Reduce size or pick another listing.`
            : helper}
        </p>
      )}
    </div>
  )
}

function ModeToggle({
  pair,
  mode,
  onChange,
}: {
  pair: { token0: string; token1: string }
  mode: Mode
  onChange: (next: Mode) => void
}) {
  const opts: { id: Mode; label: string }[] = [
    { id: 'token0', label: pair.token0 },
    { id: 'token1', label: pair.token1 },
    { id: 'USD', label: 'USD' },
  ]
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
      {opts.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            'px-2 py-1 transition ' +
            (o.id === mode
              ? 'bg-gray-900 text-white font-medium'
              : 'bg-white text-gray-600 hover:bg-gray-50')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
