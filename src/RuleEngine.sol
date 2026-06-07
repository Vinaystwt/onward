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
        require(actionSpec.value > 0, "ZERO_ACTION_VALUE");
        ruleId = nextRuleId++;
        OnwardTypes.Rule storage rule = rules[ruleId];
        rule.id = ruleId;
        rule.wallet = msg.sender;
        rule.plainText = plainText;
        rule.eventSpec = eventSpec;
        rule.actionSpec = actionSpec;
        rule.limitsRef = limitsRef;
        rule.active = true;
        rulesByWallet[msg.sender].push(ruleId);
        policyLimits.applyLimitRefFromEngine(msg.sender, ruleId, limitsRef);
        emit RuleArmed(ruleId, msg.sender, plainText);
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
