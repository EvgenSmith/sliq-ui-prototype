// ListingsTable — v3 round of feedback applied:
//   - Fee chip merged into pair-cell (v1-reference style: pair + DEX chip + fee chip)
//   - Fee column REMOVED
//   - OWNED subtle (small grey text, no green border / no green badge)
//   - Status chips wrapped in <abbr title> for tooltip-on-hover расшифровки
//   - Mode column renamed "Leverage" + tooltip explaining Provider Leverage
//   - DEX labels expanded: Uniswap V3/V4, PancakeSwap V3, GMX, other

import { useNavigate } from 'react-router-dom'
import type { DexProtocol, Listing } from '@/lib/types'
import {
  capacityFreePct,
  getNetApyBps,
  getRangeStatus,
  getTraderListingStatus,
  isSubsidized,
  pairLabel,
  splitToTokens,
  type OutbidOpportunity,
  type TraderCtaKind,
  type TraderListingChip,
  type TraderListingStatus,
} from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtToken, fmtUSD } from '@/lib/format'
import { HelpPopover } from '@/components/HelpPopover'
import { RangeBar } from '@/components/RangeBar'
import { positions } from '@/mocks/data'

interface Props {
  listings: Listing[]
  connectedAddress: string
  outbidByListing?: Map<string, OutbidOpportunity>
}

