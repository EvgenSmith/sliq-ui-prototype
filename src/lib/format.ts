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

export function isInRange(price: number, lo: number, hi: number): boolean {
  return price >= lo && price <= hi
}
