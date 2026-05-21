// ListingsTable — v3 round of feedback applied:
//   - Fee chip merged into pair-cell (v1-reference style: pair + DEX chip + fee chip)
//   - Fee column REMOVED
//   - OWNED subtle (small grey text, no green border / no green badge)
//   - Status chips wrapped in <abbr title> for tooltip-on-hover расшифровки
//   - Mode column renamed "Leverage" + tooltip explaining Provider Leverage
//   - DEX labels expanded: Uniswap V3/V4, PancakeSwap V3, GMX, other

import { useNavigate } from 'react-router-dom'
import type { DexProtocol, Listing, ListingStatus } from '@/lib/types'
import {
  capacityFreePct,
  getNetApyBps,
  getRangeStatus,
  isSubsidized,
  pairLabel,
  splitToTokens,
  type OutbidOpportunity,
} from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtToken, fmtUSD } from '@/lib/format'
import { HelpPopover } from '@/components/HelpPopover'
import { RangeBar } from '@/components/RangeBar'

interface Props {
  listings: Listing[]
  connectedAddress: string
  outbidByListing?: Map<string, OutbidOpportunity>
}

export function ListingsTable({ listings, connectedAddress, outbidByListing }: Props) {
  const navigate = useNavigate()
  const open = (id: string) => navigate(`/listings/${id}`)

  return (
    <>
      {/* Desktop table (md+) */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          {/* Trader marketplace columns (Eugene 2026-05-20 — ТЗ §3.1):
              Pair · Status · Pool size · Range · Rent APY · Net APY.
              Dropped: «Listing stability» chip (Provider Leverage moves to
              detail), separate «Available» column (folded under Pool size),
              «Listed» timestamp (moves to detail). */}
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair · DEX · fee</th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Status
                  <HelpPopover label="Listing status" width="w-80">
                    <p className="font-semibold mb-2">Состояния листинга</p>
                    <ul className="space-y-1.5 text-[11px] leading-snug">
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-700 border border-gray-200 mr-1">open · in range</span> — цена внутри range LP. IP convex, можно зайти.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-500 border border-gray-200 mr-1">open · out of range</span> — цена вне range. Зайти можно если ждёшь возврата.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">full · outbid only</span> — capacity занята. Заход только через Buyout incumbent'а.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">closing · LP exit</span> — LP попросил вывод. Новых трейдеров не принимает.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 mr-1">💥 liquidating</span> — Listing-level ликвидация в процессе. Зайти нельзя.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-300 mr-1">closed · liquidated</span> / <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-300 mr-1">closed</span> — терминальные.</li>
                    </ul>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Pool size
                  <HelpPopover label="Pool size · Available" width="w-72">
                    <p className="font-semibold mb-1">Размер пула + доступность</p>
                    <p className="mb-1.5">Верхняя строка — размер LP-позиции в $ + разбивка по токенам (например, <span className="num">1.2 ETH + 3500 USDC</span>).</p>
                    <p className="text-[11px] text-gray-600">«Available X (Y%)» — сколько ещё свободно для нового трейдера. При Provider Leverage &gt; 1× total capacity больше, чем сам NFT — плечо умножает доступный пул.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">
                <span className="inline-flex items-center gap-1">
                  Range
                  <HelpPopover label="Range · centered" width="w-72">
                    <p className="font-semibold mb-1">Где цена относительно range</p>
                    <p>Полоса показывает текущую цену (▼) между нижней и верхней границей LP-range. Подписи под границами — % отклонение от текущей цены. Когда цена выходит за range — маркер сдвигается к краю.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Rent APY
                  <HelpPopover label="Rent APY — цена позиции" width="w-72">
                    <p className="font-semibold mb-1">Сколько стоит держать позицию</p>
                    <p className="mb-1.5">«Цена аренды» LP-NFT. Сумма Premium APY (что платишь LP) и Uniswap baseline. Чем больше Rent — тем дороже позиция, но и тем больше convex IP при движении цены.</p>
                    <p className="text-[11px] text-gray-500">Если Premium отрицательный (subsidized) — наоборот, LP платит тебе.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Net APY
                  <HelpPopover label="Net APY — заработок позиции" width="w-72">
                    <p className="font-semibold mb-1">Ожидаемый чистый годовой</p>
                    <p className="mb-1.5">Net = Impermanent Profit APY − Premium APY. <span className="text-[var(--color-status-success)] font-semibold">Зелёный</span> → позиция в плюсе при текущих условиях. <span className="text-[var(--color-status-danger)] font-semibold">Красный</span> → premium burn выше ожидаемого payoff.</p>
                    <p className="text-[11px] text-gray-500"><strong>Illustrative</strong>: посчитан на базе historical Uniswap APY как proxy для IP. Не предсказание.</p>
                  </HelpPopover>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listings.map(l => (
              <DesktopRow
                key={l.id}
                listing={l}
                isOwned={l.owner === connectedAddress}
                outbid={outbidByListing?.get(l.id)}
                onClick={() => open(l.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked rows */}
      <div className="md:hidden rounded-lg border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
        {listings.map(l => (
          <MobileRow
            key={l.id}
            listing={l}
            isOwned={l.owner === connectedAddress}
            outbid={outbidByListing?.get(l.id)}
            onClick={() => open(l.id)}
          />
        ))}
      </div>
    </>
  )
}

function DesktopRow({
  listing,
  isOwned,
  outbid,
  onClick,
}: {
  listing: Listing
  isOwned: boolean
  outbid?: OutbidOpportunity
  onClick: () => void
}) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const isAdvanced = listing.providerMode === 'advanced'
  const freePct = capacityFreePct(listing)
  const inactiveBg =
    listing.status === 'LIQUIDATING'
      ? 'bg-red-50/30'
      : listing.status === 'LIQUIDATED' || listing.status === 'WITHDRAWN'
      ? 'bg-gray-50/50 opacity-75'
      : ''

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={
        'group cursor-pointer transition border-b border-gray-100 last:border-b-0 ' +
        inactiveBg +
        ' hover:bg-gray-50 focus:outline-none focus:bg-gray-50 focus:ring-1 focus:ring-[var(--color-role-trader)]/40 focus:ring-inset'
      }
    >
      {/* Pair + DEX chip + Fee chip */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PairIcons pair={listing.pair} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 group-hover:text-[var(--color-role-trader)] transition truncate">
                {pairLabel(listing)}
              </span>
              {isOwned && (
                <span className="text-[10px] uppercase tracking-wide text-gray-500">· owned</span>
              )}
              {subsidized && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold whitespace-nowrap">
                  LP pays you
                </span>
              )}
              {outbid && (
                <span
                  className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold whitespace-nowrap cursor-help"
                  title={`Incumbent с +${fmtUSD(outbid.bestPositivePnlUSD)} PnL. Перебей ставкой выше ${fmtPct(outbid.weakestApyBps)} APY — захвати convex tail.`}
                >
                  🎯 outbid +{fmtUSD(outbid.bestPositivePnlUSD)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <DexChip dex={listing.dex} />
              <FeeChip feeTierBps={listing.feeTierBps} />
            </div>
          </div>
        </div>
      </td>

      {/* Status — single source of truth for «can I enter / what kind of
          entry / is it in-range or not». Provider Leverage moved to detail. */}
      <td className="px-3 py-3">
        <StatusChip status={listing.status} leasedPct={100 - freePct} rangeStatus={rangeStatus} />
      </td>

      {/* Pool size — $ + token pair breakdown + Available sub-line. */}
      <td className="px-3 py-3 text-right">
        {(() => {
          const { t0Amt, t1Amt } = splitToTokens(listing.initialLiquidityUSD, listing)
          return (
            <>
              <div className="num font-semibold text-gray-900 leading-tight">{fmtUSD(listing.initialLiquidityUSD)}</div>
              {t0Amt !== null && t1Amt !== null && (
                <div className="text-[10px] text-gray-500 num leading-tight mt-0.5 whitespace-nowrap">
                  {fmtToken(t0Amt, listing.pair.token0)} · {fmtToken(t1Amt, listing.pair.token1)}
                </div>
              )}
              <div
                className="text-[10px] num leading-tight mt-1"
                style={{
                  color: freePct < 5
                    ? 'var(--color-status-warning)'
                    : 'var(--color-text-muted, #6b7280)',
                }}
                title={`Available ${fmtUSD(listing.availableCapacityUSD)} of ${fmtUSD(listing.totalCapacityUSD)} (${Math.round(freePct)}%)`}
              >
                Available {fmtUSD(listing.availableCapacityUSD)} ({Math.round(freePct)}%)
              </div>
            </>
          )
        })()}
      </td>

      {/* Range — centered RangeBar primitive (per ТЗ §3.2, P1 R-076).
          Hidden on small screens to keep the row tight. */}
      <td className="px-3 py-3 hidden md:table-cell" style={{ minWidth: '180px' }}>
        <RangeBar
          rangeLow={listing.rangeLow}
          rangeHigh={listing.rangeHigh}
          currentPrice={listing.currentPrice}
        />
      </td>

      {/* Rent APY — what trader pays. Headline = Premium + Uniswap;
          breakdown sub-line shows the split. Subsidized listings (negative
          Premium) keep the signed render so the sign reads correctly. */}
      <td className="px-3 py-3 text-right">
        {(() => {
          const rentBps = listing.minPremiumApyBps + listing.uniswapApyBps
          return (
            <>
              <div
                className="num font-semibold leading-tight"
                style={{ color: subsidized && rentBps < 0 ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
              >
                {fmtPct(rentBps, { signed: subsidized })}
              </div>
              <div className="text-[10px] text-gray-500 num leading-tight mt-0.5 whitespace-nowrap">
                {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)} Prem
                {' + '}
                {fmtPct(listing.uniswapApyBps)} Uni
              </div>
            </>
          )
        })()}
      </td>

      {/* Net APY — illustrative: Uniswap APY (IP proxy) − Premium APY.
          Signed, green/red. Caveat lives in the column-header tooltip. */}
      <td className="px-3 py-3 text-right">
        {(() => {
          const netBps = getNetApyBps(listing)
          const positive = netBps >= 0
          return (
            <div
              className="num font-semibold leading-tight"
              style={{ color: positive ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
            >
              {fmtPct(netBps, { signed: true })}
            </div>
          )
        })()}
      </td>
    </tr>
  )
}

function MobileRow({
  listing,
  isOwned,
  outbid,
  onClick,
}: {
  listing: Listing
  isOwned: boolean
  outbid?: OutbidOpportunity
  onClick: () => void
}) {
  const rangeStatus = getRangeStatus(listing)
  const subsidized = isSubsidized(listing)
  const isAdvanced = listing.providerMode === 'advanced'
  const freePct = capacityFreePct(listing)
  const inactiveBg =
    listing.status === 'LIQUIDATING'
      ? 'bg-red-50/30'
      : listing.status === 'LIQUIDATED' || listing.status === 'WITHDRAWN'
      ? 'bg-gray-50/50 opacity-75'
      : 'bg-white hover:bg-gray-50'

  return (
    <button
      type="button"
      onClick={onClick}
      className={'w-full text-left px-4 py-3 transition active:bg-gray-100 ' + inactiveBg}
    >
      {/* Top-right headline = Net APY (signed earning signal — green/red).
          Rent APY (cost) drops to a sub-line. Mirror of new desktop column
          priority: Net is the «interesting / take it» metric. */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PairIcons pair={listing.pair} compact />
          <span className="font-semibold text-base truncate">{pairLabel(listing)}</span>
          {isOwned && (
            <span className="text-[10px] uppercase tracking-wide text-gray-500 flex-shrink-0">· owned</span>
          )}
        </div>
        {(() => {
          const netBps = getNetApyBps(listing)
          const rentBps = listing.minPremiumApyBps + listing.uniswapApyBps
          const positive = netBps >= 0
          return (
            <div className="text-right num flex-shrink-0">
              <div
                className="font-semibold text-base"
                style={{ color: positive ? 'var(--color-status-success)' : 'var(--color-status-danger)' }}
              >
                {fmtPct(netBps, { signed: true })}
              </div>
              <div className="text-[10px] text-gray-500">
                Rent {fmtPct(rentBps, { signed: subsidized })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Chip row — pair · DEX · fee · status. Provider Leverage chip dropped
          (moves to detail per ТЗ); subsidized + outbid kept (actionable). */}
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <DexChip dex={listing.dex} />
        <FeeChip feeTierBps={listing.feeTierBps} />
        <StatusChip status={listing.status} leasedPct={100 - freePct} rangeStatus={rangeStatus} tiny />
        {subsidized && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-negative-apy-bg)] text-[var(--color-negative-apy)] font-semibold">
            LP pays you
          </span>
        )}
        {outbid && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold whitespace-nowrap">
            🎯 outbid +{fmtUSD(outbid.bestPositivePnlUSD)}
          </span>
        )}
      </div>

      {/* Pool size + Available sub-line — matches new desktop Pool column. */}
      <div className="mt-2 text-[11px] num text-gray-700 flex items-baseline justify-between gap-2">
        <span>
          <span className="font-semibold text-gray-900">{fmtUSD(listing.initialLiquidityUSD)}</span>
          <span className="text-gray-500"> pool</span>
        </span>
        {(() => {
          const { t0Amt, t1Amt } = splitToTokens(listing.initialLiquidityUSD, listing)
          if (t0Amt === null || t1Amt === null) return null
          return (
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              {fmtToken(t0Amt, listing.pair.token0)} · {fmtToken(t1Amt, listing.pair.token1)}
            </span>
          )
        })()}
      </div>
      <div className="mt-1">
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={
              'h-full transition-all ' +
              (freePct < 5
                ? 'bg-amber-400'
                : freePct < 25
                ? 'bg-amber-300'
                : 'bg-[var(--color-status-success)]/70')
            }
            style={{ width: `${freePct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1 text-[10px] num text-gray-500 text-right">
          Available {fmtUSD(listing.availableCapacityUSD)} ({Math.round(freePct)}%)
        </div>
      </div>

      {/* Centered range scale — same primitive as desktop. */}
      <div className="mt-3">
        <RangeBar
          rangeLow={listing.rangeLow}
          rangeHigh={listing.rangeHigh}
          currentPrice={listing.currentPrice}
        />
      </div>
    </button>
  )
}

function DexChip({ dex }: { dex: DexProtocol }) {
  // Single neutral chip "Uniswap v3" — no bright DEX-brand colors
  const labelMap: Record<DexProtocol, string> = {
    'uniswap-v3': 'Uniswap v3',
    'uniswap-v4': 'Uniswap v4',
    'pancakeswap-v3': 'PancakeSwap v3',
    gmx: 'GMX',
    other: 'Other DEX',
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">
      {labelMap[dex]}
    </span>
  )
}

function FeeChip({ feeTierBps }: { feeTierBps: number }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 num">
      {fmtFeeTier(feeTierBps)}
    </span>
  )
}

function StatusChip({
  status,
  leasedPct,
  rangeStatus,
  tiny,
}: {
  status: ListingStatus
  leasedPct: number
  rangeStatus: 'in-range' | 'out-of-range'
  tiny?: boolean
}) {
  const sizeCls = tiny ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls

  const data = (() => {
    if (status === 'LIQUIDATING')
      return {
        label: '💥 liquidating',
        cls: 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40',
        tip: 'Listing-level ликвидация в процессе. Все позиции закрываются по snapshot-цене. Зайти нельзя.',
      }
    if (status === 'LIQUIDATED')
      return {
        label: 'closed · liquidated',
        cls: 'bg-gray-100 text-gray-700 border border-gray-300',
        tip: 'Листинг полностью ликвидирован. Зайти нельзя. LP residual NFT (если остался) можно claim.',
      }
    if (status === 'WITHDRAWAL_REQUESTED')
      return {
        label: 'closing · LP exit',
        cls: 'bg-amber-50 text-amber-900 border border-amber-300',
        tip: 'LP попросил вывод NFT. Позиции принудительно закрываются. Новых трейдеров не принимает.',
      }
    if (status === 'WITHDRAWN')
      return {
        label: 'closed',
        cls: 'bg-gray-100 text-gray-500 border border-gray-300',
        tip: 'LP забрал NFT. Листинг закрыт. Зайти нельзя.',
      }
    // ACTIVE — derive trader-facing label from leased% + range
    if (leasedPct >= 99.5)
      return {
        label: 'full · outbid only',
        cls: 'bg-amber-50 text-amber-900 border border-amber-300',
        tip: 'Вся capacity занята. Чтобы зайти — предложи Premium APY выше текущего трейдера (перекуп).',
      }
    if (rangeStatus === 'in-range')
      return {
        label: 'open · in range',
        cls: 'bg-gray-50 text-gray-700 border border-gray-200',
        tip: 'Листинг активен, цена внутри range. Uniswap fees начисляются, IP convex. Заходи трейдером.',
      }
    return {
      label: 'open · out of range',
      cls: 'bg-gray-50 text-gray-500 border border-gray-200',
      tip: 'Листинг активен, но цена вне range. Fees не начисляются сейчас. Заходить можно — если ждёшь возврата цены в диапазон.',
    }
  })()

  return (
    <span className={baseCls + ' ' + data.cls} title={data.tip}>
      {data.label}
    </span>
  )
}

function PairIcons({
  pair,
  compact,
}: {
  pair: { token0: string; token1: string }
  compact?: boolean
}) {
  const size = compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]'
  return (
    <div className="relative flex flex-shrink-0">
      <span
        className={
          'inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-white ' +
          size
        }
        style={{ background: stringToColor(pair.token0) }}
        aria-hidden="true"
      >
        {pair.token0.slice(0, 1)}
      </span>
      <span
        className={
          'inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-white -ml-1.5 ' +
          size
        }
        style={{ background: stringToColor(pair.token1) }}
        aria-hidden="true"
      >
        {pair.token1.slice(0, 1)}
      </span>
    </div>
  )
}

function PriceInRange({
  low,
  high,
  current,
  inRange,
}: {
  low: number
  high: number
  current: number
  inRange: boolean
}) {
  const width = high - low
  // Clamp marker between -10% and 110% (out-of-range shown at edge with overflow indicator)
  const rawPos = width > 0 ? ((current - low) / width) * 100 : 50
  const clampedPos = Math.max(-10, Math.min(110, rawPos))
  const outLeft = rawPos < 0
  const outRight = rawPos > 100
  const fmtPrice = (n: number) => {
    if (n >= 1000) return `$${Math.round(n).toLocaleString()}`
    if (n >= 1) return `$${n.toFixed(2)}`
    if (n >= 0.01) return `$${n.toFixed(4)}`
    return `$${n.toExponential(2)}`
  }
  const markerColor = inRange ? 'var(--color-status-success)' : 'var(--color-status-warning)'

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Current price big */}
      <div className="num text-[11px]" style={{ color: markerColor }}>
        {outLeft && '◂ '}<span className="font-semibold">{fmtPrice(current)}</span>{outRight && ' ▸'}
      </div>
      {/* Range bar with marker */}
      <div className="relative w-24 h-2 rounded-full bg-gray-100" aria-hidden="true">
        {/* In-range zone */}
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-[var(--color-role-lp)]/15" />
        {/* Marker */}
        <div
          className="absolute -top-0.5 w-0.5 h-3"
          style={{
            left: `calc(${clampedPos}% - 1px)`,
            background: markerColor,
          }}
        />
        <div
          className="absolute -bottom-2 text-[7px] font-bold leading-none"
          style={{
            left: `calc(${clampedPos}% - 4px)`,
            color: markerColor,
          }}
        >
          ▲
        </div>
      </div>
      {/* Range bounds */}
      <div className="flex justify-between w-24 text-[9px] num text-gray-400 mt-1.5">
        <span>{fmtPrice(low)}</span>
        <span>{fmtPrice(high)}</span>
      </div>
    </div>
  )
}

function stringToColor(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `oklch(58% 0.13 ${hue})`
}
