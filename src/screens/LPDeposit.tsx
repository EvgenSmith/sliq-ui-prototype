// S5 LP Deposit wizard — design spec §8 S5 + §11.6
// 3 steps: Pick NFT → Configure (mode + min APY) → Confirm via HighStakesConfirmModal
// Uses LPFlowSelector + NotionalInput preview + RiskPanel (if Advanced) + HighStakesConfirmModal.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LPFlowSelector } from '@/components/LPFlowSelector'
import { NotionalInput } from '@/components/NotionalInput'
import { RiskPanel } from '@/components/RiskPanel'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import { fmtFeeTier, fmtPct, fmtRange } from '@/lib/format'
import type { ProviderMode } from '@/lib/types'

// Mock wallet NFTs available to deposit
const walletNFTs = [
  {
    tokenId: 421500,
    pair: { token0: 'ETH', token1: 'USDC' },
    feeTierBps: 5,
    rangeLow: 3120,
    rangeHigh: 3580,
    liquidityUSD: 48_000,
    inRange: true,
  },
  {
    tokenId: 422100,
    pair: { token0: 'WBTC', token1: 'ETH' },
    feeTierBps: 30,
    rangeLow: 18.6,
    rangeHigh: 19.8,
    liquidityUSD: 92_000,
    inRange: true,
  },
  {
    tokenId: 419872,
    pair: { token0: 'USDC', token1: 'USDT' },
    feeTierBps: 1,
    rangeLow: 0.998,
    rangeHigh: 1.002,
    liquidityUSD: 250_000,
    inRange: true,
  },
]

type Step = 'pick' | 'configure' | 'submitted'

