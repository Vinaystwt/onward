// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";
import {OnwardTypes} from "./lib/OnwardTypes.sol";
import {IPolicyLimits, IReceiptLog, ITrackRecord} from "./interfaces/IOnward.sol";

contract Vault is OwnableLite {
    struct PendingAction {
        uint256 id;
        uint256 ruleId;
        address wallet;
        bytes32 domain;
        address target;
        uint256 value;
        bytes data;
        uint256 createdAt;
        uint256 challengeDeadline;
        OnwardTypes.ActionStatus status;
        bytes32 originalDecisionHash;
        bytes rawOutput;
    }

    IPolicyLimits public policyLimits;
    IReceiptLog public receiptLog;
    ITrackRecord public trackRecord;
    address public executor;
    address public challenge;
    uint256 public challengeWindow;
    uint256 public nextActionId = 1;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public reserved;
    mapping(uint256 => PendingAction) private pendingActions;

    event ExecutorSet(address indexed executor);
    event ChallengeSet(address indexed challenge);
    event Deposited(address indexed payer, address indexed wallet, uint256 amount);
    event Withdrawn(address indexed wallet, uint256 amount);
    event PendingActionOpened(uint256 indexed actionId, uint256 indexed ruleId, address indexed wallet, address target, uint256 value);
    event ActionSettled(uint256 indexed actionId, address indexed target, uint256 value);
    event ActionRolledBack(uint256 indexed actionId);
    event ActionFailed(uint256 indexed actionId, bytes reason);

    modifier onlyExecutor() {
        require(msg.sender == executor, "ONLY_EXECUTOR");
        _;
    }

    modifier onlyChallenge() {
        require(msg.sender == challenge, "ONLY_CHALLENGE");
        _;
    }

    constructor(address policyLimits_, address receiptLog_, address trackRecord_, uint256 challengeWindow_) {
        policyLimits = IPolicyLimits(policyLimits_);
        receiptLog = IReceiptLog(receiptLog_);
        trackRecord = ITrackRecord(trackRecord_);
        challengeWindow = challengeWindow_;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.sender, msg.value);
    }

    function setExecutor(address executor_) external onlyOwner {
        executor = executor_;
        emit ExecutorSet(executor_);
    }

    function setChallenge(address challenge_) external onlyOwner {
        challenge = challenge_;
        emit ChallengeSet(challenge_);
    }

    function depositFor(address wallet) external payable {
        require(wallet != address(0), "BAD_WALLET");
        balances[wallet] += msg.value;
        emit Deposited(msg.sender, wallet, msg.value);
    }

    function availableBalance(address wallet) public view returns (uint256) {
        return balances[wallet] - reserved[wallet];
    }

    function withdraw(uint256 amount) external {
        require(availableBalance(msg.sender) >= amount, "INSUFFICIENT_AVAILABLE");
        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "WITHDRAW_FAILED");
        emit Withdrawn(msg.sender, amount);
    }

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
    ) external onlyExecutor returns (uint256 actionId) {
        require(target != address(0), "BAD_TARGET");
        require(availableBalance(wallet) >= value, "INSUFFICIENT_FUNDS");
        (bool ok, string memory reason) = policyLimits.canSpend(wallet, ruleId, value, balances[wallet]);
        require(ok, reason);
        policyLimits.consumeSpend(wallet, ruleId, value);

        actionId = nextActionId++;
        reserved[wallet] += value;
        pendingActions[actionId] = PendingAction({
            id: actionId,
            ruleId: ruleId,
            wallet: wallet,
            domain: domain,
            target: target,
            value: value,
            data: data,
            createdAt: block.timestamp,
            challengeDeadline: block.timestamp + challengeWindow,
            status: OnwardTypes.ActionStatus.Pending,
            originalDecisionHash: originalDecisionHash,
            rawOutput: rawOutput
        });
        receiptLog.createReceipt(actionId, ruleId, wallet, source, rawOutput, decision, target, value, data);
        trackRecord.recordEvaluation(ruleId);
        emit PendingActionOpened(actionId, ruleId, wallet, target, value);
    }

    function settle(uint256 actionId) external {
        PendingAction storage action = pendingActions[actionId];
        require(action.status == OnwardTypes.ActionStatus.Pending, "NOT_PENDING");
        require(block.timestamp >= action.challengeDeadline, "CHALLENGE_OPEN");
        _settle(action);
    }

    function settleAfterChallenge(uint256 actionId) external onlyChallenge {
        PendingAction storage action = pendingActions[actionId];
        require(action.status == OnwardTypes.ActionStatus.Pending, "NOT_PENDING");
        _settle(action);
    }

    function rollback(uint256 actionId) external onlyChallenge {
        PendingAction storage action = pendingActions[actionId];
        require(action.status == OnwardTypes.ActionStatus.Pending, "NOT_PENDING");
        action.status = OnwardTypes.ActionStatus.RolledBack;
        reserved[action.wallet] -= action.value;
        receiptLog.updateStatus(action.id, OnwardTypes.ActionStatus.RolledBack);
        trackRecord.recordRollback(action.ruleId);
        emit ActionRolledBack(action.id);
    }

    function getPendingAction(uint256 actionId) external view returns (OnwardTypes.PendingActionView memory view_) {
        PendingAction storage action = pendingActions[actionId];
        view_ = OnwardTypes.PendingActionView({
            id: action.id,
            ruleId: action.ruleId,
            wallet: action.wallet,
            domain: action.domain,
            target: action.target,
            value: action.value,
            data: action.data,
            createdAt: action.createdAt,
            challengeDeadline: action.challengeDeadline,
            status: action.status,
            originalDecisionHash: action.originalDecisionHash,
            rawOutput: action.rawOutput
        });
    }

    function _settle(PendingAction storage action) internal {
        action.status = OnwardTypes.ActionStatus.Settled;
        reserved[action.wallet] -= action.value;
        balances[action.wallet] -= action.value;
        (bool ok, bytes memory result) = action.target.call{value: action.value}(action.data);
        if (!ok) {
            action.status = OnwardTypes.ActionStatus.Failed;
            balances[action.wallet] += action.value;
            receiptLog.updateStatus(action.id, OnwardTypes.ActionStatus.Failed);
            emit ActionFailed(action.id, result);
            return;
        }
        receiptLog.updateStatus(action.id, OnwardTypes.ActionStatus.Settled);
        trackRecord.recordSettle(action.ruleId);
        emit ActionSettled(action.id, action.target, action.value);
    }
}
