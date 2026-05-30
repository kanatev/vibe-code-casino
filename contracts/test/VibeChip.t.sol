// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {VibeChip} from "../src/VibeChip.sol";

contract VibeChipTest is Test {
    VibeChip internal chip;
    address internal bob = makeAddr("bob");

    function setUp() public {
        chip = new VibeChip();
    }

    function test_FaucetMints() public {
        vm.prank(bob);
        chip.faucet();
        assertEq(chip.balanceOf(bob), chip.FAUCET_AMOUNT());
    }

    function test_FaucetCooldownEnforced() public {
        vm.prank(bob);
        chip.faucet();

        vm.prank(bob);
        vm.expectRevert(); // FaucetCooldownActive
        chip.faucet();
    }

    function test_FaucetClaimableAfterCooldown() public {
        vm.prank(bob);
        chip.faucet();

        vm.warp(block.timestamp + chip.FAUCET_COOLDOWN());
        vm.prank(bob);
        chip.faucet();
        assertEq(chip.balanceOf(bob), 2 * chip.FAUCET_AMOUNT());
    }

    function test_OnlyOwnerMints() public {
        vm.prank(bob);
        vm.expectRevert();
        chip.mint(bob, 1 ether);
    }
}
