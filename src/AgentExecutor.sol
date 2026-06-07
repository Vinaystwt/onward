// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "./lib/OnwardTypes.sol";
import {AgentCodec} from "./lib/AgentCodec.sol";
import {OwnableLite} from "./lib/OwnableLite.sol";
import {IAgentRequester, IAgentRequesterHandler, Request, Response, ResponseStatus} from "./interfaces/IAgentRequester.sol";
import {IAdapterRegistry, IRuleEngine, IVault} from "./interfaces/IOnward.sol";
import {IVenueAdapter} from "./interfaces/IVenueAdapter.sol";

contract AgentExecutor is IAgentRequesterHandler, OwnableLite {
    IAgentRequester public immutable platform;
    IRuleEngine public ruleEngine;
    IAdapterRegistry public adapterRegistry;
    IVault public vault;

    mapping(uint256 => uint256) public requestToRule;
    mapping(uint256 => bool) public pendingRequests;
    mapping(uint256 => bool) public forceWrongNextRead;

    event AgentRequestCreated(uint256 indexed requestId, uint256 indexed ruleId, uint256 indexed agentId, uint256 deposit);
    event AgentRequestFailed(uint256 indexed requestId, uint256 indexed ruleId, ResponseStatus status);
    event EvaluationCompleted(uint256 indexed requestId, uint256 indexed ruleId, bool decision, bytes32 decisionHash);
    event WrongNextReadInjected(uint256 indexed ruleId);

    modifier onlyRuleEngine() {
        require(msg.sender == address(ruleEngine), "ONLY_RULE_ENGINE");
        _;
    }

    constructor(address platform_, address ruleEngine_, address adapterRegistry_, address vault_) {
        platform = IAgentRequester(platform_);
        ruleEngine = IRuleEngine(ruleEngine_);
        adapterRegistry = IAdapterRegistry(adapterRegistry_);
        vault = IVault(vault_);
    }

    receive() external payable {}

    function injectWrongNextRead(uint256 ruleId) external onlyOwner {
        forceWrongNextRead[ruleId] = true;
        emit WrongNextReadInjected(ruleId);
    }

    function evaluate(uint256 ruleId) external payable onlyRuleEngine returns (uint256 requestId) {
        OnwardTypes.Rule memory rule = ruleEngine.getRule(ruleId);
        require(rule.active, "RULE_INACTIVE");
        uint256 deposit = requiredDeposit(rule.eventSpec.kind);
        require(msg.value >= deposit, "UNDERFUNDED_AGENT");

        bytes memory requestPayload = AgentCodec.payload(rule.eventSpec);
        uint256 id = AgentCodec.agentId(rule.eventSpec.kind);
        requestId = platform.createRequest{value: deposit}(
            id,
            address(this),
            this.handleResponse.selector,
            requestPayload
        );
        requestToRule[requestId] = ruleId;
        pendingRequests[requestId] = true;
        if (msg.value > deposit) {
            (bool ok,) = msg.sender.call{value: msg.value - deposit}("");
            require(ok, "REFUND_FAILED");
        }
        emit AgentRequestCreated(requestId, ruleId, id, deposit);
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
        uint256 ruleId = requestToRule[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit AgentRequestFailed(requestId, ruleId, status);
            return;
        }

        OnwardTypes.Rule memory rule = ruleEngine.getRule(ruleId);
        (bool decision, bytes32 decisionHash) = AgentCodec.decide(rule.eventSpec, responses[0].result);
        if (forceWrongNextRead[ruleId]) {
            forceWrongNextRead[ruleId] = false;
            decision = !decision;
            decisionHash = keccak256(abi.encode(decisionHash, decision, "INJECTED_WRONG_FIRST_READ"));
        }
        emit EvaluationCompleted(requestId, ruleId, decision, decisionHash);
        if (!decision) return;

        address adapter = adapterRegistry.adapterFor(rule.actionSpec.domain);
        (address target, uint256 value, bytes memory data) =
            IVenueAdapter(adapter).encodeAction(rule.wallet, ruleId, rule.actionSpec.value, rule.actionSpec.params);
        vault.createPendingAction(
            ruleId,
            rule.wallet,
            rule.actionSpec.domain,
            target,
            value,
            data,
            AgentCodec.source(rule.eventSpec),
            responses[0].result,
            decisionHash,
            decision
        );
    }
}
