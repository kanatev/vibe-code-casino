import { createConfig } from 'wagmi'
import { fallback, http } from 'viem'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Resilient transport: try the configured / primary RPC first, then fall back to
// other public Sepolia endpoints. Public nodes intermittently drop connections
// or rate-limit, so a single endpoint is fragile — viem rotates automatically.
const ENDPOINTS = [
  import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
  'https://rpc.sepolia.org',
]

const transport = fallback(
  ENDPOINTS.map((url) => http(url, { timeout: 12_000 })),
  { rank: false },
)

// Injected-only setup (MetaMask / any browser wallet). No WalletConnect, so no
// relay/projectId dependency and none of its console noise. The connect UI is a
// custom WalletButton that links to the MetaMask install page when no wallet is
// detected. (If mobile/QR wallets are wanted later, reintroduce WalletConnect.)
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [sepolia.id]: transport },
  ssr: false,
})
