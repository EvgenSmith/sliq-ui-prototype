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
    <div
      data-theme="night"
      className="min-h-screen"
      style={{
        background: 'var(--bg-1)',
        color: 'var(--fg-1)',
        fontFamily: 'var(--font-body)',
      }}
    >
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
    <nav
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        background: 'rgba(16, 24, 28, 0.85)',
        borderBottom: '1px solid var(--border-1)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" className="w-7 h-7" />
          <div className="flex flex-col leading-tight">
            <span
              className="font-medium tracking-tight text-base"
              style={{ fontFamily: 'var(--font-header)', color: 'var(--fg-1)' }}
            >
              sLiq Protocol
            </span>
            <span className="text-[10px] -mt-0.5" style={{ color: 'var(--fg-3)' }}>
              powered by <span style={{ color: 'var(--fg-2)', fontWeight: 500 }}>EarnPark</span>
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <a href="#built-for" className="hidden md:inline text-sm px-3 hover:opacity-80 transition" style={{ color: 'var(--fg-2)' }}>Built for</a>
          <a href="#how" className="hidden md:inline text-sm px-3 hover:opacity-80 transition" style={{ color: 'var(--fg-2)' }}>How it works</a>
          <a href="#use-cases" className="hidden md:inline text-sm px-3 hover:opacity-80 transition" style={{ color: 'var(--fg-2)' }}>Use cases</a>
          <a href="#safety" className="hidden md:inline text-sm px-3 hover:opacity-80 transition" style={{ color: 'var(--fg-2)' }}>Safety</a>
          <a href="#faq" className="hidden md:inline text-sm px-3 hover:opacity-80 transition" style={{ color: 'var(--fg-2)' }}>FAQ</a>
          <Link
            to="/listings"
            className="ml-2 inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
            style={{ background: 'var(--primary-lime-0)', color: 'var(--black)' }}
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
    <section style={{ borderBottom: '1px solid var(--border-1)' }}>
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16 grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-10 items-center">
        {/* LEFT — H1 + sub + CTAs + trust */}
        <div className="order-1 text-left">
          <h1
            className="text-4xl md:text-6xl leading-[1.1] tracking-tight"
            style={{ font: 'var(--h2m)', fontFamily: 'var(--font-header)', letterSpacing: '-0.01em', color: 'var(--fg-1)' }}
          >
            Rent out your <span style={{ color: 'var(--primary-lime-0)' }}>Uniswap LP</span>.<br />
            Take leveraged views on any pool.
          </h1>
          <p className="mt-6 leading-relaxed" style={{ font: 'var(--b6)', color: 'var(--fg-2)' }}>
            Up to <strong style={{ color: 'var(--fg-1)' }}>1000×</strong> leverage for traders.{' '}
            <span className="md:inline block">
              <strong style={{ color: 'var(--primary-lime-0)' }}>+3–7% APR</strong> extra carry for liquidity providers.
            </span>
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/listings"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm md:text-base font-medium hover:opacity-90 transition"
              style={{ background: 'var(--primary-lime-0)', color: 'var(--black)' }}
            >
              Browse markets <span aria-hidden>→</span>
            </Link>
            <Link
              to="/lp/deposit"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm md:text-base font-medium transition hover:opacity-80"
              style={{ border: '1px solid var(--primary-black-30)', color: 'var(--fg-1)' }}
            >
              Import your NFT <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Trust line */}
          <div className="mt-8 text-xs md:text-sm flex flex-wrap items-center gap-x-3 gap-y-2" style={{ color: 'var(--fg-3)' }}>
            <span>Live on <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>Arbitrum</span></span>
            <span style={{ color: 'var(--primary-black-50)' }}>·</span>
            <span>Built on <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>Uniswap V3</span></span>
            <span style={{ color: 'var(--primary-black-50)' }}>·</span>
            <span>Non-custodial · <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>Metamask</span></span>
            <span style={{ color: 'var(--primary-black-50)' }}>·</span>
            <span>Audited by <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>Pessimistic</span></span>
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
      <div
        className="absolute inset-x-[12%] bottom-0 top-[40%] rounded-3xl shadow-xl flex items-end justify-between px-6 py-4"
        style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
      >
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Layer 0</span>
        <span className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>Uniswap V3</span>
      </div>
      {/* Mid layer — Markets */}
      <div
        className="absolute inset-x-[6%] top-[20%] bottom-[30%] rounded-3xl shadow-2xl flex items-center justify-between px-6"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
      >
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Layer 1</span>
        <span className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Synthetic markets</span>
      </div>
      {/* Top layer — sLiq leverage */}
      <div
        className="absolute inset-x-0 top-0 bottom-[60%] rounded-3xl shadow-2xl flex items-center justify-between px-6"
        style={{ background: 'var(--primary-lime-0)', boxShadow: '0 20px 50px rgba(184, 244, 0, 0.25)' }}
      >
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(16, 17, 26, 0.7)' }}>Layer 2</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--black)' }}>sLiq · up to 1000×</span>
      </div>
      {/* Floating chips */}
      <div
        className="absolute -bottom-3 -right-2 text-[10px] font-medium rounded-full px-2.5 py-1 backdrop-blur"
        style={{ color: 'var(--primary-lime-0)', background: 'rgba(16, 24, 28, 0.85)', border: '1px solid rgba(184, 244, 0, 0.4)' }}
      >
        +3–7% APR
      </div>
      <div
        className="absolute -top-3 -left-2 text-[10px] font-medium rounded-full px-2.5 py-1 backdrop-blur"
        style={{ color: 'var(--fg-2)', background: 'rgba(16, 24, 28, 0.85)', border: '1px solid var(--border-1)' }}
      >
        No oracle
      </div>
    </div>
  )
}

