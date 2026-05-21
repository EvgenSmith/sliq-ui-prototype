// TokenAmountInput — shared input for token-denominated amounts.
// Used in:
//   · MarketView MarketActionModal — Open LongPool / Open ShortPool margin form
//   · PositionDetail Manage panel — Add Margin (single-token or both)
//
// Layout: [−] [amount   SYMBOL] [+]   with USD-equivalent below.
// Step buttons round to a sensible per-token step; the input itself accepts
// arbitrary decimals so users can paste exact wallet values.

import { fmtUSD } from '@/lib/format'

interface Props {
  symbol: string
  amount: number
  onChange: (v: number) => void
  usdEquiv: number
  /** Per-step increment for the +/− buttons (e.g. 0.1 ETH, 250 USDC). */
  stepHint: number
  /** Decimal precision for the value shown inside the input. */
  decimals: number
  /** Optional placeholder while empty. */
  placeholder?: string
}

export function TokenAmountInput({
  symbol,
  amount,
  onChange,
  usdEquiv,
  stepHint,
  decimals,
  placeholder,
}: Props) {
  return (
    <div>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, amount - stepHint))}
          className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
          aria-label={`Decrease ${symbol}`}
        >−</button>
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            step={stepHint}
            value={Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(decimals)) : ''}
            placeholder={placeholder ?? '0'}
            onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
            className="w-full pl-3 pr-14 py-2 text-sm font-mono border border-gray-300 rounded focus:border-[var(--color-role-lp)] focus:outline-none transition text-center"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-semibold">{symbol}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(amount + stepHint)}
          className="w-9 rounded border border-gray-300 hover:border-gray-500 text-gray-700 text-base font-bold transition"
          aria-label={`Increase ${symbol}`}
        >+</button>
      </div>
      <div className="mt-0.5 pl-11 text-[10px] num text-gray-500">
        ≈ <span className="text-gray-700 font-medium">{fmtUSD(usdEquiv)}</span>
      </div>
    </div>
  )
}
