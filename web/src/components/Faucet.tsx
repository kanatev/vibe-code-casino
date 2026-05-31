import { useEffect, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { chipContract, TOKEN_SYMBOL } from '../config'
import { humanizeDuration } from '../lib/format'

type Props = {
  cooldown?: bigint
  onDone: () => void
  ensureSepolia: () => boolean
}

export function Faucet({ cooldown, onDone, ensureSepolia }: Props) {
  const { run, pending, error } = useAction()
  const onCooldown = cooldown !== undefined && cooldown > 0n
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLSpanElement>(null)

  // Close the info bubble when clicking outside of it.
  useEffect(() => {
    if (!infoOpen) return
    const onClick = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [infoOpen])

  return (
    <div className="panel panel-pad col gap">
      <div className="between">
        <h3 className="row gap-sm" style={{ alignItems: 'center' }}>
          🎁 Claim free chips
          <span className="info-wrap" ref={infoRef}>
            <button className="info-btn" onClick={() => setInfoOpen((o) => !o)} aria-label="What is this?">
              i
            </button>
            {infoOpen && (
              <span className="info-bubble">
                Claim 1,000 {TOKEN_SYMBOL} for free. These are worthless test tokens — the casino
                runs on Sepolia, no real money involved.
              </span>
            )}
          </span>
        </h3>
        <span className="pill">🚰 Faucet</span>
      </div>

      <p className="muted" style={{ fontSize: 13, margin: '12px 0' }}>Cooldown 24 hours.</p>

      <button
        className="btn btn-primary btn-block"
        disabled={pending || onCooldown}
        onClick={() => ensureSepolia() && run({ ...chipContract, functionName: 'faucet' }, onDone)}
      >
        {pending ? (
          <span className="row gap-sm" style={{ justifyContent: 'center' }}>
            <span className="spin" /> Claiming…
          </span>
        ) : onCooldown ? (
          `Claim again in ${humanizeDuration(Number(cooldown))}`
        ) : (
          `Claim 1,000 ${TOKEN_SYMBOL}`
        )}
      </button>

      {error && <div className="notice error">⚠️ {error}</div>}

      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
        Claiming costs a little Sepolia ETH for gas. No ETH yet? Grab some free from a{' '}
        <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noreferrer">
          Sepolia faucet ↗
        </a>{' '}
        (or{' '}
        <a href="https://www.alchemy.com/faucets/ethereum-sepolia" target="_blank" rel="noreferrer">
          Alchemy
        </a>
        ).
      </p>
    </div>
  )
}
