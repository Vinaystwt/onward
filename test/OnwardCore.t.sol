// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {OnwardTypes} from "../src/lib/OnwardTypes.sol";
import {AgentCodec} from "../src/lib/AgentCodec.sol";
import {AdapterRegistry} from "../src/AdapterRegistry.sol";
import {AgentExecutor} from "../src/AgentExecutor.sol";
import {Challenge} from "../src/Challenge.sol";
import {PolicyLimits} from "../src/PolicyLimits.sol";
import {ReceiptLog as ReceiptLogContract} from "../src/ReceiptLog.sol";
import {RuleEngine} from "../src/RuleEngine.sol";
import {TrackRecord} from "../src/TrackRecord.sol";
import {Vault} from "../src/Vault.sol";
import {PredictionMarketAdapter} from "../src/adapters/PredictionMarketAdapter.sol";
import {TradingAdapter} from "../src/adapters/TradingAdapter.sol";
import {LendingAdapter} from "../src/adapters/LendingAdapter.sol";
import {ConstantProductAMM} from "../src/venues/ConstantProductAMM.sol";
import {MiniLendingPool} from "../src/venues/MiniLendingPool.sol";
import {MinimalPredictionMarket} from "../src/venues/MinimalPredictionMarket.sol";
import {OnwardToken} from "../src/venues/OnwardToken.sol";
import {ResponseStatus} from "../src/interfaces/IAgentRequester.sol";
import {MockAgentPlatform} from "./mocks/MockAgentPlatform.sol";

