// HelpPopover — small ⓘ icon with click-to-expand explanation panel.
// Used for tooltip content that's too long for native title attribute.

import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  label?: string
  width?: string // tailwind width class
}

export function HelpPopover({ children, label = 'More info', width = 'w-80' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
          className={
            'absolute right-0 top-full mt-1 ' +
            width +
            ' max-w-[90vw] rounded-md border border-gray-200 bg-white shadow-xl p-3.5 text-xs text-gray-700 leading-relaxed z-50 text-left font-normal normal-case tracking-normal whitespace-normal'
          }
          role="dialog"
        >
          {children}
        </div>
      )}
    </span>
  )
}
