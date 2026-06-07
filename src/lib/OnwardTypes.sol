// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library OnwardTypes {
    bytes32 internal constant DOMAIN_PREDICTION = keccak256("PREDICTION");
    bytes32 internal constant DOMAIN_TRADING = keccak256("TRADING");
    bytes32 internal constant DOMAIN_LENDING = keccak256("LENDING");

    enum AgentKind {
        JsonUint,
        InferString,
        ParseString,
        ParseNumber
    }

    enum Comparator {
        Gt,
        Gte,
        Lt,
        Lte,
        Eq,
        StringEq
    }

    enum ActionStatus {
        None,
        Pending,
        Settled,
        RolledBack,
        Failed
    }

    struct EventSpec {
        AgentKind kind;
        Comparator comparator;
        string url;
        string selector;
        uint8 decimals;
        uint256 threshold;
        string expected;
        string prompt;
        string systemOrDescription;
    }

    struct ActionSpec {
        bytes32 domain;
        uint8 actionType;
        uint256 value;
        bytes params;
    }

    struct Rule {
        uint256 id;
        address wallet;
        string plainText;
        EventSpec eventSpec;
        ActionSpec actionSpec;
        uint256 limitsRef;
        bool active;
    }

    struct PendingActionView {
        uint256 id;
        uint256 ruleId;
        address wallet;
        bytes32 domain;
        address target;
        uint256 value;
        bytes data;
        uint256 createdAt;
        uint256 challengeDeadline;
        ActionStatus status;
        bytes32 originalDecisionHash;
        bytes rawOutput;
    }
}
