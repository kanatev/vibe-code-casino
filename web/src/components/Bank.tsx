import { useState } from 'react'
import { useAction } from '../hooks/useAction'
import { AmountInput } from './AmountInput'
import { casinoContract } from '../config'
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
  const { run, pending, error } = useAction()

  const wei = parse(amount)
  const max = mode === 'deposit' ? walletBalance : casinoBalance
  const needsApproval =
    mode === 'deposit' && wei !== null && allowance !== undefined && allowance < wei
  const overMax = wei !== null && max !== undefined && wei > max

  function done() {
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
          run({ ...casinoContract, functionName: mode, args: [wei!] }, done)
        }}
      >
        {pending ? (
          <span className="row gap-sm" style={{ justifyContent: 'center' }}>
            <span className="spin" /> {mode === 'deposit' ? 'Depositing…' : 'Withdrawing…'}
          </span>
        ) : overMax ? (
          'Amount exceeds balance'
        ) : mode === 'deposit' ? (
          'Deposit'
        ) : (
          'Withdraw'
        )}
      </button>

      {error && <div className="notice error">⚠️ {error}</div>}
    </div>
  )
}
