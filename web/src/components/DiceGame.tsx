import { useEffect, useRef, useState } from 'react'
import { parseEventLogs } from 'viem'
import { useWriteContract, usePublicClient } from 'wagmi'
import { AmountInput } from './AmountInput'
import {
  casinoContract,
  casinoDiceAbi,
  MIN_ROLL_UNDER,
  MAX_ROLL_UNDER,
  TOKEN_SYMBOL,
  quotePayout,
  payoutMultiplier,
  explorerTx,
} from '../config'
import { fmt, parse } from '../lib/format'
import { useToast } from '../hooks/useToast'

type Phase = 'idle' | 'placing' | 'rolling' | 'won' | 'lost'

type Settlement = {
  result: number
  won: boolean
  payout: bigint
  rollUnder: number
  txHash?: `0x${string}`
}

type Props = {
  casinoBalance?: bigint
  houseBankroll?: bigint
  pendingRequestId?: bigint
  onDone: () => void
  ensureSepolia: () => boolean
}

const HOUSE_NUM = 100n * 9900n // 990000 = 100 * (BPS - edge)

/** Largest stake the bankroll can back at this target (mirrors maxBet on-chain). */
function bankrollMaxBet(bankroll: bigint, rollUnder: number): bigint {
  const den = BigInt(rollUnder) * 10000n
  const perUnit = HOUSE_NUM - den // > 0 for rollUnder <= 95
  if (perUnit <= 0n) return 0n
  return (bankroll * den) / perUnit
}

