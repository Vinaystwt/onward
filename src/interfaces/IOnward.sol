// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "../lib/OnwardTypes.sol";

interface IRuleEngine {
    function getRule(uint256 ruleId) external view returns (OnwardTypes.Rule memory);
}

interface IAdapterRegistry {
    function adapterFor(bytes32 domain) external view returns (address);
}

interface IPolicyLimits {
    function canSpend(address wallet, uint256 ruleId, uint256 amount, uint256 walletBalance)
        external
        view
        returns (bool ok, string memory reason);

    function consumeSpend(address wallet, uint256 ruleId, uint256 amount) external;
}

interface IReceiptLog {
    function createReceipt(
        uint256 actionId,
        uint256 ruleId,
        address wallet,
        string calldata source,
        bytes calldata rawOutput,
        bool decision,
        address target,
        uint256 value,
        bytes calldata data
    ) external;

    function updateStatus(uint256 actionId, OnwardTypes.ActionStatus status) external;
}

interface ITrackRecord {
    function recordEvaluation(uint256 ruleId) external;
    function recordSettle(uint256 ruleId) external;
    function recordRollback(uint256 ruleId) external;
    function totals() external view returns (uint256 evaluations, uint256 settled, uint256 rolledBack, uint256 failed);
}

interface IVault {
    function createPendingAction(
        uint256 ruleId,
        address wallet,
        bytes32 domain,
        address target,
        uint256 value,
        bytes calldata data,
        string calldata source,
        bytes calldata rawOutput,
        bytes32 originalDecisionHash,
        bool decision
    ) external returns (uint256 actionId);

    function getPendingAction(uint256 actionId) external view returns (OnwardTypes.PendingActionView memory);
    function settleAfterChallenge(uint256 actionId) external;
    function rollback(uint256 actionId) external;
}
