// Landing page — sLiq v4.1 copy
// v4 critic-validated (Anna + Semen, 2 rounds) → v4.1 hero restructure per Eugene feedback:
//   - Single H1 + subhead instead of split hero
//   - Trust line under buttons (sliq.finance pattern)
//   - New Benefits section with numbers (3 cards)
//   - For Whom: 3 columns (LP / Traders / Agents) replaces 2-column Two Paths
//   - Pessimistic plugged in as auditor (was [Auditor] placeholder)
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
      <AgentsBlock />
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
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          <span className="text-gray-900">sLiq</span>
          <span className="text-xs font-normal text-gray-400">powered by EarnPark</span>
        </Link>
        <div className="flex items-center gap-2">
          <a href="#how" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">How it works</a>
          <a href="#use-cases" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">Use cases</a>
          <a href="#agents" className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 px-3">For agents</a>
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
      <div className="mx-auto max-w-5xl px-4 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
          The leverage layer on{' '}
          <span className="text-lime-300">Uniswap V3</span>
        </h1>
        <p className="mt-6 text-base md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
          Open up to <strong className="text-white">1000×</strong> leveraged positions on any Uniswap V3 pool.
          LPs earn <strong className="text-lime-300">+3–7% APR</strong> extra carry from traders hosting the trades.
          <br className="hidden md:block" />
          <span className="text-gray-400">No funding rate. No oracle. ~4 sec settlement on Arbitrum.</span>
        </p>

        {/* CTAs */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
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
        <div className="mt-8 text-xs md:text-sm text-gray-400 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span>Live on <span className="text-gray-200 font-medium">Arbitrum</span></span>
          <span className="text-gray-700">·</span>
          <span>Built on <span className="text-gray-200 font-medium">Uniswap V3</span></span>
          <span className="text-gray-700">·</span>
          <span>Non-custodial · <span className="text-gray-200 font-medium">Metamask</span></span>
          <span className="text-gray-700">·</span>
          <span>Audited by <span className="text-gray-200 font-medium">Pessimistic</span></span>
        </div>
      </div>
    </section>
  )
}

// ─── 2. Benefits — 3 cards with numbers ──────────────────────────────────