contract OnwardCoreTest is Test {
    address internal user = address(0xA11CE);

    MockAgentPlatform internal platform;
    PolicyLimits internal policy;
    ReceiptLogContract internal receipts;
    TrackRecord internal track;
    Vault internal vault;
    RuleEngine internal rules;
    AgentExecutor internal executor;
    Challenge internal challenge;
    AdapterRegistry internal adapterRegistry;
    OnwardToken internal token;
    ConstantProductAMM internal amm;
    MinimalPredictionMarket internal market;
    MiniLendingPool internal lending;

    function setUp() public {
        platform = new MockAgentPlatform();
        policy = new PolicyLimits();
        receipts = new ReceiptLogContract();
        track = new TrackRecord();
        vault = new Vault(address(policy), address(receipts), address(track), 1 hours);
        adapterRegistry = new AdapterRegistry();
        rules = new RuleEngine(address(policy));
        executor = new AgentExecutor(address(platform), address(rules), address(adapterRegistry), address(vault));
        challenge = new Challenge(address(platform), address(rules), address(vault));

        policy.setVault(address(vault));
        policy.setRuleEngine(address(rules));
        policy.setTrackRecord(address(track));
        receipts.setWriter(address(vault), true);
        track.setWriter(address(vault), true);
        vault.setExecutor(address(executor));
        vault.setChallenge(address(challenge));
        rules.setExecutor(address(executor));

        token = new OnwardToken("Onward Demo USD", "ODUSD", 18);
        amm = new ConstantProductAMM(address(token));
        token.mint(address(this), 1_000_000 ether);
        token.approve(address(amm), 500_000 ether);
        amm.seed{value: 10 ether}(500_000 ether);

        market = new MinimalPredictionMarket();
        market.createMarket("Will BTC be above the demo threshold?");
        lending = new MiniLendingPool();

        adapterRegistry.setAdapter(OnwardTypes.DOMAIN_TRADING, address(new TradingAdapter(address(amm))));
        adapterRegistry.setAdapter(OnwardTypes.DOMAIN_PREDICTION, address(new PredictionMarketAdapter(address(market))));
        adapterRegistry.setAdapter(OnwardTypes.DOMAIN_LENDING, address(new LendingAdapter(address(lending))));

        vm.deal(user, 20 ether);
        vm.prank(user);
        vault.depositFor{value: 3 ether}(user);
    }

    function testCoreLoopCreatesPendingAndSettlesTradingAction() public {
        uint256 ruleId = _armTradingRule(OnwardTypes.Comparator.Gt, 10, 0.2 ether);
        uint256 requestId = _evaluate(ruleId);

        platform.fulfillUint(requestId, 20);

        OnwardTypes.PendingActionView memory action = vault.getPendingAction(1);
        assertEq(action.ruleId, ruleId);
        assertEq(uint256(action.status), uint256(OnwardTypes.ActionStatus.Pending));
        assertEq(vault.reserved(user), 0.2 ether);

        vm.warp(action.challengeDeadline + 1);
        vault.settle(1);

        assertEq(uint256(vault.getPendingAction(1).status), uint256(OnwardTypes.ActionStatus.Settled));
        assertGt(token.balanceOf(address(vault)), 0);
        assertEq(vault.reserved(user), 0);
    }

    function testChallengeAgreeSettlesBeforeWindow() public {
        uint256 ruleId = _armPredictionRule(OnwardTypes.Comparator.Gt, 10, 0.1 ether);
        uint256 requestId = _evaluate(ruleId);
        platform.fulfillUint(requestId, 20);

        uint256 challengeRequest = challenge.challenge{value: challenge.requiredDeposit(OnwardTypes.AgentKind.JsonUint)}(1);
        platform.fulfillUint(challengeRequest, 20);

        assertEq(uint256(vault.getPendingAction(1).status), uint256(OnwardTypes.ActionStatus.Settled));
        assertEq(market.yesShares(1, address(vault)), 0.1 ether);
    }

    function testChallengeRollbackOnDisagreement() public {
        uint256 ruleId = _armPredictionRule(OnwardTypes.Comparator.Gt, 1_000, 0.1 ether);
        executor.injectWrongNextRead(ruleId);
        uint256 requestId = _evaluate(ruleId);
        platform.fulfillUint(requestId, 20);

        assertEq(uint256(vault.getPendingAction(1).status), uint256(OnwardTypes.ActionStatus.Pending));
        uint256 challengeRequest = challenge.challenge{value: challenge.requiredDeposit(OnwardTypes.AgentKind.JsonUint)}(1);
        platform.fulfillUint(challengeRequest, 20);

        assertEq(uint256(vault.getPendingAction(1).status), uint256(OnwardTypes.ActionStatus.RolledBack));
        assertEq(market.yesShares(1, address(vault)), 0);
        assertEq(vault.reserved(user), 0);
    }

    function testLendingConnectorSuppliesRealPoolState() public {
        uint256 ruleId = _armLendingRule(OnwardTypes.Comparator.Gt, 1, 0.15 ether);
        uint256 requestId = _evaluate(ruleId);
        platform.fulfillUint(requestId, 2);

        OnwardTypes.PendingActionView memory action = vault.getPendingAction(1);
        vm.warp(action.challengeDeadline + 1);
        vault.settle(1);

        assertEq(lending.supplied(address(vault)), 0.15 ether);
        assertEq(lending.totalSupplied(), 0.15 ether);
    }

    function testNonSuccessCallbackDoesNotDecodeOrCreateAction() public {
        uint256 ruleId = _armTradingRule(OnwardTypes.Comparator.Gt, 10, 0.2 ether);
        uint256 requestId = _evaluate(ruleId);

        platform.fail(requestId, ResponseStatus.Failed);

        assertEq(vault.nextActionId(), 1);
        assertEq(vault.reserved(user), 0);
    }

    function _eventSpec(OnwardTypes.Comparator comparator, uint256 threshold)
        internal
        pure
        returns (OnwardTypes.EventSpec memory)
    {
        return OnwardTypes.EventSpec({
            kind: OnwardTypes.AgentKind.JsonUint,
            comparator: comparator,
            url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            selector: "bitcoin.usd",
            decimals: 8,
            threshold: threshold,
            expected: "",
            prompt: "",
            systemOrDescription: ""
        });
    }

    function _armTradingRule(OnwardTypes.Comparator comparator, uint256 threshold, uint256 value)
        internal
        returns (uint256)
    {
        return _armRule(_eventSpec(comparator, threshold), OnwardTypes.DOMAIN_TRADING, value, abi.encode(uint256(0)));
    }

    function _armPredictionRule(OnwardTypes.Comparator comparator, uint256 threshold, uint256 value)
        internal
        returns (uint256)
    {
        return _armRule(_eventSpec(comparator, threshold), OnwardTypes.DOMAIN_PREDICTION, value, abi.encode(uint256(1)));
    }

    function _armLendingRule(OnwardTypes.Comparator comparator, uint256 threshold, uint256 value)
        internal
        returns (uint256)
    {
        return _armRule(_eventSpec(comparator, threshold), OnwardTypes.DOMAIN_LENDING, value, "");
    }

    function _armRule(
        OnwardTypes.EventSpec memory eventSpec,
        bytes32 domain,
        uint256 value,
        bytes memory params
    ) internal returns (uint256 ruleId) {
        OnwardTypes.ActionSpec memory actionSpec =
            OnwardTypes.ActionSpec({domain: domain, actionType: 0, value: value, params: params});
        vm.prank(user);
        ruleId = rules.armRule("If the real data passes, execute the connector action", eventSpec, actionSpec, 1);
    }

    function _evaluate(uint256 ruleId) internal returns (uint256 requestId) {
        uint256 deposit = executor.requiredDeposit(OnwardTypes.AgentKind.JsonUint);
        vm.prank(user);
        requestId = rules.evaluate{value: deposit}(ruleId);
        assertEq(requestId, platform.lastRequestId());
    }
}
