import { useEffect, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { chipContract, TOKEN_SYMBOL, explorerTx } from '../config'
import { humanizeDuration } from '../lib/format'

type Props = {
  cooldown?: bigint
  onDone: () => void
  ensureSepolia: () => boolean
}

export function Faucet({ cooldown, onDone, ensureSepolia }: Props) {
  const { run, pending } = useAction()
  const onCooldown = cooldown !== undefined && cooldown > 0n
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
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
        onClick={() =>
          ensureSepolia() &&
          run(
            { ...chipContract, functionName: 'faucet' },
            () => {
              setTxHash(null)
              onDone()
            },
            (hash) => setTxHash(hash),
          )
        }
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

      {/* Reserve the link's line at the bottom; shows only while a claim is in
          flight (18px = one 12px line at body's 1.5). */}
      <div className="center" style={{ fontSize: 12, minHeight: 18 }}>
        {pending && txHash && (
          <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        )}
      </div>
    </div>
  )
}