// ─── 2. Benefits — 3 cards with numbers ──────────────────────────────────

// Benefits — GMX-style bento. 5 cards, asymmetric grid:
//   Row 1: [A trust 1c] [B leverage WIDE 2c]
//   Row 2: [C no-friction 1c] [D no-idle-yield 1c] [E live-stats 1c]
// Card anatomy matches Security: icon box + eyebrow + stat + title + body.
function Benefits() {
  return (
    <section className="border-b border-[var(--border-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="grid md:grid-cols-3 gap-5">
          {/* A — Trust */}
          <BenefitCard
            icon={<SvgBuilding />}
            eyebrow="Trusted operator"
            stat="Since 2022"
            title="Backed by EarnPark"
            body={
              <>
                Production fintech with multi-year track record. <strong>Qualified market maker on Binance.</strong>
              </>
            }
          />

          {/* B — Leverage (WIDE, 2-column) */}
          <BenefitCard
            wide
            icon={<SvgLightning />}
            eyebrow="Max leverage"
            stat={<>Up to <span className="text-[var(--primary-lime-0)]">1000×</span></>}
            title="Leverage on real Uniswap pools"
            body={
              <>
                Traders open up to <strong>1000×</strong> per market. Liquidity providers earn carry up to <strong>100×</strong> via Provider Leverage. Cap is set per market based on liquidity depth — not a protocol-wide constant.
              </>
            }
          />

          {/* C — No friction (trading mechanics, from Hero subhead) */}
          <BenefitCard
            icon={<SvgZap />}
            eyebrow="No friction"
            title="No funding · No oracle · Exit any time"
            body={
              <>
                Carry rate is the only ongoing cost — no perp funding. Settlement at the actual Uniswap V3 pool, not an oracle feed. Open and exit any time — settles in <strong>~4 sec on Arbitrum</strong>.
              </>
            }
          />

          {/* D — No idle yield */}
          <BenefitCard
            icon={<SvgInfinity />}
            eyebrow="No idle yield"
            title="Base Uniswap APY never pauses"
            body={
              <>
                Your Uniswap fees keep accruing at all times — pre-listing, listed-but-not-taken, listed-and-active. Premium APY is <strong>on top</strong>, not instead.
              </>
            }
          />

          {/* E — Live stats (combined 4 numbers into one card) */}
          <BenefitCard
            icon={<SvgPulse />}
            eyebrow="Live on Beta"
            customBody={
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-2">
                <MiniStat value="47" label="Liquidity providers" />
                <MiniStat value="12" label="Active markets" />
                <MiniStat value="$84K" label="Open interest" />
                <MiniStat value="+$2.4K" label="Top trade today" href="https://dune.com/" />
              </div>
            }
          />
        </div>
      </div>
    </section>
  )
}

