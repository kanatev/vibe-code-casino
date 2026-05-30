import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useCasino } from './hooks/useCasino'
import { Faucet } from './components/Faucet'
import { Bank } from './components/Bank'
import { DiceGame } from './components/DiceGame'
import { ProvablyFair } from './components/ProvablyFair'
import { isConfigured, TOKEN_SYMBOL } from './config'
import { fmt } from './lib/format'

type Tab = 'play' | 'fair'

export default function App() {
  const { isConnected } = useAccount()
  const [tab, setTab] = useState<Tab>('play')
  const casino = useCasino()

  return (
    <div className="app">
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
          <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
        </div>
      </header>

      {!isConfigured ? (
        <NotConfigured />
      ) : !isConnected ? (
        <Landing />
      ) : (
        <>
          <div className="center" style={{ marginBottom: 22 }}>
            <div className="tabs">
              <button className={`tab ${tab === 'play' ? 'active' : ''}`} onClick={() => setTab('play')}>
                🎲 Play
              </button>
              <button className={`tab ${tab === 'fair' ? 'active' : ''}`} onClick={() => setTab('fair')}>
                🔍 Provably Fair
              </button>
            </div>
          </div>

          {tab === 'play' ? (
            <div className="grid grid-2">
              <DiceGame
                casinoBalance={casino.casinoBalance}
                houseBankroll={casino.houseBankroll}
                pendingRequestId={casino.pendingRequestId}
                onDone={casino.refetch}
              />
              <div className="col gap">
                <Faucet
                  walletBalance={casino.walletBalance}
                  cooldown={casino.faucetCooldown}
                  onDone={casino.refetch}
                />
                <Bank
                  walletBalance={casino.walletBalance}
                  casinoBalance={casino.casinoBalance}
                  allowance={casino.allowance}
                  onDone={casino.refetch}
                />
              </div>
            </div>
          ) : (
            <ProvablyFair />
          )}

          <footer className="footer">
            House bankroll: <strong>{fmt(casino.houseBankroll)} {TOKEN_SYMBOL}</strong> · Flat 1% edge ·
            Randomness by Chainlink VRF v2.5 · Test tokens only, no real value.
          </footer>
        </>
      )}
    </div>
  )
}

function Landing() {
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
        <ConnectButton label="Connect wallet to play" />
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
