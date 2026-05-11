// S18 Whitelist gate — design spec §8 S18 + §11.2
// Full-page state when wallet is not whitelisted. Reached at /access or as auto-redirect.

import { Link } from 'react-router-dom'

export function WhitelistGate() {
  return (
    <div className="flex items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 border border-amber-200 mb-6">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            This wallet isn't on the Alpha whitelist
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            sLiq is in closed Alpha. Access is granted per wallet. If you were invited,
            connect the wallet you submitted for whitelisting. If not, request access —
            we read every form.
          </p>

          <div className="flex flex-col gap-2">
            <a
              href="#"
              className="text-sm font-semibold px-4 py-2.5 rounded-md bg-gray-900 text-white hover:opacity-90 transition"
            >
              Request Alpha access
            </a>
            <button
              type="button"
              className="text-sm font-medium px-4 py-2.5 rounded-md border border-gray-300 hover:bg-gray-50 transition"
            >
              Switch wallet
            </button>
            <Link
              to="/onboarding"
              className="text-xs text-gray-500 underline mt-2"
            >
              Read what Alpha means →
            </Link>
          </div>

          <hr className="my-8 border-gray-200" />

          <p className="text-xs text-gray-500 leading-relaxed">
            sLiq v1: Uniswap V3 only. No insurance fund. No oracle. Settlement via market liquidators.
            Don't deposit more than you can afford to lose.
          </p>
      </div>
    </div>
  )
}
