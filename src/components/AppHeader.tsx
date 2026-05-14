// Top app header — Uniswap-style: brand + inline [Trade] [Pools] [Keeper(cond)]
// + Network + Wallet with copy button. Sub-nav below is contextual (see AppSubNav).

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { connectedWallet } from '@/mocks/data'
import { shortAddr } from '@/lib/format'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { LPStateSwitcher } from '@/components/LPStateSwitcher'
import { StatusBanner } from '@/components/StatusBanner'
import { useLPDemoState, deriveLPState } from '@/lib/lpDemoState'
import type { ChainId } from '@/lib/types'

const SECTIONS = [
  { id: 'trade', label: 'Trade', match: ['/listings', '/trader'], dest: '/listings' },
  { id: 'pools', label: 'Pools', match: ['/lp'], dest: '/lp/list' },
] as const

export function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [walletOpen, setWalletOpen] = useState(false)
  const [chain, setChain] = useState<ChainId>(() => {
    if (typeof window === 'undefined') return 'arbitrum'
    return (localStorage.getItem('sliq.activeChain') as ChainId) ?? 'arbitrum'
  })
  const [lpState] = useLPDemoState()
  const inPoolsRoute = path.startsWith('/lp')
  const { isConnected } = deriveLPState(lpState)
  // When user is on /lp/* and demo state says "guest", visually present as not-connected.
  // Other routes (Trade, Keeper) continue using the real `connectedWallet` mock unchanged.
  const renderAsGuest = inPoolsRoute && !isConnected
  const walletRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sliq.activeChain', chain)
    }
  }, [chain])

  // Outside-click for wallet dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false)
      }
    }
    if (walletOpen) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [walletOpen])

  const inTrade = SECTIONS[0].match.some(p => path.startsWith(p))
  const inPools = SECTIONS[1].match.some(p => path.startsWith(p))
  const inKeeper = path.startsWith('/keeper')
  const hideNav =
    path.startsWith('/onboarding') ||
    path.startsWith('/access')

  return (
    <header className="bg-white sticky top-0 z-30">
      {/* Row 1 — Brand · Network · Wallet (always visible, minimal) */}
      <div className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
          {/* Brand lockup */}
          <Link to="/listings" className="flex flex-col leading-tight hover:opacity-90 transition flex-shrink-0">
            <span className="font-semibold tracking-tight text-base">sLiq Protocol</span>
            <span className="text-[10px] text-gray-500 -mt-0.5">
              powered by <span className="font-medium text-gray-700">EarnPark</span>
            </span>
          </Link>

          {/* Network + Wallet (right-aligned) */}
          <div className="ml-auto flex items-center gap-2">
            <NetworkSwitcher value={chain} onChange={setChain} compact />
            {renderAsGuest ? (
            <button
              type="button"
              onClick={() => { /* prototype: dev should flip state via LPStateSwitcher */ }}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-gray-900 text-white hover:opacity-90 transition"
              title="Prototype: connect via LP state switcher (set state 1.2-1.5)"
            >
              Connect wallet
            </button>
          ) : (
            <div className="relative" ref={walletRef}>
              <button
                type="button"
                onClick={() => setWalletOpen(o => !o)}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-[var(--color-status-success)] text-white hover:opacity-90 transition"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-white/80" />
                <span className="num">{shortAddr(connectedWallet.address)}</span>
              </button>

              {walletOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-30"
                >
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <div className="num font-medium text-sm">{connectedWallet.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                      {connectedWallet.persona}
                    </div>
                  </div>
                  {connectedWallet.isPermissionedLiquidator && (
                    <MenuItem
                      to="/keeper/positions"
                      onSelect={() => setWalletOpen(false)}
                      label="Keeper queue"
                      hint="Permissioned"
                    />
                  )}
                  <MenuItem
                    to="/settings"
                    onSelect={() => setWalletOpen(false)}
                    label="Settings"
                    hint="Network · Core · Dev switcher"
                  />
                  <button
                    type="button"
                    onClick={() => setWalletOpen(false)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition border-t border-gray-100 text-[var(--color-status-danger)]"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Row 2 — Dev state switcher (prototype only; will be removed in production) */}
      <div className="border-b border-dashed border-gray-200 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-end">
          <LPStateSwitcher />
        </div>
      </div>

      {/* Row 3 — Beta-version banner (must go between logo block and menus per Eugene) */}
      <StatusBanner />

      {/* Row 4 — Section nav (Trade / Pools) — flows directly into Row 5 (AppSubNav)
          without a divider, so level-1 and level-2 read as one menu block.
          Bottom border lives on AppSubNav. */}
      {!hideNav && (
        <div>
          <div className="mx-auto max-w-7xl px-4 h-11 flex items-center gap-1">
            <NavItem label="Trade" active={inTrade} onClick={() => navigate(SECTIONS[0].dest)} />
            <NavItem label="Pools" active={inPools} onClick={() => navigate(SECTIONS[1].dest)} />
            {connectedWallet.isPermissionedLiquidator && (
              <NavItem
                label="Keeper"
                active={inKeeper}
                onClick={() => navigate('/keeper/positions')}
                accent="liquidator"
              />
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function NavItem({
  label,
  active,
  onClick,
  accent = 'default',
}: {
  label: string
  active: boolean
  onClick: () => void
  accent?: 'default' | 'liquidator'
}) {
  // Level-1 section nav uses underline-active style — visually distinct from
  // chip-style sub-nav (AppSubNav) → clearer hierarchy «section → sub-tab».
  // Active underline overlaps the row's bottom border via -mb-px.
  const activeColor = accent === 'liquidator' ? 'var(--color-role-liquidator)' : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        // L1 uses text-base (16px) vs L2's text-sm (14px) for clear hierarchy.
        'px-3 h-11 inline-flex items-center text-base transition font-medium border-b-2 -mb-px ' +
        (active
          ? 'text-gray-900 border-gray-900'
          : 'text-gray-500 border-transparent hover:text-gray-900 hover:border-gray-300')
      }
      style={active && activeColor ? { color: activeColor, borderColor: activeColor } : undefined}
    >
      {label}
    </button>
  )
}

function MenuItem({
  to,
  onSelect,
  label,
  hint,
}: {
  to: string
  onSelect: () => void
  label: string
  hint?: string
}) {
  return (
    <Link
      to={to}
      onClick={onSelect}
      className="block px-3 py-2 hover:bg-gray-50 transition"
    >
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </Link>
  )
}
