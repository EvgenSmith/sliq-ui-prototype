// RangeBar — visual primitive per ТЗ §3.2: centered range scale showing
// LP range bounds + current price relative to them. The bar extends slightly
// beyond the range bounds because the current price CAN sit outside the
// range (out-of-range listings are still tradeable / waiting for re-entry).
//
// Eugene reference (2026-05-20):
//   0.9531           1.1549            ← raw prices above endpoints
//   ●━━━━━━▼━━━━━━●━━                  ← bar with range dots + price marker
//   −8.34%           +11.06%           ← delta-from-current below endpoints
//
// Reused on:
//   - Trader marketplace listing rows (this commit)
//   - Live position monitoring (per ТЗ §7.3)

import { fmtPriceShort } from '@/lib/format'

interface Props {
  rangeLow: number
  rangeHigh: number
  currentPrice: number
  /** Compact mode: hide raw prices above, only show ± labels. */
  compact?: boolean
  /** Show raw prices above the endpoints (default true unless compact). */
  showPrices?: boolean
}

export function RangeBar({ rangeLow, rangeHigh, currentPrice, compact = false, showPrices }: Props) {
  const showRawPrices = showPrices ?? !compact

  // Compute % delta from current price to each bound
  const deltaLowPct = ((rangeLow - currentPrice) / currentPrice) * 100   // typically negative
  const deltaHighPct = ((rangeHigh - currentPrice) / currentPrice) * 100 // typically positive

  // Layout math: we paint a horizontal scale that extends 25% beyond the
  // range on each side so the marker can sit slightly outside without falling
  // off the bar. The marker (current price) is conceptually at 50% of the
  // VISIBLE scale when price = midpoint of range. We map [rangeLow..rangeHigh]
  // onto [scaleStart..scaleEnd] linearly.
  const span = rangeHigh - rangeLow
  const padding = span * 0.25
  const scaleStart = rangeLow - padding
  const scaleEnd = rangeHigh + padding
  const scaleSpan = scaleEnd - scaleStart

  const posPct = (v: number) => ((v - scaleStart) / scaleSpan) * 100

  const lowPos = posPct(rangeLow)
  const highPos = posPct(rangeHigh)
  const priceRaw = posPct(currentPrice)
  const priceClamped = Math.max(2, Math.min(98, priceRaw)) // visual clamp so marker stays on bar
  const priceOutsideRange = currentPrice < rangeLow || currentPrice > rangeHigh

  // Inside-range region of the bar gets emphasized colour; padding stays gray.
  const innerColour = priceOutsideRange ? 'var(--color-status-warning)' : 'var(--color-status-success)'

  return (
    <div className="w-full select-none">
      {showRawPrices && (
        <div className="relative h-4 text-[10px] num text-gray-700">
          <span className="absolute -translate-x-1/2 font-medium" style={{ left: `${lowPos}%` }}>{fmtPriceShort(rangeLow)}</span>
          <span className="absolute -translate-x-1/2 font-medium" style={{ left: `${highPos}%` }}>{fmtPriceShort(rangeHigh)}</span>
        </div>
      )}
      <div className="relative h-1.5">
        {/* Full track (gray background = padding outside range) */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-200" />
        {/* Inside-range emphasised segment */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            left: `${lowPos}%`,
            width: `${highPos - lowPos}%`,
            background: innerColour,
          }}
        />
        {/* Range bound dots */}
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ left: `${lowPos}%`, background: innerColour }}
          aria-hidden
        />
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ left: `${highPos}%`, background: innerColour }}
          aria-hidden
        />
        {/* Current price marker — yellow ▼ triangle above the bar */}
        <span
          className="absolute -top-1 -translate-x-1/2 text-[10px] leading-none"
          style={{ left: `${priceClamped}%`, color: 'var(--color-status-warning)' }}
          aria-label={`Current price ${fmtPriceShort(currentPrice)}`}
          title={`Current price: ${fmtPriceShort(currentPrice)}`}
        >
          ▼
        </span>
      </div>
      <div className="relative h-4 text-[10px] num text-gray-500 mt-0.5">
        <span className="absolute -translate-x-1/2" style={{ left: `${lowPos}%` }}>{deltaLowPct >= 0 ? '+' : '−'}{Math.abs(deltaLowPct).toFixed(2)}%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${highPos}%` }}>{deltaHighPct >= 0 ? '+' : '−'}{Math.abs(deltaHighPct).toFixed(2)}%</span>
      </div>
    </div>
  )
}
