// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "./OnwardTypes.sol";
import {IJsonApiAgent, ILLMAgent, IParseWebsiteAgent} from "../interfaces/IBaseAgents.sol";

library AgentCodec {
    uint256 internal constant JSON_API_AGENT_ID = 13_174_292_974_160_097_713;
    uint256 internal constant LLM_INFERENCE_AGENT_ID = 12_847_293_847_561_029_384;
    uint256 internal constant LLM_PARSE_WEBSITE_AGENT_ID = 12_875_401_142_070_969_085;

    uint256 internal constant SUBCOMMITTEE_SIZE = 3;
    uint256 internal constant JSON_PRICE_PER_AGENT = 0.03 ether;
    uint256 internal constant LLM_PRICE_PER_AGENT = 0.07 ether;
    uint256 internal constant PARSE_PRICE_PER_AGENT = 0.10 ether;

    function agentId(OnwardTypes.AgentKind kind) internal pure returns (uint256) {
        if (kind == OnwardTypes.AgentKind.JsonUint) return JSON_API_AGENT_ID;
        if (kind == OnwardTypes.AgentKind.InferString) return LLM_INFERENCE_AGENT_ID;
        return LLM_PARSE_WEBSITE_AGENT_ID;
    }

    function pricePerAgent(OnwardTypes.AgentKind kind) internal pure returns (uint256) {
        if (kind == OnwardTypes.AgentKind.JsonUint) return JSON_PRICE_PER_AGENT;
        if (kind == OnwardTypes.AgentKind.InferString) return LLM_PRICE_PER_AGENT;
        return PARSE_PRICE_PER_AGENT;
    }

    function payload(OnwardTypes.EventSpec memory spec) internal pure returns (bytes memory) {
        if (spec.kind == OnwardTypes.AgentKind.JsonUint) {
            return abi.encodeWithSelector(IJsonApiAgent.fetchUint.selector, spec.url, spec.selector, spec.decimals);
        }
        if (spec.kind == OnwardTypes.AgentKind.InferString) {
            string[] memory allowed = new string[](2);
            allowed[0] = spec.expected;
            allowed[1] = "no";
            return abi.encodeWithSelector(ILLMAgent.inferString.selector, spec.prompt, spec.systemOrDescription, false, allowed);
        }
        if (spec.kind == OnwardTypes.AgentKind.ParseNumber) {
            return abi.encodeWithSelector(
                IParseWebsiteAgent.ExtractANumber.selector,
                spec.selector,
                spec.systemOrDescription,
                uint256(0),
                uint256(0),
                spec.prompt,
                spec.url,
                true,
                uint8(3),
                uint8(70)
            );
        }
        string[] memory options = new string[](0);
        return abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            spec.selector,
            spec.systemOrDescription,
            options,
            spec.prompt,
            spec.url,
            true,
            uint8(3),
            uint8(70)
        );
    }

    function decide(OnwardTypes.EventSpec memory spec, bytes memory result)
        internal
        pure
        returns (bool decision, bytes32 decisionHash)
    {
        if (spec.kind == OnwardTypes.AgentKind.JsonUint || spec.kind == OnwardTypes.AgentKind.ParseNumber) {
            uint256 value = abi.decode(result, (uint256));
            decision = compareNumber(value, spec.comparator, spec.threshold);
            decisionHash = keccak256(abi.encode(spec.kind, value, decision));
            return (decision, decisionHash);
        }

        string memory valueString = abi.decode(result, (string));
        decision = keccak256(bytes(valueString)) == keccak256(bytes(spec.expected));
        decisionHash = keccak256(abi.encode(spec.kind, valueString, decision));
    }

    function compareNumber(uint256 value, OnwardTypes.Comparator comparator, uint256 threshold)
        internal
        pure
        returns (bool)
    {
        if (comparator == OnwardTypes.Comparator.Gt) return value > threshold;
        if (comparator == OnwardTypes.Comparator.Gte) return value >= threshold;
        if (comparator == OnwardTypes.Comparator.Lt) return value < threshold;
        if (comparator == OnwardTypes.Comparator.Lte) return value <= threshold;
        return value == threshold;
    }

    function source(OnwardTypes.EventSpec memory spec) internal pure returns (string memory) {
        return string.concat(spec.url, "#", spec.selector);
    }
}
