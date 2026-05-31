import { useState } from 'react'
import { useAction } from '../hooks/useAction'
import { AmountInput } from './AmountInput'
import { casinoContract, explorerTx } from '../config'
import { parse } from '../lib/format'

type Props = {
  walletBalance?: bigint
  casinoBalance?: bigint
  allowance?: bigint
  onDone: () => void
  ensureSepolia: () => boolean
  onNeedApproval: () => void
}

export function Bank({ walletBalance, casinoBalance, allowance, onDone, ensureSepolia, onNeedApproval }: Props) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  // The action in flight, tagged with the mode that started it (hash arrives once
  // broadcast). Keeps the spinner/label and the tx link on their own tab — so
  // peeking at the withdraw tab during a deposit shows a plain Withdraw button,
  // not the deposit's loader. Cleared once mined.
  const [active, setActive] = useState<{ mode: 'deposit' | 'withdraw'; hash?: `0x${string}` } | null>(null)
  const { run, pending } = useAction()

  const wei = parse(amount)
  const max = mode === 'deposit' ? walletBalance : casinoBalance
  const needsApproval =
    mode === 'deposit' && wei !== null && allowance !== undefined && allowance < wei
  const overMax = wei !== null && max !== undefined && wei > max
  const runningHere = pending && active?.mode === mode

  function done() {
    setActive(null)
    setAmount('')
    onDone()
  }

  return (
    <div className="panel panel-pad col gap">
      <div className="between">
        <h3>💰 Bank</h3>
        <div className="tabs">
          <button className={`tab ${mode === 'deposit' ? 'active' : ''}`} onClick={() => setMode('deposit')}>
            Deposit
          </button>
          <button className={`tab ${mode === 'withdraw' ? 'active' : ''}`} onClick={() => setMode('withdraw')}>
            Withdraw
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 14, lineHeight: 1.4, minHeight: '2.8em', margin: '12px 0' }}>
        {mode === 'deposit'
          ? 'Move chips from your wallet into the casino to play with them.'
          : 'Pull your casino balance back to your wallet any time.'}
      </p>

      <AmountInput
        label={mode === 'deposit' ? 'Amount to deposit' : 'Amount to withdraw'}
        value={amount}
        onChange={setAmount}
        max={max}
        disabled={pending}
      />

      <button
        className="btn btn-primary btn-block"
        disabled={pending || wei === null || overMax}
        onClick={() => {
          if (!ensureSepolia()) return
          // First deposit needs an ERC-20 allowance — prompt for it in a modal
          // instead of depositing, then the user comes back and deposits.
          if (needsApproval) return onNeedApproval()
          setActive({ mode })
          run({ ...casinoContract, functionName: mode, args: [wei!] }, done, (hash) =>
            setActive({ mode, hash }),
          )
        }}
      >
        {runningHere ? (
          <span className="row gap-sm" style={{ justifyContent: 'center' }}>
            <span className="spin" /> {mode === 'deposit' ? 'Depositing…' : 'Withdrawing…'}
          </span>
        ) : pending ? (
          // The other tab's tx is in flight — show it's blocked until that settles.
          <span className="row gap-sm" style={{ justifyContent: 'center' }}>
            <span className="spin" /> Waiting…
          </span>
        ) : overMax ? (
          'Amount exceeds balance'
        ) : mode === 'deposit' ? (
          'Deposit'
        ) : (
          'Withdraw'
        )}
      </button>

      {/* Always reserve the link's line so the panel doesn't change height. The
          link shows only while this tab's tx is in flight (18px = one 12px line). */}
      <div className="center" style={{ fontSize: 12, minHeight: 18 }}>
        {active?.hash && active.mode === mode && (
          <a href={explorerTx(active.hash)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        )}
      </div>
    </div>
  )
}
