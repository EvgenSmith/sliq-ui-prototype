// ListingsTable — v3 round of feedback applied:
//   - Fee chip merged into pair-cell (v1-reference style: pair + DEX chip + fee chip)
//   - Fee column REMOVED
//   - OWNED subtle (small grey text, no green border / no green badge)
//   - Status chips wrapped in <abbr title> for tooltip-on-hover расшифровки
//   - Mode column renamed "Leverage" + tooltip explaining Provider Leverage
//   - DEX labels expanded: Uniswap V3/V4, PancakeSwap V3, GMX, other

import { useNavigate } from 'react-router-dom'
import type { DexProtocol, Listing, ListingStatus } from '@/lib/types'
import { capacityFreePct, getRangeStatus, isSubsidized, pairLabel, type OutbidOpportunity } from '@/lib/derive'
import { fmtFeeTier, fmtPct, fmtTimeAgo, fmtUSD } from '@/lib/format'
import { HelpPopover } from '@/components/HelpPopover'

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
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Pair · DEX · fee</th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Listing stability
                  <HelpPopover label="Что такое Listing stability" width="w-72">
                    <p className="font-semibold mb-1">Risk твоего force-close</p>
                    <p className="mb-1"><strong>safe · 1×</strong> — LP не в залоге. Тебя не закроют принудительно по vol-event'у.</p>
                    <p><strong>at-risk · N×</strong> — LP в залоге × N. Если случится vol-spike и LP ликвидируется — все твои позиции на этом листинге force-close по snapshot-цене. Зато потенциал выше: больше Reference-pool.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-left font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Status
                  <HelpPopover label="Все статусы листингов" width="w-80">
                    <p className="font-semibold mb-2">Какие бывают статусы</p>
                    <ul className="space-y-1.5 text-[11px] leading-snug">
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 mr-1">open · in range</span> — цена внутри range LP, Uniswap fees начисляются, IP convex. Можно зайти.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-600 border border-gray-300 mr-1">open · out of range</span> — цена вышла за range, fees не идут. Зайти можно если ждёшь возврата.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">full · outbid only</span> — capacity занята. Зайти можно только перекупив incumbent'а.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-900 border border-amber-300 mr-1">closing · LP exit</span> — LP попросил вывод. Позиции принудительно закрываются.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-700 border border-gray-300 mr-1">paused</span> — LP временно остановил новые входы.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-50 text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/40 mr-1">💥 liquidating</span> — Listing-level ликвидация в процессе. Зайти нельзя.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-300 mr-1">closed · liquidated</span> — листинг полностью ликвидирован. Pro-rata claim доступен.</li>
                      <li><span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-300 mr-1">closed</span> — LP забрал NFT, листинг закрыт навсегда.</li>
                    </ul>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Premium APY
                  <HelpPopover label="Что такое Premium APY" width="w-72">
                    <p className="font-semibold mb-1">Premium APY — твой carry за вход</p>
                    <p className="mb-1.5">Минимальная ставка, которую LP принимает. <strong>Ты платишь</strong> её LP'у годовых на virtual notional, пока сидишь. Если отрицательная — наоборот, <strong>LP платит тебе</strong> (стейбл-пары).</p>
                    <p className="text-[11px] text-gray-500">«+Uni X%» снизу — Uniswap APY за 30d. Это LP baseline (не идёт тебе). Используется как proxy для Reference Fees — второй части carry, которую ты тоже платишь.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-4 py-2.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Available
                  <HelpPopover label="Что такое Available" width="w-72">
                    <p className="font-semibold mb-1">Доступно для входа</p>
                    <p className="mb-1.5">Свободная virtual liquidity / total. Это max virtual notional одной новой позиции. Несколько трейдеров могут разделить один листинг.</p>
                    <p className="text-[11px] text-gray-500">При LP risk &gt; 1× total capacity больше чем размер самой NFT — потому что LP плечо умножает её.</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">
                <span className="inline-flex items-center gap-1 justify-end">
                  Price in range
                  <HelpPopover label="Price position" width="w-64">
                    <p className="font-semibold mb-1">Где сейчас цена</p>
                    <p>Маркер ▲ показывает текущую цену пары. Внутри границ LP → fees начисляются, IP convex. Снаружи → fees заморожены, но позиция всё ещё bid-able (если ждёшь mean-reversion).</p>
                  </HelpPopover>
                </span>
              </th>
              <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Listed</th>
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

      {/* LP risk (was Leverage) */}
      <td className="px-3 py-3">
        {isAdvanced ? (
          <span
            className="text-xs whitespace-nowrap px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium cursor-help"
            title={`LP в залоге ×${listing.providerLeverage}. Для тебя: возможен force-close твоей позиции если LP ликвидируется.`}
          >
            at-risk · {listing.providerLeverage}×
          </span>
        ) : (
          <span
            className="text-xs whitespace-nowrap px-2 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium cursor-help"
            title="NFT владельца защищён. Для тебя: стабильно, listing-level force-close невозможен."
          >
            safe · 1×
          </span>
        )}
      </td>

      {/* Status — tooltip enabled */}
      <td className="px-3 py-3">
        <StatusChip status={listing.status} rangeStatus={rangeStatus} />
      </td>

      {/* Premium APY — stacked (no misleading +sign, subsidized shows negative) */}
      <td className="px-3 py-3 text-right">
        <div
          className="num font-semibold leading-tight"
          style={{ color: subsidized ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
        >
          {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
        </div>
        <div className="text-[11px] text-gray-500 num leading-tight mt-0.5">
          Uni baseline {fmtPct(listing.uniswapApyBps)}
        </div>
      </td>

      {/* Open capacity */}
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs num text-gray-700">
            <span className="font-medium text-gray-900">{fmtUSD(listing.availableCapacityUSD)}</span>
            <span className="text-gray-500"> / {fmtUSD(listing.totalCapacityUSD)}</span>
          </span>
          <div className="h-1 w-24 bg-gray-200 rounded-full overflow-hidden" title="Доступная для входа capacity">
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
        </div>
      </td>

      {/* Where price is in range (lg+) */}
      <td className="px-3 py-3 num text-xs text-gray-700 hidden lg:table-cell">
        <PriceInRange
          low={listing.rangeLow}
          high={listing.rangeHigh}
          current={listing.currentPrice}
          inRange={rangeStatus === 'in-range'}
        />
      </td>

      {/* Listed (lg+) */}
      <td className="px-3 py-3 text-right num text-xs text-gray-500 hidden lg:table-cell">
        {fmtTimeAgo(listing.listedAt)}
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
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PairIcons pair={listing.pair} compact />
          <span className="font-semibold text-base truncate">{pairLabel(listing)}</span>
          {isOwned && (
            <span className="text-[10px] uppercase tracking-wide text-gray-500 flex-shrink-0">· owned</span>
          )}
        </div>
        <div className="text-right num flex-shrink-0">
          <div
            className="font-semibold text-base"
            style={{ color: subsidized ? 'var(--color-negative-apy)' : 'oklch(20% 0 0)' }}
          >
            {subsidized ? fmtPct(listing.minPremiumApyBps, { signed: true }) : fmtPct(listing.minPremiumApyBps)}
          </div>
          <div className="text-[10px] text-gray-500">Uni {fmtPct(listing.uniswapApyBps)}</div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <DexChip dex={listing.dex} />
        <FeeChip feeTierBps={listing.feeTierBps} />
        {isAdvanced ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium">
            {listing.providerLeverage}× advanced
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30 font-medium">
            1× conservative
          </span>
        )}
        <StatusChip status={listing.status} rangeStatus={rangeStatus} tiny />
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

      <div className="mt-2">
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
        <div className="mt-1 text-[11px] num text-gray-500 text-right">
          available {fmtUSD(listing.availableCapacityUSD)} / {fmtUSD(listing.totalCapacityUSD)}
        </div>
      </div>

      <div className="mt-2">
        <PriceInRange
          low={listing.rangeLow}
          high={listing.rangeHigh}
          current={listing.currentPrice}
          inRange={rangeStatus === 'in-range'}
        />
      </div>
    </button>
  )
}

