// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {VibeChip} from "../src/VibeChip.sol";
import {CasinoDice} from "../src/CasinoDice.sol";
import {VRFCoordinatorV2_5Mock} from
    "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract CasinoDiceTest is Test {
    VibeChip internal chip;
    VRFCoordinatorV2_5Mock internal coordinator;
    CasinoDice internal casino;

    uint256 internal subId;
    bytes32 internal constant KEY_HASH = keccak256("test-key-hash");

    address internal house = address(this);
    address internal alice = makeAddr("alice");

    uint256 internal constant BANKROLL = 1_000_000 ether;

    function setUp() public {
        chip = new VibeChip();

        // base fee, gas price, wei per unit link (values irrelevant for logic tests)
        coordinator = new VRFCoordinatorV2_5Mock(0.0001 ether, 1e9, 4e15);
        subId = coordinator.createSubscription();
        vm.deal(address(this), 100 ether);
        coordinator.fundSubscriptionWithNative{value: 100 ether}(subId);

        casino = new CasinoDice(address(chip), address(coordinator), KEY_HASH, subId);
        coordinator.addConsumer(subId, address(casino));

        // Seed the house bankroll.
        chip.mint(house, BANKROLL);
        chip.approve(address(casino), BANKROLL);
        casino.fundBankroll(BANKROLL);

        // Give Alice some chips to play with.
        chip.mint(alice, 10_000 ether);
        vm.prank(alice);
        chip.approve(address(casino), type(uint256).max);
    }

    // ---- helpers ----

    function _deposit(address who, uint256 amount) internal {
        vm.prank(who);
        casino.deposit(amount);
    }

    /// Settle the player's in-flight bet with a chosen result (0..99).
    function _settleWithResult(address who, uint8 result) internal {
        uint256 reqId = casino.pendingRequestId(who);
        uint256[] memory words = new uint256[](1);
        words[0] = uint256(result); // result % 100 == result for result < 100
        coordinator.fulfillRandomWordsWithOverride(reqId, address(casino), words);
    }

    function _assertSolvent() internal view {
        assertGe(casino.solvencySurplus(), int256(0), "casino is insolvent");
    }

    // ---- deposit / withdraw ----

    function test_DepositAndWithdraw() public {
        _deposit(alice, 1_000 ether);
        assertEq(casino.balanceOf(alice), 1_000 ether);
        assertEq(casino.totalPlayerBalance(), 1_000 ether);

        vm.prank(alice);
        casino.withdraw(400 ether);
        assertEq(casino.balanceOf(alice), 600 ether);
        assertEq(chip.balanceOf(alice), 10_000 ether - 600 ether);
        _assertSolvent();
    }

    function test_WithdrawMoreThanBalanceReverts() public {
        _deposit(alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(CasinoDice.InsufficientBalance.selector);
        casino.withdraw(101 ether);
    }

    // ---- payout math / edge ----

    function test_QuotePayoutHasOnePercentEdge() public view {
        // rollUnder 50 -> 1.98x ; win chance 50% -> EV = 0.99
        assertEq(casino.quotePayout(100 ether, 50), 198 ether);
        // rollUnder 1 -> 99x ; win chance 1% -> EV = 0.99
        assertEq(casino.quotePayout(1 ether, 1), 99 ether);
        // rollUnder 95 -> ~1.0421x ; win chance 95% -> EV = 0.99
        assertEq(casino.quotePayout(95 ether, 95), 99 ether);
    }

    function test_RollUnderOutOfRangeReverts() public {
        vm.expectRevert(CasinoDice.InvalidRollUnder.selector);
        casino.quotePayout(1 ether, 0);
        vm.expectRevert(CasinoDice.InvalidRollUnder.selector);
        casino.quotePayout(1 ether, 96);
    }

    // ---- betting: win / lose ----

    function test_WinningBetPaysOut() public {
        _deposit(alice, 1_000 ether);
        vm.prank(alice);
        casino.placeBet(100 ether, 50);

        assertEq(casino.balanceOf(alice), 900 ether, "stake should be locked");
        assertTrue(casino.pendingRequestId(alice) != 0, "bet should be in flight");

        // result 25 < 50 => win, payout 198
        _settleWithResult(alice, 25);

        assertEq(casino.balanceOf(alice), 900 ether + 198 ether);
        assertEq(casino.pendingRequestId(alice), 0);
        assertEq(casino.reservedPayout(), 0);
        _assertSolvent();
    }

    function test_LosingBetKeepsStake() public {
        _deposit(alice, 1_000 ether);
        uint256 bankrollBefore = casino.houseBankroll();

        vm.prank(alice);
        casino.placeBet(100 ether, 50);

        // result 75 >= 50 => lose
        _settleWithResult(alice, 75);

        assertEq(casino.balanceOf(alice), 900 ether, "stake is lost");
        assertEq(casino.houseBankroll(), bankrollBefore + 100 ether, "house gains stake");
        assertEq(casino.reservedPayout(), 0);
        _assertSolvent();
    }

    function test_BoundaryResultEqualsRollUnderLoses() public {
        _deposit(alice, 1_000 ether);
        vm.prank(alice);
        casino.placeBet(100 ether, 50);
        // result == rollUnder is a loss (strictly less wins)
        _settleWithResult(alice, 50);
        assertEq(casino.balanceOf(alice), 900 ether);
    }

    function test_CannotPlaceTwoBetsConcurrently() public {
        _deposit(alice, 1_000 ether);
        vm.prank(alice);
        casino.placeBet(100 ether, 50);
        vm.prank(alice);
        vm.expectRevert(CasinoDice.BetInFlight.selector);
        casino.placeBet(100 ether, 50);
    }

    function test_BetBeyondBankrollReverts() public {
        // Drain bankroll to a tiny amount.
        casino.withdrawBankroll(BANKROLL - 10 ether);
        _deposit(alice, 10_000 ether);

        // rollUnder 50 needs houseContribution = amount * 0.98; 10 ether bankroll
        // only backs a small stake. A 1000-chip bet must revert.
        vm.prank(alice);
        vm.expectRevert(CasinoDice.InsufficientBankroll.selector);
        casino.placeBet(1_000 ether, 50);
    }

    function test_MaxBetIsBettable() public {
        // Shrink the bankroll so maxBet is below Alice's deposit and the cap is
        // exercised by bankroll, not by player balance.
        casino.withdrawBankroll(BANKROLL - 4_900 ether);
        _deposit(alice, 10_000 ether);

        uint256 mb = casino.maxBet(50);
        assertEq(mb, 5_000 ether, "maxBet should consume the full bankroll");

        vm.prank(alice);
        casino.placeBet(mb, 50);
        // House contribution (mb * 0.98) should have drained the bankroll to ~0.
        assertEq(casino.houseBankroll(), 0);
        _assertSolvent();
    }

    // ---- solvency under a sequence of mixed outcomes ----

    function testFuzz_SolvencyHoldsAcrossOutcomes(uint8 result, uint8 rollUnder, uint256 amount) public {
        rollUnder = uint8(bound(rollUnder, 1, 95));
        amount = bound(amount, 1 ether, 5_000 ether);
        _deposit(alice, 5_000 ether);

        vm.prank(alice);
        casino.placeBet(amount, rollUnder);
        _settleWithResult(alice, uint8(bound(result, 0, 99)));
        _assertSolvent();
    }

    // ---- access control ----

    function test_OnlyOwnerWithdrawsBankroll() public {
        vm.prank(alice);
        vm.expectRevert();
        casino.withdrawBankroll(1 ether);
    }

    receive() external payable {}
}
