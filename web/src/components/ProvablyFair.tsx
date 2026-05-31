import { useState } from 'react'
import { parseEventLogs } from 'viem'
import { usePublicClient } from 'wagmi'
import {
  casinoContract,
  casinoDiceAbi,
  CASINO_ADDRESS,
  CHIP_ADDRESS,
  VRF_SUBSCRIPTION_ID,
  TOKEN_SYMBOL,
  HOUSE_EDGE_BPS,
  explorerAddress,
} from '../config'
import { fmt, shortAddr } from '../lib/format'
import { useToast } from '../hooks/useToast'

type Verified = {
  requestId: bigint
  player: string
  amount: bigint
  payoutOnWin: bigint
  rollUnder: number
  settled: boolean
  won: boolean
  result: number
}

export function ProvablyFair({ onBack }: { onBack: () => void }) {
  const publicClient = usePublicClient()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [bet, setBet] = useState<Verified | null>(null)
  const notify = useToast()

  async function verify() {
    setBet(null)
    const raw = input.trim()
    if (!raw) return
    setLoading(true)
    try {
      let requestId: bigint
      if (raw.startsWith('0x') && raw.length === 66) {
        // Treat as a transaction hash: pull the requestId out of the logs.
        const receipt = await publicClient!.getTransactionReceipt({ hash: raw as `0x${string}` })
        const logs = parseEventLogs({ abi: casinoDiceAbi, logs: receipt.logs })
        const evt = logs.find((l) => l.eventName === 'BetPlaced' || l.eventName === 'BetSettled')
        const id = (evt?.args as { requestId?: bigint } | undefined)?.requestId
        if (id === undefined) throw new Error('No casino bet found in that transaction.')
        requestId = id
      } else {
        requestId = BigInt(raw)
      }

      const b = (await publicClient!.readContract({
        ...casinoContract,
        functionName: 'bets',
        args: [requestId],
      })) as readonly [string, bigint, bigint, number, boolean, boolean, number]

      if (b[0] === '0x0000000000000000000000000000000000000000') {
        throw new Error('No bet exists for that id.')
      }
      setBet({
        requestId,
        player: b[0],
        amount: b[1],
        payoutOnWin: b[2],
        rollUnder: Number(b[3]),
        settled: b[4],
        won: b[5],
        result: Number(b[6]),
      })
    } catch (e) {
      notify((e as Error)?.message ?? 'Could not verify that input.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="col gap">
      <div className="panel panel-pad col gap">
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <button className="back-btn" onClick={onBack} aria-label="Back to Play">←</button>
          <h3>🔍 Provably fair — don't trust, verify</h3>
        </div>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
          Every roll is decided by <strong>Chainlink VRF v2.5</strong>, a verifiable random
          function. The casino requests randomness, and the VRF coordinator delivers a number
          on-chain together with a cryptographic proof. The house cannot see, predict, or change
          the result — and neither can we. The settlement formula is fixed in the contract:
        </p>
        <pre className="formula">
{`result  = randomWord % 100        // 0..99, from Chainlink VRF
won     = result < rollUnder      // you picked rollUnder
payout  = amount × 99 ÷ rollUnder // ${HOUSE_EDGE_BPS / 100}% house edge, baked in`}
        </pre>
        <p className="muted" style={{ fontSize: 14 }}>
          The edge is a flat {HOUSE_EDGE_BPS / 100}% on every bet, whatever target you pick — the
          expected return is always 0.99×. Source is verified on Etherscan; read it yourself.
        </p>
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <a className="pill" href={explorerAddress(CASINO_ADDRESS)} target="_blank" rel="noreferrer">
            📜 Casino contract ↗
          </a>
          <a className="pill" href={explorerAddress(CHIP_ADDRESS)} target="_blank" rel="noreferrer">
            🪙 {TOKEN_SYMBOL} token ↗
          </a>
          {VRF_SUBSCRIPTION_ID && (
            <a className="pill" href="https://vrf.chain.link/sepolia" target="_blank" rel="noreferrer">
              🎲 VRF subscription #{VRF_SUBSCRIPTION_ID.slice(0, 6)}… ↗
            </a>
          )}
        </div>
      </div>

      <div className="panel panel-pad col gap">
        <h3>Verify any bet</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Paste a bet transaction hash (or a raw VRF request id) and recompute the outcome straight
          from on-chain state.
        </p>
        <div className="input-wrap">
          <input
            placeholder="0x… bet tx hash"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
          />
          <button className="btn btn-primary" style={{ padding: '8px 16px' }} disabled={loading} onClick={verify}>
            {loading ? <span className="spin" /> : 'Verify'}
          </button>
        </div>

        {bet && (
          <div className="verify-result">
            <div className="between">
              <span className="muted">Player</span>
              <a href={explorerAddress(bet.player)} target="_blank" rel="noreferrer" className="mono">
                {shortAddr(bet.player)} ↗
              </a>
            </div>
            <div className="between"><span className="muted">Bet amount</span><span className="mono">{fmt(bet.amount)} {TOKEN_SYMBOL}</span></div>
            <div className="between"><span className="muted">Target (roll under)</span><span className="mono">{bet.rollUnder}</span></div>
            <div className="divider" />
            {bet.settled ? (
              <>
                <div className="between"><span className="muted">Rolled result</span><span className="mono" style={{ fontSize: 18 }}>{bet.result}</span></div>
                <div className="between">
                  <span className="muted">{bet.result} &lt; {bet.rollUnder} ?</span>
                  <span className={`pill ${bet.won ? 'win' : 'lose'}`}>{bet.won ? 'WIN' : 'LOSE'}</span>
                </div>
                <div className="between"><span className="muted">Payout</span><span className="mono">{bet.won ? fmt(bet.payoutOnWin) : '0'} {TOKEN_SYMBOL}</span></div>
              </>
            ) : (
              <div className="notice warn">⏳ This bet is still waiting for Chainlink VRF to settle.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