function DexChip({ dex }: { dex: DexProtocol }) {
  const map: Record<DexProtocol, { name: string; version: string; bg: string; versionBg: string; versionText: string }> = {
    'uniswap-v3': {
      name: 'Uniswap',
      version: 'v3',
      bg: 'bg-gray-50 text-gray-700 border border-gray-200',
      versionBg: 'bg-[#bef264] border-[#a3e635]/60', // Uniswap-green chip
      versionText: 'text-gray-900',
    },
    'uniswap-v4': {
      name: 'Uniswap',
      version: 'v4',
      bg: 'bg-gray-50 text-gray-700 border border-gray-200',
      versionBg: 'bg-pink-200 border-pink-300/60',
      versionText: 'text-pink-900',
    },
    'pancakeswap-v3': {
      name: 'PancakeSwap',
      version: 'v3',
      bg: 'bg-gray-50 text-gray-700 border border-gray-200',
      versionBg: 'bg-amber-200 border-amber-300/60',
      versionText: 'text-amber-900',
    },
    gmx: {
      name: 'GMX',
      version: '',
      bg: 'bg-gray-50 text-gray-700 border border-gray-200',
      versionBg: '',
      versionText: '',
    },
    other: {
      name: 'Other DEX',
      version: '',
      bg: 'bg-gray-50 text-gray-700 border border-gray-200',
      versionBg: '',
      versionText: '',
    },
  }
  const m = map[dex]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium">
      <span className={'px-1.5 py-0.5 rounded ' + m.bg}>{m.name}</span>
      {m.version && (
        <span className={'px-1.5 py-0.5 rounded font-semibold ' + m.versionBg + ' ' + m.versionText}>
          {m.version}
        </span>
      )}
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
  rangeStatus,
  tiny,
}: {
  status: ListingStatus
  rangeStatus: 'in-range' | 'out-of-range'
  tiny?: boolean
}) {
  const sizeCls = tiny ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  const baseCls = 'whitespace-nowrap rounded-full font-medium cursor-help ' + sizeCls

  const status_active = status === 'ACTIVE'
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
    if (status === 'PAUSED')
      return {
        label: 'paused',
        cls: 'bg-gray-50 text-gray-700 border border-gray-300',
        tip: 'LP временно остановил новые входы. Текущие позиции продолжают начислять.',
      }
    if (status === 'FULL')
      return {
        label: 'full · outbid only',
        cls: 'bg-amber-50 text-amber-900 border border-amber-300',
        tip: 'Вся capacity занята. Чтобы зайти — предложи Premium APY выше текущего трейдера (перекуп).',
      }
    // ACTIVE — derived range
    if (rangeStatus === 'in-range')
      return {
        label: 'open · in range',
        cls: 'bg-[var(--color-role-lp-bg)] text-[var(--color-role-lp)] border border-[var(--color-role-lp)]/30',
        tip: 'Листинг активен, цена внутри range. Uniswap fees начисляются, IP convex. Заходи трейдером.',
      }
    return {
      label: 'open · out of range',
      cls: 'bg-gray-50 text-gray-600 border border-gray-300',
      tip: 'Листинг активен, но цена вне range. Fees не начисляются сейчас. Заходить можно — если ждёшь возврата цены в диапазон.',
    }
  })()

  void status_active
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