export function DiceGame({ casinoBalance, houseBankroll, pendingRequestId, onDone, ensureSepolia }: Props) {
  const [rollUnder, setRollUnder] = useState(50)
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [display, setDisplay] = useState(50)
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const notify = useToast()

  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const wei = parse(amount)
  const bankrollCap = houseBankroll ? bankrollMaxBet(houseBankroll, rollUnder) : 0n
  const maxBet =
    casinoBalance !== undefined ? (casinoBalance < bankrollCap ? casinoBalance : bankrollCap) : 0n
  const overMax = wei !== null && wei > maxBet
  const payout = wei && wei > 0n ? quotePayout(wei, rollUnder) : 0n
  const busy = phase === 'placing' || phase === 'rolling'

  // Spin the displayed number while waiting for randomness. Only once the bet is
  // placed on-chain ('rolling') — not during 'placing', when we're still waiting
  // for the user to sign and the tx to mine.
  useEffect(() => {
    if (phase === 'rolling') {
      tickRef.current = setInterval(() => setDisplay(Math.floor(Math.random() * 100)), 70)
    } else if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [phase])

  // Resume a bet that's still in flight (e.g. after a page refresh).
  useEffect(() => {
    if (phase === 'idle' && pendingRequestId && pendingRequestId !== 0n) {
      setPhase('rolling')
      void pollSettlement(pendingRequestId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequestId])

  async function pollSettlement(requestId: bigint) {
    const deadline = Date.now() + 5 * 60_000 // 5 min safety window
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const bet = (await publicClient!.readContract({
          ...casinoContract,
          functionName: 'bets',
          args: [requestId],
        })) as readonly [string, bigint, bigint, number, boolean, boolean, number]
        const settled = bet[4]
        if (settled) {
          const won = bet[5]
          const result = Number(bet[6])
          setSettlement({ result, won, payout: bet[2], rollUnder: Number(bet[3]) })
          setDisplay(result)
          setPhase(won ? 'won' : 'lost')
          onDone()
          return
        }
      } catch {
        /* transient RPC error — keep polling */
      }
    }
    notify('Randomness is taking unusually long. Your bet is safe on-chain — refresh to check again.', 'warn')
    setPhase('idle')
  }

  async function roll() {
    if (wei === null || overMax) return
    if (!ensureSepolia()) return
    setSettlement(null)
    setPhase('placing')
    try {
      const hash = await writeContractAsync({
        ...casinoContract,
        functionName: 'placeBet',
        args: [wei, rollUnder],
      })
      // Record the tx hash as soon as it's signed so the "View bet transaction"
      // link shows during 'placing' too, not only once 'rolling' starts.
      setSettlement({ result: 0, won: false, payout: 0n, rollUnder, txHash: hash })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      const logs = parseEventLogs({ abi: casinoDiceAbi, logs: receipt.logs, eventName: 'BetPlaced' })
      const requestId = (logs[0]?.args as { requestId?: bigint } | undefined)?.requestId
      if (requestId === undefined) {
        notify('Bet placed but could not read the request id. Refresh to see the result.', 'warn')
        setPhase('idle')
        onDone()
        return
      }
      setPhase('rolling')
      onDone()
      await pollSettlement(requestId)
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? 'Bet failed'
      notify(/reject|denied/i.test(msg) ? 'You rejected the request.' : msg, 'error')
      setPhase('idle')
    }
  }

  const tileClass =
    phase === 'won' ? 'mint' : phase === 'lost' ? 'red' : busy ? 'gold' : 'neutral'

  return (
    <div className="panel panel-pad col gap">
      <div className="between">
        <h3>🎲 Roll the dice</h3>
        <span className="pill">Provably fair · Chainlink VRF</span>
      </div>

      {/* Result tile */}
      <div className="dice-stage">
        <div className={`dice-tile ${tileClass} ${phase === 'won' || phase === 'lost' ? 'pop' : ''}`}>
          <span className="dice-num">{display.toString().padStart(2, '0')}</span>
          <span className="dice-cap">
            {phase === 'rolling'
              ? 'rolling…'
              : phase === 'won'
                ? 'WIN'
                : phase === 'lost'
                  ? 'LOSE'
                  : `roll under ${rollUnder}`}
          </span>
        </div>
        {phase === 'won' && settlement && (
          <p className="result-line win">
            🎉 {display} &lt; {settlement.rollUnder} — you won {fmt(settlement.payout)} {TOKEN_SYMBOL}!
          </p>
        )}
        {phase === 'lost' && settlement && (
          <p className="result-line lose">
            {display} ≥ {settlement.rollUnder} — house wins this one.
          </p>
        )}
        {busy && (
          <p className="muted center" style={{ fontSize: 13 }}>
            {phase === 'placing'
              ? 'Confirm in your wallet…'
              : 'Waiting for Chainlink VRF to deliver a verifiable random number on-chain…'}
          </p>
        )}
        {/* Base caption so idle reserves the same vertical space as the other
            phases — keeps the block from jumping in size between states. */}
        {phase === 'idle' && (
          <p className="muted center" style={{ fontSize: 13 }}>
            Place your bet.
          </p>
        )}
      </div>

      {/* Target slider */}
      <div className="field">
        <div className="between">
          <label>Win if roll is under</label>
          <span className="mono" style={{ color: 'var(--mint)', fontWeight: 700 }}>{rollUnder}</span>
        </div>
        <input
          type="range"
          min={MIN_ROLL_UNDER}
          max={MAX_ROLL_UNDER}
          value={rollUnder}
          disabled={busy}
          onChange={(e) => setRollUnder(Number(e.target.value))}
          className="slider"
          style={{
            background: `linear-gradient(90deg, var(--mint) 0%, var(--mint) ${
              ((rollUnder - MIN_ROLL_UNDER) / (MAX_ROLL_UNDER - MIN_ROLL_UNDER)) * 100
            }%, var(--bg-3) ${((rollUnder - MIN_ROLL_UNDER) / (MAX_ROLL_UNDER - MIN_ROLL_UNDER)) * 100}%, var(--bg-3) 100%)`,
          }}
        />
        <div className="odds-row">
          <div className="stat">
            <span className="label">Win chance</span>
            <span className="value">{rollUnder}%</span>
          </div>
          <div className="stat">
            <span className="label">Payout</span>
            <span className="value">{payoutMultiplier(rollUnder).toFixed(4)}×</span>
          </div>
          <div className="stat">
            <span className="label">On win you get</span>
            <span className="value">{fmt(payout)} <span className="unit">{TOKEN_SYMBOL}</span></span>
          </div>
        </div>
      </div>

      <AmountInput label="Bet amount" value={amount} onChange={setAmount} max={maxBet} disabled={busy} />

      <button className="btn btn-primary btn-block btn-lg" disabled={busy || wei === null || wei === 0n || overMax} onClick={roll}>
        {phase === 'placing' ? (
          <span className="row gap-sm" style={{ justifyContent: 'center' }}><span className="spin" /> Placing bet…</span>
        ) : phase === 'rolling' ? (
          <span className="row gap-sm" style={{ justifyContent: 'center' }}><span className="spin" /> Rolling…</span>
        ) : overMax ? (
          'Bet exceeds your max'
        ) : (
          'Roll'
        )}
      </button>

      {/* Always reserve the link's line so the block doesn't grow when a bet
          settles and the link appears (18px = one 12px line at body's 1.5). */}
      <div className="center" style={{ fontSize: 12, minHeight: 18 }}>
        {settlement?.txHash && (
          <a href={explorerTx(settlement.txHash)} target="_blank" rel="noreferrer">
            View bet transaction ↗
          </a>
        )}
      </div>
    </div>
  )
}
