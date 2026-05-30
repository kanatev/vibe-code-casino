import { formatUnits, parseUnits } from 'viem'
import { TOKEN_DECIMALS } from '../config'

/** Format a token amount (wei) to a human string with up to `maxFrac` decimals. */
export function fmt(amount: bigint | undefined, maxFrac = 2): string {
  if (amount === undefined) return '—'
  const s = formatUnits(amount, TOKEN_DECIMALS)
  const n = Number(s)
  if (Number.isNaN(n)) return s
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac })
}

/** Parse a human token string to wei. Returns null on invalid input. */
export function parse(input: string): bigint | null {
  try {
    if (!input || Number(input) <= 0) return null
    return parseUnits(input as `${number}`, TOKEN_DECIMALS)
  } catch {
    return null
  }
}

export function shortAddr(addr?: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function shortHash(hash?: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

/** Turn seconds into a compact "2h 14m" / "44s" string. */
export function humanizeDuration(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
