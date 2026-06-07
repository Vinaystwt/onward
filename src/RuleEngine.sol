// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "./lib/OnwardTypes.sol";
import {OwnableLite} from "./lib/OwnableLite.sol";
import {PolicyLimits} from "./PolicyLimits.sol";

interface IAgentExecutorEntry {
    function evaluate(uint256 ruleId) external payable returns (uint256 requestId);
}

contract RuleEngine is OwnableLite {
    PolicyLimits public policyLimits;
    address public executor;
    uint256 public nextRuleId = 1;

    mapping(uint256 => OnwardTypes.Rule) private rules;
    mapping(address => uint256[]) private rulesByWallet;

    event ExecutorSet(address indexed executor);
    event RuleArmed(uint256 indexed ruleId, address indexed wallet, string plainText);
    event RulePaused(uint256 indexed ruleId, bool active);
    event RuleEvaluationRequested(uint256 indexed ruleId, uint256 indexed requestId);

    constructor(address policyLimits_) {
        policyLimits = PolicyLimits(policyLimits_);
    }

    receive() external payable {}

    function setExecutor(address executor_) external onlyOwner {
        executor = executor_;
        emit ExecutorSet(executor_);
    }

    function armRule(
        string calldata plainText,
        OnwardTypes.EventSpec calldata eventSpec,
        OnwardTypes.ActionSpec calldata actionSpec,
        uint256 limitsRef
    ) external returns (uint256 ruleId) {
        ruleId = _armRule(msg.sender, plainText, eventSpec, actionSpec, limitsRef);
    }

    function armLiveThresholdRule(
        string calldata plainText,
        bytes32 domain,
        uint256 actionValue,
        bytes calldata actionParams,
        uint256 limitsRef,
        OnwardTypes.Comparator comparator,
        string calldata url,
        string calldata selector,
        uint8 decimals,
        uint256 threshold
    ) external onlyOwner returns (uint256 ruleId) {
        OnwardTypes.EventSpec memory eventSpec = OnwardTypes.EventSpec({
            kind: OnwardTypes.AgentKind.JsonUint,
            comparator: comparator,
            url: url,
            selector: selector,
            decimals: decimals,
            threshold: threshold,
            expected: "",
            prompt: "",
            systemOrDescription: ""
        });
        OnwardTypes.ActionSpec memory actionSpec =
            OnwardTypes.ActionSpec({domain: domain, actionType: 0, value: actionValue, params: actionParams});
        ruleId = _armRule(msg.sender, plainText, eventSpec, actionSpec, limitsRef);
    }

    function _armRule(
        address wallet,
        string memory plainText,
        OnwardTypes.EventSpec memory eventSpec,
        OnwardTypes.ActionSpec memory actionSpec,
        uint256 limitsRef
    ) internal returns (uint256 ruleId) {
        require(actionSpec.value > 0, "ZERO_ACTION_VALUE");
        ruleId = nextRuleId++;
        OnwardTypes.Rule storage rule = rules[ruleId];
        rule.id = ruleId;
        rule.wallet = wallet;
        rule.plainText = plainText;
        rule.eventSpec = eventSpec;
        rule.actionSpec = actionSpec;
        rule.limitsRef = limitsRef;
        rule.active = true;
        rulesByWallet[wallet].push(ruleId);
        policyLimits.applyLimitRefFromEngine(wallet, ruleId, limitsRef);
        emit RuleArmed(ruleId, wallet, plainText);
    }

    function setRuleActive(uint256 ruleId, bool active) external {
        require(rules[ruleId].wallet == msg.sender, "ONLY_RULE_WALLET");
        rules[ruleId].active = active;
        emit RulePaused(ruleId, active);
    }

    function evaluate(uint256 ruleId) external payable returns (uint256 requestId) {
        requestId = _evaluate(ruleId);
    }

    function forceEvaluate(uint256 ruleId) external payable returns (uint256 requestId) {
        requestId = _evaluate(ruleId);
    }

    function simulateEvent(uint256 ruleId) external payable returns (uint256 requestId) {
        requestId = _evaluate(ruleId);
    }

    function getRule(uint256 ruleId) external view returns (OnwardTypes.Rule memory) {
        return rules[ruleId];
    }

    function getRulesByWallet(address wallet) external view returns (uint256[] memory) {
        return rulesByWallet[wallet];
    }

    function _evaluate(uint256 ruleId) internal returns (uint256 requestId) {
        OnwardTypes.Rule storage rule = rules[ruleId];
        require(rule.active, "RULE_INACTIVE");
        require(rule.wallet == msg.sender, "ONLY_RULE_WALLET");
        require(executor != address(0), "EXECUTOR_MISSING");
        requestId = IAgentExecutorEntry(executor).evaluate{value: msg.value}(ruleId);
        emit RuleEvaluationRequested(ruleId, requestId);
    }
}