// Bento benefit card — Security-style anatomy: icon box + eyebrow + (optional) stat + title + body.
// `wide` adds md:col-span-2 for the asymmetric grid row.
// `customBody` replaces the body+title slot with arbitrary content (used by the stats card).
function BenefitCard({
  icon, eyebrow, stat, title, body, customBody, wide,
}: {
  icon: React.ReactNode
  eyebrow: string
  stat?: React.ReactNode
  title?: string
  body?: React.ReactNode
  customBody?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={`rounded-2xl bg-[var(--bg-2)] border border-[var(--border-1)] p-6 md:p-7 hover:border-[var(--border-1)] transition ${wide ? 'md:col-span-2' : ''}`}>
      <div className="w-11 h-11 rounded-xl bg-[var(--primary-lime-80)] text-[var(--primary-lime-0)] flex items-center justify-center mb-5">
        {icon}
      </div>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--fg-3)]">{eyebrow}</div>
      {stat && (
        <div className={`mt-1 ${wide ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'} font-bold text-[var(--fg-1)] leading-none tracking-tight`}>
          {stat}
        </div>
      )}
      {title && (
        <div className={`${stat ? 'mt-3' : 'mt-1'} text-base md:text-lg font-bold text-[var(--fg-1)]`}>
          {title}
        </div>
      )}
      {body && <p className="mt-2 text-sm text-[var(--fg-2)] leading-relaxed">{body}</p>}
      {customBody}
    </div>
  )
}

function MiniStat({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <div>
      <div className="text-2xl md:text-3xl font-bold text-[var(--fg-1)] leading-none tracking-tight">
        {value}
        {href && <span aria-hidden className="text-xs text-[var(--fg-3)] ml-1">↗</span>}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide font-medium text-[var(--fg-3)]">{label}</div>
    </div>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition">
      {inner}
    </a>
  ) : (
    inner
  )
}

// Bento icon SVGs (lime-700 currentColor)
function SvgBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
    </svg>
  )
}
function SvgLightning() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-5 h-5">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
function SvgZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function SvgInfinity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.739-8z" />
    </svg>
  )
}
function SvgPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

// ─── 3. For Whom — 3 columns (LP / Traders / Agents) ─────────────────────

