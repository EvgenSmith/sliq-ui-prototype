// Landing page — sLiq v4.2 copy
// v4.2 changes per Eugene feedback:
//   - Hero: right-aligned content, left = layered visual placeholder
//   - Benefits: replace +3-7% APR card (dup of Hero) → TVL placeholder card
//   - LP card: add prominent leverage chips (Conservative 1× · Advanced up to 100×)
//   - Agent card: human-friendly description + 4 agent jobs absorbed from old AgentsBlock
//   - Removed standalone AgentsBlock — best content moved into Agent card
//   - Security: expanded to Tymio-style 3 prominent cards + 2 supporting
// Spec: vault/EarnPark/sLiq/docs/{sLiq} {prd} landing copy v2 – 2026-05-12.md

import { useState } from 'react'
import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNav />
      <Hero />
      <Benefits />
      <ForWhom />
      <HowItWorks />
      <UseCases />
      <WhySliq />
      <ComparisonTable />
      <Security />
      <FAQ />
      <LandingFooter />
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex flex-col leading-tight hover:opacity-90 transition flex-shrink-0">
          <span className="font-semibold tracking-tight text-base text-gray-900">sLiq Protocol</span>
          <span className="text-[10px] text-gray-500 -mt-0.5">
            powered by <span className="font-medium text-gray-700">EarnPark</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <a href="#built-for" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">Built for</a>
          <a href="#how" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">How it works</a>
          <a href="#use-cases" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">Use cases</a>
          <a href="#safety" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">Safety</a>
          <a href="#faq" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">FAQ</a>
          <Link
            to="/listings"
            className="ml-2 inline-flex items-center rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Launch app
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── 1. Hero — single H1 + subhead + 2 CTAs + trust line ─────────────────

