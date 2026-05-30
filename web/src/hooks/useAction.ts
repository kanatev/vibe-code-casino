import { useState, useCallback } from 'react'
import { useWriteContract, usePublicClient } from 'wagmi'
import type { Abi } from 'viem'

type WriteParams = {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

function humanError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string }
  const msg = err?.shortMessage || err?.message || 'Transaction failed'
  if (/user rejected|denied|rejected the request/i.test(msg)) return 'You rejected the request.'
  if (/insufficient funds/i.test(msg)) return 'Not enough Sepolia ETH for gas.'
  // Surface our custom contract errors readably.
  if (/InsufficientBalance/.test(msg)) return 'Insufficient casino balance.'
  if (/InsufficientBankroll/.test(msg)) return 'Bet exceeds what the house can cover right now.'
  if (/BetInFlight/.test(msg)) return 'You already have a bet in flight — wait for it to settle.'
  if (/FaucetCooldownActive/.test(msg)) return 'Faucet is on cooldown.'
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg
}

/** Send a contract write and wait for it to be mined. Tracks pending + error. */
export function useAction() {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (params: WriteParams, onMined?: (hash: `0x${string}`) => void): Promise<`0x${string}` | null> => {
      setError(null)
      setPending(true)
      try {
        const hash = await writeContractAsync(params as never)
        await publicClient!.waitForTransactionReceipt({ hash })
        onMined?.(hash)
        return hash
      } catch (e) {
        setError(humanError(e))
        return null
      } finally {
        setPending(false)
      }
    },
    [writeContractAsync, publicClient],
  )

  return { run, pending, error, setError }
}