export function LPDeposit() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [selected, setSelected] = useState<typeof walletNFTs[0] | null>(null)
  const [mode, setMode] = useState<ProviderMode>('conservative')
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false)
  const [leverage, setLeverage] = useState(1)
  const [minApyPct, setMinApyPct] = useState(8) // 8% default; signed (can be negative)

  // Modals
  const [confirmAdvanced, setConfirmAdvanced] = useState(false)
  const [confirmDeposit, setConfirmDeposit] = useState(false)

  // Pseudo-stress for preview RiskPanel
  const stressPreview = selected
    ? [
        { label: '+20%', reserveAfter: selected.liquidityUSD * 0.42, triggers: false },
        { label: '−20%', reserveAfter: selected.liquidityUSD * 0.18, triggers: leverage > 50 },
      ]
    : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Deposit a Uniswap V3 NFT</h1>
        <p className="text-sm text-gray-600 mt-1">
          List your LP NFT into the sLiq market. You keep custody — request withdrawal at any time.
        </p>
      </header>

      {/* Stepper */}
      <ol className="flex items-center gap-3 mb-8 text-xs">
        <StepDot active={step === 'pick'} done={step !== 'pick'} label="1. Pick NFT" />
        <StepDivider />
        <StepDot
          active={step === 'configure'}
          done={step === 'submitted'}
          label="2. Configure listing"
        />
        <StepDivider />
        <StepDot active={step === 'submitted'} done={false} label="3. Confirm" />
      </ol>

      {step === 'pick' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Your Uniswap V3 LP NFTs</h2>
          {walletNFTs.map(nft => (
            <button
              key={nft.tokenId}
              type="button"
              onClick={() => {
                setSelected(nft)
                setStep('configure')
              }}
              className="w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-[var(--color-role-lp)] hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-semibold tracking-tight">
                  {nft.pair.token0} / {nft.pair.token1}
                  <span className="text-xs text-gray-500 ml-2 num">fee {fmtFeeTier(nft.feeTierBps)}</span>
                </div>
                <span className="text-xs text-gray-500 num">#{nft.tokenId}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span className="num">Range {fmtRange(nft.rangeLow, nft.rangeHigh)}</span>
                <span className="num">≈ ${nft.liquidityUSD.toLocaleString()} liquidity</span>
                {nft.inRange && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30">
                    in range
                  </span>
                )}
              </div>
            </button>
          ))}

          <div className="pt-2">
            <details className="rounded-md border border-gray-200 bg-white p-3 text-sm">
              <summary className="text-xs text-gray-600 cursor-pointer">Enter tokenId manually</summary>
              <div className="mt-3 space-y-2">
                <input
                  type="number"
                  placeholder="Token ID"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm num"
                />
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Manual entry skips the wallet check. Confirm the tokenId belongs to this wallet — depositing
                  someone else's NFT will revert and burn gas.
                </p>
              </div>
            </details>
          </div>
        </div>
      )}

      {step === 'configure' && selected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Selected NFT summary */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-semibold">
                  {selected.pair.token0} / {selected.pair.token1}
                  <span className="text-xs text-gray-500 ml-2 num">fee {fmtFeeTier(selected.feeTierBps)}</span>
                </h3>
                <button
                  onClick={() => setStep('pick')}
                  className="text-xs text-gray-500 underline"
                >
                  Change NFT
                </button>
              </div>
              <div className="text-sm text-gray-600 num flex flex-wrap gap-x-3 gap-y-1">
                <span>Token ID #{selected.tokenId}</span>
                <span>·</span>
                <span>Range {fmtRange(selected.rangeLow, selected.rangeHigh)}</span>
                <span>·</span>
                <span>≈ ${selected.liquidityUSD.toLocaleString()} liquidity</span>
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Listing mode</label>
              <LPFlowSelector
                value={mode}
                onChange={setMode}
                gateOnEnterAdvanced={true}
                gateUnlocked={advancedUnlocked}
                onRequestAdvancedGate={() => setConfirmAdvanced(true)}
              />
            </div>

            {/* Provider Leverage (Advanced only) */}
            {mode === 'advanced' && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-semibold">Provider Leverage</label>
                  <span className="text-sm num font-medium">{leverage}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={leverage}
                  onChange={e => setLeverage(Number(e.target.value))}
                  className="w-full accent-[var(--color-status-warning)]"
                />
                <p className="text-xs text-gray-600">
                  {leverage <= 5 && 'Conservative-equivalent. NFT minimally exposed.'}
                  {leverage > 5 && leverage <= 25 && 'Moderate. Listing-level liquidation possible on >15% adverse moves.'}
                  {leverage > 25 && leverage <= 50 && (
                    <span className="text-amber-800">High. ±10% pool move can trigger listing-level liquidation.</span>
                  )}
                  {leverage > 50 && (
                    <span className="text-[var(--color-status-danger)]">
                      Maximum. ±5% pool move can trigger listing-level liquidation. Reserve this for stable pairs.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Min Premium APY */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold">Minimum Premium APY</label>
                <span
                  className="text-sm num font-medium"
                  style={{ color: minApyPct < 0 ? 'var(--color-negative-apy)' : 'inherit' }}
                >
                  {minApyPct > 0 ? '+' : ''}{minApyPct.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={mode === 'advanced' ? -50 : 0}
                max={50}
                step={0.5}
                value={minApyPct}
                onChange={e => setMinApyPct(Number(e.target.value))}
                className="w-full accent-[var(--color-role-lp)]"
              />
              <p className="text-xs text-gray-600">
                {minApyPct < 0 ? (
                  <span className="text-[var(--color-negative-apy)]">
                    Negative APY — you'll pay traders {Math.abs(minApyPct).toFixed(1)}% annualized to take this listing.
                    Make sure Reference Fees × Provider Leverage covers the subsidy.
                  </span>
                ) : (
                  `Traders can't open below this. Suggested for ${selected.pair.token0}/${selected.pair.token1}: ${
                    selected.feeTierBps === 1 ? '1–2%' : selected.feeTierBps === 5 ? '6–10%' : '10–15%'
                  } based on recent vol.`
                )}
              </p>
              {mode === 'conservative' && minApyPct < 0 && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
                  Negative APY requires Advanced mode (Provider Leverage &gt; 1×).
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-3 flex items-center gap-3">
              <button
                onClick={() => setStep('pick')}
                className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setConfirmDeposit(true)}
                disabled={mode === 'conservative' && minApyPct < 0}
                className={
                  'ml-auto text-sm font-semibold px-4 py-2 rounded-md transition ' +
                  (mode === 'conservative' && minApyPct < 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[var(--color-role-lp)] text-white hover:opacity-90')
                }
              >
                Deposit and list →
              </button>
            </div>
          </div>

          {/* Sidebar — preview */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Preview
              </h3>
              <dl className="space-y-1.5 text-sm">
                <Row k="Mode" v={mode === 'advanced' ? `Advanced · ${leverage}×` : 'Conservative · 1×'} />
                <Row k="Min Premium APY" v={
                  <span
                    className="num font-medium"
                    style={{ color: minApyPct < 0 ? 'var(--color-negative-apy)' : undefined }}
                  >
                    {minApyPct > 0 ? '+' : ''}{minApyPct.toFixed(1)}%
                  </span>
                } />
                <Row k="Tracking liquidity (1%)" v={
                  <span className="num">≈ ${(selected.liquidityUSD * 0.01).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                } />
                <Row k="Market capacity (99%)" v={
                  <span className="num">≈ ${(selected.liquidityUSD * 0.99).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                } />
              </dl>
            </div>

            {mode === 'advanced' && (
              <RiskPanel
                context="preview"
                previewLabel="estimated at deposit"
                aggregateReserveUSD={selected.liquidityUSD}
                distanceToLiqPct={leverage <= 25 ? 85 : leverage <= 50 ? 60 : 35}
                stress={stressPreview}
                traderClaimsUSD={0}
              />
            )}
          </aside>
        </div>
      )}

      {step === 'submitted' && selected && (
        <div className="rounded-lg border border-[var(--color-status-success)]/30 bg-[var(--color-role-lp-bg)] p-6">
          <h2 className="text-lg font-semibold tracking-tight mb-1">Your NFT is listed</h2>
          <p className="text-sm text-gray-700">
            1% of the liquidity stays in the NFT as a tracking probe — that earns real Uniswap fees. The other 99% is the
            surface traders bid on.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/"
              className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-white transition"
            >
              Back to Portfolio
            </Link>
            <Link
              to="/lp/listings"
              className="text-sm font-medium px-3 py-2 rounded-md bg-[var(--color-role-lp)] text-white hover:opacity-90 transition"
            >
              View my listings →
            </Link>
          </div>
        </div>
      )}

      {/* Modals */}
      <HighStakesConfirmModal
        open={confirmAdvanced}
        title="Switch listing to Advanced — confirm"
        subtitle="Advanced mode uses your NFT as collateral. The NFT can be partially liquidated."
        currentState={[
          { label: 'Mode', value: 'Conservative' },
          { label: 'Provider Leverage', value: '1×' },
          { label: 'NFT at risk', value: 'No' },
        ]}
        newState={[
          { label: 'Mode', value: 'Advanced', deltaTone: 'negative' },
          { label: 'Provider Leverage', value: 'up to 100×', deltaTone: 'negative' },
          { label: 'NFT at risk', value: 'Yes', deltaTone: 'negative' },
        ]}
        risks={[
          'Listing-level liquidation can reduce or remove your NFT.',
          'Aggregate trader claims may exceed your collateral if price moves sharply.',
          'You can lower leverage later, but open trader positions stay under the higher cap until they close.',
        ]}
        irreversibilityNote="Active trader positions remain bound to this listing under the new leverage. Switching back to Conservative does not free them."
        confirmType="type-to-confirm"
        typeWord="ADVANCED"
        confirmButtonLabel="Confirm — Switch to Advanced"
        onConfirm={() => {
          setAdvancedUnlocked(true)
          setMode('advanced')
          setLeverage(5)
          setConfirmAdvanced(false)
        }}
        onCancel={() => setConfirmAdvanced(false)}
      />

      <HighStakesConfirmModal
        open={confirmDeposit}
        title="Deposit and list NFT — confirm"
        subtitle={
          mode === 'advanced'
            ? 'You are about to deposit a Uniswap V3 NFT with Advanced mode — collateralized.'
            : 'You are about to deposit a Uniswap V3 NFT with Conservative mode — your NFT cannot be lost on listing-level liquidation.'
        }
        currentState={
          selected
            ? [
                { label: 'NFT', value: `#${selected.tokenId}` },
                { label: 'Pair', value: `${selected.pair.token0}/${selected.pair.token1}` },
                { label: 'Liquidity', value: `$${selected.liquidityUSD.toLocaleString()}` },
              ]
            : []
        }
        newState={[
          { label: 'Mode', value: mode === 'advanced' ? `Advanced · ${leverage}×` : 'Conservative · 1×' },
          { label: 'Min Premium APY', value: `${minApyPct > 0 ? '+' : ''}${minApyPct.toFixed(1)}%`, deltaTone: minApyPct < 0 ? 'negative' : 'neutral' },
          { label: 'NFT at risk', value: mode === 'advanced' ? 'Yes' : 'No', deltaTone: mode === 'advanced' ? 'negative' : 'positive' },
        ]}
        risks={[
          'You transfer the NFT to the sLiq contract. You can request withdrawal at any time.',
          'Withdrawal force-closes any active trader positions on this listing.',
          mode === 'advanced'
            ? 'Listing-level liquidation can reduce or remove the NFT in adverse market conditions.'
            : 'No insurance fund. Reference and Premium APY can settle partial if trader margin runs out.',
        ]}
        irreversibilityNote={
          mode === 'advanced'
            ? 'Once active positions open under this Advanced setting, they keep their leverage until close — switching back later does not free them.'
            : 'Pre-SLIQ fees are collected back to your wallet on deposit. Standard withdrawal flow available after.'
        }
        confirmType="checkbox"
        confirmButtonLabel="Confirm deposit"
        onConfirm={() => {
          setConfirmDeposit(false)
          setStep('submitted')
        }}
        onCancel={() => setConfirmDeposit(false)}
      />
    </div>
  )
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  const bg = active
    ? 'bg-gray-900 text-white border-gray-900'
    : done
    ? 'bg-[var(--color-status-success)]/20 text-[var(--color-status-success)] border-[var(--color-status-success)]/40'
    : 'bg-white text-gray-500 border-gray-300'
  return (
    <span className={'px-2 py-1 rounded-full border font-medium ' + bg}>{label}</span>
  )
}

function StepDivider() {
  return <span className="flex-1 h-px bg-gray-200" />
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}
