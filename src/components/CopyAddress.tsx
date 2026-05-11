// Reusable copy-to-clipboard button for wallet addresses.
// Per Uniswap-reference: address + clipboard icon, brief "copied" feedback.

import { useState } from 'react'

interface Props {
  address: string
  size?: 'sm' | 'xs'
}

export function CopyAddress({ address, size = 'xs' }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  const iconSize = size === 'sm' ? 14 : 12
  const padCls = size === 'sm' ? 'p-1.5' : 'p-1'

  return (
    <button
      type="button"
      onClick={copy}
      className={
        'rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition relative inline-flex items-center justify-center ' +
        padCls
      }
      aria-label={`Copy ${address}`}
      title={copied ? 'Скопировано' : 'Скопировать адрес'}
    >
      {copied ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-status-success)]"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  )
}
