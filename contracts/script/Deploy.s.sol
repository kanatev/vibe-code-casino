// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {VibeChip} from "../src/VibeChip.sol";
import {CasinoDice} from "../src/CasinoDice.sol";
import {IVRFCoordinatorV2Plus} from
    "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

/// @notice Reproducible Sepolia deploy.
///
/// IMPORTANT — create the VRF subscription FIRST, then pass its id in.
/// A VRF v2.5 subscription id is generated on-chain and is NOT deterministic,
/// so creating it *inside* a forge script breaks: the id captured during
/// simulation differs from the real one, and every call that references it
/// (fund / addConsumer / the casino constructor) ends up pointing at a
/// subscription that doesn't exist. We therefore create + fund the subscription
/// out of band and feed the real id to this script via VRF_SUBSCRIPTION_ID.
///
/// 1) Create + fund a subscription (prints the real id):
///      cast send $VRF_COORDINATOR "createSubscription()" --private-key $PK --rpc-url $RPC
///      # read subId from the SubscriptionCreated event, then:
///      cast send $VRF_COORDINATOR "fundSubscriptionWithNative(uint256)" $SUBID \
///          --value 0.3ether --private-key $PK --rpc-url $RPC
///      # NOTE: fund generously (~0.3 ETH). The Sepolia DON only fulfils once the
///      # subscription can cover the worst-case callback cost at the 500 gwei lane
///      # (~(callbackGasLimit + ~115k overhead) * 500 gwei). 0.02 ETH looks like it
///      # works (the request is accepted) but the request then silently hangs.
/// 2) export VRF_SUBSCRIPTION_ID=<subId>
/// 3) forge script script/Deploy.s.sol:Deploy --rpc-url $RPC --broadcast --verify
///
/// Required env: PRIVATE_KEY, VRF_SUBSCRIPTION_ID
/// Optional env: VRF_COORDINATOR, KEY_HASH, BANKROLL_WEI
contract Deploy is Script {
    // Ethereum Sepolia VRF v2.5 defaults (docs.chain.link).
    address constant SEPOLIA_COORDINATOR = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
    bytes32 constant SEPOLIA_KEY_HASH = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        uint256 subId = vm.envUint("VRF_SUBSCRIPTION_ID");
        address coordinatorAddr = vm.envOr("VRF_COORDINATOR", SEPOLIA_COORDINATOR);
        bytes32 keyHash = vm.envOr("KEY_HASH", SEPOLIA_KEY_HASH);
        uint256 bankroll = vm.envOr("BANKROLL_WEI", uint256(500_000 ether));

        IVRFCoordinatorV2Plus coordinator = IVRFCoordinatorV2Plus(coordinatorAddr);

        vm.startBroadcast(pk);

        // 1. Token
        VibeChip chip = new VibeChip();

        // 2. Casino, wired to the pre-created subscription
        CasinoDice casino = new CasinoDice(address(chip), coordinatorAddr, keyHash, subId);

        // 3. Register the casino as a consumer of the subscription
        coordinator.addConsumer(subId, address(casino));

        // 4. Seed the house bankroll
        chip.mint(deployer, bankroll);
        chip.approve(address(casino), bankroll);
        casino.fundBankroll(bankroll);

        vm.stopBroadcast();

        console2.log("=========== DEPLOYMENT ===========");
        console2.log("Deployer:        ", deployer);
        console2.log("VibeChip (VCHIP):", address(chip));
        console2.log("CasinoDice:      ", address(casino));
        console2.log("VRF Coordinator: ", coordinatorAddr);
        console2.log("VRF Subscription:", subId);
        console2.log("Bankroll funded: ", bankroll);
        console2.log("==================================");
    }
}
