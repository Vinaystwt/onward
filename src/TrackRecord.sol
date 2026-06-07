// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";

contract TrackRecord is OwnableLite {
    struct Record {
        uint256 evaluations;
        uint256 settled;
        uint256 rolledBack;
        uint256 failed;
    }

    mapping(address => bool) public writers;
    mapping(uint256 => Record) public ruleRecords;
    Record private overall;

    event WriterSet(address indexed writer, bool allowed);
    event TrackUpdated(uint256 indexed ruleId, uint256 evaluations, uint256 settled, uint256 rolledBack);

    modifier onlyWriter() {
        require(writers[msg.sender], "ONLY_WRITER");
        _;
    }

    function setWriter(address writer, bool allowed) external onlyOwner {
        writers[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

    function recordEvaluation(uint256 ruleId) external onlyWriter {
        ruleRecords[ruleId].evaluations++;
        overall.evaluations++;
        _emit(ruleId);
    }

    function recordSettle(uint256 ruleId) external onlyWriter {
        ruleRecords[ruleId].settled++;
        overall.settled++;
        _emit(ruleId);
    }

    function recordRollback(uint256 ruleId) external onlyWriter {
        ruleRecords[ruleId].rolledBack++;
        overall.rolledBack++;
        _emit(ruleId);
    }

    function recordFailure(uint256 ruleId) external onlyWriter {
        ruleRecords[ruleId].failed++;
        overall.failed++;
        _emit(ruleId);
    }

    function totals()
        external
        view
        returns (uint256 evaluations, uint256 settled, uint256 rolledBack, uint256 failed)
    {
        return (overall.evaluations, overall.settled, overall.rolledBack, overall.failed);
    }

    function accuracyBps(uint256 ruleId) public view returns (uint256) {
        Record memory record = ruleRecords[ruleId];
        uint256 outcomes = record.settled + record.rolledBack;
        if (outcomes == 0) return 0;
        return (record.settled * 10_000) / outcomes;
    }

    function leaderboard(uint256[] calldata ruleIds)
        external
        view
        returns (uint256 bestRuleId, uint256 bestAccuracyBps)
    {
        for (uint256 i = 0; i < ruleIds.length; i++) {
            uint256 score = accuracyBps(ruleIds[i]);
            if (score > bestAccuracyBps) {
                bestAccuracyBps = score;
                bestRuleId = ruleIds[i];
            }
        }
    }

    function _emit(uint256 ruleId) internal {
        Record memory record = ruleRecords[ruleId];
        emit TrackUpdated(ruleId, record.evaluations, record.settled, record.rolledBack);
    }
}
