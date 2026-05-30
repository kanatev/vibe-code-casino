// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title VIBECHIP — test casino token
/// @notice An ERC-20 used as casino chips on testnet. Anyone can claim free
///         chips from the public faucet once per cooldown window. Has no real
///         value; exists purely so players can try the casino without buying
///         anything. The owner can also mint (used to seed the house bankroll).
contract VibeChip is ERC20, Ownable {
    /// @notice Amount of VCHIP handed out per faucet claim (1,000 VCHIP).
    uint256 public constant FAUCET_AMOUNT = 1_000 * 1e18;

    /// @notice Minimum time between faucet claims for a single address.
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    /// @notice Timestamp of the last faucet claim per address.
    mapping(address => uint256) public lastClaim;

    event FaucetClaimed(address indexed to, uint256 amount);

    error FaucetCooldownActive(uint256 availableAt);

    constructor() ERC20("Vibe Chip", "VCHIP") Ownable(msg.sender) {}

    /// @notice Claim free test chips. Callable once per FAUCET_COOLDOWN.
    function faucet() external {
        uint256 nextClaim = lastClaim[msg.sender] + FAUCET_COOLDOWN;
        if (lastClaim[msg.sender] != 0 && block.timestamp < nextClaim) {
            revert FaucetCooldownActive(nextClaim);
        }
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Seconds until `account` can claim again (0 if claimable now).
    function timeUntilNextClaim(address account) external view returns (uint256) {
        if (lastClaim[account] == 0) return 0;
        uint256 nextClaim = lastClaim[account] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaim) return 0;
        return nextClaim - block.timestamp;
    }

    /// @notice Owner mint, used to fund the casino house bankroll.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
