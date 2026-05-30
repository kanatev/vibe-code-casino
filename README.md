# 🎲 Vibe Casino — a provably-fair crypto casino

A fully on-chain dice casino on **Ethereum Sepolia**. Deposit test chips, bet on a
dice roll, win or lose, withdraw — and verify on a block explorer that the house
isn't cheating. Randomness comes from **Chainlink VRF v2.5**, so neither the house
nor the developer can predict or tamper with a roll.

> Built for the *Vibe-Code Challenge: Build a Crypto Casino in a Weekend* (48h).
> Testnet only. The chips are worthless. Don't gamble real money.

---

## 🔗 Live links

| | |
|---|---|
| **Frontend** | **[vibe-code-casino.vercel.app](https://vibe-code-casino.vercel.app/)** |
| **Casino contract** | [`0xaAc22207…47d59`](https://sepolia.etherscan.io/address/0xaAc22207FcF183A34aBB7e87A179290411047d59#code) — verified |
| **Chip token (VCHIP)** | [`0x963d9C56…BC0EB`](https://sepolia.etherscan.io/address/0x963d9C56A38fA03f84c9dBD0319D232786dBC0EB#code) — verified |
| **VRF subscription** | [vrf.chain.link/sepolia](https://vrf.chain.link/sepolia) |

Full address list: [`DEPLOYMENTS.md`](./DEPLOYMENTS.md).

---

## How it works

Two contracts:

- **`VibeChip` (VCHIP)** — an ERC-20 test chip with a public faucet (1,000 VCHIP
  per address per 24h). The in-game currency. Worthless by design.
- **`CasinoDice`** — custodial balances + the dice game + Chainlink VRF integration.

A round of play:

```
faucet()        →  claim free VCHIP to your wallet
approve()       →  one-time allowance for the casino
deposit()       →  move chips into your in-casino balance
placeBet()      →  stake locked, a Chainlink VRF request is opened   ⟵ tx 1
fulfillRandomWords()  →  VRF delivers a number on-chain, bet settles  ⟵ tx 2 (Chainlink)
withdraw()      →  pull your balance back to your wallet
```

Because VRF is asynchronous, a bet is a two-transaction flow: you place the bet,
then ~30–90s later the VRF coordinator calls back with a verifiable random number
and the result is written on-chain. The UI shows a "waiting for randomness" state
and resolves automatically (and survives a page refresh).

### Provably fair — the whole point

Everything needed to audit a bet is on-chain and the contract is verified on
Etherscan. The settlement is a fixed, public formula:

```
result  = randomWord % 100        // 0..99, straight from Chainlink VRF
won     = result < rollUnder       // your chosen target (1..95)
payout  = amount * 99 / rollUnder  // 1% house edge, baked in
```

- The **house edge is a flat 1%** at every target — expected return is always
  `0.99×`. Pick a 50 target → 50% win chance, `1.98×` payout. Pick 1 → 1% chance,
  `99×` payout. Same edge either way.
- The house **cannot influence the roll**: the random number is produced by
  Chainlink's VRF and delivered with a cryptographic proof the coordinator
  verifies on-chain before the callback runs.
- Every bet emits `BetPlaced` and `BetSettled` events with the stake, target,
  random result and payout. The in-app **Provably Fair** tab lets anyone paste a
  bet transaction hash and recompute the outcome from chain state.

### Staying solvent (it's a casino, not a charity — but it also can't go bankrupt mid-bet)

The contract keeps a strict invariant, checkable on-chain via `solvencySurplus()`:

```
token.balanceOf(casino) >= totalPlayerBalance + houseBankroll + reservedPayout
```

When a bet is placed, the **full potential payout** is reserved out of the house
bankroll, so a winning player is always paid. `maxBet(rollUnder)` caps a stake to
what the current bankroll can cover, which prevents a single bet from draining the
house.

---

## ✅ What works

- Connect wallet (MetaMask / WalletConnect via RainbowKit), Sepolia network.
- Faucet, approve, deposit, withdraw — full custodial banking flow.
- Dice game with a live odds/payout/win-chance readout and an adjustable target.
- Real Chainlink VRF v2.5 randomness, funded with **native ETH** (no LINK needed).
- Async settlement UX with auto-resolve and refresh-resume.
- Provably-fair verifier that recomputes any bet from a tx hash.
- Both contracts **verified on Etherscan**.
- Contracts covered by Foundry tests (16 tests, incl. a solvency fuzz test).
- Polished dark "neon felt" UI, error states throughout (rejections, gas,
  cooldowns, bankroll limits).

## ⚠️ What doesn't / limitations

- **Players pay their own gas.** A brand-new wallet needs a little Sepolia ETH
  before it can even claim chips. The faucet card links to public ETH faucets, but
  sponsoring user gas (a paymaster / meta-tx relayer) was out of scope for 48h.
- **One bet in flight at a time** per player — simpler accounting and UX, at the
  cost of concurrent rolls.
- **VRF latency.** Rolls take ~30–90s (sometimes longer if Sepolia is congested).
  That's the price of verifiable randomness; the UI is built around it.
- **Manual VRF top-ups.** When the subscription's ETH runs low, the owner refunds
  it. No auto-refill.
- **No historical bet feed** in the UI yet (events exist on-chain; only the current
  round is shown).

---

## Why Ethereum (and not Solana)

The challenge let me pick either. I chose **Ethereum / Sepolia** because:

1. **Verifiable randomness is the entire challenge**, and Chainlink VRF on EVM is
   the most battle-tested, easiest-to-audit source of on-chain randomness. The
   "paranoid player" story is strongest when the randomness itself carries an
   on-chain cryptographic proof — not a commit-reveal scheme the house could grief.
2. **Tooling maturity for a 48h sprint**: Foundry (fast tests + one-command
   verification), wagmi/viem/RainbowKit, and Etherscan source verification let me
   spend time on the product instead of fighting the stack.
3. **Block-explorer auditability**: verified Solidity on Etherscan is exactly the
   "read the code yourself" surface the brief asks for.

Solana would mean lower fees and faster finality, but a weaker/heavier story for
*verifiable* randomness and a less familiar audit path for a casual skeptic.

---

## 🧠 Hardest unknown I had to figure out

**Chainlink VRF v2.5 with native-ETH payment, and a nasty non-determinism trap.**

Two things bit me:

1. **Native payment over LINK.** VRF v2.5 can be paid in native ETH from a funded
   subscription (`fundSubscriptionWithNative` + `extraArgs.nativePayment = true`),
   which removed the LINK-faucet dependency entirely. Figuring out the exact
   `RandomWordsRequest` encoding and `extraArgs` was the first hurdle.

2. **A VRF subscription id is created on-chain and is *not* deterministic.** My
   first deploy script created the subscription *inside* the Foundry script and
   reused the returned `subId` to fund it, add the consumer, and construct the
   casino. It failed in a confusing way: the `subId` captured during simulation
   differs from the one actually produced on-chain, so the fund/`addConsumer` calls
   targeted a subscription that didn't exist, and the casino was deployed pointing
   at the wrong id. The fix: **create + fund the subscription out of band**, read
   the real id from the `SubscriptionCreated` event, then pass it into the deploy
   (the casino also exposes `setVrfConfig` so the id can be corrected in place).
   The deploy script and `DEPLOYMENTS.md` document the working flow.

3. **The silent-hang funding trap.** With the subscription funded at 0.02 ETH the
   request was *accepted* on-chain (`pendingRequestExists == true`) but never
   fulfilled — no error, just a hang. The Sepolia DON only fulfils once the
   subscription can cover the worst-case callback cost at the 500 gwei gas lane
   (≈ `(callbackGasLimit + ~115k overhead) × 500 gwei` ≈ 0.16 ETH). Topping the
   subscription up to ~0.3 ETH made the pending request settle within ~12 seconds.
   Lesson: on testnet, fund VRF subscriptions far more generously than the live
   gas price suggests.

---

## 🔮 What I'd build next

- **Gasless onboarding** — a paymaster (ERC-4337) or a meta-tx relayer so a fresh
  wallet can claim and play without first hunting for Sepolia ETH.
- **Bet history & live feed** — index `BetSettled` events for a personal history
  and a global "recent rolls" ticker.
- **More games on the same bankroll** — coinflip, limbo, a simple wheel; the
  VRF + solvency plumbing already generalizes.
- **Concurrent bets** and an in-UI "verify" that links straight to the VRF request.
- **Bankroll auto-refill** for the VRF subscription and bankroll analytics.

---

## 🛠 Run it locally

### Contracts (Foundry)

```bash
cd contracts
forge install            # if libs aren't present
forge test               # 16 tests, incl. solvency fuzz
```

Deploy to Sepolia (see the header of `script/Deploy.s.sol` for the full flow):

```bash
cp .env.example .env     # fill PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY

# 1) create + fund a VRF subscription, note the printed subId
cast send $VRF_COORDINATOR "createSubscription()" --private-key $PK --rpc-url $RPC
# fund generously (~0.3 ETH) — see the VRF gotcha note below
cast send $VRF_COORDINATOR "fundSubscriptionWithNative(uint256)" $SUBID \
    --value 0.3ether --private-key $PK --rpc-url $RPC

# 2) export VRF_SUBSCRIPTION_ID=<subId> into .env, then deploy + verify
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC --broadcast --verify
```

### Frontend (Vite + React + wagmi)

```bash
cd web
npm install
cp .env.example .env      # set VITE_CHIP_ADDRESS / VITE_CASINO_ADDRESS (already filled for the live deploy)
npm run dev               # http://localhost:5173
```

---

## Repo layout

```
contracts/        Foundry project
  src/            VibeChip.sol, CasinoDice.sol
  test/           Foundry tests
  script/         Deploy.s.sol
web/              Vite + React + wagmi + RainbowKit frontend
DEPLOYMENTS.md    deployed addresses & parameters
```

---

## Tech

Solidity 0.8.26 · Foundry · OpenZeppelin · Chainlink VRF v2.5 · React 19 · Vite ·
wagmi v3 · viem · RainbowKit · TypeScript.
