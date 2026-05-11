// StatusBanner — design spec §9.7 + §11.1
// Always-on Alpha context, persistent header. Canonical wording locked.

import { useState } from 'react'

interface Props {
  variant?: 'global' | 'elevated'
}

export function StatusBanner({ variant = 'global' }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={
        variant === 'global'
          ? 'border-b border-[var(--color-beta-border)] bg-[var(--color-beta-bg)] text-[var(--color-beta-text)]'
          : 'rounded-md border border-[var(--color-beta-border)] bg-[var(--color-beta-bg)] text-[var(--color-beta-text)] my-3'
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-2 text-sm flex items-center gap-3">
        <span className="font-semibold tracking-tight">Alpha. Audit pending. Whitelist-only.</span>
        <span className="hidden sm:inline">Don't deposit more than you can afford to lose.</span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-auto text-xs underline decoration-dotted underline-offset-2 hover:opacity-80"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'Why?'}
        </button>
      </div>
      {expanded && (
        <div className="mx-auto max-w-7xl px-4 pb-3 text-xs leading-relaxed border-t border-[var(--color-beta-border)]/60 pt-2">
          No insurance fund. No oracle. Settlement uses live pool price. Reference Fees and Premium APY can settle partial if trader margin runs out.
          <br />
          v1: Uniswap V3 only. Permissioned liquidators during Alpha.
        </div>
      )}
    </div>
  )
}
