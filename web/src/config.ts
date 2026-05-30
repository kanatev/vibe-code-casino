import { sepolia } from 'wagmi/chains'
import { vibeChipAbi } from './abi/vibeChipAbi'
import { casinoDiceAbi } from './abi/casinoDiceAbi'

export { vibeChipAbi } from './abi/vibeChipAbi'
export { casinoDiceAbi } from './abi/casinoDiceAbi'

/** Deployed contract addresses, injected at build time via Vite env vars. */
export const CHIP_ADDRESS = (import.meta.env.VITE_CHIP_ADDRESS ?? '') as `0x${string}`
export const CASINO_ADDRESS = (import.meta.env.VITE_CASINO_ADDRESS ?? '') as `0x${string}`

/** Chainlink VRF subscription id (for the "Provably Fair" page links). */
export const VRF_SUBSCRIPTION_ID = import.meta.env.VITE_VRF_SUBSCRIPTION_ID ?? ''

export const CHAIN = sepolia
export const EXPLORER_URL = sepolia.blockExplorers.default.url // https://sepolia.etherscan.io

export const chipContract = { address: CHIP_ADDRESS, abi: vibeChipAbi } as const
export const casinoContract = { address: CASINO_ADDRESS, abi: casinoDiceAbi } as const

/** Game constants — kept in sync with the on-chain contract. */
export const HOUSE_EDGE_BPS = 100 // 1%
export const MIN_ROLL_UNDER = 1
export const MAX_ROLL_UNDER = 95
export const TOKEN_SYMBOL = 'VCHIP'
export const TOKEN_DECIMALS = 18

export const isConfigured = Boolean(CHIP_ADDRESS && CASINO_ADDRESS)

/** Quote the gross payout (stake included) for a winning bet, mirroring
 *  CasinoDice.quotePayout: amount * 99 / rollUnder. */
export function quotePayout(amount: bigint, rollUnder: number): bigint {
  return (amount * 100n * BigInt(10000 - HOUSE_EDGE_BPS)) / (BigInt(rollUnder) * 10000n)
}

/** Win chance as a percentage, e.g. rollUnder 50 -> 50. */
export function winChancePct(rollUnder: number): number {
  return rollUnder
}

/** Net multiplier shown to the player, e.g. 1.98x at rollUnder 50. */
export function payoutMultiplier(rollUnder: number): number {
  return (100 * (10000 - HOUSE_EDGE_BPS)) / (rollUnder * 10000)
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`
}

export function explorerAddress(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`
}
