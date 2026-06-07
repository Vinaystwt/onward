// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";
import {ITrackRecord} from "./interfaces/IOnward.sol";

contract PolicyLimits is OwnableLite {
    struct Limit {
        uint256 maxSpend;
        uint256 periodSeconds;
        uint256 maxSpendPerPeriod;
        bool enabled;
    }

    struct Usage {
        uint256 periodStart;
        uint256 spent;
    }

    mapping(uint256 => Limit) public templates;
    mapping(address => mapping(uint256 => Limit)) public limits;
    mapping(address => mapping(uint256 => Usage)) public usages;

    address public vault;
    address public ruleEngine;
    ITrackRecord public trackRecord;
    uint256 public baseTrustCeilingBps = 2_500;
    uint256 public maxTrustCeilingBps = 9_500;

    event TemplateSet(uint256 indexed templateId, uint256 maxSpend, uint256 periodSeconds, uint256 maxSpendPerPeriod);
    event LimitApplied(address indexed wallet, uint256 indexed ruleId, uint256 indexed templateId);
    event VaultSet(address indexed vault);
    event RuleEngineSet(address indexed ruleEngine);
    event TrackRecordSet(address indexed trackRecord);

    modifier onlyVault() {
        require(msg.sender == vault, "ONLY_VAULT");
        _;
    }

    constructor() {
        templates[1] = Limit(1 ether, 1 days, 1 ether, true);
        emit TemplateSet(1, 1 ether, 1 days, 1 ether);
    }

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setRuleEngine(address ruleEngine_) external onlyOwner {
        ruleEngine = ruleEngine_;
        emit RuleEngineSet(ruleEngine_);
    }

    function setTrackRecord(address trackRecord_) external onlyOwner {
        trackRecord = ITrackRecord(trackRecord_);
        emit TrackRecordSet(trackRecord_);
    }

    function setTemplate(
        uint256 templateId,
        uint256 maxSpend,
        uint256 periodSeconds,
        uint256 maxSpendPerPeriod
    ) external onlyOwner {
        require(templateId != 0, "BAD_TEMPLATE");
        templates[templateId] = Limit(maxSpend, periodSeconds, maxSpendPerPeriod, true);
        emit TemplateSet(templateId, maxSpend, periodSeconds, maxSpendPerPeriod);
    }

    function applyLimitRef(address wallet, uint256 ruleId, uint256 templateId) external onlyOwner {
        _applyLimitRef(wallet, ruleId, templateId);
    }

    function applyLimitRefFromEngine(address wallet, uint256 ruleId, uint256 templateId) external {
        require(msg.sender == ruleEngine, "ONLY_RULE_ENGINE");
        _applyLimitRef(wallet, ruleId, templateId);
    }

    function setLimit(address wallet, uint256 ruleId, Limit calldata limit) external onlyOwner {
        limits[wallet][ruleId] = limit;
    }

    function canSpend(address wallet, uint256 ruleId, uint256 amount, uint256 walletBalance)
        external
        view
        returns (bool ok, string memory reason)
    {
        Limit memory limit = limits[wallet][ruleId];
        if (!limit.enabled) return (false, "LIMIT_DISABLED");
        if (amount == 0 || amount > limit.maxSpend) return (false, "MAX_SPEND");
        uint256 trustCap = (walletBalance * trustCeilingBps()) / 10_000;
        if (amount > trustCap) return (false, "TRUST_CEILING");

        Usage memory usage = usages[wallet][ruleId];
        uint256 spent = usage.spent;
        if (block.timestamp >= usage.periodStart + limit.periodSeconds) {
            spent = 0;
        }
        if (spent + amount > limit.maxSpendPerPeriod) return (false, "RATE_LIMIT");
        return (true, "");
    }

    function consumeSpend(address wallet, uint256 ruleId, uint256 amount) external onlyVault {
        Limit memory limit = limits[wallet][ruleId];
        Usage storage usage = usages[wallet][ruleId];
        if (usage.periodStart == 0 || block.timestamp >= usage.periodStart + limit.periodSeconds) {
            usage.periodStart = block.timestamp;
            usage.spent = 0;
        }
        usage.spent += amount;
    }

    function trustCeilingBps() public view returns (uint256) {
        if (address(trackRecord) == address(0)) return baseTrustCeilingBps;
        (, uint256 settled, uint256 rolledBack,) = trackRecord.totals();
        uint256 uplift = settled * 500;
        uint256 penalty = rolledBack * 1_000;
        if (penalty >= uplift + baseTrustCeilingBps) return 1_000;
        uint256 value = baseTrustCeilingBps + uplift - penalty;
        return value > maxTrustCeilingBps ? maxTrustCeilingBps : value;
    }

    function _applyLimitRef(address wallet, uint256 ruleId, uint256 templateId) internal {
        Limit memory template = templates[templateId];
        require(template.enabled, "TEMPLATE_MISSING");
        limits[wallet][ruleId] = template;
        emit LimitApplied(wallet, ruleId, templateId);
    }
}
