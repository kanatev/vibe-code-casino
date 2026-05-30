import { useAction } from '../hooks/useAction'
import { chipContract, TOKEN_SYMBOL } from '../config'
import { fmt, humanizeDuration } from '../lib/format'

type Props = {
  walletBalance?: bigint
  cooldown?: bigint
  onDone: () => void
  ensureSepolia: () => boolean
}

export function Faucet({ walletBalance, cooldown, onDone, ensureSepolia }: Props) {
  const { run, pending, error } = useAction()
  const onCooldown = cooldown !== undefined && cooldown > 0n

  return (
    <div className="panel panel-pad col gap">
      <div className="between">
        <h3>1 · Get test chips</h3>
        <span className="pill">🚰 Faucet</span>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Claim 1,000 {TOKEN_SYMBOL} for free. These are worthless test tokens — the
        casino runs on Sepolia, no real money involved.
      </p>

      <div className="stat">
        <span className="label">Wallet balance</span>
        <span className="value">
          {fmt(walletBalance)} <span className="unit">{TOKEN_SYMBOL}</span>
        </span>
      </div>

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

      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
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
