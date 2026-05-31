import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { WalletButton } from './components/WalletButton'
import { InstallWalletModal } from './components/InstallWalletModal'
import { SwitchNetworkModal } from './components/SwitchNetworkModal'
import { ApproveModal } from './components/ApproveModal'
import { useCasino } from './hooks/useCasino'
import { Faucet } from './components/Faucet'
import { Bank } from './components/Bank'
import { DiceGame } from './components/DiceGame'
import { ProvablyFair } from './components/ProvablyFair'
import { isConfigured, TOKEN_SYMBOL } from './config'
import { fmt } from './lib/format'

type Tab = 'play' | 'fair'

export default function App() {
  const { isConnected, chainId } = useAccount()
  const [tab, setTab] = useState<Tab>('play')
  const [installOpen, setInstallOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const casino = useCasino()
  const openInstall = () => setInstallOpen(true)

  // The MetaMask extension does not inject into an already-open tab, so after the
  // user installs it and returns, reload once to pick up window.ethereum.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sessionStorage.getItem('vibe-mm-installing') === '1') {
        sessionStorage.removeItem('vibe-mm-installing')
        window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Guard every transaction: if connected to the wrong network, prompt a switch
  // instead of letting the wallet sign on the wrong chain. Returns false if blocked.
  const ensureSepolia = (): boolean => {
    if (isConnected && chainId !== sepolia.id) {
      setSwitchOpen(true)
      return false
    }
    return true
  }

  return (
    <div className="app">
      <InstallWalletModal open={installOpen} onClose={() => setInstallOpen(false)} />
      <SwitchNetworkModal open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onApproved={casino.refetch}
      />
      <header className="topbar">
        <div className="brand">
          <span className="logo">🎲</span>
          Vibe Casino
          <span className="tag">Sepolia testnet</span>
        </div>

        <div className="row gap">
          {isConnected && isConfigured && (
            <div className="balances">
              <div className="balance-chip">
                <span className="k">In casino</span>
                <span className="v">{fmt(casino.casinoBalance)} {TOKEN_SYMBOL}</span>
              </div>
              <div className="balance-chip">
                <span className="k">In wallet</span>
                <span className="v">{fmt(casino.walletBalance)} {TOKEN_SYMBOL}</span>
              </div>
            </div>
          )}
          <WalletButton onInstall={openInstall} />
        </div>
      </header>

      {!isConfigured ? (
        <NotConfigured />
      ) : !isConnected ? (
        <Landing onInstall={openInstall} />
      ) : (
        <>
          {/* No top switcher: navigation is via the "Provably fair" link in the
              dice panel and the back arrow in Provably Fair. Both tabs stay
              mounted (toggled via CSS) so in-flight rolls and form state survive. */}
          <div className={`tab-panel ${tab === 'play' ? '' : 'hidden'}`}>
            <div className="grid grid-2">
              <DiceGame
                casinoBalance={casino.casinoBalance}
                houseBankroll={casino.houseBankroll}
                pendingRequestId={casino.pendingRequestId}
                onDone={casino.refetch}
                ensureSepolia={ensureSepolia}
                onOpenFair={() => setTab('fair')}
              />
              <div className="col gap side-col">
                <Faucet
                  cooldown={casino.faucetCooldown}
                  onDone={casino.refetch}
                  ensureSepolia={ensureSepolia}
                />
                <Bank
                  walletBalance={casino.walletBalance}
                  casinoBalance={casino.casinoBalance}
                  allowance={casino.allowance}
                  onDone={casino.refetch}
                  ensureSepolia={ensureSepolia}
                  onNeedApproval={() => setApproveOpen(true)}
                />
              </div>
            </div>
          </div>
          <div className={`tab-panel ${tab === 'fair' ? '' : 'hidden'}`}>
            <ProvablyFair onBack={() => setTab('play')} />
          </div>

          <footer className="footer">
            House bankroll: <strong>{fmt(casino.houseBankroll)} {TOKEN_SYMBOL}</strong> · Flat 1% edge ·
            Randomness by Chainlink VRF v2.5 · Test tokens only, no real value.
          </footer>
        </>
      )}
    </div>
  )
}

function Landing({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="hero">
      <h1 className="hero-title">
        The casino that <span className="grad">can't lie to you.</span>
      </h1>
      <p className="hero-sub">
        A fully on-chain dice game on Ethereum Sepolia. Every roll is settled by Chainlink VRF and
        every payout is verifiable on Etherscan. Connect a wallet, grab free test chips, and play.
      </p>
      <div className="hero-cta">
        <WalletButton onInstall={onInstall} />
      </div>
      <div className="hero-steps">
        <div className="hero-step"><span>1</span> Claim free {TOKEN_SYMBOL} from the faucet</div>
        <div className="hero-step"><span>2</span> Deposit into the casino</div>
        <div className="hero-step"><span>3</span> Roll the dice & win</div>
        <div className="hero-step"><span>4</span> Withdraw any time</div>
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="panel panel-pad" style={{ marginTop: 40 }}>
      <h2>⚙️ Almost there</h2>
      <p className="muted mt-sm">
        The frontend is running but contract addresses aren't set yet. Deploy the contracts and add
        <code> VITE_CHIP_ADDRESS</code> and <code> VITE_CASINO_ADDRESS</code> to <code>web/.env</code>,
        then restart the dev server.
      </p>
    </div>
  )
}
