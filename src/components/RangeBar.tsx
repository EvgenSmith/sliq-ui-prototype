// RangeBar — visual primitive per ТЗ §3.2: shows LP range bounds + current
// price as a centered scale.
//
// Eugene 2026-05-20 v4 — revert to range-relative padding (was briefly
// ±10% normalised window, which broke wide ranges by clamping both dots
// to edges and overlapping labels). Bar now extends 25% past the range on
// each side; current price marker positions naturally within that window.
// When the price is well outside range it clamps to the bar edge but
// won't collide with the bound dots because we still have the 25% margin
// of safety on each side.
//
// Layout:
//                                       ▼ $1.05               ← top-right, colour
//   ●━━━━━━━━━━▼━━━━━━━━━●━━━━                                ← bar with bounds + ▼
//   $0.95 (−8.3%)        $1.16 (+11.1%)                       ← bounds with delta-%
//
// Eugene also asked: «разрадность до 1 цифры после точки» — % labels now
// 1-decimal (was 2). Less visual noise on wide ranges that DO occur in
// mock data but are out-of-distribution for real users.

import { fmtPriceShort } from '@/lib/format'

interface Props {
  rangeLow: number
  rangeHigh: number
  currentPrice: number
  /** Optional «closeness to range center» percentage shown next to the
   *  current-price label as `(NN%)`. Tooltip clarifies semantics. */
  inRangePct?: number
  /** Compact mode — render ONLY the bar (drops top price label + bottom
   *  bound labels). Used inline with adjacent text where the bar is
   *  decoration, not the primary read. Eugene 2026-05-21. */
  compact?: boolean
}

export function RangeBar({ rangeLow, rangeHigh, currentPrice, inRangePct, compact }: Props) {
  const deltaLowPct = ((rangeLow - currentPrice) / currentPrice) * 100
  const deltaHighPct = ((rangeHigh - currentPrice) / currentPrice) * 100

  // Bar visible range = rangeLow .. rangeHigh padded by 25% each side.
  // The current price sits wherever it sits relative to this window.
  const span = rangeHigh - rangeLow
  const padding = span * 0.25
  const scaleStart = rangeLow - padding
  const scaleEnd = rangeHigh + padding
  const scaleSpan = scaleEnd - scaleStart

  const posPct = (v: number) => ((v - scaleStart) / scaleSpan) * 100

  const lowPos = posPct(rangeLow)
  const highPos = posPct(rangeHigh)
  const priceRaw = posPct(currentPrice)
  const priceClamped = Math.max(2, Math.min(98, priceRaw))
  const priceOutsideRange = currentPrice < rangeLow || currentPrice > rangeHigh
  const innerColour = priceOutsideRange ? 'var(--color-status-warning)' : 'var(--color-status-success)'

  return (
    <div className="w-full select-none">
      {/* Top — current price top-right (skipped in compact mode; caller is
          expected to show the price next to the bar inline). Optionally
          shows «closeness to range center» % next to the price. */}
      {!compact && (
        <div className="relative h-4 text-[11px] num">
          <span
            className="absolute right-0 font-semibold whitespace-nowrap"
            style={{ color: innerColour }}
            title={
              inRangePct !== undefined
                ? `Current price: ${fmtPriceShort(currentPrice)} · (${inRangePct}%) — distance from range center (100% = perfectly centered, 0% = at range edge or beyond). Lower numbers mean the LP range is about to flip out-of-range.`
                : `Current price: ${fmtPriceShort(currentPrice)}`
            }
          >
            {fmtPriceShort(currentPrice)}
            {inRangePct !== undefined && (
              <span className="text-gray-500 font-normal ml-1">({inRangePct}%)</span>
            )}
          </span>
        </div>
      )}
      {/* Bar */}
      <div className="relative h-1.5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-200" />
        {/* Inside-range emphasised segment between the two bound dots. */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            left: `${lowPos}%`,
            width: `${highPos - lowPos}%`,
            background: innerColour,
          }}
        />
        {/* Range bound dots. */}
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
        {/* Current price marker — ▼ raised above the bar so the glyph
            tip sits at the bar's top edge instead of overlapping the
            inside-range segment (Eugene 2026-05-20). Clamped to [2,98]. */}
        <span
          className="absolute -top-3 -translate-x-1/2 text-[10px] leading-none"
          style={{ left: `${priceClamped}%`, color: innerColour }}
          aria-label={`Current price ${fmtPriceShort(currentPrice)}`}
        >
          ▼
        </span>
      </div>
      {/* Bottom — range bounds with delta-% (1-decimal precision). Compact
          mode keeps these (only the top price-label gets dropped). Eugene
          2026-05-21 v2: «над таббаром только ползунок» = no top label, but
          bottom bounds stay so the user can still read the range. */}
      <div className="relative h-4 text-[10px] num text-gray-700 mt-0.5">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${lowPos}%` }}
        >
          <span className="font-medium">{fmtPriceShort(rangeLow)}</span>
          <span className="text-gray-400"> ({deltaLowPct >= 0 ? '+' : '−'}{Math.abs(deltaLowPct).toFixed(1)}%)</span>
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${highPos}%` }}
        >
          <span className="font-medium">{fmtPriceShort(rangeHigh)}</span>
          <span className="text-gray-400"> ({deltaHighPct >= 0 ? '+' : '−'}{Math.abs(deltaHighPct).toFixed(1)}%)</span>
        </span>
      </div>
      <span className="sr-only">{`Range ${fmtPriceShort(rangeLow)} to ${fmtPriceShort(rangeHigh)}, current ${fmtPriceShort(currentPrice)}`}</span>
    </div>
  )
}
