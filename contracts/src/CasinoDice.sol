// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/// @title CasinoDice — provably-fair "roll under" dice casino
/// @notice Players deposit VCHIP into a custodial balance, then bet on a dice
///         roll (0..99). Pick a target `rollUnder` in [1, 95]; you win if the
///         random result is strictly less than your target. Higher target =
///         higher win chance = lower payout. The house keeps a flat 1% edge on
///         every bet regardless of the target.
///
///         Randomness comes from Chainlink VRF v2.5 (paid in native ETH from a
///         funded subscription). The casino cannot see or influence the result
///         before it is delivered on-chain by the VRF coordinator, and every
///         outcome is recomputable from the emitted events:
///
///             result  = randomWord % 100
///             won     = result < rollUnder
///             payout  = amount * 100 * (10000 - 100) / (rollUnder * 10000)
///                     = amount * 99 / rollUnder
///
/// @dev Solvency invariant, preserved by every state transition:
///         token.balanceOf(this) >= totalPlayerBalance + houseBankroll + reservedPayout
contract CasinoDice is VRFConsumerBaseV2Plus, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------- //
    //                               Constants                               //
    // --------------------------------------------------------------------- //

    /// @notice House edge in basis points (100 = 1%).
    uint256 public constant HOUSE_EDGE_BPS = 100;
    uint256 public constant BPS = 10_000;

    /// @notice Allowed range for the win target. Capped at 95 so that a winning
    ///         payout always strictly exceeds the stake and bets stay meaningful.
    uint8 public constant MIN_ROLL_UNDER = 1;
    uint8 public constant MAX_ROLL_UNDER = 95;

    uint32 public constant NUM_WORDS = 1;

    // --------------------------------------------------------------------- //
    //                                 State                                 //
    // --------------------------------------------------------------------- //

    /// @notice The chip token used for all deposits, bets and payouts.
    IERC20 public immutable token;

    // ---- Chainlink VRF v2.5 configuration (owner-set) ----
    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint32 public callbackGasLimit = 200_000;
    uint16 public requestConfirmations = 3;

    // ---- Accounting ----
    /// @notice Withdrawable balance per player.
    mapping(address => uint256) public balanceOf;
    /// @notice Sum of all `balanceOf` values.
    uint256 public totalPlayerBalance;
    /// @notice Free house funds available to back new bets.
    uint256 public houseBankroll;
    /// @notice Total payout reserved across all unsettled bets.
    uint256 public reservedPayout;

    struct Bet {
        address player;
        uint256 amount;
        uint256 payoutOnWin;
        uint8 rollUnder;
        bool settled;
        bool won;
        uint8 result; // 0..99, valid once settled
    }

    /// @notice Bet details keyed by the VRF request id.
    mapping(uint256 => Bet) public bets;
    /// @notice Open VRF request id per player (0 = no bet in flight).
    mapping(address => uint256) public pendingRequestId;

    // --------------------------------------------------------------------- //
    //                                 Events                                //
    // --------------------------------------------------------------------- //

    event Deposit(address indexed player, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed player, uint256 amount, uint256 newBalance);
    event BankrollFunded(address indexed from, uint256 amount, uint256 newBankroll);
    event BankrollWithdrawn(address indexed to, uint256 amount, uint256 newBankroll);
    event BetPlaced(
        uint256 indexed requestId,
        address indexed player,
        uint256 amount,
        uint8 rollUnder,
        uint256 payoutOnWin
    );
    event BetSettled(
        uint256 indexed requestId,
        address indexed player,
        uint8 result,
        uint8 rollUnder,
        bool won,
        uint256 payout
    );
    event VrfConfigUpdated(bytes32 keyHash, uint256 subscriptionId, uint32 callbackGasLimit, uint16 requestConfirmations);

    // --------------------------------------------------------------------- //
    //                                 Errors                                //
    // --------------------------------------------------------------------- //

    error InvalidAmount();
    error InvalidRollUnder();
    error InsufficientBalance();
    error InsufficientBankroll();
    error BetInFlight();

    // --------------------------------------------------------------------- //
    //                              Construction                             //
    // --------------------------------------------------------------------- //

    constructor(address _token, address _vrfCoordinator, bytes32 _keyHash, uint256 _subscriptionId)
        VRFConsumerBaseV2Plus(_vrfCoordinator)
    {
        token = IERC20(_token);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }

    // --------------------------------------------------------------------- //
    //                          Player banking flow                          //
    // --------------------------------------------------------------------- //

    /// @notice Deposit chips into your custodial casino balance.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
        totalPlayerBalance += amount;
        emit Deposit(msg.sender, amount, balanceOf[msg.sender]);
    }

    /// @notice Withdraw chips from your casino balance back to your wallet.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        totalPlayerBalance -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount, balanceOf[msg.sender]);
    }

    // --------------------------------------------------------------------- //
    //                                Betting                                //
    // --------------------------------------------------------------------- //

    /// @notice Place a dice bet. Stake `amount` chips on the roll landing
    ///         strictly below `rollUnder` (result in 0..99). Funds are locked
    ///         and a Chainlink VRF request is opened; the result is settled
    ///         asynchronously in `fulfillRandomWords`.
    /// @return requestId The VRF request id, also the key into `bets`.
    function placeBet(uint256 amount, uint8 rollUnder) external nonReentrant returns (uint256 requestId) {
        if (amount == 0) revert InvalidAmount();
        if (rollUnder < MIN_ROLL_UNDER || rollUnder > MAX_ROLL_UNDER) revert InvalidRollUnder();
        if (pendingRequestId[msg.sender] != 0) revert BetInFlight();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();

        uint256 payout = quotePayout(amount, rollUnder);
        // payout > amount holds for rollUnder <= 95, so this never underflows.
        uint256 houseContribution = payout - amount;
        if (houseBankroll < houseContribution) revert InsufficientBankroll();

        // Effects: move the stake out of the player balance and reserve the
        // full payout (stake + house top-up) so the casino can always pay out.
        balanceOf[msg.sender] -= amount;
        totalPlayerBalance -= amount;
        houseBankroll -= houseContribution;
        reservedPayout += payout;

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))
            })
        );

        bets[requestId] = Bet({
            player: msg.sender,
            amount: amount,
            payoutOnWin: payout,
            rollUnder: rollUnder,
            settled: false,
            won: false,
            result: 0
        });
        pendingRequestId[msg.sender] = requestId;

        emit BetPlaced(requestId, msg.sender, amount, rollUnder, payout);
    }

    /// @dev VRF callback. Must not revert under normal conditions. Computes the
    ///      result deterministically and releases the reserved payout either to
    ///      the player (win) or back to the house (loss).
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        Bet storage bet = bets[requestId];
        if (bet.settled || bet.player == address(0)) return; // defensive no-op

        uint8 result = uint8(randomWords[0] % 100);
        bool won = result < bet.rollUnder;

        bet.result = result;
        bet.won = won;
        bet.settled = true;

        reservedPayout -= bet.payoutOnWin;
        pendingRequestId[bet.player] = 0;

        if (won) {
            balanceOf[bet.player] += bet.payoutOnWin;
            totalPlayerBalance += bet.payoutOnWin;
        } else {
            // Reclaim the whole reservation (player's stake + house top-up).
            houseBankroll += bet.payoutOnWin;
        }

        emit BetSettled(requestId, bet.player, result, bet.rollUnder, won, won ? bet.payoutOnWin : 0);
    }

    // --------------------------------------------------------------------- //
    //                            House bankroll                             //
    // --------------------------------------------------------------------- //

    /// @notice Add chips to the house bankroll. Anyone may fund the house.
    function fundBankroll(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        houseBankroll += amount;
        emit BankrollFunded(msg.sender, amount, houseBankroll);
    }

    /// @notice Withdraw free house funds. Cannot touch player balances or
    ///         payouts reserved for in-flight bets.
    function withdrawBankroll(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (houseBankroll < amount) revert InsufficientBankroll();
        houseBankroll -= amount;
        token.safeTransfer(owner(), amount);
        emit BankrollWithdrawn(owner(), amount, houseBankroll);
    }

    // --------------------------------------------------------------------- //
    //                             Configuration                             //
    // --------------------------------------------------------------------- //

    function setVrfConfig(
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) external onlyOwner {
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        emit VrfConfigUpdated(_keyHash, _subscriptionId, _callbackGasLimit, _requestConfirmations);
    }

    // --------------------------------------------------------------------- //
    //                                 Views                                 //
    // --------------------------------------------------------------------- //

    /// @notice Payout (including stake) for a winning bet of `amount` at `rollUnder`.
    /// @dev payout = amount * 100 * (BPS - edge) / (rollUnder * BPS) = amount * 99 / rollUnder.
    function quotePayout(uint256 amount, uint8 rollUnder) public pure returns (uint256) {
        if (rollUnder < MIN_ROLL_UNDER || rollUnder > MAX_ROLL_UNDER) revert InvalidRollUnder();
        return (amount * 100 * (BPS - HOUSE_EDGE_BPS)) / (uint256(rollUnder) * BPS);
    }

    /// @notice Win chance for a target, in basis points (e.g. 5000 = 50%).
    function winChanceBps(uint8 rollUnder) external pure returns (uint256) {
        if (rollUnder < MIN_ROLL_UNDER || rollUnder > MAX_ROLL_UNDER) revert InvalidRollUnder();
        return uint256(rollUnder) * 100; // rollUnder/100 expressed in bps
    }

    /// @notice Largest stake the current bankroll can back at `rollUnder`.
    /// @dev houseContribution = amount * (99 - rollUnder) / rollUnder <= houseBankroll.
    function maxBet(uint8 rollUnder) external view returns (uint256) {
        if (rollUnder < MIN_ROLL_UNDER || rollUnder > MAX_ROLL_UNDER) revert InvalidRollUnder();
        uint256 num = 100 * (BPS - HOUSE_EDGE_BPS); // 990000
        uint256 den = uint256(rollUnder) * BPS; // rollUnder * 10000
        // payout/amount = num/den ; houseContribution/amount = (num - den)/den
        uint256 contributionPerUnitNum = num - den; // > 0 for rollUnder <= 95
        return (houseBankroll * den) / contributionPerUnitNum;
    }

    /// @notice The solvency cushion: contract token balance minus all liabilities.
    ///         Should always be >= 0; exposed so anyone can audit it on-chain.
    function solvencySurplus() external view returns (int256) {
        uint256 assets = token.balanceOf(address(this));
        uint256 liabilities = totalPlayerBalance + houseBankroll + reservedPayout;
        return int256(assets) - int256(liabilities);
    }
}
