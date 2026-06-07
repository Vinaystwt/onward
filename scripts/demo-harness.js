import { ethers } from "ethers";
import {
  DOMAINS,
  build,
  contractAt,
  parseEvent,
  readDeployments,
  send,
  waitFor,
  withRetry,
  wallet,
  writeJson
} from "./lib.js";

const AgentKind = { JsonUint: 0 };
const Comparator = { Gt: 0 };
const ActionStatus = ["None", "Pending", "Settled", "RolledBack", "Failed"];

function eventSpec(threshold) {
  return [
    AgentKind.JsonUint,
    Comparator.Gt,
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "bitcoin.usd",
    8,
    threshold,
    "",
    "",
    ""
  ];
}

function actionSpec(domain, value, params = "0x") {
  return [domain, 0, value, params];
}

async function main() {
  build();
  const deployments = readDeployments();
  const signer = wallet();
  const user = await signer.getAddress();

  const vault = contractAt("Vault.sol", "Vault", deployments.contracts.Vault.address, signer);
  const rules = contractAt("RuleEngine.sol", "RuleEngine", deployments.contracts.RuleEngine.address, signer);
  const executor = contractAt("AgentExecutor.sol", "AgentExecutor", deployments.contracts.AgentExecutor.address, signer);
  const challenge = contractAt("Challenge.sol", "Challenge", deployments.contracts.Challenge.address, signer);
  const token = contractAt("OnwardToken.sol", "OnwardToken", deployments.contracts.OnwardToken.address, signer);
  const market = contractAt(
    "MinimalPredictionMarket.sol",
    "MinimalPredictionMarket",
    deployments.contracts.MinimalPredictionMarket.address,
    signer
  );
  const lending = contractAt("MiniLendingPool.sol", "MiniLendingPool", deployments.contracts.MiniLendingPool.address, signer);

  const balanceBefore = await withRetry(() => signer.provider.getBalance(user), "demo starting balance");
  await send("Vault.depositFor(demo)", vault.depositFor(user, { value: ethers.parseEther("5") }));

  async function arm(name, domain, threshold, actionValue, params = "0x") {
    const receipt = await send(
      `RuleEngine.armRule(${name})`,
      rules.armRule(
        `${name}: if the live BTC/USD JSON read passes, execute ${name}`,
        eventSpec(threshold),
        actionSpec(domain, actionValue, params),
        1
      )
    );
    const event = parseEvent(rules, receipt, "RuleArmed");
    return event.args.ruleId;
  }

  async function evaluateToPending(ruleId, label) {
    const nextActionId = await withRetry(() => vault.nextActionId(), `${label} next action id`);
    const deposit = await withRetry(() => executor.requiredDeposit(AgentKind.JsonUint), `${label} required deposit`);
    const receipt = await send(`${label}.evaluate`, rules.evaluate(ruleId, { value: deposit }));
    const event = parseEvent(rules, receipt, "RuleEvaluationRequested");
    const requestId = event.args.requestId;
    console.log(`${label} agent request ${requestId}`);
    await waitFor(async () => (await vault.nextActionId()) > nextActionId, `${label} pending action`);
    return nextActionId;
  }

  async function challengeAndWait(actionId, label) {
    const deposit = await withRetry(() => challenge.requiredDeposit(AgentKind.JsonUint), `${label} challenge deposit`);
    const receipt = await send(`${label}.challenge`, challenge.challenge(actionId, { value: deposit }));
    const event = parseEvent(challenge, receipt, "ChallengeOpened");
    const requestId = event.args.requestId;
    console.log(`${label} challenge request ${requestId}`);
    await waitFor(async () => !(await challenge.pendingRequests(requestId)), `${label} challenge callback`);
    const action = await withRetry(() => vault.getPendingAction(actionId), `${label} final action`);
    return ActionStatus[Number(action.status)];
  }

  const lowThreshold = 1n;
  const highThreshold = 100000000000000000000n;
  const smallAction = ethers.parseEther("0.05");

  const predictionRule = await arm(
    "prediction",
    DOMAINS.PREDICTION,
    lowThreshold,
    smallAction,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [deployments.demoMarketId || 1])
  );
  const predictionAction = await evaluateToPending(predictionRule, "prediction");
  const predictionStatus = await challengeAndWait(predictionAction, "prediction");

  const tradingRule = await arm(
    "trading",
    DOMAINS.TRADING,
    lowThreshold,
    smallAction,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [0])
  );
  const tradingAction = await evaluateToPending(tradingRule, "trading");
  const tradingStatus = await challengeAndWait(tradingAction, "trading");

  const lendingRule = await arm("lending", DOMAINS.LENDING, lowThreshold, smallAction, "0x");
  const lendingAction = await evaluateToPending(lendingRule, "lending");
  const lendingStatus = await challengeAndWait(lendingAction, "lending");

  const rollbackRule = await arm(
    "rollback",
    DOMAINS.PREDICTION,
    highThreshold,
    smallAction,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [deployments.demoMarketId || 1])
  );
  await send("AgentExecutor.injectWrongNextRead", executor.injectWrongNextRead(rollbackRule));
  const rollbackAction = await evaluateToPending(rollbackRule, "rollback");
  const rollbackStatus = await challengeAndWait(rollbackAction, "rollback");

  const balanceAfter = await withRetry(() => signer.provider.getBalance(user), "demo ending balance");
  const vaultAddress = await withRetry(() => vault.getAddress(), "vault address");
  const results = {
    generatedAt: new Date().toISOString(),
    user,
    actions: {
      prediction: { ruleId: predictionRule.toString(), actionId: predictionAction.toString(), finalStatus: predictionStatus },
      trading: { ruleId: tradingRule.toString(), actionId: tradingAction.toString(), finalStatus: tradingStatus },
      lending: { ruleId: lendingRule.toString(), actionId: lendingAction.toString(), finalStatus: lendingStatus },
      rollback: { ruleId: rollbackRule.toString(), actionId: rollbackAction.toString(), finalStatus: rollbackStatus }
    },
    venueState: {
      predictionYesSharesForVault: (
        await withRetry(() => market.yesShares(deployments.demoMarketId || 1, vaultAddress), "prediction venue state")
      ).toString(),
      tradingTokenBalanceForVault: (
        await withRetry(() => token.balanceOf(vaultAddress), "trading venue state")
      ).toString(),
      lendingSuppliedByVault: (
        await withRetry(() => lending.supplied(vaultAddress), "lending venue state")
      ).toString()
    },
    balanceBeforeStt: ethers.formatEther(balanceBefore),
    balanceAfterStt: ethers.formatEther(balanceAfter),
    sttConsumedIncludingVaultDeposit: ethers.formatEther(balanceBefore - balanceAfter)
  };

  writeJson("demo-results.json", results);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
