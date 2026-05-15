// StatusBanner — design spec §9.7 + §11.1
// Always-on Beta context, persistent header. Canonical wording locked.

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
      <div className="mx-auto max-w-7xl px-4 py-2 text-sm flex items-center gap-3 min-w-0">
        {/* Single truncating line — full sentence visible whenever it fits,
            otherwise cut by ellipsis. Eugene 2026-05-15: «пусть обрезается,
            если не влезает на экран». Was `hidden sm:inline` which dropped
            the second half entirely on mobile. */}
        <span className="truncate flex-1 min-w-0">
          <span className="font-semibold tracking-tight">Beta version. Audit pending.</span>{' '}
          <span>Don't deposit more than you can afford to lose.</span>
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-xs underline decoration-dotted underline-offset-2 hover:opacity-80"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'Why?'}
        </button>
      </div>
      {expanded && (
        <div className="mx-auto max-w-7xl px-4 pb-3 text-xs leading-relaxed border-t border-[var(--color-beta-border)]/60 pt-2">
          No oracle. Settlement uses live pool price. Reference Fees and Premium APY can settle partial if trader margin runs out.
          <br />
          v1: Uniswap V3 only. Permissioned liquidators during Beta.
        </div>
      )}
    </div>
  )
}