function ForWhom() {
  return (
    <section id="built-for" className="border-b border-[var(--border-1)] bg-[var(--bg-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Built for" title="Who sLiq is built for" />

        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <ForWhomCard
            tag="Liquidity providers"
            tagColor="lime"
            heading="Your IL is now someone else's trade"
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
            heading="Leveraged views on any Uniswap V3 pool"
            chips={['Up to 1000× per market', 'Two-token margin']}
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
                  className="underline hover:text-[var(--fg-1)]"
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
  tag, tagColor, badge, heading, chips, steps, stepsLabel, stepsStyle, cta, micro, visual,
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
  visual?: React.ReactNode
}) {
  const isPrompt = stepsStyle === 'prompt'
  const tagCls =
    tagColor === 'lime'
      ? 'text-[var(--primary-lime-0)] bg-[rgba(184,244,0,0.08)] border-[rgba(184,244,0,0.3)]'
      : 'text-[var(--critical)] bg-[rgba(255,190,24,0.08)] border-[rgba(255,190,24,0.3)]'
  const isExt = cta.to.startsWith('mailto:') || cta.to.startsWith('http')
  const ctaCls =
    cta.kind === 'primary'
      ? 'bg-[var(--bg-3)] hover:opacity-90 text-white'
      : 'border border-[var(--border-1)] hover:border-[var(--primary-black-30)] text-[var(--fg-1)]'
  const ctaBase = 'inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium'

  return (
    <div className="rounded-xl bg-[var(--bg-2)] border border-[var(--border-1)] p-6 md:p-7 flex flex-col">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${tagCls}`}>
          {tag}
        </span>
        {badge && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,190,24,0.08)] text-[var(--critical)] border border-[rgba(255,190,24,0.3)]">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-xl font-bold text-[var(--fg-1)] leading-snug">{heading}</h3>
      {chips && chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span
              key={c}
              className="text-[11px] font-medium text-[var(--fg-2)] bg-[var(--bg-2)] border border-[var(--border-1)] rounded-full px-2.5 py-1"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {visual && <div className="mt-4">{visual}</div>}
      {stepsLabel && (
        <div className="mt-5 flex items-start justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--fg-3)]">{stepsLabel}</span>
          {isPrompt && (
            <span
              aria-hidden
              className="text-5xl text-[var(--critical)] font-serif leading-[0.4] select-none -mt-1"
            >
              {'“'}
            </span>
          )}
        </div>
      )}
      <ol className={`${stepsLabel ? 'mt-2' : 'mt-5'} space-y-2.5 flex-1`}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            {!isPrompt && (
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--bg-3)] text-white text-[10px] font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
            )}
            <span className={isPrompt ? 'italic text-[var(--fg-2)]' : 'text-[var(--fg-2)]'}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-[var(--fg-3)] leading-relaxed">{micro}</p>
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
    <section id="how" className="border-b border-[var(--border-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Mechanism" title="How sLiq works" />
        <div className="grid md:grid-cols-4 gap-5 mt-10">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="text-xs text-[var(--fg-3)] font-mono">0{i + 1}</div>
              <div className="mt-2 text-lg font-semibold text-[var(--fg-1)]">{s.n}</div>
              <p className="mt-2 text-sm text-[var(--fg-2)] leading-relaxed">{s.body}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-0 -right-3 text-[var(--fg-3)] text-xl">→</div>
              )}
            </div>
          ))}
        </div>

        {/* Keepers callout — 4th party in sLiq economy */}
        <div className="mt-10 rounded-2xl border border-[var(--border-1)] bg-[var(--bg-1)] p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--bg-3)] text-[var(--primary-lime-0)] flex items-center justify-center">
            <SvgBolt />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--fg-3)]">Fourth party</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,190,24,0.08)] text-[var(--critical)] border border-[rgba(255,190,24,0.3)]">
                Beta: sLiq team only
              </span>
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--fg-1)]">Settlement & liquidations run by permissionless keepers</div>
            <p className="mt-1 text-sm text-[var(--fg-2)] leading-relaxed">
              Anyone can run a keeper node — monitor positions, execute liquidations on price moves,
              settle expired markets — and earn keeper fees for each successful action. No central operator. No allowlist.
            </p>
            <p className="mt-2 text-xs text-[var(--fg-3)] leading-relaxed">
              <strong>In Beta:</strong> keeper infrastructure is operated by the sLiq team only. Permissionless opens after mainnet audit + 3rd-party keeper SDK release.
            </p>
          </div>
          <Link
            to="/keeper/positions"
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-[var(--border-1)] hover:border-[var(--primary-black-30)] text-[var(--fg-1)] px-4 py-2 text-sm font-medium"
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
    <section id="use-cases" className="border-b border-[var(--border-1)] bg-[var(--bg-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Use cases" title="How people use sLiq" />
        <div className="mt-10 space-y-4">
          <UseCaseRow
            num="①"
            audience="lp"
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
            audience="lp"
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
            audience="trader"
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
            audience="trader"
            title="Long-tail trader — trade pairs no options market will ever list"
            body="You think a long-tail token will pump or dump hard. Lyra and Deribit don't list it — but Uniswap does, so sLiq does. Open a leveraged position on any V3 pool."
            example={
              <>
                <strong>$PEPE/USDC</strong> at $0.000012. You open <strong>$200 margin, 100× long</strong> → notional $20,000.
                PEPE pumps <strong>+30%</strong> in 8 hours → notional gain <strong>+$6,000</strong> (30× return on margin).
                Settle on-chain, no funding rate, no oracle. If price reverses past your liquidation, a keeper auto-closes.
                Works on any pair Uniswap V3 supports — including the ones no centralized vol-market will ever touch.
              </>
            }
          />
          <UseCaseRow
            num="⑤"
            audience="lp"
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
  num, title, body, example, badge, warning, audience,
}: {
  num: string
  title: string
  body: string
  example: React.ReactNode
  badge?: string
  warning?: React.ReactNode
  audience?: 'lp' | 'trader'
}) {
  const [open, setOpen] = useState(false)
  const audienceCls =
    audience === 'lp'
      ? 'bg-[rgba(184,244,0,0.08)] text-[var(--primary-lime-0)] border-[rgba(184,244,0,0.3)]'
      : audience === 'trader'
        ? 'bg-[rgba(92,76,255,0.08)] text-[var(--indigo-0)] border-[rgba(92,76,255,0.3)]'
        : ''
  const audienceLabel = audience === 'lp' ? 'For LPs' : audience === 'trader' ? 'For Traders' : null
  return (
    <div className="rounded-xl bg-[var(--bg-2)] border border-[var(--border-1)] overflow-hidden">
      <div className="px-6 py-5 md:px-8 md:py-6 grid md:grid-cols-[auto_1fr] gap-x-5 gap-y-3 items-start">
        <div className="text-2xl font-bold text-[var(--fg-3)] leading-none">{num}</div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--fg-1)]">{title}</h3>
            {audienceLabel && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${audienceCls}`}>
                {audienceLabel}
              </span>
            )}
            {badge && (
              <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-[rgba(255,190,24,0.08)] text-[var(--critical)] border border-[rgba(255,190,24,0.3)]">
                {badge}
              </span>
            )}
          </div>
          {warning && (
            <p className="mt-2 text-xs text-[var(--critical)] bg-[rgba(255,190,24,0.08)] border border-[rgba(255,190,24,0.3)] rounded px-3 py-2">
              {warning}
            </p>
          )}
          <p className="mt-2 text-sm text-[var(--fg-2)] leading-relaxed">{body}</p>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="mt-3 text-xs font-medium text-[var(--fg-2)] hover:text-[var(--fg-1)] inline-flex items-center gap-1"
          >
            Example {open ? '▴' : '▾'}
          </button>
          {open && (
            <div className="mt-3 text-sm text-[var(--fg-2)] bg-[var(--bg-2)] border border-[var(--border-1)] rounded-md px-4 py-3 leading-relaxed">
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
    <section className="border-b border-[var(--border-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Why sLiq" title="What makes sLiq different" />
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {pillars.map(p => (
            <div key={p.title} className="rounded-xl border border-[var(--border-1)] bg-[var(--bg-2)] p-6">
              <h3 className="text-base font-semibold text-[var(--fg-1)]">{p.title}</h3>
              <p className="mt-2 text-sm text-[var(--fg-2)] leading-relaxed">{p.body}</p>
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
  const [tab, setTab] = useState<'lp' | 'trader'>('lp')
  const lpRows = [
    ['LP fees from swaps', '✓', '✓ (keep accruing)'],
    ['Carry from traders (Premium APY)¹', '—', '+3–7% APR typical'],
    ['In-range / out-of-range alerts', 'manual', '✓ Telegram + email'],
    ['IL-aware PnL display', '—', '✓ in dollars'],
    ['Exit', 'manual remove + collect', '2-click, ~4 sec on Arbitrum'],
    ['Provider Leverage (Advanced)', '—', 'up to 100×'],
    ['Liquidation risk', 'none', 'none on Conservative · yes on Advanced'],
  ]
  const traderRows = [
    ['Max leverage', '50–100×', '50–100×', '1000× per market'],
    ['Funding rate', 'yes, periodic', 'yes, periodic', 'no'],
    ['Price source', 'oracle', 'oracle', 'real Uniswap V3 pool'],
    ['Underlying liquidity', 'protocol vault', 'protocol vault', 'individual LP NFT'],
    ['Long-tail pairs', 'limited', 'limited', 'any Uniswap V3 pool'],
    ['Buyout / outbid existing position', '—', '—', '✓'],
    ['Margin assets', 'USDC only', 'USDC only', 'two-token (USDC + position)'],
  ]
  return (
    <section className="border-b border-[var(--border-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Comparison" title="How sLiq compares" />

        {/* Tab switcher */}
        <div className="mt-8 inline-flex rounded-lg border border-[var(--border-1)] bg-[var(--bg-2)] p-1">
          <button
            type="button"
            onClick={() => setTab('lp')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              tab === 'lp'
                ? 'bg-[var(--bg-2)] text-[var(--fg-1)] shadow-sm border border-[var(--border-1)]'
                : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
            }`}
          >
            For liquidity providers
          </button>
          <button
            type="button"
            onClick={() => setTab('trader')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              tab === 'trader'
                ? 'bg-[var(--bg-2)] text-[var(--fg-1)] shadow-sm border border-[var(--border-1)]'
                : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
            }`}
          >
            For traders
          </button>
        </div>

        {tab === 'lp' && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[var(--fg-3)] border-b border-[var(--border-1)]">
                    <th className="py-3 pr-4 font-medium"></th>
                    <th className="py-3 px-4 font-medium">Uniswap V3 alone</th>
                    <th className="py-3 px-4 font-medium text-[var(--fg-1)]">Uniswap V3 + sLiq</th>
                  </tr>
                </thead>
                <tbody>
                  {lpRows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border-1)]">
                      <td className="py-3 pr-4 text-[var(--fg-2)]">{r[0]}</td>
                      <td className="py-3 px-4 text-[var(--fg-3)]">{r[1]}</td>
                      <td className="py-3 px-4 text-[var(--fg-1)] font-medium">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[var(--fg-3)] max-w-3xl leading-relaxed">
              ¹ Based on backtest of major Uniswap V3 pairs (USDC/ETH, USDC/WBTC, ETH/WBTC) over 12 months
              + simulated Premium APY auction with realistic trader demand. Range, not guarantee. See methodology in White Paper.
            </p>
          </div>
        )}

        {tab === 'trader' && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[var(--fg-3)] border-b border-[var(--border-1)]">
                    <th className="py-3 pr-4 font-medium"></th>
                    <th className="py-3 px-4 font-medium">Hyperliquid</th>
                    <th className="py-3 px-4 font-medium">GMX</th>
                    <th className="py-3 px-4 font-medium text-[var(--fg-1)]">sLiq</th>
                  </tr>
                </thead>
                <tbody>
                  {traderRows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border-1)]">
                      <td className="py-3 pr-4 text-[var(--fg-2)]">{r[0]}</td>
                      <td className="py-3 px-4 text-[var(--fg-3)]">{r[1]}</td>
                      <td className="py-3 px-4 text-[var(--fg-3)]">{r[2]}</td>
                      <td className="py-3 px-4 text-[var(--fg-1)] font-medium">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[var(--fg-3)] max-w-3xl leading-relaxed">
              Perp DEXs trade index price via oracle. sLiq settles against the actual Uniswap V3 pool — every market wraps a real LP position, including long-tail pairs that no centralized venue lists.
            </p>
          </div>
        )}
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
          Contracts live on Arbitrum (<a href="#" className="underline hover:text-[var(--fg-1)]">addresses</a>).
        </>
      ),
    },
    {
      eyebrow: 'INDEPENDENT AUDIT',
      icon: <SvgShield />,
      title: 'Audited by Pessimistic',
      body: (
        <>
          Full audit by <a href="#" className="underline hover:text-[var(--fg-1)]">Pessimistic Security</a> covering{' '}
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
    <section id="safety" className="border-b border-[var(--border-1)] bg-[var(--bg-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="Security" title="Safety" />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {primary.map(it => (
            <div key={it.title} className="rounded-2xl bg-[var(--bg-2)] border border-[var(--border-1)] p-6 md:p-7 hover:border-[var(--border-1)] transition">
              <div className="w-11 h-11 rounded-xl bg-[var(--primary-lime-80)] text-[var(--primary-lime-0)] flex items-center justify-center mb-5">
                {it.icon}
              </div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--fg-3)]">{it.eyebrow}</div>
              <div className="mt-1 text-xl font-bold text-[var(--fg-1)]">{it.title}</div>
              <p className="mt-3 text-sm text-[var(--fg-2)] leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {secondary.map(it => (
            <div key={it.title} className="rounded-xl bg-[var(--bg-2)] border border-[var(--border-1)] p-5 flex items-start gap-3">
              <span className="text-[var(--primary-lime-0)] text-lg mt-0.5">✓</span>
              <div>
                <div className="text-sm font-semibold text-[var(--fg-1)]">{it.title}</div>
                <p className="text-sm text-[var(--fg-2)] mt-1 leading-relaxed">{it.body}</p>
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
  const groups: { heading: string; items: { q: string; a: string }[] }[] = [
    {
      heading: 'General',
      items: [
        {
          q: 'What is sLiq?',
          a: 'A protocol that lets Uniswap V3 liquidity providers earn extra yield from leveraged traders. Traders get exposure to real Uniswap pools without owning the LP NFT.',
        },
        {
          q: 'How is this different from Uniswap?',
          a: 'Uniswap is the underlying AMM. sLiq sits on top: wraps LP NFTs into markets, runs a Premium APY auction, lets traders take leveraged views without touching the actual liquidity.',
        },
        {
          q: 'How is sLiq different from Panoptic or perp DEXs?',
          a: 'Panoptic aggregates LPs into a shared pool with formula-based premium; sLiq keeps LPs as individual NFTs with auction-priced premium. Perp DEXs (Hyperliquid, GMX) settle against an oracle index — sLiq settles against the actual Uniswap pool. Long-tail pairs unavailable on perps work on sLiq because Uniswap V3 supports them.',
        },
        {
          q: 'Can AI agents use sLiq?',
          a: 'Yes — by design. sLiq\'s protocol surface (open auctions, public formulas, on-chain settlement) is machine-readable. Subgraph and REST endpoints are live today. A dedicated MCP server launches soon so any AI agent (Claude Desktop, custom, ops bot) can browse markets, simulate, and execute in one MCP call.',
        },
        {
          q: 'Is it audited?',
          a: 'Audited by Pessimistic — full report at the link in the footer.',
        },
      ],
    },
    {
      heading: 'For liquidity providers',
      items: [
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
          q: 'What happens if a trader runs out of margin before settling?',
          a: 'The trader\'s position is auto-closed by a keeper. The LP receives Uniswap fees + accrued Premium APY + Reference Fees up to the available margin. If margin is insufficient, partial payment is paid pro-rata — this is the explicit LP-side risk on sLiq (no insurance fund). Mitigation: the underlying Uniswap LP position is always restored at close.',
        },
        {
          q: 'How fast can I exit?',
          a: 'Two clicks to request close + a 2-block guard (~4 seconds on Arbitrum) for settlement. Uniswap fees keep accruing right up to the moment your NFT is returned.',
        },
        {
          q: 'Can I cancel a listing if no trader has taken it?',
          a: 'Yes. As long as your listing is in idle state (not bought), withdrawal is instant — your NFT returns immediately, no penalty, no fee.',
        },
      ],
    },
    {
      heading: 'For traders',
      items: [
        {
          q: 'What carry rate will I pay?',
          a: 'Carry rate = Premium APY × position size × time. Typical ranges 4–12% APR for major pairs in Beta. The number you bid in the auction is the only ongoing cost — no separate funding rate.',
        },
        {
          q: 'What is the minimum position size?',
          a: 'Minimum margin starts at $50 USDC on Beta. Caps lift as the protocol matures and liquidity deepens.',
        },
        {
          q: 'How does liquidation work?',
          a: 'When the underlying Uniswap pool price moves past your liquidation level (a function of your leverage and margin), a permissionless keeper auto-closes your position by restoring the LP via Uniswap SwapRouter. You receive the residual margin after the close.',
        },
        {
          q: 'What is the swap cost / slippage?',
          a: 'sLiq performs swaps on close via Uniswap SwapRouter against the real pool. Slippage is bounded by tick-spacing for the listed range — typically <0.1% on major pairs, more on long-tail. Visible in the close preview before you confirm.',
        },
        {
          q: 'Why no oracle?',
          a: 'sLiq settles at the actual Uniswap V3 pool price at the block of close. The pool itself is the price source — there\'s no off-chain feed, no Chainlink dependency, no oracle attack surface.',
        },
      ],
    },
    {
      heading: 'Risk',
      items: [
        {
          q: 'What are the risks?',
          a: 'Standard DeFi risks: smart contract bugs (pending mainnet audit), partial payment in extreme drawdown scenarios, liquidation in Advanced LP mode, swap slippage during settlement on thin liquidity. Read the white paper and audit report before using.',
        },
      ],
    },
  ]
  return (
    <section id="faq" className="border-b border-[var(--border-1)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <SectionHeader eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 max-w-3xl mx-auto space-y-10">
          {groups.map(g => (
            <div key={g.heading}>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--fg-3)] mb-2">{g.heading}</div>
              <div className="divide-y divide-[var(--border-1)] border-y border-[var(--border-1)]">
                {g.items.map((it, i) => (
                  <FaqItem key={i} q={it.q} a={it.a} />
                ))}
              </div>
            </div>
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
        <span className="text-base font-medium text-[var(--fg-1)]">{q}</span>
        <span className="text-[var(--fg-3)] group-hover:text-[var(--fg-2)] text-sm">{open ? '−' : '+'}</span>
      </div>
      {open && <p className="mt-2 text-sm text-[var(--fg-2)] leading-relaxed">{a}</p>}
    </button>
  )
}

