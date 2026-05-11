# sLiq UI Prototype

Implements the design spec at `~/Documents/Obsidian Vault/EarnPark/sLiq/docs/{sLiq} {prd} v2 design spec – 2026-05-10.md`.

**Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind 4 + react-router-dom 7. Mock data only — no wallet, no contract, no on-chain calls. Focus is the design system, IA, and copy.

## Run

```bash
cd /Users/evgenijkuznecov/Projects/sliq-ui-prototype
npm install
npm run dev
```

Then open <http://localhost:5173>.

## What's built (iteration 1)

- **Design tokens** — role colors (LP green / Trader orange / Liquidator purple), status colors, beta-banner palette, negative-APY surface (per spec §3 + §12).
- **App shell** — header with logo, nav, sticky `RoleBadge`; persistent `StatusBanner`; routing scaffold for all 18 screens (most as stubs).
- **Components**:
  - `StatusBanner` — always-on Beta context, expandable risk explainer (spec §11.1)
  - `RoleBadge` — sticky per-tab persistent role indicator with dropdown switcher (spec §7)
  - `ListingCard` — role-conditional CTA, subsidized-listing badge for negative APY (spec §9.8)
  - `APYBreakdown` — strict Realized vs Pending split, never summed; renders LP-perspective vs Trader-perspective for negative regimes (spec §9.6 + §12)
- **Screen S2 — Portfolio Overview** — default landing with My Listings · My Positions · Claimable · Recent Activity (spec §11.6)

## Mock data

`src/mocks/data.ts` ships three listings reflecting marketing positioning use cases:

- **L1** ETH/USDC 0.05% — UC-LP-1.A (Active V3 Range Manager)
- **L2** WBTC/ETH 0.3% — UC-LP-1.B (vol-event LP, FULL → outbid only)
- **L3** USDC/USDT 0.01% — **UC-LP-1.D ⭐** Advanced 50× provider leverage with **negative −2% Premium APY** (the subsidy mechanic Жень confirmed)

Connected wallet is mocked as `0xMaria` (LP-1 persona, owner of L1 and L2). Switch the `connectedWallet` constant in `src/mocks/data.ts` to test other roles.

## What's NOT built yet

Stubs only — see `App.tsx` route table:

- S1 Onboarding
- S3 Listings Marketplace (browse)
- S4 Listing Detail (canonical, role-aware tabs) ← high priority next
- S5 LP Deposit wizard
- S6 LP Owner Listing Detail
- S7 Provider Leverage change modal
- S8 Open Position wizard ← high priority next (most complex form)
- S9 Position Manage
- S10 Closed P&L
- S11 Buyout flow
- S12 Withdrawal flow
- S13 Listing-level liquidation view
- S14 / S15 Liquidator queue
- S16 Claimable Hub (full screen — Portfolio table is preview)
- S17 Settings
- S18 Whitelist gate
- `HighStakesConfirmModal` reusable modal (spec §11.3)
- `RiskPanel` (spec §9.4)
- `NotionalInput` (spec §9.5)

## Recommended next iterations

1. **S4 Listing Detail (canonical)** — proves the role-aware tabs IA, exercises ListingCard at scale.
2. **S8 Open Position wizard** — most complex form, exercises `NotionalInput` (replacing raw `uint128`), APY bid validation including negative regime, two-token margin presets.
3. **`HighStakesConfirmModal`** + a real flow that uses it (e.g. F2 Switch to Advanced or F5 Request Close).
4. **S5 LP Deposit wizard** with `LPFlowSelector`.

## Engineering questions for Коля

20 questions consolidated in design spec §13. Critical for wiring this prototype to actual contract:

- `apyBps` storage type (`int256` vs `uint256` with sign flag)
- `minPremiumApyBps` validation — contract floor or UI-only
- Event names for hooks
- `canLiquidate` polling vs event-driven
- Whitelist mechanism — on-chain or off-chain
- Generated typed SDK via `wagmi-cli`?

## Design provenance

This prototype is the second-step output of a 2-day design sprint:

- Phase 1 (2026-05-09) — UI diagnosis synthesis, 6 parallel agents
- Phase 2 (2026-05-10) — design spec synthesis, 3 parallel agents (IA + naming + copy)
- This prototype (2026-05-10) — design spec → working code

All artifacts live in `~/Documents/Obsidian Vault/EarnPark/sLiq/docs/`.
