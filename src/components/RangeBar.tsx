// RangeBar — visual primitive per ТЗ §3.2: centered range scale showing
// LP range bounds + current price relative to them. The bar extends slightly
// beyond the range bounds because the current price CAN sit outside the
// range (out-of-range listings are still tradeable / waiting for re-entry).
//
// Eugene 2026-05-20 v2 layout:
//             ▼ $1.05               ← current price ABOVE the bar, in colour,
//                                     positioned over the marker (▼ glyph)
//   ●━━━━━━━━━━━━━━━━━●━━           ← bar with range bound dots + ▼ at price
//   $0.95 (−8.34%)   $1.16 (+11.06%) ← range bounds BELOW, raw + delta in ()
//
// Reused on:
//   - Trader marketplace listing rows (this commit)
//   - Live position monitoring (per ТЗ §7.3)

import { fmtPriceShort } from '@/lib/format'

interface Props {
  rangeLow: number
  rangeHigh: number
  currentPrice: number
}

export function RangeBar({ rangeLow, rangeHigh, currentPrice }: Props) {
  // Compute % delta from current price to each bound
  const deltaLowPct = ((rangeLow - currentPrice) / currentPrice) * 100   // typically negative
  const deltaHighPct = ((rangeHigh - currentPrice) / currentPrice) * 100 // typically positive

  // Layout math: we paint a horizontal scale that extends 25% beyond the
  // range on each side so the marker can sit slightly outside without falling
  // off the bar.
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

  // Inside-range region of the bar gets emphasised colour; padding stays gray.
  const innerColour = priceOutsideRange ? 'var(--color-status-warning)' : 'var(--color-status-success)'

  // Above-bar label clamp: keep the «▼ $current» label inside the [0, 100]
  // range so it never escapes the column on the sides.
  const labelClamped = Math.max(8, Math.min(92, priceRaw))

  return (
    <div className="w-full select-none">
      {/* Top — current price floating over its marker, in colour. */}
      <div className="relative h-4 text-[11px] num">
        <span
          className="absolute -translate-x-1/2 font-semibold whitespace-nowrap"
          style={{ left: `${labelClamped}%`, color: innerColour }}
          title={`Current price: ${fmtPriceShort(currentPrice)}`}
        >
          ▼ {fmtPriceShort(currentPrice)}
        </span>
      </div>
      {/* Bar */}
      <div className="relative h-1.5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            left: `${lowPos}%`,
            width: `${highPos - lowPos}%`,
            background: innerColour,
          }}
        />
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
      </div>
      {/* Bottom — range bounds with delta-% in parens. */}
      <div className="relative h-4 text-[10px] num text-gray-700 mt-0.5">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${lowPos}%` }}
        >
          <span className="font-medium">{fmtPriceShort(rangeLow)}</span>
          <span className="text-gray-400"> ({deltaLowPct >= 0 ? '+' : '−'}{Math.abs(deltaLowPct).toFixed(2)}%)</span>
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${highPos}%` }}
        >
          <span className="font-medium">{fmtPriceShort(rangeHigh)}</span>
          <span className="text-gray-400"> ({deltaHighPct >= 0 ? '+' : '−'}{Math.abs(deltaHighPct).toFixed(2)}%)</span>
        </span>
      </div>
      {/* Reserve some horizontal padding so endpoint labels don't clip when
          they extend past the column edges (they're positioned absolutely
          based on the dot positions, then -translate-x-1/2 centres them). */}
      <span className="sr-only">{`Range ${fmtPriceShort(rangeLow)} to ${fmtPriceShort(rangeHigh)}, current ${fmtPriceShort(currentPrice)}, marker at ${priceClamped.toFixed(0)}% of visible scale`}</span>
    </div>
  )
}