function Hero() {
  return (
    <section className="border-b border-gray-100 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24 grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-10 items-center">
        {/* LEFT — H1 + sub + CTAs + trust */}
        <div className="order-1 text-left">
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            The leverage layer on{' '}
            <span className="text-lime-300">Uniswap V3</span>
          </h1>
          <p className="mt-6 text-base md:text-xl text-gray-300 leading-relaxed">
            Open up to <strong className="text-white">1000×</strong> leveraged positions on any Uniswap V3 pool.
            Liquidity providers earn <strong className="text-lime-300">+3–7% APR</strong> extra carry from traders hosting the trades.
            <br className="hidden md:block" />
            <span className="text-gray-400">No funding rate. No oracle. ~4 sec settlement on Arbitrum.</span>
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/listings"
              className="inline-flex items-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-gray-900 px-6 py-3 text-sm md:text-base font-semibold"
            >
              Browse markets <span aria-hidden>→</span>
            </Link>
            <Link
              to="/lp/deposit"
              className="inline-flex items-center gap-2 rounded-md border border-gray-600 hover:border-gray-400 text-gray-200 px-6 py-3 text-sm md:text-base font-medium"
            >
              Import your NFT <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Trust line (sliq.finance pattern) */}
          <div className="mt-8 text-xs md:text-sm text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Live on <span className="text-gray-200 font-medium">Arbitrum</span></span>
            <span className="text-gray-700">·</span>
            <span>Built on <span className="text-gray-200 font-medium">Uniswap V3</span></span>
            <span className="text-gray-700">·</span>
            <span>Non-custodial · <span className="text-gray-200 font-medium">Metamask</span></span>
            <span className="text-gray-700">·</span>
            <span>Audited by <span className="text-gray-200 font-medium">Pessimistic</span></span>
          </div>
        </div>

        {/* RIGHT — visual */}
        <div className="order-2">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

// Layered stack visual — placeholder for proper 3D asset.
// Conveys «layer on top of Uniswap» metaphor via 3 stacked rounded planes.
function HeroVisual() {
  return (
    <div className="relative aspect-square max-w-sm mx-auto md:ml-auto md:mr-0 select-none">
      {/* Base layer — Uniswap */}
      <div className="absolute inset-x-[12%] bottom-0 top-[40%] rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600 shadow-xl flex items-end justify-between px-6 py-4">
        <span className="text-[10px] uppercase tracking-widest text-gray-400">Layer 0</span>
        <span className="text-sm font-medium text-gray-300">Uniswap V3</span>
      </div>
      {/* Mid layer — Markets */}
      <div className="absolute inset-x-[6%] top-[20%] bottom-[30%] rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 shadow-2xl flex items-center justify-between px-6">
        <span className="text-[10px] uppercase tracking-widest text-gray-400">Layer 1</span>
        <span className="text-sm font-medium text-gray-200">Synthetic markets</span>
      </div>
      {/* Top layer — sLiq leverage */}
      <div className="absolute inset-x-0 top-0 bottom-[60%] rounded-3xl bg-lime-400 shadow-2xl shadow-lime-400/20 flex items-center justify-between px-6 ring-1 ring-lime-300/40">
        <span className="text-[10px] uppercase tracking-widest text-gray-900/70">Layer 2</span>
        <span className="text-sm font-semibold text-gray-900">sLiq · up to 1000×</span>
      </div>
      {/* Floating chips */}
      <div className="absolute -bottom-3 -right-2 text-[10px] font-medium text-lime-300 bg-gray-900/80 border border-lime-400/40 rounded-full px-2.5 py-1 backdrop-blur">
        +3–7% APR
      </div>
      <div className="absolute -top-3 -left-2 text-[10px] font-medium text-gray-300 bg-gray-900/80 border border-gray-600 rounded-full px-2.5 py-1 backdrop-blur">
        No oracle
      </div>
    </div>
  )
}

// ─── 2. Benefits — 3 cards with numbers ──────────────────────────────────

function Benefits() {
  const cards: {
    stat: React.ReactNode
    title: string
    body: React.ReactNode
  }[] = [
    {
      stat: 'Since 2022',
      title: 'Backed by EarnPark',
      body: (
        <>
          Production fintech with multi-year track record. <strong>Qualified market maker on Binance.</strong>
        </>
      ),
    },
    {
      stat: '1K',
      title: 'Active traders',
      body: 'Real users testing leveraged Uniswap exposure during Beta.',
    },
    {
      stat: '$2M',
      title: 'Open interest',
      body: 'Combined notional across all currently open positions on sLiq.',
    },
    {
      stat: '$3M',
      title: 'Total volume',
      body: (
        <>
          Cumulative settled notional since Beta launch.{' '}
          <a
            href="https://dune.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-gray-900 font-medium underline decoration-gray-300 hover:decoration-gray-700"
          >
            Verify on Dune <span aria-hidden className="text-[10px]">↗</span>
          </a>
        </>
      ),
    },
    {
      stat: <>100× <span className="text-gray-400">/</span> 1000×</>,
      title: 'Use liquidity efficiently',
      body: (
        <>
          Liquidity providers amplify earnings up to <strong>100×</strong> via Provider Leverage. Traders open leveraged views up to <strong>1000×</strong> on the same pair.
        </>
      ),
    },
    {
      stat: <>IL <span className="text-gray-400">→</span> profit</>,
      title: 'Earn from impermanent loss',
      body: (
        <>
          Short your LP exposure on sLiq while keeping Uniswap fees. Redefine DeFi: from impermanent loss to <strong>impermanent profit</strong> when the pool moves.
        </>
      ),
    },
  ]
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map(c => (
            <div
              key={c.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7 hover:border-gray-300 transition"
            >
              <div className="text-3xl md:text-4xl font-bold text-gray-900 leading-none tracking-tight">
                {c.stat}
              </div>
              <div className="mt-3 text-base font-semibold text-gray-900">{c.title}</div>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 3. For Whom — 3 columns (LP / Traders / Agents) ─────────────────────

function ForWhom() {
  return (
    <section id="built-for" className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Built for" title="Who sLiq is built for" />

        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <ForWhomCard
            tag="Liquidity providers"
            tagColor="lime"
            heading="Plug in your existing Uniswap V3 NFT"
            chips={['Conservative 1× · no liq risk', 'Advanced up to 100×']}
            steps={[
              'Connect wallet, import an existing V3 LP NFT',
              'Set minimum Premium APY (or accept the auction)',
              'Earn Uniswap fees + extra carry. 2-click exit, ~4 sec.',
            ]}
            cta={{ label: 'Import your NFT', to: '/lp/deposit', kind: 'primary' }}
            micro={
              <>
                Advanced mode unlocks <strong>Provider Leverage up to 100×</strong> — amplify your earnings even when underlying pool volume is quiet. Liquidation risk applies in Advanced.
              </>
            }
          />
          <ForWhomCard
            tag="Traders"
            tagColor="lime"
            heading="Leveraged views on real Uniswap pools"
            chips={['Up to 1000×', 'No funding · No oracle']}
            steps={[
              'Browse live markets — pair, fee tier, leverage available',
              'Open long, short, or volatility with margin',
              'Settle anytime. Auto-settled on liquidation by keepers.',
            ]}
            cta={{ label: 'Browse markets', to: '/listings', kind: 'primary' }}
            micro={
              <>
                Up to <strong>1000× leverage</strong> (set per market). Carry rate paid to LPs is the only ongoing cost — no perp funding.
              </>
            }
          />
          <ForWhomCard
            tag="Agents"
            tagColor="amber"
            badge="Soon"
            heading="Tell an AI agent to handle your DeFi"
            chips={['MCP-native', 'Subgraph + REST live']}
            stepsLabel="Ask your agent:"
            stepsStyle="prompt"
            steps={[
              'Hedge IL on my USDC/ETH LP if ETH moves more than 5%',
              'Auto-rebalance my listings when auction depth spikes',
              'Find the best Premium APY across USDC pairs and list me',
            ]}
            cta={{ label: 'Join MCP waitlist', to: 'mailto:support@earnpark.com?subject=sLiq%20MCP%20waitlist', kind: 'secondary' }}
            micro={
              <>
                Your AI agent reads live markets, simulates positions, and executes on-chain in one MCP call. <strong>Subgraph + REST are live today</strong>; MCP server + Agent SDK land soon. Built on the{' '}
                <a
                  href="https://teletype.in/@exitsexist/agent-led-growth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-900"
                >
                  Agent-Led Growth
                </a>{' '}
                thesis — protocols built for agent consumption win.
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

function ForWhomCard({
  tag, tagColor, badge, heading, chips, steps, stepsLabel, stepsStyle, cta, micro,
}: {
  tag: string
  tagColor: 'lime' | 'amber'
  badge?: string
  heading: string
  chips?: string[]
  steps: string[]
  stepsLabel?: string
  stepsStyle?: 'numbered' | 'prompt'
  cta: { label: string; to: string; kind: 'primary' | 'secondary' }
  micro: React.ReactNode
}) {
  const isPrompt = stepsStyle === 'prompt'
  const tagCls =
    tagColor === 'lime'
      ? 'text-lime-700 bg-lime-50 border-lime-200'
      : 'text-amber-700 bg-amber-50 border-amber-200'
  const isExt = cta.to.startsWith('mailto:') || cta.to.startsWith('http')
  const ctaCls =
    cta.kind === 'primary'
      ? 'bg-gray-900 hover:bg-gray-800 text-white'
      : 'border border-gray-300 hover:border-gray-500 text-gray-800'
  const ctaBase = 'inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium'

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6 md:p-7 flex flex-col">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${tagCls}`}>
          {tag}
        </span>
        {badge && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-xl font-bold text-gray-900 leading-snug">{heading}</h3>
      {chips && chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span
              key={c}
              className="text-[11px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {stepsLabel && (
        <div className="mt-5 text-[11px] uppercase tracking-wide font-semibold text-gray-500">{stepsLabel}</div>
      )}
      <ol className={`${stepsLabel ? 'mt-2' : 'mt-5'} space-y-2.5 flex-1`}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            {isPrompt ? (
              <span className="shrink-0 w-5 h-5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-base font-serif leading-none flex items-center justify-center mt-0.5">
                {'“'}
              </span>
            ) : (
              <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
            )}
            <span className={isPrompt ? 'italic text-gray-700' : 'text-gray-700'}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-gray-500 leading-relaxed">{micro}</p>
      <div className="mt-5">
        {isExt ? (
          <a href={cta.to} className={`${ctaBase} ${ctaCls}`}>{cta.label} <span aria-hidden>→</span></a>
        ) : (
          <Link to={cta.to} className={`${ctaBase} ${ctaCls}`}>{cta.label} <span aria-hidden>→</span></Link>
        )}
      </div>
    </div>
  )
}

// ─── 4. How it works ─────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: 'List', body: 'A liquidity provider wraps a Uniswap V3 NFT into sLiq and sets a minimum carry (their Premium APY).' },
    { n: 'Auction', body: 'sLiq matches the market to trader demand via continuous Premium APY auction.' },
    { n: 'Trade', body: 'Traders open leveraged long, short, or vol positions. PnL mirrors the underlying Uniswap pool.' },
    { n: 'Settle', body: 'Positions close on-chain. Liquidity providers receive Uniswap fees + carry. Traders receive PnL — or get auto-closed by a permissionless keeper.' },
  ]
  return (
    <section id="how" className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Mechanism" title="How sLiq works" />
        <div className="grid md:grid-cols-4 gap-5 mt-10">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="text-xs text-gray-400 font-mono">0{i + 1}</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">{s.n}</div>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.body}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-0 -right-3 text-gray-300 text-xl">→</div>
              )}
            </div>
          ))}
        </div>

        {/* Keepers callout — 4th party in sLiq economy */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-gray-900 text-lime-300 flex items-center justify-center">
            <SvgBolt />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Fourth party</div>
            <div className="mt-1 text-base font-semibold text-gray-900">Settlement & liquidations run by permissionless keepers</div>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              Anyone can run a keeper node — monitor positions, execute liquidations on price moves,
              settle expired markets — and earn keeper fees for each successful action. No central operator. No allowlist.
            </p>
          </div>
          <Link
            to="/keeper/positions"
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-gray-300 hover:border-gray-500 text-gray-800 px-4 py-2 text-sm font-medium"
          >
            Run a keeper <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function SvgBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

// ─── 5. Use Cases ────────────────────────────────────────────────────────

function UseCases() {
  return (
    <section id="use-cases" className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Use cases" title="How people use sLiq" />
        <div className="mt-10 space-y-4">
          <UseCaseRow
            num="①"
            title="Retail LP — earn extra yield on your existing position"
            body="You provide V3 liquidity on a major pair. Uniswap shows your fees, but not idle range time. List your NFT on sLiq Conservative 1× and pick up a Premium APY on top."
            example={
              <>
                You have <strong>$20K in a USDC/ETH</strong> range on Uniswap V3. Uniswap earns you{' '}
                <strong>~14% APR</strong> in fees. List on sLiq → Premium APY auction adds{' '}
                <strong>+3–7% APR</strong>. Net: <strong>+$600–1,400/year</strong> with no extra capital.{' '}
                <strong>2-click exit, ~4 sec on Arbitrum.</strong> No liquidation risk on Conservative.
              </>
            }
          />
          <UseCaseRow
            num="②"
            title="High-conviction LP — leverage your view"
            badge="Advanced"
            warning={
              <>
                ⚠️ <strong>Advanced mode only.</strong> Liquidation risk applies if pool moves against your range.
              </>
            }
            body="You believe a stable pair will stay tight, or a volatile pair will mean-revert. Use Provider Leverage 50× and amplify your Reference Fees pool."
            example={
              <>
                <strong>USDC/USDT 0.01%</strong> fee tier. Provider Leverage <strong>50×</strong>, minimum
                Premium APY <strong>−2%</strong> (subsidized — you pay traders carry to attract demand on a
                quiet stable pair). Net: Uniswap fees + Reference × 50 − 2% subsidy. Large positive carry on
                a pair where most LPs earn nothing.
              </>
            }
          />
          <UseCaseRow
            num="③"
            title="Directional trader — long or short a real pair"
            body="You think ETH breaks $5,000 next week. Open a long on the USDC/ETH market with up to 1000× leverage. PnL follows the real Uniswap pool — no funding rate, no oracle."
            example={
              <>
                ETH at <strong>$4,800</strong>. You open <strong>$500 margin, 50× long</strong> on USDC/ETH → notional $25,000,{' '}
                <strong>liquidation at $4,704</strong> (~−2% from entry). ETH moves to <strong>$4,992 (+4%)</strong> → notional gain{' '}
                <strong>+$1,000</strong> (200% return on margin). Settle on-chain, no rollover. If price hits $4,704, a keeper auto-closes your position.
              </>
            }
          />
          <UseCaseRow
            num="④"
            title="Volatility trader — bet on movement, not direction"
            body="You don't have a directional view but you think the pair will move. Open a vol position — pay LPs carry for the right to profit on either direction."
            example={
              <>
                ETH at <strong>$4,800</strong>. You open <strong>$1,000 margin</strong> vol on USDC/ETH. Carry rate 8% annualized → ~$0.22/hour cost.
                Breakeven: price moves <strong>&gt;±$96 (±2%)</strong> within the market window. If ETH hits $5,000 or $4,600, you profit. If it stays in [$4,704–$4,896], you pay carry until expiry. No funding rate.
              </>
            }
          />
          <UseCaseRow
            num="⑤"
            title="IL hedger — neutralize impermanent loss on a Uniswap LP"
            body="You hold a V3 LP NFT outside sLiq and want to hedge IL exposure. Open a short on the same pair via sLiq — when the pool moves and your LP suffers IL, your sLiq short pays for it."
            example={
              <>
                <strong>$50K LP on USDC/ETH 0.05%</strong> (in Uniswap, not sLiq). Expected IL on a 10% ETH move: ~$250. Open a <strong>$5K short at 10×</strong> on USDC/ETH via sLiq → IL hedged, you keep pocketing Uniswap fees.
                <br /><br />
                <em>Note:</em> one wallet can be both LP and Trader on sLiq simultaneously — separate role contexts, separate UIs, separate risk.
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

function UseCaseRow({
  num, title, body, example, badge, warning,
}: {
  num: string
  title: string
  body: string
  example: React.ReactNode
  badge?: string
  warning?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 md:px-8 md:py-6 grid md:grid-cols-[auto_1fr] gap-x-5 gap-y-3 items-start">
        <div className="text-2xl font-bold text-gray-300 leading-none">{num}</div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {badge && (
              <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                {badge}
              </span>
            )}
          </div>
          {warning && (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {warning}
            </p>
          )}
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">{body}</p>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="mt-3 text-xs font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
          >
            Example {open ? '▴' : '▾'}
          </button>
          {open && (
            <div className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-4 py-3 leading-relaxed">
              {example}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 6. Why sLiq ─────────────────────────────────────────────────────────

function WhySliq() {
  const pillars = [
    {
      title: 'Real Uniswap, not a synthetic clone',
      body: 'Every market references an actual Uniswap V3 pool. No custom AMM. No oracle dependency for index price.',
    },
    {
      title: 'Liquidity providers keep their NFT',
      body: 'You list your position. You don\'t sell it. 2-click exit with a 2-block guard (~4 sec on Arbitrum). Uniswap fees keep accruing normally throughout.',
    },
    {
      title: 'Built-in tools Uniswap UI doesn\'t have',
      body: 'In-range / out-of-range alerts via Telegram or email. IL-aware PnL in dollar terms — not just «fees earned». One panel for all your listings.',
    },
    {
      title: 'Non-custodial by design',
      body: 'Your wallet signs every action. sLiq core holds no admin keys over user funds. Audit reports public on day one.',
    },
  ]
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Why sLiq" title="What makes sLiq different" />
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {pillars.map(p => (
            <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── AgentsBlock removed in v4.2 — best content absorbed into «For Whom» Agent card.
//     ALG thesis link, MCP-native framing, agent prompt examples, and surface status
//     all now live inside the Agent column above.

// ─── 8. Comparison ───────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    ['LP fees from swaps', '✓', '✓ (keep accruing)'],
    ['Carry from traders (Premium APY)¹', '—', '+3–7% APR typical'],
    ['In-range / out-of-range alerts', 'manual', '✓ Telegram + email'],
    ['IL-aware PnL display', '—', '✓ in dollars'],
    ['Exit', 'manual remove + collect', '2-click, ~4 sec on Arbitrum'],
    ['Provider Leverage (Advanced)', '—', 'up to 100×'],
    ['Liquidation risk', 'none', 'none on Conservative · yes on Advanced'],
    ['Agent-callable (MCP)', '—', 'Soon'],
  ]
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Comparison" title="Uniswap alone vs Uniswap + sLiq" />
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 pr-4 font-medium"></th>
                <th className="py-3 px-4 font-medium">Uniswap V3 alone</th>
                <th className="py-3 px-4 font-medium text-gray-900">Uniswap V3 + sLiq</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-700">{r[0]}</td>
                  <td className="py-3 px-4 text-gray-500">{r[1]}</td>
                  <td className="py-3 px-4 text-gray-900 font-medium">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-500 max-w-3xl leading-relaxed">
          ¹ Based on backtest of major Uniswap V3 pairs (USDC/ETH, USDC/WBTC, ETH/WBTC) over 12 months
          + simulated Premium APY auction with realistic trader demand. Range, not guarantee. See methodology in White Paper.
        </p>
      </div>
    </section>
  )
}

// ─── 9. Security ─────────────────────────────────────────────────────────

function Security() {
  const primary = [
    {
      eyebrow: 'SELF-CUSTODY',
      icon: <SvgKey />,
      title: 'Non-custodial',
      body: (
        <>
          sLiq is a non-custodial protocol. Your wallet signs every action. sLiq core contracts hold{' '}
          <strong>no admin keys</strong> over user funds — neither EarnPark nor anyone else can move your assets.
          Contracts live on Arbitrum (<a href="#" className="underline hover:text-gray-900">addresses</a>).
        </>
      ),
    },
    {
      eyebrow: 'INDEPENDENT AUDIT',
      icon: <SvgShield />,
      title: 'Audited by Pessimistic',
      body: (
        <>
          Full audit by <a href="#" className="underline hover:text-gray-900">Pessimistic Security</a> covering{' '}
          <strong>SLIQCore + margin module + liquidator + listing module</strong>. Report published with the codebase.
          All sLiq contracts are open source and verifiable on GitHub.
        </>
      ),
    },
    {
      eyebrow: 'NO ORACLES, NO OFF-CHAIN MATCHERS',
      icon: <SvgChain />,
      title: 'On-chain settlement only',
      body: (
        <>
          All position settlement happens through <strong>permissionless keepers</strong> reading the actual Uniswap V3 pool state.
          No oracle, no centralized price feed, no off-chain order book. Anyone can run a keeper and earn liquidation rewards.
        </>
      ),
    },
  ]
  const secondary = [
    {
      title: 'Beta on Arbitrum with TVL cap',
      body: 'Beta runs with a TVL cap to bound early risk. Cap lifts gradually as the protocol matures and additional audits land.',
    },
    {
      title: 'No third-party liquidity risk',
      body: 'User funds remain inside sLiq smart contracts and serve only as collateral for trades. sLiq does not rehypothecate, lend, or move user capital off-chain.',
    },
  ]
  return (
    <section id="safety" className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Security" title="Safety of users' funds is our first priority" />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {primary.map(it => (
            <div key={it.title} className="rounded-2xl bg-white border border-gray-200 p-6 md:p-7 hover:border-gray-300 transition">
              <div className="w-11 h-11 rounded-xl bg-lime-100 text-lime-700 flex items-center justify-center mb-5">
                {it.icon}
              </div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{it.eyebrow}</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{it.title}</div>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {secondary.map(it => (
            <div key={it.title} className="rounded-xl bg-white border border-gray-200 p-5 flex items-start gap-3">
              <span className="text-lime-500 text-lg mt-0.5">✓</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SvgKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15 19 4" />
      <path d="m18 5 2 2" />
      <path d="m15 8 2 2" />
    </svg>
  )
}
function SvgShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
function SvgChain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

// ─── 10. FAQ ─────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: 'What is sLiq?',
      a: 'A protocol that lets Uniswap V3 liquidity providers earn extra yield from leveraged traders. Traders get exposure to real Uniswap pools without owning the LP NFT.',
    },
    {
      q: 'How is this different from Uniswap?',
      a: 'Uniswap is the underlying AMM. sLiq sits on top: wraps LP NFTs into markets, runs a Premium APY auction, lets traders take leveraged views without touching the actual liquidity.',
    },
    {
      q: 'Who is this for?',
      a: 'Liquidity providers already running V3 ranges who want extra yield on idle range time. Traders who want directional or vol exposure without perp funding or oracle risk. AI agents — sLiq is built MCP-native (server launching soon).',
    },
    {
      q: 'What is Premium APY?',
      a: 'The carry rate traders pay liquidity providers for hosting their leveraged exposure. Set by a continuous auction — providers set a minimum, traders bid above.',
    },
    {
      q: 'What are Reference Fees?',
      a: 'The synthetic fee stream liquidity providers earn from sLiq traders: Reference Fees = realized Uniswap fees × Provider Leverage.',
    },
    {
      q: 'What is Provider Leverage?',
      a: 'In Advanced mode, liquidity providers can amplify their exposure (and Reference Fee earnings) up to 100×. Liquidation risk applies if the pool moves against the provider\'s range. Conservative mode (1×, default) has no liquidation risk.',
    },
    {
      q: 'Can AI agents use sLiq?',
      a: 'Yes — by design. sLiq\'s protocol surface (open auctions, public formulas, on-chain settlement) is machine-readable. Subgraph and REST endpoints are live today. A dedicated MCP server launches soon so any AI agent (Claude Desktop, custom, ops bot) can browse markets, simulate, and execute in one MCP call.',
    },
    {
      q: 'Is it audited?',
      a: 'Yes. Audited by Pessimistic — full report at the link in the footer. sLiq is in Beta with a TVL cap.',
    },
    {
      q: 'What are the risks?',
      a: 'Standard DeFi risks: smart contract bugs, pool-dependent settlement, liquidation in Advanced LP mode, market gaps. Read the white paper and the audit before using.',
    },
  ]
  return (
    <section id="faq" className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 max-w-3xl mx-auto divide-y divide-gray-200 border-y border-gray-200">
          {items.map((it, i) => (
            <FaqItem key={i} q={it.q} a={it.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className="w-full text-left py-4 px-1 group"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-base font-medium text-gray-900">{q}</span>
        <span className="text-gray-400 group-hover:text-gray-700 text-sm">{open ? '−' : '+'}</span>
      </div>
      {open && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{a}</p>}
    </button>
  )
}

// ─── 11. Footer ──────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-8">
          <div>
            <div className="flex flex-col leading-tight mb-4">
              <span className="text-white font-semibold tracking-tight text-base">sLiq Protocol</span>
              <span className="text-[10px] text-gray-400 -mt-0.5">
                powered by <span className="font-medium text-gray-200">EarnPark</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-md">
              Extra yield for liquidity providers. Leveraged exposure for traders.
            </p>
            <p className="mt-4 text-xs">
              sLiq Protocol · Powered by EarnPark · <a href="mailto:support@earnpark.com" className="hover:text-white">support@earnpark.com</a>
            </p>
          </div>
          <FooterCol title="Product" items={[
            ['Launch app', '/listings'],
            ['Import NFT', '/lp/deposit'],
            ['MCP waitlist', 'mailto:support@earnpark.com?subject=sLiq%20MCP%20waitlist'],
          ]} />
          <FooterCol title="Docs" items={[
            ['White paper', '#'],
            ['Audit (Pessimistic)', '#'],
            ['GitHub', '#'],
            ['MCP spec', '#'],
          ]} />
          <div>
            <div className="text-xs uppercase tracking-wide font-semibold text-gray-300 mb-3">Community</div>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="X" className="w-9 h-9 rounded-md border border-gray-700 hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center text-gray-300 hover:text-white transition">
                <SvgX />
              </a>
              <a href="#" aria-label="Discord" className="w-9 h-9 rounded-md border border-gray-700 hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center text-gray-300 hover:text-white transition">
                <SvgDiscord />
              </a>
              <a href="#" aria-label="Telegram" className="w-9 h-9 rounded-md border border-gray-700 hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center text-gray-300 hover:text-white transition">
                <SvgTelegram />
              </a>
              <a href="https://github.com/" aria-label="GitHub" className="w-9 h-9 rounded-md border border-gray-700 hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center text-gray-300 hover:text-white transition">
                <SvgGithub />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>© 2026 sLiq Protocol</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SvgX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function SvgDiscord() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.045-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
function SvgTelegram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}
function SvgGithub() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-300 mb-3">{title}</div>
      <ul className="space-y-2 text-sm">
        {items.map(([label, href]) => (
          <li key={label}>
            {href.startsWith('mailto:') || href === '#' || href.startsWith('http') ? (
              <a href={href} className="hover:text-white">{label}</a>
            ) : (
              <Link to={href} className="hover:text-white">{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">{eyebrow}</div>
      <h2 className="mt-1 text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{title}</h2>
    </div>
  )
}
