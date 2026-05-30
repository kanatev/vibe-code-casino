import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { shortAddr } from '../lib/format'

/** Detect an injected EIP-1193 provider (MetaMask et al). MetaMask injects
 *  `window.ethereum` at document-start; we re-check shortly after mount in case
 *  the announcement is slightly delayed. */
function useInjectedPresent(): boolean {
  const [present, setPresent] = useState(
    () => typeof window !== 'undefined' && Boolean((window as { ethereum?: unknown }).ethereum),
  )
  useEffect(() => {
    if (present) return
    const check = () => setPresent(Boolean((window as { ethereum?: unknown }).ethereum))
    const t = setTimeout(check, 400)
    window.addEventListener('eip6963:announceProvider', check)
    return () => {
      clearTimeout(t)
      window.removeEventListener('eip6963:announceProvider', check)
    }
  }, [present])
  return present
}

/** Deterministic gradient avatar from an address. */
function avatarStyle(address?: string): React.CSSProperties {
  const seed = address ? parseInt(address.slice(2, 8), 16) : 0
  const h = seed % 360
  return { background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 60) % 360} 70% 45%))` }
}

export function WalletButton({ onInstall }: { onInstall: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  const hasWallet = useInjectedPresent()

  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the account menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // --- No wallet installed ---
  if (!isConnected && !hasWallet) {
    return (
      <button className="btn btn-primary" onClick={onInstall}>
        Install Wallet
      </button>
    )
  }

  // --- Wallet present, not connected ---
  if (!isConnected) {
    const connector = connectors.find((c) => c.type === 'injected') ?? connectors[0]
    return (
      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <button
          className="btn btn-primary"
          disabled={isPending || !connector}
          onClick={() => connector && connect({ connector })}
        >
          {isPending ? (
            <span className="row gap-sm" style={{ justifyContent: 'center' }}>
              <span className="spin" /> Connecting…
            </span>
          ) : (
            'Connect wallet'
          )}
        </button>
        {error && (
          <span className="muted" style={{ fontSize: 11, maxWidth: 220, textAlign: 'right' }}>
            {/reject|denied/i.test(error.message) ? 'Connection rejected.' : 'Connection failed.'}
          </span>
        )}
      </div>
    )
  }

  // --- Connected, wrong network ---
  if (chainId !== sepolia.id) {
    return (
      <button className="btn btn-danger" disabled={switching} onClick={() => switchChain({ chainId: sepolia.id })}>
        {switching ? 'Switching…' : 'Switch to Sepolia'}
      </button>
    )
  }

  // --- Connected on Sepolia: account pill + dropdown ---
  return (
    <div className="wallet-account" ref={menuRef}>
      <button className="btn btn-ghost wallet-pill" onClick={() => setMenuOpen((o) => !o)}>
        <span className="wallet-avatar" style={avatarStyle(address)} />
        <span className="mono">{shortAddr(address)}</span>
        <span className="wallet-caret">▾</span>
      </button>
      {menuOpen && (
        <div className="wallet-menu">
          <button onClick={copyAddress}>{copied ? '✓ Copied!' : 'Copy address'}</button>
          <button
            className="danger"
            onClick={() => {
              disconnect()
              setMenuOpen(false)
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
