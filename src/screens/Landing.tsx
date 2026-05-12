// Landing page — sLiq v4 copy (post 2-round critic validation by Anna + Semen)
// Spec: ../../../../Documents/Obsidian Vault/EarnPark/sLiq/docs/{sLiq} {prd} landing copy v2 – 2026-05-12.md
// Structure: 11 sections, audiences = LPs / Traders / Agents (MCP, Soon)

import { useState } from 'react'
import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNav />
      <Hero />
      <TrustRow />
      <TwoPaths />
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

// ─── 1. Hero — split LP / Trader ──────────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20 grid md:grid-cols-2 gap-6">
        {/* LP side */}
        <div className="rounded-2xl bg-gray-900 text-white p-8 md:p-10 relative overflow-hidden">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-lime-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
            For liquidity providers
          </span>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Earn extra yield on your Uniswap V3 LP
          </h1>
          <p className="mt-4 text-gray-300 leading-relaxed">
            Plug in your existing LP NFT. Earn <strong className="text-lime-300">+3–7% APR carry</strong>
            <sup className="text-xs">¹</sup> from sLiq traders on top of your normal Uniswap fees.{' '}
            <strong className="text-white">2-click exit, ~4 sec on Arbitrum.</strong>
          </p>
          <div className="mt-6">
            <Link
              to="/lp/deposit"
              className="inline-flex items-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-gray-900 px-5 py-3 text-sm font-semibold"
            >
              Import your NFT
              <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Conservative 1× by default — no liquidation risk. Advanced mode (up to 100×) for pros.
          </p>
        </div>

        {/* Trader side */}
        <div className="rounded-2xl bg-gray-900 text-white p-8 md:p-10 relative overflow-hidden">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-lime-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
            For traders
          </span>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Up to <span className="text-lime-300">1000×</span> leverage on real Uniswap pairs
          </h1>
          <p className="mt-4 text-gray-300 leading-relaxed">
            Long, short, or volatility views on any listed market. Example:{' '}
            <span className="text-white font-medium">$500 margin · 50× long · ETH +4% = +$1,000.</span>{' '}
            <strong className="text-white">No funding rate. No oracle.</strong> PnL settles against the real Uniswap V3 pool.
          </p>
          <div className="mt-6">
            <Link
              to="/listings"
              className="inline-flex items-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-gray-900 px-5 py-3 text-sm font-semibold"
            >
              Browse markets
              <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Margin in USDC + position token (ERC-20 representing your sLiq position). Open and close any time.
          </p>
        </div>
      </div>

      {/* Sub-row */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-3 text-center text-xs text-gray-600 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Built on Uniswap V3</span><span className="text-gray-300">·</span>
          <span>Non-custodial</span><span className="text-gray-300">·</span>
          <span>Audited by <em className="not-italic text-gray-400">[Auditor]</em></span><span className="text-gray-300">·</span>
          <span>Beta on Arbitrum</span>
        </div>
      </div>
    </section>
  )
}

// ─── 2. Trust row ────────────────────────────────────────────────────────

function TrustRow() {
  const items = [
    { icon: '🛡️', label: 'Audited', detail: 'Report by [Auditor]' },
    { icon: '⟨/⟩', label: 'Open source', detail: 'github.com/earnpark/sliq' },
    { icon: '🔑', label: 'Non-custodial', detail: 'Your wallet signs every action' },
    { icon: '🏛️', label: 'Backed by EarnPark', detail: 'Production fintech since 2022' },
  ]
  return (
    <section className="border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(it => (
          <div key={it.label} className="flex items-start gap-3 px-2">
            <span className="text-xl leading-none mt-0.5">{it.icon}</span>
            <div>
              <div className="text-sm font-semibold text-gray-900">{it.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{it.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── 3. Two Paths ────────────────────────────────────────────────────────

function TwoPaths() {
  return (
    <section className="border-b border-gray-100 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20 grid md:grid-cols-2 gap-6">
        <PathCard
          tag="Liquidity providers"
          heading="Plug in your Uniswap V3 NFT. Earn extra yield while it sits in range."
          steps={[
            'Connect wallet, import an existing Uniswap V3 LP NFT',
            'Set your minimum Premium APY (or accept the market auction)',
            'Earn Uniswap fees + Premium APY from sLiq traders. 2-click exit, ~4 sec on Arbitrum.',
          ]}
          cta={{ label: 'Import your NFT', to: '/lp/deposit' }}
          micro={
            <>
              <strong>Conservative 1× by default — no liquidation risk.</strong> Advanced mode unlocks Provider Leverage up to 100× for high-conviction LPs.
            </>
          }
        />
        <PathCard
          tag="Traders"
          heading="Take leveraged views on real Uniswap pools. No funding. No oracle."
          steps={[
            'Browse live markets — pair, fee tier, leverage available',
            'Open a long, short, or volatility position with margin (volatility = bet on movement in either direction)',
            'PnL follows the real Uniswap pool price. Settle anytime, or get auto-settled on liquidation.',
          ]}
          cta={{ label: 'Browse markets', to: '/listings' }}
          micro={
            <>
              Up to <strong>1000× leverage</strong> (set per market). Carry rate paid to LPs is the only ongoing cost — no perp funding.
            </>
          }
        />
      </div>
    </section>
  )
}

function PathCard({
  tag, heading, steps, cta, micro,
}: {
  tag: string
  heading: string
  steps: string[]
  cta: { label: string; to: string }
  micro: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-7 md:p-8 shadow-sm">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{tag}</span>
      <h3 className="mt-2 text-2xl font-bold text-gray-900 leading-snug">{heading}</h3>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center gap-4">
        <Link
          to={cta.to}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 text-sm font-medium"
        >
          {cta.label} <span aria-hidden>→</span>
        </Link>
      </div>
      <p className="mt-4 text-xs text-gray-500 leading-relaxed">{micro}</p>
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

// ─── 7. Agents-MCP block (Soon) ──────────────────────────────────────────

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
    { label: 'Audited', detail: 'Report by [Auditor] at [link]' },
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
      a: 'Yes. Audit by [Auditor], report at [link]. sLiq is in Beta with a TVL cap.',
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
            ['Audit reports', '#'],
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
