import { createConfig } from 'wagmi'
import { fallback, http } from 'viem'
import { sepolia } from 'wagmi/chains'
import { getDefaultConfig, connectorsForWallets } from '@rainbow-me/rainbowkit'
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets'

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

// A real WalletConnect projectId unlocks the full wallet list (mobile via QR).
// Get one (free) at https://cloud.reown.com. Without it we fall back to an
// injected-only setup so MetaMask works with zero external dependency — the
// WalletConnect relay is never initialized, so no "invalid key" socket errors.
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || ''

export const wagmiConfig = WC_PROJECT_ID
  ? getDefaultConfig({
      appName: 'Vibe Casino',
      projectId: WC_PROJECT_ID,
      chains: [sepolia],
      transports: { [sepolia.id]: transport },
      ssr: false,
    })
  : createConfig({
      chains: [sepolia],
      connectors: connectorsForWallets(
        [{ groupName: 'Installed', wallets: [injectedWallet] }],
        { appName: 'Vibe Casino', projectId: 'INJECTED_ONLY' },
      ),
      transports: { [sepolia.id]: transport },
      ssr: false,
    })