// ─── 11. Footer ──────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="bg-[var(--bg-3)] text-[var(--fg-3)]">
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-8">
          <div>
            <div className="flex flex-col leading-tight mb-4">
              <span className="text-white font-semibold tracking-tight text-base">sLiq Protocol</span>
              <span className="text-[10px] text-[var(--fg-3)] -mt-0.5">
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
            <div className="text-xs uppercase tracking-wide font-semibold text-[var(--fg-3)] mb-3">Community</div>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="X" className="w-9 h-9 rounded-md border border-gray-700 hover:border-[var(--primary-black-30)] hover:opacity-90 flex items-center justify-center text-[var(--fg-3)] hover:text-white transition">
                <SvgX />
              </a>
              <a href="#" aria-label="Discord" className="w-9 h-9 rounded-md border border-gray-700 hover:border-[var(--primary-black-30)] hover:opacity-90 flex items-center justify-center text-[var(--fg-3)] hover:text-white transition">
                <SvgDiscord />
              </a>
              <a href="#" aria-label="Telegram" className="w-9 h-9 rounded-md border border-gray-700 hover:border-[var(--primary-black-30)] hover:opacity-90 flex items-center justify-center text-[var(--fg-3)] hover:text-white transition">
                <SvgTelegram />
              </a>
              <a href="https://github.com/" aria-label="GitHub" className="w-9 h-9 rounded-md border border-gray-700 hover:border-[var(--primary-black-30)] hover:opacity-90 flex items-center justify-center text-[var(--fg-3)] hover:text-white transition">
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
      <div className="text-xs uppercase tracking-wide font-semibold text-[var(--fg-3)] mb-3">{title}</div>
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
      <div className="text-xs uppercase tracking-wide font-semibold text-[var(--fg-3)]">{eyebrow}</div>
      <h2
        className="mt-1 text-3xl md:text-4xl leading-tight text-[var(--fg-1)]"
        style={{ fontFamily: 'var(--font-header)', fontWeight: 500, letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
    </div>
  )
}
