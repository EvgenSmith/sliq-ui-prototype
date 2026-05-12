// S12 LP Deposit — primary path: Import existing Uniswap V3 LP NFT.
// All-in-one single-scroll page (per Pools card spec v1). Mirror trader-side
// inline-form pattern from S4 ListingDetail OpenPositionForm.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { walletNFTs } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtUSD } from '@/lib/format'
import { HelpPopover } from '@/components/HelpPopover'
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'
import type { WalletNFT } from '@/lib/types'

type Mode = 'import' | 'create'

export function LPDeposit() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('import')
  const [selected, setSelected] = useState<WalletNFT | null>(null)
  const [providerMode, setProviderMode] = useState<'conservative' | 'advanced'>('conservative')
  const [leverage, setLeverage] = useState(10)
  const [minApyPct, setMinApyPct] = useState(5)
  const [autoCompound, setAutoCompound] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isAdvanced = providerMode === 'advanced'
  const effectiveLeverage = isAdvanced ? leverage : 1
  const subsidized = minApyPct < 0

  // Earnings estimate (mocked)
  const estimate = useMemo(() => {
    if (!selected) return null
    const uniApr = selected.uniswapApyBps / 100
    // Premium APY proxy from comparable listings — roughly minApy + 5-10% market spread
    const premApr = Math.max(minApyPct + 5, 8)
    // Reference Fees ≈ uni × (leverage - 1) for advanced
    const refApr = uniApr * Math.max(0, effectiveLeverage - 1)
    return {
      uniApr,
      premApr: subsidized ? minApyPct : premApr,
      refApr,
      totalApr: uniApr + (subsidized ? minApyPct : premApr) + refApr,
    }
  }, [selected, minApyPct, effectiveLeverage, subsidized])

  // Validation
  const errors: string[] = []
  if (!selected) errors.push('Select an NFT to list')
  if (selected && minApyPct < -10) errors.push('Min APY cannot be below −10%')
  if (selected && minApyPct > 100) errors.push('Min APY cannot exceed 100%')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/lp/listings" className="hover:underline">My Listings</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">Deposit NFT</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">List your Uniswap V3 LP NFT on sLiq</h1>
        <p className="text-sm text-gray-600 mt-1.5 max-w-3xl">
          Зарабатывай extra Premium APY поверх обычных Uniswap fees. Out-of-range alerts. IL-aware PnL. One-click exit.
          NFT остаётся в твоём контроле — withdrawal на следующем блоке Arbitrum.
        </p>
      </header>

      {/* Tabs (discreet, no big underline pattern) */}
      <div className="mb-5 inline-flex items-center gap-1 rounded-md bg-gray-100 p-1">
        <ModeTab active={mode === 'import'} onClick={() => setMode('import')}>
          Import existing
        </ModeTab>
        <ModeTab active={mode === 'create'} onClick={() => setMode('create')}>
          Create new V3 LP <span className="text-[10px] uppercase ml-1 opacity-60">advanced</span>
        </ModeTab>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <section className="lg:col-span-2 space-y-5">
          {mode === 'import' ? (
            <>
              {/* NFT list */}
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold mb-3">Your Uniswap V3 NFTs</h2>
                {walletNFTs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-600 mb-3">У тебя нет Uniswap V3 LP позиций.</p>
                    <a
                      href="https://app.uniswap.org/positions/create"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition"
                    >
                      Create one on Uniswap →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {walletNFTs.map(nft => (
                      <NFTOption
                        key={nft.tokenId}
                        nft={nft}
                        selected={selected?.tokenId === nft.tokenId}
                        onSelect={() => setSelected(nft)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Listing form — appears when NFT selected */}
              {selected && (
                <div className="rounded-lg border border-[var(--color-role-lp)]/40 bg-[var(--color-role-lp-bg)]/40 p-5 space-y-4">
                  <h2 className="text-base font-semibold">List configuration</h2>

                  {/* Provider Mode */}
                  <div>
                    <label className="text-sm font-medium inline-flex items-center gap-1 mb-2">
                      Listing stability
                      <HelpPopover label="Conservative vs Advanced" width="w-80">
                        <p className="font-semibold mb-1">Conservative (1×) vs Advanced (N×)</p>
                        <p className="mb-1.5"><strong>Conservative · 1×</strong> — NFT защищён. Не может быть liquidated. Earn baseline + Premium APY normally.</p>
                        <p><strong>Advanced · N×</strong> — NFT становится залогом × N. Reference Fees pool amplified ×N, но при vol-event'е listing-level liquidation возможен (можешь потерять часть NFT). Для high-conviction LPs.</p>
                      </HelpPopover>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <ModeOption
                        active={providerMode === 'conservative'}
                        onClick={() => setProviderMode('conservative')}
                        title="Safe · 1×"
                        subtitle="NFT защищён, рекомендуется"
                        recommended
                      />
                      <ModeOption
                        active={providerMode === 'advanced'}
                        onClick={() => setProviderMode('advanced')}
                        title="At-risk · N×"
                        subtitle="NFT в залоге, выше потенциал"
                      />
                    </div>
                    {isAdvanced && (
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <label className="text-xs text-gray-600">Provider Leverage</label>
                          <span className="num font-semibold text-sm">{leverage}×</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={100}
                          step={1}
                          value={leverage}
                          onChange={e => setLeverage(Number(e.target.value))}
                          className="w-full accent-[var(--color-role-lp)]"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 num mt-0.5">
                          <span>2×</span><span>10×</span><span>50×</span><span>100×</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-2">
                          ⚠️ Эффективное плечо ≈ √{leverage} = {Math.sqrt(leverage).toFixed(1)}×. NFT collateralized — листинг может быть ликвидирован при vol-event'е.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Min Premium APY */}
                  <div>
                    <label className="text-sm font-medium inline-flex items-center gap-1 mb-1.5">
                      Min Premium APY
                      <HelpPopover label="Min Premium APY" width="w-80">
                        <p className="font-semibold mb-1">Auction floor — your minimum rate</p>
                        <p className="mb-1.5">Минимальная ставка которую trader должен предложить чтобы зайти. Это твой floor — не auto-clear. Trader может предложить выше → ты получаешь больше.</p>
                        <p className="mb-1.5">Default 5% — comfortable middle. Higher = меньше lessees, но больше earnings per lessee. Lower = больше демo, меньше per-lessee.</p>
                        <p className="text-[11px] text-gray-500">Negative — subsidized listing: <strong>ты платишь trader'у</strong>. Используется для stable pairs где Reference Fees × leverage даёт большой pool.</p>
                      </HelpPopover>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={minApyPct}
                        step={1}
                        onChange={e => setMinApyPct(Number(e.target.value))}
                        className={
                          'flex-1 rounded-md border px-3 py-2 text-sm num ' +
                          (subsidized
                            ? 'border-[var(--color-negative-apy)] bg-[var(--color-negative-apy-bg)]/50 text-[var(--color-negative-apy)] font-semibold'
                            : 'border-gray-300 bg-white')
                        }
                      />
                      <span className="text-xs text-gray-500">%</span>
                      <button
                        type="button"
                        onClick={() => setMinApyPct(5)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        suggest 5%
                      </button>
                    </div>
                    {subsidized && (
                      <p className="text-[11px] text-[var(--color-negative-apy)] mt-1.5">
                        ⚠️ <strong>Subsidized listing</strong> — ты будешь платить trader'у {Math.abs(minApyPct)}% годовых.
                        Используется для stable pairs с Provider Leverage 50×+, где Reference Fees pool покрывает subsidy.
                      </p>
                    )}
                  </div>

                  {/* Auto-compound */}
                  <div>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCompound}
                        onChange={e => setAutoCompound(e.target.checked)}
                        className="w-4 h-4 accent-[var(--color-role-lp)]"
                      />
                      <span className="font-medium">Auto-compound Uniswap fees</span>
                      <HelpPopover label="Auto-compound" width="w-72">
                        <p>Keeper автоматически collects Uniswap fees и re-добавляет к NFT при каждом settlement (когда trader closes / outbid). Eliminates manual collect+re-add overhead.</p>
                        <p className="text-[11px] text-gray-500 mt-1.5">Recommended ON. Можно выключить если хочешь fees на wallet directly.</p>
                      </HelpPopover>
                    </label>
                  </div>

                  {/* Earnings estimate */}
                  {estimate && (
                    <div className="rounded-md border border-gray-200 bg-white p-3 num text-sm">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Estimated earnings (APR)</div>
                      <div className="space-y-1">
                        <PreviewRow label="Uniswap baseline" value={`${estimate.uniApr.toFixed(2)}%`} />
                        {estimate.refApr > 0 && (
                          <PreviewRow label="Reference Fees" value={`+${estimate.refApr.toFixed(2)}%`} />
                        )}
                        <PreviewRow
                          label={subsidized ? 'Premium APY (you pay)' : 'Premium APY (trader pays you)'}
                          value={subsidized ? `${minApyPct}%` : `+${estimate.premApr.toFixed(2)}%`}
                          tone={subsidized ? 'danger' : 'success'}
                        />
                        <div className="border-t border-gray-100 pt-1.5 mt-1.5">
                          <PreviewRow
                            label="Combined APR (estimate)"
                            value={`${estimate.totalApr >= 0 ? '+' : ''}${estimate.totalApr.toFixed(2)}%`}
                            bold
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
                        Estimate. Реальный earnings зависит от market demand (Premium APY auction) и Uniswap pool activity.
                      </p>
                    </div>
                  )}

                  {/* Errors */}
                  {errors.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                      <ul className="text-[11px] text-amber-900 space-y-0.5">
                        {errors.map(e => <li key={e}>⚠️ {e}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={errors.length > 0}
                    onClick={() => setConfirmOpen(true)}
                    className={
                      'w-full text-sm font-semibold px-4 py-3 rounded-md transition ' +
                      (errors.length > 0
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-[var(--color-role-lp)] text-white hover:opacity-90')
                    }
                  >
                    List NFT #{selected.tokenId} on sLiq →
                  </button>

                  <p className="text-[10px] text-gray-500 leading-snug">
                    ⓘ Listing на next block Arbitrum. После listing — NFT в protocol custody. Withdrawal anytime — 2-block keeper settlement.
                  </p>
                </div>
              )}
            </>
          ) : (
            // CREATE NEW V3 LP path
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold mb-2">Create new Uniswap V3 LP + list on sLiq</h2>
              <p className="text-sm text-gray-600 mb-3">
                Advanced workflow — мы минтим Uniswap V3 NFT и сразу листим его в sLiq одной транзакцией (multicall).
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50/40 px-3 py-3 text-xs text-amber-900">
                ⚠️ <strong>Coming in v2.</strong> Пока используй <a href="https://app.uniswap.org/positions/create" target="_blank" rel="noreferrer" className="underline">Uniswap UI</a> для создания LP, потом возвращайся сюда и импортируй NFT через <button type="button" onClick={() => setMode('import')} className="underline font-medium">Import existing</button>.
              </div>
              <div className="mt-4 space-y-2 text-xs text-gray-600 leading-relaxed">
                <p>Planned features when shipped:</p>
                <ul className="list-disc list-outside ml-5 space-y-1">
                  <li>Pool selector с TVL + 24h volume</li>
                  <li>Range presets: Full · Conservative ±20% · Balanced ±10% · Aggressive ±3%</li>
                  <li>Historical APR backtest для выбранного range</li>
                  <li>Auto-derived token0/token1 deposit split</li>
                  <li>Single tx: mint NFT + list on sLiq</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 sticky top-20">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Why list on sLiq
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-700 leading-snug">
              <li className="flex gap-2">
                <span className="text-[var(--color-status-success)] flex-shrink-0">✓</span>
                <span>Premium APY <strong>поверх</strong> Uniswap fees (avg 12-18% extra)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-status-success)] flex-shrink-0">✓</span>
                <span>Out-of-range push alerts (нет на Uniswap)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-status-success)] flex-shrink-0">✓</span>
                <span>IL-aware Net PnL view (что Uniswap не показывает)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-status-success)] flex-shrink-0">✓</span>
                <span>One-click exit (~12s, не 3-step burn dance)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-status-success)] flex-shrink-0">✓</span>
                <span>Auto-compound option (toggle, не manual collect)</span>
              </li>
            </ul>

            <hr className="my-3 border-gray-100" />

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              What stays
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-600 leading-snug">
              <li>• Uniswap fees flow normally (95% from baseline)</li>
              <li>• Ты задаёшь price range (мы не трогаем)</li>
              <li>• NFT в твоём контроле (Conservative · 1×)</li>
              <li>• Withdrawal anytime (~12s)</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Confirm modal */}
      {selected && (
        <HighStakesConfirmModal
          open={confirmOpen}
          title={subsidized ? 'Subsidized listing — confirm' : 'List NFT on sLiq — confirm'}
          subtitle={
            subsidized
              ? `Negative APY: ты будешь платить trader'ам ${Math.abs(minApyPct)}% годовых. Use только если знаешь что делаешь (Provider Leverage 50×+ покрывает subsidy через Reference Fees).`
              : 'Listing исполнится на следующем блоке Arbitrum. NFT в custody protocol — withdrawal через 2-block keeper settlement.'
          }
          currentState={[
            { label: 'NFT', value: `#${selected.tokenId} · ${selected.pair.token0}/${selected.pair.token1}` },
            { label: 'Liquidity', value: fmtUSD(selected.liquidityUSD) },
            { label: 'Range', value: `${selected.rangeLow.toFixed(4)}–${selected.rangeHigh.toFixed(4)}` },
            { label: 'In range now', value: selected.inRange ? 'Yes' : 'No' },
          ]}
          newState={[
            { label: 'Listing stability', value: isAdvanced ? `at-risk · ${leverage}×` : 'safe · 1×', deltaTone: isAdvanced ? 'negative' : 'positive' },
            { label: 'Min Premium APY', value: `${minApyPct}%`, deltaTone: subsidized ? 'negative' : 'positive' },
            { label: 'Auto-compound', value: autoCompound ? 'ON' : 'OFF', deltaTone: 'neutral' },
          ]}
          risks={[
            'Listing custody — NFT в sLiq protocol до withdrawal',
            isAdvanced ? `Advanced ${leverage}× — listing может быть liquidated при vol-event'е, можно потерять часть NFT` : 'Conservative 1× — NFT защищён, listing не может быть liquidated',
            subsidized ? `Subsidized — ты платишь ${Math.abs(minApyPct)}% годовых trader'у пока сидит` : 'Lessees платят carry — ты получаешь Premium APY',
            'Withdrawal 2-block keeper settlement — instant cancel невозможен',
          ]}
          irreversibilityNote="Listing settled на next block Arbitrum (~0.5s). Withdrawal — отдельный flow."
          confirmType="checkbox"
          confirmButtonLabel={subsidized ? 'Confirm subsidized listing' : 'Confirm listing'}
          onConfirm={() => {
            setConfirmOpen(false)
            navigate('/lp/listings')
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

// === Components ===

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 text-sm rounded transition ' +
        (active ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-600 hover:text-gray-900')
      }
    >
      {children}
    </button>
  )
}

function NFTOption({
  nft,
  selected,
  onSelect,
}: {
  nft: WalletNFT
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'w-full text-left rounded-lg border p-3 transition ' +
        (selected
          ? 'border-[var(--color-role-lp)] bg-[var(--color-role-lp-bg)]/30 ring-1 ring-[var(--color-role-lp)]/30'
          : 'border-gray-200 bg-white hover:bg-gray-50')
      }
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <input
            type="radio"
            checked={selected}
            onChange={() => {}}
            className="w-4 h-4 accent-[var(--color-role-lp)] flex-shrink-0"
          />
          <span className="num text-xs text-gray-500">#{nft.tokenId}</span>
          <span className="font-medium text-gray-900">{nft.pair.token0} / {nft.pair.token1}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
            {fmtFeeTier(nft.feeTierBps)}
          </span>
          {nft.inRange ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
              in range
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              out of range
            </span>
          )}
        </div>
        <div className="text-right num text-xs">
          <div className="font-semibold text-gray-900">{fmtUSD(nft.liquidityUSD)}</div>
          <div className="text-gray-500 text-[10px]">Uni baseline {fmtPct(nft.uniswapApyBps)}</div>
        </div>
      </div>
      <div className="mt-1.5 text-[11px] num text-gray-600">
        Range {nft.rangeLow.toFixed(nft.rangeLow < 10 ? 4 : 0)}–{nft.rangeHigh.toFixed(nft.rangeHigh < 10 ? 4 : 0)} · current {nft.currentPrice.toFixed(nft.currentPrice < 10 ? 4 : 0)}
      </div>
    </button>
  )
}

function ModeOption({
  active,
  onClick,
  title,
  subtitle,
  recommended,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
  recommended?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-lg border p-3 text-left transition ' +
        (active
          ? 'border-[var(--color-role-lp)] bg-[var(--color-role-lp-bg)]/30'
          : 'border-gray-200 bg-white hover:bg-gray-50')
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{title}</span>
        {recommended && (
          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] font-semibold">
            recommended
          </span>
        )}
      </div>
      <div className="text-[11px] text-gray-600 mt-0.5">{subtitle}</div>
    </button>
  )
}

function PreviewRow({ label, value, tone, bold }: { label: string; value: React.ReactNode; tone?: 'success' | 'danger'; bold?: boolean }) {
  const color = tone === 'success' ? 'var(--color-status-success)' : tone === 'danger' ? 'var(--color-status-danger)' : undefined
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      <span className={'num ' + (bold ? 'font-bold text-sm' : 'font-medium')} style={{ color }}>{value}</span>
    </div>
  )
}
