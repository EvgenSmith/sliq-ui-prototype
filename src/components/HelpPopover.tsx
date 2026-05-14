// HelpPopover — small ⓘ icon with click-to-expand explanation panel.
// Used for tooltip content that's too long for native title attribute.
// Auto-flips horizontally so it doesn't clip past viewport edges.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  label?: string
  width?: string // tailwind width class
}

type Side = 'left' | 'right'

export function HelpPopover({ children, label = 'More info', width = 'w-80' }: Props) {
  const [open, setOpen] = useState(false)
  // Which edge of the popover we anchor to the icon.
  // 'right' = popover extends LEFT from the icon  (icon near right edge of viewport)
  // 'left'  = popover extends RIGHT from the icon (icon near left edge of viewport)
  const [side, setSide] = useState<Side>('right')
  const ref = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Measure on open: if extending-left would clip past viewport's left edge,
  // flip to extend right. Same in reverse.
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) return
    const iconRect = ref.current.getBoundingClientRect()
    const panelWidth = panelRef.current.offsetWidth
    const viewportW = window.innerWidth
    const padding = 8

    // Try default (extends left). Left edge of panel = iconRect.right - panelWidth.
    const leftWhenExtendingLeft = iconRect.right - panelWidth
    const rightWhenExtendingRight = iconRect.left + panelWidth

    if (leftWhenExtendingLeft < padding && rightWhenExtendingRight < viewportW - padding) {
      setSide('left') // extend right
    } else {
      setSide('right') // extend left (default)
    }
  }, [open])

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(o => !o)
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[11px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-help leading-none"
        aria-label={label}
        aria-expanded={open}
      >
        ⓘ
      </button>
      {open && (
        <div
          ref={panelRef}
          className={
            'absolute top-full mt-1 ' +
            (side === 'right' ? 'right-0 ' : 'left-0 ') +
            width +
            ' max-w-[calc(100vw-1rem)] rounded-md border border-gray-200 bg-white shadow-xl p-3.5 text-xs text-gray-700 leading-relaxed z-50 text-left font-normal normal-case tracking-normal whitespace-normal'
          }
          role="dialog"
        >
          {children}
        </div>
      )}
    </span>
  )
}
