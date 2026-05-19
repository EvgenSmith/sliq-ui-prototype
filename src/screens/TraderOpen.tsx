// S8 Open Position wizard — design spec §8 S8 + §11.6
// Trader configures and opens a ShortPool position on a listing.
// Exercises NotionalInput (replaces raw uint128) + APY bid with negative validation
// + two-token margin presets + leverage indicator (derived) + RiskPanel preview + HighStakesConfirmModal.

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listings, positions } from '@/mocks/data'
import { fmtFeeTier, fmtPct, fmtRange, fmtUSD, shortAddr } from '@/lib/format'
import { NotionalInput } from '@/components/NotionalInput'
// RiskPanel dropped from this screen per Eugene 2026-05-18 — see comment
// near the (removed) <RiskPanel> render block below.
import { HighStakesConfirmModal } from '@/components/HighStakesConfirmModal'

type Mode = 'token0' | 'token1' | 'USD'
type Preset = 'min' | 'balanced' | 'max-safe' | 'custom'

export function TraderOpen() {
  const [params] = useSearchParams()
  const listingId = params.get('listing')
  const intent = params.get('intent')
  const targetPositionId = params.get('position')
  const isOutbid = intent === 'outbid' && !!targetPositionId
  const navigate = useNavigate()

  const listing = useMemo(() => listings.find(l => l.id === listingId), [listingId])
  const targetPosition = useMemo(
    () => positions.find(p => p.id === targetPositionId),
    [targetPositionId]
  )

  // Form state
  const [notional, setNotional] = useState<{ mode: Mode; amount: number }>({
    mode: 'USD',
    amount: 25_000,
  })
  // APY in % (UI uses pct, contract uses bps). Default to listing min, allow negative when listing allows.
  const [apyPct, setApyPct] = useState<number>(
    listing
      ? Math.max((listing.minPremiumApyBps + 100) / 100, listing.minPremiumApyBps / 100)
      : 10
  )
  const [margin0, setMargin0] = useState<number>(0.05)
  const [margin1, setMargin1] = useState<number>(150)
  const [preset, setPreset] = useState<Preset>('balanced')
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">No listing selected</h2>
        <p className="text-sm text-gray-600 mb-4">Pick a listing from the marketplace first.</p>
        <Link to="/listings" className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition">
          Browse listings →
        </Link>
      </div>
    )
  }

  // Derived numbers
  const notionalUSD = notional.mode === 'USD'
    ? notional.amount
    : notional.mode === 'token0'
    ? notional.amount * listing.currentPrice
    : notional.amount
  const marginValueUSD =
    margin1 + margin0 * listing.currentPrice
  const effectiveLeverage = marginValueUSD > 0
    ? Math.round(notionalUSD / marginValueUSD)
    : 0
  const apyBps = Math.round(apyPct * 100)
  const minApy = listing.minPremiumApyBps
  const apyValid = apyBps >= minApy
  const apyStepValid = apyBps % 100 === 0 // 1% step on Beta
  const isAdvancedListing = listing.providerMode === 'advanced'
  const subsidizedListing = listing.minPremiumApyBps < 0
  const traderReceivesCarry = apyBps < 0

  // Margin presets
  function applyPreset(p: Preset) {
    if (!listing) return
    setPreset(p)
    const sizeRef = Math.max(notionalUSD, 1)
    const price = listing.currentPrice
    switch (p) {
      case 'min': {
        const usdTarget = sizeRef / 1000 // 1000x max
        setMargin0(usdTarget / 2 / price)
        setMargin1(usdTarget / 2)
        break
      }
      case 'balanced': {
        const usdTarget = sizeRef / 100
        setMargin0(usdTarget / 2 / price)
        setMargin1(usdTarget / 2)
        break
      }
      case 'max-safe': {
        const usdTarget = sizeRef / 25
        setMargin0(usdTarget / 2 / price)
        setMargin1(usdTarget / 2)
        break
      }
      // custom — leave manual values
    }
  }

  // stressPreview values were the only consumer of RiskPanel — dropped along
  // with the panel itself (Eugene 2026-05-18). Will be redesigned with the
  // trader-side overhaul informed by the May 18 trader-interface review.

  const canSubmit =
    apyValid && apyStepValid && marginValueUSD > 0 && notionalUSD > 0 && notionalUSD <= listing.availableCapacityUSD + (isOutbid ? listing.totalCapacityUSD : 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-xs text-gray-500 mb-3">
        <Link to="/listings" className="hover:underline">
          Listings
        </Link>
        <span className="mx-1.5">/</span>
        <Link to={`/listings/${listing.id}`} className="hover:underline">
          {listing.pair.token0} / {listing.pair.token1}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{isOutbid ? 'Outbid' : 'Open position'}</span>
      </nav>

      <header className="mb-6 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isOutbid ? 'Outbid active position' : 'Open ShortPool position'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {listing.pair.token0} / {listing.pair.token1}
            <span className="text-gray-500 ml-2 num">fee {fmtFeeTier(listing.feeTierBps)}</span>
            <span className="text-gray-500 ml-2 num">range {fmtRange(listing.rangeLow, listing.rangeHigh)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdvancedListing && (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-medium">
              Advanced · {listing.providerLeverage}× listing
            </span>
          )}
          {subsidizedListing && (
            <span className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] border border-[var(--color-negative-apy)]/30 font-medium">
              LP pays carry · subsidized
            </span>
          )}
        </div>
      </header>

      {isOutbid && targetPosition && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Outbidding existing position </span>
          <span className="num">{targetPosition.id} </span> · current APY{' '}
          <span className="num font-medium">{fmtPct(targetPosition.apyBps, { signed: true })}</span> · trader{' '}
          {shortAddr(targetPosition.trader)} · their position will be force-closed when keeper picks up.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <section className="lg:col-span-2 space-y-5">
          {/* 1. Position size */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <NotionalInput
              pair={listing.pair}
              currentPrice={listing.currentPrice}
              feeTierBps={listing.feeTierBps}
              capacityUSD={listing.availableCapacityUSD > 0 ? listing.availableCapacityUSD : listing.totalCapacityUSD}
              value={notional.amount}
              mode={notional.mode}
              onChange={setNotional}
              label="Position size"
              helper="Enter the size you want to long-gamma. We convert this to liquidity units for you."
            />
          </div>

          {/* 2. APY bid */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-gray-800">Premium APY you bid</label>
              <span
                className="num font-medium"
                style={{ color: apyBps < 0 ? 'var(--color-negative-apy)' : undefined }}
              >
                {apyPct > 0 ? '+' : ''}{apyPct.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={subsidizedListing ? -50 : 0}
              max={50}
              step={1}
              value={apyPct}
              onChange={e => setApyPct(Number(e.target.value))}
              className="w-full accent-[var(--color-role-trader)]"
            />
            <p className="text-xs text-gray-600">
              {subsidizedListing ? (
                <>
                  Listing minimum: <span className="num">{fmtPct(minApy, { signed: true })}</span>.
                  The APY shown here is what <span className="font-medium">you'll receive from the LP</span> — they're paying you
                  to take this exposure. Step: 1%.
                </>
              ) : (
                <>
                  Listing minimum: <span className="num">{fmtPct(minApy)}</span>.
                  Step: 1%. The APY you bid is the carry you pay until you close.
                </>
              )}
            </p>
            {!apyValid && (
              <p className="text-xs text-[var(--color-status-danger)]">
                Bid must be at least {fmtPct(minApy, { signed: true })} (listing minimum).
              </p>
            )}
            {apyValid && !apyStepValid && (
              <p className="text-xs text-[var(--color-status-danger)]">
                Bid must align to 1% step.
              </p>
            )}
            {traderReceivesCarry && apyValid && (
              <p className="text-xs text-[var(--color-negative-apy)] bg-[var(--color-negative-apy-bg)] border border-[var(--color-negative-apy)]/20 rounded p-2">
                You'll <span className="font-medium">receive</span> {fmtPct(Math.abs(apyBps))} annualized from the LP. Carry is
                yours; you still pay Reference Fees and bear position-level liquidation risk.
              </p>
            )}
          </div>

          {/* 3. Margin */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-gray-800">Margin (two-token)</label>
              <span className="text-xs text-gray-500 num">≈ {fmtUSD(marginValueUSD)} value</span>
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              {(['min', 'balanced', 'max-safe', 'custom'] as Preset[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={
                    'px-3 py-1.5 rounded-md border transition ' +
                    (preset === p
                      ? 'border-gray-900 bg-gray-900 text-white font-medium'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  {p === 'max-safe' ? 'Max safe' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  {listing.pair.token0} (margin)
                </label>
                <input
                  type="number"
                  value={margin0 || ''}
                  onChange={e => {
                    setMargin0(Number(e.target.value))
                    setPreset('custom')
                  }}
                  placeholder="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm num"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  {listing.pair.token1} (margin)
                </label>
                <input
                  type="number"
                  value={margin1 || ''}
                  onChange={e => {
                    setMargin1(Number(e.target.value))
                    setPreset('custom')
                  }}
                  placeholder="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm num"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-gray-500">
              <div className="num">
                Wallet: <span className="text-gray-700">2.4 {listing.pair.token0}</span>
              </div>
              <div className="num">
                Wallet: <span className="text-gray-700">12,400 {listing.pair.token1}</span>
              </div>
            </div>

            {/* Leverage indicator (derived, read-only) */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-baseline justify-between">
              <span className="text-sm text-gray-700">Effective leverage</span>
              <span
                className="num font-semibold text-base"
                style={{
                  color: effectiveLeverage > 500
                    ? 'var(--color-status-danger)'
                    : effectiveLeverage > 100
                    ? 'var(--color-status-warning)'
                    : effectiveLeverage > 10
                    ? 'var(--color-status-info)'
                    : 'var(--color-status-neutral)',
                }}
              >
                {effectiveLeverage}×
              </span>
            </div>
            {effectiveLeverage > 500 && (
              <p className="text-xs text-[var(--color-status-danger)]">
                Above 500×, a 0.2% adverse move can wipe your margin.
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center gap-3">
            <Link
              to={`/listings/${listing.id}`}
              className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
            >
              ← Cancel
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
              className={
                'ml-auto text-sm font-semibold px-4 py-2 rounded-md transition ' +
                (canSubmit
                  ? 'bg-[var(--color-role-trader)] text-white hover:opacity-90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed')
              }
            >
              {isOutbid ? 'Outbid position →' : 'Open position →'}
            </button>
          </div>
        </section>

        {/* Sidebar — preview */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Live preview
            </h3>
            <dl className="space-y-1.5 text-sm">
              <Row k="Notional" v={<span className="num font-medium">{fmtUSD(notionalUSD)}</span>} />
              <Row
                k="Premium APY"
                v={
                  <span
                    className="num font-medium"
                    style={{ color: apyBps < 0 ? 'var(--color-negative-apy)' : undefined }}
                  >
                    {apyPct > 0 ? '+' : ''}{apyPct.toFixed(1)}%
                    {apyBps < 0 && <span className="text-xs text-gray-500 ml-1">(you receive)</span>}
                  </span>
                }
              />
              <Row k="Margin (token0)" v={<span className="num">{margin0.toLocaleString('en-US', { maximumFractionDigits: 4 })} {listing.pair.token0}</span>} />
              <Row k="Margin (token1)" v={<span className="num">{margin1.toLocaleString('en-US', { maximumFractionDigits: 0 })} {listing.pair.token1}</span>} />
              <Row k="Margin value" v={<span className="num">{fmtUSD(marginValueUSD)}</span>} />
              <Row k="Effective leverage" v={<span className="num font-medium">{effectiveLeverage}×</span>} />
            </dl>
            <hr className="border-gray-100 my-3" />
            <dl className="space-y-1.5 text-sm">
              <Row k="Daily Reference fee" v={<span className="num">≈ {fmtUSD(notionalUSD * (listing.uniswapApyBps / 10000) / 365)}/day</span>} />
              <Row
                k="Daily Premium APY"
                v={
                  <span
                    className="num"
                    style={{ color: apyBps < 0 ? 'var(--color-negative-apy)' : undefined }}
                  >
                    {apyBps < 0 ? '+' : '−'}{fmtUSD(Math.abs(notionalUSD * (apyBps / 10000) / 365))}/day
                  </span>
                }
              />
            </dl>
          </div>

          {/* «Advanced — listing risk» preview panel removed per Eugene
              2026-05-18 («Этот блок выпили»). The aggregate-reserve / stress
              / distance-to-liq read here will be redesigned as part of the
              trader-side overhaul informed by the May 18 trader-interface
              review. Until then, the trader gets risk context inline in the
              open-position card (margin / leverage / liq distance) and on
              the per-position pages — no aside panel here. */}
        </aside>
      </div>

      <HighStakesConfirmModal
        open={confirmOpen}
        title={isOutbid ? 'Outbid active position — confirm' : 'Open ShortPool position — confirm'}
        subtitle={
          isOutbid
            ? 'Your bid replaces the current trader. Their position is force-closed.'
            : 'Position can only be closed via Request Close → keeper executes next block. Not instant.'
        }
        currentState={[
          { label: 'Listing', value: `${listing.pair.token0}/${listing.pair.token1}` },
          { label: 'Available capacity', value: fmtUSD(listing.availableCapacityUSD) },
          isOutbid && targetPosition
            ? { label: 'Existing APY', value: fmtPct(targetPosition.apyBps, { signed: true }) }
            : { label: 'Listing min APY', value: fmtPct(minApy, { signed: true }) },
        ]}
        newState={[
          { label: 'Your notional', value: fmtUSD(notionalUSD), deltaTone: 'neutral' },
          {
            label: 'APY paid',
            value: `${apyPct > 0 ? '+' : ''}${apyPct.toFixed(1)}%`,
            deltaTone: apyBps < 0 ? 'positive' : 'negative',
          },
          { label: 'Effective leverage', value: `${effectiveLeverage}×`, deltaTone: 'neutral' },
        ]}
        risks={[
          'Settlement uses live pool price — slippage is real.',
          'Reference Fees and Premium APY are paid before your residual.',
          traderReceivesCarry
            ? 'You receive Premium APY as carry. Reference Fees still flow to LP.'
            : 'If reserve drops below 10% of initial, your position is liquidated and margin is lost.',
        ]}
        irreversibilityNote={
          isOutbid
            ? 'Once submitted, your bid is on-chain. Lowering it requires close + reopen.'
            : 'Once a keeper picks up the close (typically next block), it is final.'
        }
        confirmType="checkbox"
        confirmButtonLabel={isOutbid ? 'Confirm — Outbid' : 'Confirm — Open'}
        onConfirm={() => {
          setConfirmOpen(false)
          navigate('/trader/positions/P3')
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}
