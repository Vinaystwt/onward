// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";
import {OnwardTypes} from "./lib/OnwardTypes.sol";

contract ReceiptLog is OwnableLite {
    struct ActionReceipt {
        uint256 actionId;
        uint256 ruleId;
        address wallet;
        string source;
        bytes rawOutput;
        bool decision;
        address target;
        uint256 value;
        bytes data;
        uint256 createdAt;
        uint256 updatedAt;
        OnwardTypes.ActionStatus status;
    }

    mapping(address => bool) public writers;
    mapping(uint256 => ActionReceipt) private receipts;
    mapping(uint256 => uint256[]) private actionsByRule;
    mapping(address => uint256[]) private actionsByWallet;

    event WriterSet(address indexed writer, bool allowed);
    event Receipt(
        uint256 indexed actionId,
        uint256 indexed ruleId,
        address indexed wallet,
        bool decision,
        OnwardTypes.ActionStatus status
    );
    event ReceiptStatus(uint256 indexed actionId, OnwardTypes.ActionStatus status);

    modifier onlyWriter() {
        require(writers[msg.sender], "ONLY_WRITER");
        _;
    }

    function setWriter(address writer, bool allowed) external onlyOwner {
        writers[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

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
    ) external onlyWriter {
        require(receipts[actionId].actionId == 0, "RECEIPT_EXISTS");
        receipts[actionId] = ActionReceipt({
            actionId: actionId,
            ruleId: ruleId,
            wallet: wallet,
            source: source,
            rawOutput: rawOutput,
            decision: decision,
            target: target,
            value: value,
            data: data,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            status: OnwardTypes.ActionStatus.Pending
        });
        actionsByRule[ruleId].push(actionId);
        actionsByWallet[wallet].push(actionId);
        emit Receipt(actionId, ruleId, wallet, decision, OnwardTypes.ActionStatus.Pending);
    }

    function updateStatus(uint256 actionId, OnwardTypes.ActionStatus status) external onlyWriter {
        require(receipts[actionId].actionId != 0, "RECEIPT_MISSING");
        receipts[actionId].status = status;
        receipts[actionId].updatedAt = block.timestamp;
        emit ReceiptStatus(actionId, status);
    }

    function getReceipt(uint256 actionId) external view returns (ActionReceipt memory) {
        return receipts[actionId];
    }

    function getActionsByRule(uint256 ruleId) external view returns (uint256[] memory) {
        return actionsByRule[ruleId];
    }

    function getActionsByWallet(address wallet) external view returns (uint256[] memory) {
        return actionsByWallet[wallet];
    }
}
