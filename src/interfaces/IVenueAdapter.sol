// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVenueAdapter {
    function domain() external view returns (bytes32);
    function venue() external view returns (address);

    function encodeAction(
        address wallet,
        uint256 ruleId,
        uint256 amount,
        bytes calldata params
    ) external view returns (address target, uint256 value, bytes memory data);
}
