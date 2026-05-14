// Marketplace constants per S3 redesign spec.

import type { ChainId } from '@/lib/types'

export const FEE_TIER_OPTIONS = [
  { bps: 1, label: '0.01%' },
  { bps: 5, label: '0.05%' },
  { bps: 30, label: '0.3%' },
  { bps: 100, label: '1%' },
] as const

export const MODE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'conservative', label: 'Conservative' },
  { id: 'advanced', label: 'Advanced' },
] as const

export const RANGE_STATUS_FILTER = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'In range' },
  { id: 'out', label: 'Out of range' },
] as const

// FULL retired — full capacity is now a display of ACTIVE+leased=100% (call 2026-05-14).
export const STATUS_FILTER = ['ACTIVE', 'LIQUIDATING'] as const

export const SORT_OPTIONS = [
  { id: 'outbid-desc', label: '🎯 Outbid opportunities (by PnL)' },
  { id: 'apy-desc', label: 'Premium APY · high → low' },
  { id: 'apy-asc', label: 'Premium APY · low → high' },
  { id: 'capacity-desc', label: 'Available capacity' },
  { id: 'time-desc', label: 'Newest first' },
  { id: 'midpoint-asc', label: 'Price near range center' },
  { id: 'fee-asc', label: 'Fee tier · low → high' },
] as const

export type SortId = typeof SORT_OPTIONS[number]['id']

// Chain registry — V3 only. Arbitrum active (sLiq deployed here), остальные L2 + Ethereum ждут (disabled in Beta UI).
export interface ChainOption {
  id: ChainId
  shortLabel: string
  fullLabel: string
  state: 'active' | 'next-up' | 'coming-soon' | 'dev'
  iconColor: string // background color for token-style placeholder icon
}

export const CHAINS: ChainOption[] = [
  { id: 'arbitrum', shortLabel: 'Arbitrum', fullLabel: 'Arbitrum One', state: 'active', iconColor: 'oklch(60% 0.10 220)' },
  { id: 'ethereum', shortLabel: 'Ethereum', fullLabel: 'Ethereum Mainnet', state: 'coming-soon', iconColor: 'oklch(60% 0.05 250)' },
  { id: 'base', shortLabel: 'Base', fullLabel: 'Base', state: 'coming-soon', iconColor: 'oklch(55% 0.18 250)' },
  { id: 'optimism', shortLabel: 'Optimism', fullLabel: 'OP Mainnet', state: 'coming-soon', iconColor: 'oklch(60% 0.20 25)' },
  { id: 'polygon', shortLabel: 'Polygon', fullLabel: 'Polygon PoS', state: 'coming-soon', iconColor: 'oklch(55% 0.20 290)' },
  { id: 'sepolia', shortLabel: 'Sepolia', fullLabel: 'Sepolia Testnet', state: 'dev', iconColor: 'oklch(70% 0.04 80)' },
]

// Locked strings (do not paraphrase)
export const LOCKED_STRINGS = {
  selectNetwork: 'Select network',
  comingSoon: 'Coming soon',
  switchPending: 'Switching network…',
  switchFailed: "Couldn't switch network. Check your wallet and try again.",
  wrongNetworkBanner: (detected: string) =>
    `Your wallet is on ${detected}. sLiq Beta version runs on Arbitrum One.`,
  switchNetworkCta: 'Switch network',
  // Marketplace
  emptyFiltered: {
    title: 'No listings match your filters',
    body: 'Расширь пары, добавь out-of-range, или сдвинь Premium APY чтобы показать больше.',
    cta: 'Reset filters',
  },
  emptyGlobal: {
    title: 'No listings yet on Arbitrum One',
    body: 'Be the first LP to list a position, or check back shortly.',
    cta: 'Go to Pools',
  },
  errorLoad: {
    title: "Couldn't load listings",
    body: 'Marketplace data is temporarily unavailable.',
    retry: 'Retry',
  },
}