function Benefits() {
  const cards = [
    {
      stat: 'Since 2022',
      title: 'Backed by EarnPark',
      body: 'Production fintech with multi-year track record. sLiq is built and operated by the EarnPark team.',
      accent: 'gray' as const,
    },
    {
      stat: '+3–7% APR',
      title: 'Extra yield for LPs',
      body: 'Premium APY carry paid by sLiq traders on top of your normal Uniswap fees. Set your minimum, market bids above.',
      accent: 'lime' as const,
    },
    {
      stat: 'Up to 1000×',
      title: 'Leverage for traders',
      body: 'On real Uniswap V3 pools. No funding rate. No oracle. PnL settles against the actual pool price.',
      accent: 'lime' as const,
    },
  ]
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map(c => (
            <div
              key={c.title}
              className="rounded-2xl border border-gray-200 bg-white p-7 md:p-8 hover:border-gray-300 transition"
            >
              <div
                className={
                  c.accent === 'lime'
                    ? 'text-4xl md:text-5xl font-bold text-gray-900 leading-none tracking-tight'
                    : 'text-2xl font-bold text-gray-900 leading-none tracking-tight'
                }
              >
                {c.stat}
              </div>
              <div className="mt-4 text-lg font-semibold text-gray-900">{c.title}</div>
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
    <section className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="For whom" title="Who sLiq is built for" />

        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <ForWhomCard
            tag="LPs"
            tagColor="lime"
            heading="Plug in your existing Uniswap V3 NFT"
            steps={[
              'Connect wallet, import an existing V3 LP NFT',
              'Set minimum Premium APY (or accept the auction)',
              'Earn Uniswap fees + extra carry. 2-click exit, ~4 sec.',
            ]}
            cta={{ label: 'Import your NFT', to: '/lp/deposit', kind: 'primary' }}
            micro={
              <>
                <strong>Conservative 1× by default</strong> — no liquidation risk.<br />
                Advanced mode unlocks Provider Leverage up to 100×.
              </>
            }
          />
          <ForWhomCard
            tag="Traders"
            tagColor="lime"
            heading="Leveraged views on real Uniswap pools"
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
            badge="Soon · Q3 2026"
            heading="Agent-callable by design"
            steps={[
              'Subgraph + REST endpoint — live today',
              'Public formulas + on-chain primitives',
              'MCP server + Agent SDK — Q3 2026',
            ]}
            cta={{ label: 'Join MCP waitlist', to: 'mailto:support@earnpark.com?subject=sLiq%20MCP%20waitlist', kind: 'secondary' }}
            micro={
              <>
                Built MCP-native for vol-arb bots, IL-hedge agents, LP-rebalance agents. Per the{' '}
                <a
                  href="https://teletype.in/@exitsexist/agent-led-growth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-900"
                >
                  Agent-Led Growth
                </a>{' '}
                thesis.
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

function ForWhomCard({
  tag, tagColor, badge, heading, steps, cta, micro,
}: {
  tag: string
  tagColor: 'lime' | 'amber'
  badge?: string
  heading: string
  steps: string[]
  cta: { label: string; to: string; kind: 'primary' | 'secondary' }
  micro: React.ReactNode
}) {
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
      <ol className="mt-5 space-y-2.5 flex-1">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-gray-700">
            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{s}</span>
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
    { n: 'List', body: 'An LP wraps a Uniswap V3 NFT into sLiq and sets a minimum carry (their Premium APY).' },
    { n: 'Auction', body: 'sLiq matches the market to trader demand via continuous Premium APY auction.' },
    { n: 'Trade', body: 'Traders open leveraged long, short, or vol positions. PnL mirrors the underlying Uniswap pool.' },
    { n: 'Settle', body: 'Positions close on-chain. LPs receive Uniswap fees + carry. Traders receive PnL (or get liquidated by a keeper).' },
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
      </div>
    </section>
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
      title: 'LPs keep their NFT',
      body: 'You list your position. You don\'t sell it. 2-click exit with a 2-block guard (~4 sec on Arbitrum). Uniswap fees keep accruing normally throughout.',
    },
    {
      title: 'Built-in LP tools Uniswap UI doesn\'t have',
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

// ─── 7. Agents-MCP block (Soon) — deeper section with ALG thesis ─────────

function AgentsBlock() {
  const agentTypes = [
    { type: 'Vol arb bot', job: 'Monitor Premium APY auctions across markets, open vol positions when carry < expected realized vol' },
    { type: 'IL-hedge agent', job: 'Watch a user\'s LP positions on Uniswap, auto-open hedge shorts on sLiq when range drifts' },
    { type: 'LP-rebalance agent', job: 'Adjust Min Premium APY based on auction depth, withdraw/reinvest on signal' },
    { type: 'DCA-into-LP agent', job: 'Steadily build LP positions and list them at programmed leverage' },
  ]
  const surface = [
    { live: true, label: 'Subgraph', detail: 'Full event indexing, queryable today' },
    { live: true, label: 'REST endpoint', detail: 'Read market state, listings, positions' },
    { live: true, label: 'Public formulas', detail: 'Premium APY, Reference Fees, Provider Leverage math in white paper' },
    { live: false, label: 'MCP server', detail: 'Q3 2026' },
    { live: false, label: 'Agent SDK (Python + TypeScript)', detail: 'Q3 2026' },
  ]
  return (
    <section id="agents" className="border-b border-gray-100 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-lime-300">For autonomous agents</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
            🤖 Soon · MCP server launching Q3 2026
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-3xl">
          Built for agents, not just humans.
        </h2>
        <p className="mt-4 max-w-3xl text-gray-300 leading-relaxed">
          Synthetic markets are an agent-native primitive: precise formulas, public auctions, programmatic settlement,
          no GUI dependencies. sLiq's MCP server (in development) will let any AI agent — Claude Desktop, custom GPTs,
          in-house ops bots — read live markets, simulate positions, and open/close on-chain in one MCP call.
        </p>
        <p className="mt-4 max-w-3xl text-xs text-gray-400">
          Per the{' '}
          <a
            href="https://teletype.in/@exitsexist/agent-led-growth"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime-300 hover:text-lime-200 underline"
          >
            Agent-Led Growth
          </a>{' '}
          thesis, buyers are increasingly AI agents — 77% of B2B purchases land with the vendor agents flag first.
          sLiq's protocol surface is built to be <strong>agent-evaluable from day one</strong>: public white paper,
          open formulas, on-chain primitives, low token-to-value.
        </p>

        <div className="mt-10 grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">What agents will do</h3>
            <div className="mt-4 space-y-3">
              {agentTypes.map(a => (
                <div key={a.type} className="rounded-lg bg-gray-900/60 border border-gray-700 p-4">
                  <div className="text-sm font-semibold text-lime-300">{a.type}</div>
                  <div className="text-sm text-gray-300 mt-1 leading-relaxed">{a.job}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Agent surface</h3>
            <div className="mt-4 space-y-2">
              {surface.map(s => (
                <div key={s.label} className="flex items-start gap-3 rounded-lg bg-gray-900/60 border border-gray-700 p-3">
                  <span className={`shrink-0 mt-0.5 text-base ${s.live ? 'text-lime-400' : 'text-amber-400'}`}>
                    {s.live ? '✓' : '○'}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white">{s.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
                  </div>
                  <span className={`ml-auto text-[10px] uppercase tracking-wide font-semibold ${s.live ? 'text-lime-400' : 'text-amber-400'}`}>
                    {s.live ? 'Live' : 'Soon'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="mailto:support@earnpark.com?subject=sLiq%20MCP%20waitlist"
            className="inline-flex items-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-gray-900 px-5 py-3 text-sm font-semibold"
          >
            Join MCP waitlist <span aria-hidden>→</span>
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-md border border-gray-600 hover:border-gray-400 text-gray-200 px-5 py-3 text-sm font-medium"
          >
            Read protocol spec
          </a>
        </div>
      </div>
    </section>
  )
}

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
    ['Agent-callable (MCP)', '—', 'Soon (Q3 2026)'],
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
  const items = [
    { label: 'Audited by Pessimistic', detail: 'Full audit report → link' },
    { label: 'Open source', detail: 'Code on GitHub' },
    { label: 'Non-custodial', detail: 'Your wallet, your keys, no admin keys over funds' },
    { label: 'Beta on Arbitrum', detail: 'TVL cap to bound early risk' },
    { label: 'Liquidator design', detail: 'Public, permissionless, on-chain settlement' },
  ]
  return (
    <section className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Security" title="Security & trust" />
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          {items.map(it => (
            <div key={it.label} className="rounded-lg bg-white border border-gray-200 px-5 py-4 flex items-start gap-3">
              <span className="text-lime-500 text-lg mt-0.5">✓</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{it.label}</div>
                <div className="text-sm text-gray-600 mt-0.5">{it.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 10. FAQ ─────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: 'What is sLiq?',
      a: 'A protocol that lets Uniswap V3 LPs earn extra yield from leveraged traders. Traders get exposure to real Uniswap pools without owning the LP.',
    },
    {
      q: 'How is this different from Uniswap?',
      a: 'Uniswap is the underlying AMM. sLiq sits on top: wraps LP NFTs into markets, runs a Premium APY auction, lets traders take leveraged views without touching the actual liquidity.',
    },
    {
      q: 'Who is this for?',
      a: 'LPs already providing V3 liquidity who want extra yield on idle range time. Traders who want directional or vol exposure without perp funding or oracle risk. AI agents — sLiq is built MCP-native (server launching Q3 2026).',
    },
    {
      q: 'What is Premium APY?',
      a: 'The carry rate traders pay LPs for hosting their leveraged exposure. Set by a continuous auction — LPs set a minimum, traders bid above.',
    },
    {
      q: 'What are Reference Fees?',
      a: 'The synthetic fee stream LPs earn from sLiq traders: Reference Fees = realized Uniswap fees × Provider Leverage.',
    },
    {
      q: 'What is Provider Leverage?',
      a: 'In Advanced mode, LPs can amplify their exposure (and Reference Fee earnings) up to 100×. Liquidation risk applies if the pool moves against the LP\'s range. Conservative mode (1×, default) has no liquidation risk.',
    },
    {
      q: 'Can AI agents use sLiq?',
      a: 'Yes — by design. sLiq\'s protocol surface (open auctions, public formulas, on-chain settlement) is machine-readable. Subgraph and REST endpoints are live today. A dedicated MCP server launches Q3 2026 so any AI agent (Claude Desktop, custom, ops bot) can browse markets, simulate, and execute in one MCP call.',
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
            <div className="text-white font-bold text-lg mb-3">sLiq</div>
            <p className="text-sm leading-relaxed max-w-md">
              Extra yield for LPs. Leveraged exposure for traders.{' '}
              <span className="text-lime-300">Agent-callable by design.</span>
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
          <FooterCol title="Resources" items={[
            ['White paper', '#'],
            ['Audit (Pessimistic)', '#'],
            ['GitHub', '#'],
            ['MCP spec', '#'],
          ]} />
          <FooterCol title="Community" items={[
            ['Discord', '#'],
            ['X', '#'],
            ['Telegram', '#'],
          ]} />
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
