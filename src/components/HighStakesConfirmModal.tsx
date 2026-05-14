// HighStakesConfirmModal — design spec §9.1 + §11.3
// Single reusable component for irreversible / high-stakes actions.
// 5 instantiations spec'd: Switch-to-Advanced, Update-Leverage, Request-Close, Request-Withdraw, Outbid.

import { useEffect, useState } from 'react'

export interface KeyValue {
  label: string
  value: React.ReactNode
}

export interface KeyValueWithDelta extends KeyValue {
  deltaTone?: 'positive' | 'negative' | 'neutral'
}

export interface HighStakesConfirmModalProps {
  open: boolean
  title: string
  subtitle: string                       // why this is high-stakes
  currentState: KeyValue[]
  newState: KeyValueWithDelta[]
  risks: string[]
  irreversibilityNote: string
  confirmType: 'checkbox' | 'type-to-confirm'
  typeWord?: string                      // required if confirmType === 'type-to-confirm'
  confirmButtonLabel: string             // e.g. "Confirm — Switch to Advanced"
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  // Optional pre-comparison slot — for actions where the user must ACTUALLY
  // configure the new value (slider / input) before the before/after preview
  // makes sense. Used by Update Leverage + Update Min Premium APY where the
  // generic confirm modal alone is insufficient (Eugene 2026-05-15: «тут
  // нельзя настроить плечо… нельзя поменять Premium APY»).
  topSlot?: React.ReactNode
}

export function HighStakesConfirmModal(props: HighStakesConfirmModalProps) {
  const {
    open,
    title,
    subtitle,
    currentState,
    newState,
    risks,
    irreversibilityNote,
    confirmType,
    typeWord,
    confirmButtonLabel,
    onConfirm,
    onCancel,
    topSlot,
  } = props

  const [checkbox, setCheckbox] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCheckbox(false)
      setTyped('')
      setBusy(false)
    }
  }, [open])

  // ESC to cancel
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const canConfirm =
    confirmType === 'checkbox' ? checkbox : typed.trim().toUpperCase() === (typeWord ?? '').toUpperCase()

  async function handleConfirm() {
    if (!canConfirm) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hsmodal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 id="hsmodal-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </header>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Optional inputs — slider / number-input for actions that need the
              user to set the new value before the comparison reads correctly. */}
          {topSlot && (
            <div className="pb-2 border-b border-gray-100">
              {topSlot}
            </div>
          )}

          {/* Current vs After */}
          <div className="grid grid-cols-2 gap-3">
            <KvBlock title="Current state" entries={currentState} tone="neutral" />
            <KvBlock title="After this action" entries={newState} tone="next" />
          </div>

          {/* Risks */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              What you're accepting
            </h3>
            <ul className="space-y-1 text-sm text-gray-800">
              {risks.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Irreversibility */}
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">Irreversibility: </span>
            {irreversibilityNote}
          </div>

          {/* Confirm input */}
          <div className="pt-1">
            {confirmType === 'checkbox' ? (
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkbox}
                  onChange={e => setCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[var(--color-role-trader)]"
                />
                <span>I understand.</span>
              </label>
            ) : (
              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Type <code className="font-mono font-semibold bg-gray-100 px-1.5 py-0.5 rounded">{typeWord}</code> to confirm
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={typeWord}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--color-role-trader)]/30"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className={
              'ml-auto text-sm font-semibold px-4 py-2 rounded-md transition ' +
              (canConfirm && !busy
                ? 'bg-[var(--color-status-danger)] text-white hover:opacity-90'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed')
            }
          >
            {busy ? 'Submitting…' : confirmButtonLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}

function KvBlock({
  title,
  entries,
  tone,
}: {
  title: string
  entries: KeyValue[] | KeyValueWithDelta[]
  tone: 'neutral' | 'next'
}) {
  return (
    <div
      className={
        'rounded-md border p-3 ' +
        (tone === 'neutral'
          ? 'border-gray-200 bg-gray-50'
          : 'border-amber-300 bg-amber-50/60')
      }
    >
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {title}
      </h4>
      <dl className="space-y-1 text-xs">
        {entries.map((e, i) => {
          const delta = (e as KeyValueWithDelta).deltaTone
          const color = delta === 'negative' ? 'var(--color-status-danger)'
            : delta === 'positive' ? 'var(--color-status-success)'
            : undefined
          return (
            <div key={i} className="flex justify-between gap-2">
              <dt className="text-gray-600">{e.label}</dt>
              <dd className="text-right font-medium num" style={color ? { color } : undefined}>
                {e.value}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
