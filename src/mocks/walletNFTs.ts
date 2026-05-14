// Mock LP NFTs in the connected wallet — used for the "eligible to list" surface on /lp/listings.
// These are NFTs the user owns directly on Uniswap V3 but hasn't deposited into sLiq yet.
// Per state (lpDemoState.ts) the visible count differs:
//   - 1.1 guest:                irrelevant (not connected)
//   - 1.2 connected-no-nfts:    [] empty
//   - 1.3 connected-fresh:      full set (4 NFTs)
//   - 1.4 connected-all-listed: [] empty
//   - 1.5 connected-partial:    subset (2 NFTs)

import type { LPDemoStateId } from '@/lib/lpDemoState'

export type WalletNFT = {
  tokenId: string
  pair: { token0: string; token1: string }
  feeTierBps: number
  // V3 price range (display strings; tick math out of scope for mock)
  priceRange: { lower: string; upper: string }
  // Current pool price relative to range
  rangeStatus: 'in-range' | 'out-of-range'
  // USD-equivalent liquidity backing the position
  liquidityUSD: number
  // Unclaimed Uniswap fees sitting on the NFT today
  unclaimedFeesUSD: number
  // Days since the user opened this position on Uniswap
  ageDays: number
  // 24h Uniswap fee APR on this position (real, before sLiq)
  uniswapAprPct: number
}

// Full inventory — gets filtered by state
const ALL_WALLET_NFTS: WalletNFT[] = [
  {
    tokenId: '5489037',
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
    pair: { token0: 'ARB', token1: 'USDC' },
    feeTierBps: 30,
    priceRange: { lower: '0.42', upper: '0.58' },
    rangeStatus: 'in-range',
    liquidityUSD: 3_200,
    unclaimedFeesUSD: 7.85,
    ageDays: 4,
    uniswapAprPct: 22.1,
  },
]

// Subset for 1.5 partial state — pick the smaller / less mature NFTs
const PARTIAL_SUBSET: WalletNFT[] = [ALL_WALLET_NFTS[1], ALL_WALLET_NFTS[3]]

export function getWalletNFTsForState(state: LPDemoStateId): WalletNFT[] {
  switch (state) {
    case 'connected-fresh':
      return ALL_WALLET_NFTS
    case 'connected-partial':
      return PARTIAL_SUBSET
    case 'guest':
    case 'connected-no-nfts':
    case 'connected-all-listed':
    default:
      return []
  }
}

// For the listings surface — derive whether to show user's existing listings
export function showListingsForState(state: LPDemoStateId): boolean {
  return state === 'connected-all-listed' || state === 'connected-partial'
}