export function ListingsTable({ listings, connectedAddress, outbidByListing }: Props) {
  const navigate = useNavigate()
  const open = (id: string) => navigate(`/listings/${id}`)

  // Primary-CTA handler removed per Eugene 2026-05-20 — Action column gone;
  // detail page handles all action flows. Row click navigates to detail and
  // the detail page picks up the trader-relative status itself.

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
                  <HelpPopover label="Listing status (trader view)" width="w-96" size="lg">
                    <p className="font-semibold mb-2">Что я как трейдер могу сделать</p>
                    <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">Чипы зависят от того, есть ли у тебя позиция на этом листинге, и от состояния листинга. «Out of range» — суб-метка, появляется поверх активных состояний когда цена вышла из LP-range.</p>
                    <p className="text-[11px] font-semibold mb-1">Когда у меня нет позиции</p>
                    <ul className="space-y-1 text-[11px] leading-snug mb-2">
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-700 border border-gray-200 mr-1">open</span> — есть свободная capacity, можно зайти кнопкой <strong>Open</strong>.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">full · buyout only</span> — capacity занята другими. Зайти только через <strong>Buyout</strong> incumbent'а (выставить Premium APY выше).</li>
                    </ul>
                    <p className="text-[11px] font-semibold mb-1">Когда у меня уже есть позиция</p>
                    <ul className="space-y-1 text-[11px] leading-snug mb-2">
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 mr-1">my position</span> — я держу, никто не перебивал.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 mr-1">my position · open</span> — я держу, ещё есть свободная capacity (можно добавиться).</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">outbid</span> — меня перебили. Маржи хватает — могу <strong>Buyout back</strong> (предложить выше Premium APY).</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 mr-1">out of margin</span> — меня перебили + маржи не хватает на возврат. Нужен <strong>Top up margin</strong>, потом buyout. ≠ ликвидация.</li>
                    </ul>
                    <p className="text-[11px] font-semibold mb-1">Терминальные / LP-side</p>
                    <ul className="space-y-1 text-[11px] leading-snug">
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">closing · LP exit</span> — LP запросил вывод. Новых не принимает.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 mr-1">💥 liquidating</span> — Listing-level ликвидация в процессе.</li>
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
                traderStatus={getTraderListingStatus(l, positions, connectedAddress)}
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
            traderStatus={getTraderListingStatus(l, positions, connectedAddress)}
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
  traderStatus,
  onClick,
}: {
  listing: Listing
  isOwned: boolean
  outbid?: OutbidOpportunity
  traderStatus: TraderListingStatus
  onClick: () => void
}) {
  const subsidized = isSubsidized(listing)
  void isOwned // chip surfaces «my position»; the «· owned» label below also renders for LP owners
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

      {/* Trader-relative status — what THIS trader can do with this listing. */}
      <td className="px-3 py-3">
        <TraderStatusChip status={traderStatus} />
      </td>

      {/* Pool size — $ + Available sub-line. Token pair breakdown dropped
          per Eugene 2026-05-20 («давай везде уберём — переложим внутрь
          карточки»). The detail card surfaces the per-asset split. */}
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <div className="num font-semibold text-gray-900 leading-tight">{fmtUSD(listing.initialLiquidityUSD)}</div>
          <div
            className="text-[10px] num leading-tight whitespace-nowrap mt-0.5"
            style={{
              color: freePct < 5
                ? 'var(--color-status-warning)'
                : 'var(--color-text-muted, #6b7280)',
            }}
          >
            Available <span className="text-gray-900 font-medium">{fmtUSD(listing.availableCapacityUSD)}</span> ({Math.round(freePct)}%)
          </div>
        </div>
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

      {/* Rent APY — what trader pays. Headline = Uniswap + Premium;
          breakdown sub-line shows the two numbers without labels (Uni first,
          Premium second — matches LP-side reading order). Full labels live
          only in the column-header tooltip per Eugene 2026-05-20. */}
      <td className="px-3 py-3 text-right">
        {(() => {
          const rentBps = listing.uniswapApyBps + listing.minPremiumApyBps
          return (
            <>
              <div
                className="num font-semibold leading-tight"
                style={{ color: subsidized && rentBps < 0 ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
              >
                {fmtPct(rentBps, { signed: subsidized })}
              </div>
              <div className="text-[10px] text-gray-500 num leading-tight mt-0.5 whitespace-nowrap">
                {fmtPct(listing.uniswapApyBps)}
                {' '}
                {listing.minPremiumApyBps >= 0 ? '+' : '−'}
                {' '}
                {fmtPct(Math.abs(listing.minPremiumApyBps))}
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

      {/* Primary CTA dropped per Eugene 2026-05-20 («Action уберём, всё
          делается внутри карточки»). Row stays clickable — clicking opens
          the listing detail page where the right flow lives. */}
    </tr>
  )
}

function MobileRow({
  listing,
  isOwned,
  outbid,
  traderStatus,
  onClick,
}: {
  listing: Listing
  isOwned: boolean
  outbid?: OutbidOpportunity
  traderStatus: TraderListingStatus
  onClick: () => void
}) {
  const subsidized = isSubsidized(listing)
  void isOwned
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

      {/* Chip row — pair · DEX · fee · trader-relative status. Provider
          Leverage chip dropped (moves to detail per ТЗ); subsidized + outbid
          kept (actionable). */}
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <DexChip dex={listing.dex} />
        <FeeChip feeTierBps={listing.feeTierBps} />
        <TraderStatusChip status={traderStatus} tiny />
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

      {/* Pool size sub-line — token-pair breakdown moved to detail card. */}
      <div className="mt-2 text-[11px] num text-gray-700 flex items-baseline justify-between gap-2">
        <span>
          <span className="font-semibold text-gray-900">{fmtUSD(listing.initialLiquidityUSD)}</span>
          <span className="text-gray-500"> pool</span>
        </span>
      </div>
      <div className="mt-1 text-[10px] num text-gray-500 text-right">
        Available <span className="text-gray-900 font-medium">{fmtUSD(listing.availableCapacityUSD)}</span> ({Math.round(freePct)}%)
      </div>

      {/* Centered range scale — same primitive as desktop. */}
      <div className="mt-3">
        <RangeBar
          rangeLow={listing.rangeLow}
          rangeHigh={listing.rangeHigh}
          currentPrice={listing.currentPrice}
        />
      </div>

      {/* Primary CTA dropped per Eugene 2026-05-20 — same reasoning as
          desktop. The whole card stays tap-to-drill-in. */}
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

// Trader-relative status chip. Drives label, colour, and tooltip from the
// resolved `TraderListingStatus` (helper in lib/derive.ts). The previous
// listing-level StatusChip is gone — every marketplace row now shows the
// status FROM THE CURRENT TRADER's PERSPECTIVE (Eugene 2026-05-20). Out-of-
// range is rendered as a stacked secondary chip (« · out of range»).
function TraderStatusChip({ status, tiny }: { status: TraderListingStatus; tiny?: boolean }) {
  const sizeCls = tiny ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls

  const meta = TRADER_CHIP_META[status.chip]

  return (
    <span className="inline-flex items-center gap-1">
      <span className={baseCls + ' ' + meta.cls} title={meta.tip}>{meta.label}</span>
      {status.outOfRange && !status.terminal && (
        <span
          className={baseCls + ' bg-amber-50 text-amber-900 border border-amber-300'}
          title="Цена вышла за LP-range. Fees не начисляются сейчас. Зайти можно — если ждёшь возврата цены в диапазон."
        >
          out of range
        </span>
      )}
    </span>
  )
}

const TRADER_CHIP_META: Record<TraderListingChip, { label: string; cls: string; tip: string }> = {
  open: {
    label: 'open',
    cls: 'bg-gray-50 text-gray-700 border border-gray-200',
    tip: 'Свободная capacity есть, никто меня тут не выбивал. Можно зайти кнопкой Open.',
  },
  'open-and-mine': {
    label: 'my position · open',
    cls: 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30',
    tip: 'Я держу позицию + ещё есть свободная capacity. Можно добавиться к своей или зайти ещё одной заявкой.',
  },
  'full-buyout-only': {
    label: 'full · buyout only',
    cls: 'bg-amber-50 text-amber-900 border border-amber-300',
    tip: 'Вся capacity занята другими трейдерами. Зайти — только через Buyout incumbent\'а (выставить Premium APY выше).',
  },
  'my-position': {
    label: 'my position',
    cls: 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30',
    tip: 'Я держу позицию, никто не перебивал. Manage → детальная страница позиции.',
  },
  outbid: {
    label: 'outbid',
    cls: 'bg-amber-50 text-amber-900 border border-amber-300',
    tip: 'Меня перебили другой Premium APY. Margin сохранён — можно Buyout back (предложить выше).',
  },
  'out-of-margin': {
    label: 'out of margin',
    cls: 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40',
    tip: 'Меня перебили + моей margin не хватает на возврат. Top up margin, потом Buyout back. ≠ ликвидация — margin не нулевой.',
  },
  closing: {
    label: 'closing · LP exit',
    cls: 'bg-amber-50 text-amber-900 border border-amber-300',
    tip: 'LP запросил вывод NFT. Позиции принудительно закрываются. Новых не принимает.',
  },
  liquidating: {
    label: '💥 liquidating',
    cls: 'bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40',
    tip: 'Listing-level ликвидация в процессе. Все позиции закрываются по snapshot-цене. Зайти нельзя.',
  },
  liquidated: {
    label: 'closed · liquidated',
    cls: 'bg-gray-100 text-gray-700 border border-gray-300',
    tip: 'Листинг полностью ликвидирован. Зайти нельзя.',
  },
  withdrawn: {
    label: 'closed',
    cls: 'bg-gray-100 text-gray-500 border border-gray-300',
    tip: 'LP забрал NFT. Листинг закрыт навсегда.',
  },
}

// Trader-relative action button. Drives label + style from the resolved
// TraderCtaKind. Click is intercepted (doesn't trigger row navigation).
function ActionButton({
  cta,
  listing,
  onPrimary,
  tiny,
}: {
  cta: TraderCtaKind
  listing: Listing
  onPrimary: (kind: TraderCtaKind, listing: Listing) => void
  tiny?: boolean
}) {
  const meta = ACTION_META[cta]
  if (!meta) return null
  const sizeCls = tiny
    ? 'text-[10px] px-2 py-1'
    : 'text-xs px-2.5 py-1'
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onPrimary(cta, listing)
      }}
      className={
        'whitespace-nowrap rounded font-semibold transition border ' +
        sizeCls + ' ' + meta.cls
      }
      title={meta.tip}
    >
      {meta.label}
    </button>
  )
}

const ACTION_META: Record<TraderCtaKind, { label: string; cls: string; tip: string } | null> = {
  open: {
    label: 'Open',
    cls: 'bg-[var(--color-role-lp)] text-white border-transparent hover:opacity-90',
    tip: 'Open a new position on this listing.',
  },
  buyout: {
    label: 'Buyout',
    cls: 'bg-[var(--color-role-lp)] text-white border-transparent hover:opacity-90',
    tip: 'Перекупи incumbent\'а — предложи Premium APY выше его ставки.',
  },
  manage: {
    label: 'Manage',
    cls: 'bg-white text-[var(--color-role-lp)] border-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)]',
    tip: 'Перейти на детальную страницу твоей позиции.',
  },
  add: {
    label: 'Add',
    cls: 'bg-white text-[var(--color-role-lp)] border-[var(--color-role-lp)] hover:bg-[var(--color-role-lp-bg)]',
    tip: 'Добавить ещё к своей существующей позиции (свободная capacity есть).',
  },
  'buyout-back': {
    label: 'Buyout back',
    cls: 'bg-[var(--color-role-lp)] text-white border-transparent hover:opacity-90',
    tip: 'Вернуть свою позицию — предложи Premium APY выше того, кто тебя перебил.',
  },
  'top-up-margin': {
    label: 'Top up margin',
    cls: 'bg-amber-500 text-white border-transparent hover:opacity-90',
    tip: 'Маржи не хватает на возврат. Сначала пополни margin, потом сможешь Buyout back.',
  },
  view: {
    label: 'View',
    cls: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
    tip: 'Открыть детальную страницу листинга.',
  },
}

// (StatusChip removed — replaced by TraderStatusChip above; both DesktopRow
// and MobileRow render the trader-relative chip now.)
function _DEPRECATED_StatusChipShim() {
  return null
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
