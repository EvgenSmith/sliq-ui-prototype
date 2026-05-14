// Mock LP NFTs in the connected wallet — used for the "eligible to list" surface on /lp/listings.
// These are NFTs the user owns directly on Uniswap V3 but hasn't deposited into sLiq yet.
// Per state (lpDemoState.ts) the visible count differs:
//   - 1.1 guest:                irrelevant (not connected)
//   - 1.2 connected-no-nfts:    [] empty
//   - 1.3 connected-fresh:      full set (4 NFTs)
//   - 1.4 connected-all-listed: [] empty
//   - 1.5 connected-partial:    subset (2 NFTs)

import type { LPDemoStateId } from '@/lib/lpDemoState'

export type LPProtocol = 'uniswap-v3' | 'pancake-v3' | 'gmx' | 'sushi-v3' | 'maverick'

export type WalletNFT = {
  tokenId: string
  protocol: LPProtocol
  pair: { token0: string; token1: string }
  feeTierBps: number
  // V3-style price range (display strings; tick math out of scope for mock)
  priceRange: { lower: string; upper: string }
  // Current pool price relative to range
  rangeStatus: 'in-range' | 'out-of-range'
  // USD-equivalent liquidity backing the position
  liquidityUSD: number
  // Unclaimed fees sitting on the NFT today (in the source protocol)
  unclaimedFeesUSD: number
  // Days since the user opened this position
  ageDays: number
  // 24h fee APR on this position (real, before sLiq)
  uniswapAprPct: number
}

// Human-readable protocol labels — simplified per Eugene's UX preference
export const PROTOCOL_LABELS: Record<LPProtocol, string> = {
  'uniswap-v3': 'Uniswap V3',
  'pancake-v3': 'PancakeSwap',
  'gmx': 'GMX',
  'sushi-v3': 'SushiSwap',
  'maverick': 'Maverick',
}

// Full inventory — gets filtered by state
const ALL_WALLET_NFTS: WalletNFT[] = [
  {
    tokenId: '5489037',
    protocol: 'uniswap-v3',
    pair: { token0: 'WETH', token1: 'USDC' },
    feeTierBps: 5,
    priceRange: { lower: '2 168.99', upper: '2 349.63' },
    rangeStatus: 'in-range',
    liquidityUSD: 12_420,
    unclaimedFeesUSD: 28.40,
    ageDays: 12,
    uniswapAprPct: 14.2,
  },
  {
    tokenId: '5491204',
    protocol: 'uniswap-v3',
    pair: { token0: 'WBTC', token1: 'USDC' },
    feeTierBps: 30,
    priceRange: { lower: '94 100', upper: '102 800' },
    rangeStatus: 'in-range',
    liquidityUSD: 24_850,
    unclaimedFeesUSD: 61.20,
    ageDays: 8,
    uniswapAprPct: 18.7,
  },
  {
    tokenId: '5474019',
    protocol: 'uniswap-v3',
    pair: { token0: 'WETH', token1: 'wstETH' },
    feeTierBps: 1,
    priceRange: { lower: '0.9712', upper: '0.9858' },
    rangeStatus: 'out-of-range',
    liquidityUSD: 8_300,
    unclaimedFeesUSD: 4.10,
    ageDays: 23,
    uniswapAprPct: 4.8,
  },
  {
    tokenId: '5493877',
    protocol: 'uniswap-v3',
    pair: { token0: 'ARB', token1: 'USDC' },
    feeTierBps: 30,
    priceRange: { lower: '0.42', upper: '0.58' },
    rangeStatus: 'in-range',
    liquidityUSD: 3_200,
    unclaimedFeesUSD: 7.85,
    ageDays: 4,
    uniswapAprPct: 22.1,
  },
  // Non-eligible — other-protocol LP positions detected in the wallet.
  // Surfaced as protocol-tab «Coming soon» surface. Keep 2 examples (GMX + PancakeSwap).
  {
    tokenId: '7041',
    protocol: 'gmx',
    pair: { token0: 'GMX', token1: 'ETH' },
    feeTierBps: 30,
    priceRange: { lower: '0.0084', upper: '0.0112' },
    rangeStatus: 'in-range',
    liquidityUSD: 9_400,
    unclaimedFeesUSD: 22.10,
    ageDays: 19,
    uniswapAprPct: 11.5,
  },
  {
    tokenId: '12390',
    protocol: 'pancake-v3',
    pair: { token0: 'CAKE', token1: 'BNB' },
    feeTierBps: 25,
    priceRange: { lower: '0.0028', upper: '0.0034' },
    rangeStatus: 'out-of-range',
    liquidityUSD: 2_100,
    unclaimedFeesUSD: 1.85,
    ageDays: 31,
    uniswapAprPct: 6.2,
  },
]

const isUniswapV3 = (nft: WalletNFT) => nft.protocol === 'uniswap-v3'

// Eligible = Uniswap V3 only (per sLiq Beta scope-lock §1.4).
// Subset for 1.5 partial = 2 of the 4 Uniswap V3 entries.
const PARTIAL_SUBSET_UNI: WalletNFT[] = [ALL_WALLET_NFTS[1], ALL_WALLET_NFTS[3]]

export function getWalletNFTsForState(state: LPDemoStateId): WalletNFT[] {
  switch (state) {
    case 'connected-fresh':
      return ALL_WALLET_NFTS.filter(isUniswapV3)
    case 'connected-partial':
      return PARTIAL_SUBSET_UNI
    case 'guest':
    case 'connected-no-nfts':
    case 'connected-all-listed':
    default:
      return []
  }
}

// Non-eligible NFTs (other protocols) — surface as transparency footer.
// Same connectivity rule: shown whenever wallet has any LP NFTs.
export function getNonEligibleNFTsForState(state: LPDemoStateId): WalletNFT[] {
  // Non-eligible NFTs are part of the wallet inventory whenever the wallet
  // has anything to show. So states 1.3 + 1.5 both surface them.
  if (state === 'connected-fresh' || state === 'connected-partial') {
    return ALL_WALLET_NFTS.filter(n => !isUniswapV3(n))
  }
  return []
}

// For the listings surface — derive whether to show user's existing listings
export function showListingsForState(state: LPDemoStateId): boolean {
  return state === 'connected-all-listed' || state === 'connected-partial'
}
