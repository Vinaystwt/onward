// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "./lib/OnwardTypes.sol";
import {AgentCodec} from "./lib/AgentCodec.sol";
import {OwnableLite} from "./lib/OwnableLite.sol";
import {IAgentRequester, IAgentRequesterHandler, Request, Response, ResponseStatus} from "./interfaces/IAgentRequester.sol";
import {IRuleEngine, IVault} from "./interfaces/IOnward.sol";

contract Challenge is IAgentRequesterHandler, OwnableLite {
    IAgentRequester public immutable platform;
    IRuleEngine public ruleEngine;
    IVault public vault;

    mapping(uint256 => uint256) public requestToAction;
    mapping(uint256 => bool) public pendingRequests;

    event ChallengeOpened(uint256 indexed actionId, uint256 indexed requestId);
    event ChallengeResolved(uint256 indexed actionId, bool agreed, bytes32 rereadDecisionHash);
    event ChallengeFailed(uint256 indexed actionId, ResponseStatus status);

    constructor(address platform_, address ruleEngine_, address vault_) {
        platform = IAgentRequester(platform_);
        ruleEngine = IRuleEngine(ruleEngine_);
        vault = IVault(vault_);
    }

    receive() external payable {}

    function challenge(uint256 actionId) external payable returns (uint256 requestId) {
        OnwardTypes.PendingActionView memory action = vault.getPendingAction(actionId);
        require(action.status == OnwardTypes.ActionStatus.Pending, "NOT_PENDING");
        OnwardTypes.Rule memory rule = ruleEngine.getRule(action.ruleId);
        uint256 deposit = requiredDeposit(rule.eventSpec.kind);
        require(msg.value >= deposit, "UNDERFUNDED_AGENT");
        requestId = platform.createRequest{value: deposit}(
            AgentCodec.agentId(rule.eventSpec.kind),
            address(this),
            this.handleResponse.selector,
            AgentCodec.payload(rule.eventSpec)
        );
        requestToAction[requestId] = actionId;
        pendingRequests[requestId] = true;
        if (msg.value > deposit) {
            (bool ok,) = msg.sender.call{value: msg.value - deposit}("");
            require(ok, "REFUND_FAILED");
        }
        emit ChallengeOpened(actionId, requestId);
    }

    function requiredDeposit(OnwardTypes.AgentKind kind) public view returns (uint256) {
        return platform.getRequestDeposit() + AgentCodec.pricePerAgent(kind) * AgentCodec.SUBCOMMITTEE_SIZE;
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external override {
        require(msg.sender == address(platform), "ONLY_PLATFORM");
        require(pendingRequests[requestId], "UNKNOWN_REQUEST");
        pendingRequests[requestId] = false;
        uint256 actionId = requestToAction[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit ChallengeFailed(actionId, status);
            return;
        }

        OnwardTypes.PendingActionView memory action = vault.getPendingAction(actionId);
        OnwardTypes.Rule memory rule = ruleEngine.getRule(action.ruleId);
        (, bytes32 rereadDecisionHash) = AgentCodec.decide(rule.eventSpec, responses[0].result);
        bool agreed = rereadDecisionHash == action.originalDecisionHash;
        if (agreed) {
            vault.settleAfterChallenge(actionId);
        } else {
            vault.rollback(actionId);
        }
        emit ChallengeResolved(actionId, agreed, rereadDecisionHash);
    }
}
