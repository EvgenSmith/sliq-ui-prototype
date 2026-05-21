// Display formatters. Use tabular numerals (.num class) for alignment in tables.

export function fmtUSD(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? '+' : ''
  if (Math.abs(n) >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${sign}$${(n / 1_000).toFixed(1)}K`
  return `${sign}$${n.toFixed(2)}`
}

export function fmtUSDExact(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function fmtPct(bps: number, opts: { signed?: boolean; decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 1
  const v = bps / 100
  const sign = opts.signed && v > 0 ? '+' : ''
  return `${sign}${v.toFixed(decimals)}%`
}

export function fmtPctRaw(pct: number, opts: { signed?: boolean; decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 1
  const sign = opts.signed && pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(decimals)}%`
}

export function fmtRange(lo: number, hi: number): string {
  return `$${Math.round(lo).toLocaleString()} – $${Math.round(hi).toLocaleString()}`
}

// Compact raw-price formatter for the RangeBar primitive. Sub-$1 token pairs
// (e.g. 0.95) need 4 decimals; mid-range pairs need 2; thousands USD pairs
// strip decimals. Used above/below the centered range scale labels.
export function fmtPriceShort(n: number): string {
  if (n >= 10_000) return Math.round(n).toLocaleString()
  if (n >= 100) return n.toFixed(0)
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

export function fmtFeeTier(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`.replace(/\.?0+%$/, '%').replace(/\.?0+$/, '')
}

export function fmtTimeAgo(unixMs: number): string {
  const diff = Date.now() - unixMs
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Token amount — adapts decimals to magnitude. Sub-1 → 4dp; <1k → 2dp; ≥1k → "1.2K" style.
export function fmtToken(n: number, symbol: string): string {
  const abs = Math.abs(n)
  let body: string
  if (abs >= 1_000_000) body = `${(n / 1_000_000).toFixed(2)}M`
  else if (abs >= 1_000) body = `${(n / 1_000).toFixed(1)}K`
  else if (abs >= 1) body = n.toFixed(2)
  else if (abs >= 0.01) body = n.toFixed(4)
  else body = n.toPrecision(2)
  return `${body} ${symbol}`
}

export function isInRange(price: number, lo: number, hi: number): boolean {
  return price >= lo && price <= hi
}
