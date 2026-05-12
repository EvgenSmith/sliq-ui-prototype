// Domain types per design spec §4 (object model)
// Canonical nouns: Listing, Position, LP NFT, Margin, Reserve, APY (3 streams), Buyout, Withdrawal, Close Request

export type Role = 'LP' | 'Trader' | 'Liquidator' | 'All'

export type ProviderMode = 'conservative' | 'advanced'

export type ListingStatus =
  | 'ACTIVE'
  | 'FULL'
  | 'PAUSED'
  | 'WITHDRAWAL_REQUESTED'
  | 'LIQUIDATING'
  | 'WITHDRAWN'
  | 'LIQUIDATED'

export type PositionStatus =
  | 'OPEN'
  | 'CLOSE_REQUESTED'
  | 'CLOSING'
  | 'CLOSED_PAID'
  | 'CLOSED_PARTIAL'
  | 'LIQUIDATED_POSITION'
  | 'LIQUIDATED_LISTING'
  | 'OUTBID_PENDING'

export type ChainId =
  | 'ethereum'
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'polygon'
  | 'sepolia'

export type DexProtocol =
  | 'uniswap-v3'
  | 'uniswap-v4'
  | 'pancakeswap-v3'
  | 'gmx'
  | 'other'

export interface Listing {
  id: string
  tokenId: number
  owner: string
  chain: ChainId                 // V3 protocol, multi-chain ready
  dex: DexProtocol               // architecture multi-DEX ready (Alpha: uniswap-v3 only)
  pair: { token0: string; token1: string }
  feeTierBps: number          // e.g. 5 = 0.05%, 30 = 0.3%
  rangeLow: number
  rangeHigh: number
  currentPrice: number
  initialLiquidityUSD: number
  availableCapacityUSD: number
  totalCapacityUSD: number
  providerMode: ProviderMode
  providerLeverage: number    // 1 for Conservative; >1 for Advanced
  minPremiumApyBps: number    // signed; negative possible per §12
  uniswapApyBps: number       // realized last 30d
  referenceApyBps: number     // realized last 30d
  status: ListingStatus
  listedAt: number            // unix ms
  // Advanced-only metrics (only present when providerMode === 'advanced')
  aggregateReserveUSD?: number
  distanceToLiqPct?: number
  // LP-side analytics (computed/aggregated)
  rangeHitRatePct?: number    // % time in range last 30d
  autoCompound?: boolean      // toggle
  lifetimeUniFeesUSD?: number // realized fees from Uniswap baseline since listing
  lifetimePremiumUSD?: number // realized Premium APY paid by lessees since listing
  lifetimeReferenceUSD?: number // realized Reference Fees since listing
  netPnLUSD?: number          // IL-adjusted PnL vs initial deposit value
  hodlDeltaUSD?: number       // delta vs «if just HODL'd»
}

// Wallet-owned Uniswap V3 NFTs available for import (S12)
export interface WalletNFT {
  tokenId: number
  pair: { token0: string; token1: string }
  feeTierBps: number
  rangeLow: number
  rangeHigh: number
  currentPrice: number        // current pool price для in-range check
  liquidityUSD: number
  amountToken0: number        // current token amounts in NFT
  amountToken1: number
  inRange: boolean
  uniswapApyBps: number       // recent 30d
}

export interface Position {
  id: string
  listingId: string
  trader: string
  notionalUSD: number
  apyBps: number              // signed
  margin0: number
  margin1: number
  marginValueUSD: number
  reserveUSD: number
  reservePctOfInitial: number
  effectiveLeverage: number
  entryPrice: number          // pool price at open
  openedAtLeverage: number    // leverage as opened (effectiveLeverage decays vs this)
  // accruing
  pendingRefApyBps: number
  pendingPremApyBps: number
  // status
  status: PositionStatus
  openedAt: number
  closeRequestedAt?: number
}

export interface ClaimRow {
  listingId: string
  uniswapFeesUSD: number
  refRealizedUSD: number
  premRealizedUSD: number
  refPendingUSD: number
  premPendingUSD: number
}

export interface Activity {
  id: string
  ts: number
  kind: 'deposit' | 'list' | 'open' | 'outbid' | 'request-close' | 'closed' | 'claim' | 'withdraw' | 'leverage-change'
  text: string
  listingId?: string
  positionId?: string
}

// Persisted close result for S10 Closed P&L
export interface ClosedPosition {
  id: string
  listingId: string
  trader: string
  pair: { token0: string; token1: string }
  feeTierBps: number
  openedAt: number
  closedAt: number
  durationHours: number
  notionalUSD: number
  apyBps: number
  marginPostedUSD: number
  entryPrice: number                     // pool price at open
  exitPrice: number                      // pool price at close
  // Settlement breakdown
  impermanentProfitUSD: number          // before fees
  referencePaidUSD: number              // to LP
  premiumPaidUSD: number                // to LP (negative = trader received)
  keeperRewardUSD: number
  protocolFeeUSD: number
  residualUSD: number                   // final to trader
  // Status
  paidInFull: boolean                   // false if Reference/Premium unpaid partial
  unpaidUSD?: number
  liquidated?: boolean                  // hit liq threshold before normal close
}
