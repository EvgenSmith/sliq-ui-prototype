// RangeBar — visual primitive per ТЗ §3.2: shows LP range bounds + current
// price as a centered scale. Bar extends slightly beyond the range so the
// marker can sit outside without overflowing.
//
// Eugene 2026-05-20 v3 layout:
//                                              ▼ $1.05      ← top-right, colour
//   ●━━━━━━━━━━━━━━━━━●━━                                   ← bar with bounds + ▼
//   $0.95 (−8.34%)   $1.16 (+11.06%)                       ← bounds with delta-%
//
// Visual scale is ALWAYS ±10% from current price (Eugene 2026-05-20:
// «% под прогрессбаром не должны быть больше 10% в среднем»). Range bounds
// outside that window clamp to the bar edges; the label still shows the
// actual delta-%.

import { fmtPriceShort } from '@/lib/format'

interface Props {
  rangeLow: number
  rangeHigh: number
  currentPrice: number
}

// Visible half-window — bar always shows current ± this fraction.
// 0.10 = ±10%. Tight ranges fit comfortably; wide ranges clamp to edges.
const VISIBLE_HALF_WINDOW = 0.10

export function RangeBar({ rangeLow, rangeHigh, currentPrice }: Props) {
  const deltaLowPct = ((rangeLow - currentPrice) / currentPrice) * 100
  const deltaHighPct = ((rangeHigh - currentPrice) / currentPrice) * 100

  // Visible scale: ±VISIBLE_HALF_WINDOW from currentPrice. Current price
  // is by construction at the center (50%) of the bar.
  const scaleStart = currentPrice * (1 - VISIBLE_HALF_WINDOW)
  const scaleEnd = currentPrice * (1 + VISIBLE_HALF_WINDOW)
  const scaleSpan = scaleEnd - scaleStart

  // Map a price to a % position on the bar, then clamp to [0, 100] so dots
  // never visually exit the grey track. Labels still show actual delta-%
  // even when the dot is clamped at the edge.
  const posPct = (v: number) => {
    const raw = ((v - scaleStart) / scaleSpan) * 100
    return Math.max(0, Math.min(100, raw))
  }
  const lowPos = posPct(rangeLow)
  const highPos = posPct(rangeHigh)
  const priceOutsideRange = currentPrice < rangeLow || currentPrice > rangeHigh
  const innerColour = priceOutsideRange ? 'var(--color-status-warning)' : 'var(--color-status-success)'

  return (
    <div className="w-full select-none">
      {/* Top — current price top-right, fixed (Eugene 2026-05-20: «цену
          текущую над Range показываем всегда справа вверху»). */}
      <div className="relative h-4 text-[11px] num">
        <span
          className="absolute right-0 font-semibold whitespace-nowrap"
          style={{ color: innerColour }}
          title={`Current price: ${fmtPriceShort(currentPrice)}`}
        >
          ▼ {fmtPriceShort(currentPrice)}
        </span>
      </div>
      {/* Bar */}
      <div className="relative h-1.5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-200" />
        {/* Inside-range emphasised segment — between the two clamped dots. */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            left: `${Math.min(lowPos, highPos)}%`,
            width: `${Math.abs(highPos - lowPos)}%`,
            background: innerColour,
          }}
        />
        {/* Range bound dots — clamped to bar edges. */}
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
      <span className="sr-only">{`Range ${fmtPriceShort(rangeLow)} to ${fmtPriceShort(rangeHigh)}, current ${fmtPriceShort(currentPrice)}`}</span>
    </div>
  )
}
