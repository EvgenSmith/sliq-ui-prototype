// Developer-only state switcher to preview the 5 LP-side user states on /lp/listings.
// Visual treatment: monospace + dashed border + neutral gray. Intentionally NOT brand-styled —
// signals "dev tooling, not user UI". Lives next to NetworkSwitcher in AppHeader.

import { useEffect, useRef, useState } from 'react'
import { LP_DEMO_STATES, useLPDemoState } from '@/lib/lpDemoState'

export function LPStateSwitcher() {
  const [state, setState] = useLPDemoState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LP_DEMO_STATES.find(s => s.id === state) ?? LP_DEMO_STATES[4]

  // Outside-click close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="px-2 py-1 text-[10px] font-mono border border-dashed border-gray-400 text-gray-500 rounded hover:text-gray-700 hover:border-gray-500 transition select-none whitespace-nowrap"
        title="Dev: LP page state switcher (prototype only)"
      >
        [LP: {current.code}]
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-300 shadow-lg rounded z-40 overflow-hidden"
        >
          <div className="px-2.5 py-1.5 text-[10px] uppercase font-mono tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
            Dev · LP page state
          </div>
          {LP_DEMO_STATES.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setState(s.id)
                setOpen(false)
              }}
              className={`w-full text-left px-2.5 py-2 font-mono hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0 ${
                s.id === state ? 'bg-gray-50' : ''
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-gray-400">{s.code}</span>
                <span className="text-[12px] text-gray-900">{s.label}</span>
                {s.id === state && (
                  <span className="ml-auto text-[10px] text-gray-400">●</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.short}</div>
            </button>
          ))}
          <div className="px-2.5 py-1.5 text-[10px] text-gray-400 bg-gray-50 border-t border-gray-200 font-mono">
            persists in localStorage
          </div>
        </div>
      )}
    </div>
  )
}
