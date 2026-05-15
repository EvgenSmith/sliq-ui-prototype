// HelpPopover — small ⓘ icon with click-to-expand explanation panel.
// Used for tooltip content that's too long for native title attribute.
// Auto-clamps horizontally to viewport so it never clips on narrow screens.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  label?: string
  width?: string // tailwind width class
  // Icon visual size. Defaults to `md` (18×18). Use `lg` (22×22 with text-base
  // glyph) when the icon sits next to body-text labels where the default
  // looks too small (e.g., mobile card next to pair name).
  size?: 'md' | 'lg'
}

export function HelpPopover({ children, label = 'More info', width = 'w-80', size = 'md' }: Props) {
  const [open, setOpen] = useState(false)
  // Pixel offset of the panel's left edge relative to the icon's left edge.
  // Computed on open so the panel always stays inside the viewport regardless of
  // where the icon sits. Fixes mobile clipping where neither «extend-left» nor
  // «extend-right» fit the full panel (Eugene 2026-05-15 — tooltip popping off
  // screen on narrow viewport).
  const [offsetX, setOffsetX] = useState<number | null>(null)
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

  // Measure on open: clamp panel so it stays inside [padding, viewportW - padding].
  // Falls back to side-aware default while measuring (first render before useLayoutEffect).
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) {
      setOffsetX(null)
      return
    }
    const iconRect = ref.current.getBoundingClientRect()
    const panelWidth = panelRef.current.offsetWidth
    const viewportW = window.innerWidth
    const padding = 8

    // Ideal: center panel under icon
    const idealLeftViewport = iconRect.left + iconRect.width / 2 - panelWidth / 2
    // Clamp to viewport
    const clampedLeftViewport = Math.max(
      padding,
      Math.min(idealLeftViewport, viewportW - panelWidth - padding),
    )
    // Convert to offset relative to icon (so absolute positioning works)
    setOffsetX(clampedLeftViewport - iconRect.left)
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
        // Size variants — md default (18×18 / text-[13px]), lg for body-text
        // contexts (22×22 / text-base). Eugene 2026-05-15: «(i) кнопочку сделай
        // по размеру с парой» — applied via size='lg' on mobile card.
        className={
          'inline-flex items-center justify-center rounded-full font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-help leading-none align-middle ' +
          (size === 'lg' ? 'w-[22px] h-[22px] text-base' : 'w-[18px] h-[18px] text-[13px]')
        }
        aria-label={label}
        aria-expanded={open}
      >
        ⓘ
      </button>
      {open && (
        <div
          ref={panelRef}
          // Render slightly transparent while offset is being computed (first frame)
          // to avoid the flash-of-misplaced-panel.
          style={{
            left: offsetX !== null ? `${offsetX}px` : undefined,
            right: offsetX !== null ? 'auto' : 0,
            visibility: offsetX === null ? 'hidden' : 'visible',
          }}
          className={
            'absolute top-full mt-1 ' +
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
