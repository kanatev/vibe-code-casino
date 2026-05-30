import { useState } from 'react'
import { maxUint256 } from 'viem'
import { useAction } from '../hooks/useAction'
import { AmountInput } from './AmountInput'
import { casinoContract, chipContract, CASINO_ADDRESS, TOKEN_SYMBOL } from '../config'
import { parse } from '../lib/format'

type Props = {
  walletBalance?: bigint
  casinoBalance?: bigint
  allowance?: bigint
  onDone: () => void
}

export function Bank({ walletBalance, casinoBalance, allowance, onDone }: Props) {
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
        <h3>2 · Bank</h3>
        <div className="tabs">
          <button className={`tab ${mode === 'deposit' ? 'active' : ''}`} onClick={() => setMode('deposit')}>
            Deposit
          </button>
          <button className={`tab ${mode === 'withdraw' ? 'active' : ''}`} onClick={() => setMode('withdraw')}>
            Withdraw
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 14 }}>
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

      {needsApproval ? (
        <button
          className="btn btn-primary btn-block"
          disabled={pending || overMax}
          onClick={() =>
            run({ ...chipContract, functionName: 'approve', args: [CASINO_ADDRESS, maxUint256] }, onDone)
          }
        >
          {pending ? (
            <span className="row gap-sm" style={{ justifyContent: 'center' }}>
              <span className="spin" /> Approving…
            </span>
          ) : (
            `Approve ${TOKEN_SYMBOL}`
          )}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-block"
          disabled={pending || wei === null || overMax}
          onClick={() =>
            run({ ...casinoContract, functionName: mode, args: [wei!] }, done)
          }
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
      )}

      {needsApproval && !pending && (
        <p className="muted center" style={{ fontSize: 12 }}>
          One-time approval lets the casino move your chips. You approve once, then deposit.
        </p>
      )}
      {error && <div className="notice error">⚠️ {error}</div>}
    </div>
  )
}
