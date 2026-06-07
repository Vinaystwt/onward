import { ethers } from "ethers";
import {
  AGENT_PLATFORM_ADDRESS,
  DOMAINS,
  build,
  contractAt,
  parseEvent,
  readDeployments,
  send,
  sleep,
  waitFor,
  wallet,
  withRetry,
  writeJson
} from "./lib.js";

const AgentKind = { JsonUint: 0 };
const Comparator = { Gt: 0, Gte: 1, Lt: 2, Lte: 3, Eq: 4 };
const ActionStatus = ["None", "Pending", "Settled", "RolledBack", "Failed"];
const ResponseStatus = ["None", "Pending", "Success", "Failed", "TimedOut"];
const TIME_URL = "https://timeapi.io/api/time/current/zone?timeZone=UTC";
const TIME_SELECTOR = "seconds";
const abi = ethers.AbiCoder.defaultAbiCoder();
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

function actionSpec(domain, value, params = "0x") {
  return [domain, 0, value, params];
}

function pathFor(nativeTrading) {
  return ethers.solidityPacked(
    ["address", "address", "address"],
    [nativeTrading.wNative, nativeTrading.pathDeployer || ethers.ZeroAddress, nativeTrading.tokenOut]
  );
}

function topicForRequestId(requestId) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(requestId)), 32);
}

function compare(value, comparator, threshold) {
  if (comparator === Comparator.Gt) return value > threshold;
  if (comparator === Comparator.Gte) return value >= threshold;
  if (comparator === Comparator.Lt) return value < threshold;
  if (comparator === Comparator.Lte) return value <= threshold;
  return value === threshold;
}

function decodeUint(raw) {
  if (!raw || raw === "0x") return null;
  return abi.decode(["uint256"], raw)[0];
}

async function liveSeconds() {
  const response = await fetch(TIME_URL);
  if (!response.ok) throw new Error(`time API HTTP ${response.status}`);
  const json = await response.json();
  return Number(json.seconds);
}

async function waitForSecond(predicate, label, timeoutMs = 75_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const seconds = await liveSeconds();
    if (predicate(seconds)) return seconds;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for clock condition: ${label}`);
}

async function findLatestParsedEvent(provider, contract, eventName, indexedValue, fromBlock) {
  const fragment = contract.interface.getEvent(eventName);
  const logs = await provider.getLogs({
    address: await contract.getAddress(),
    fromBlock,
    toBlock: "latest",
    topics: [fragment.topicHash, topicForRequestId(indexedValue)]
  });
  if (logs.length === 0) return null;
  const log = logs[logs.length - 1];
  return { log, parsed: contract.interface.parseLog(log), receipt: await provider.getTransactionReceipt(log.transactionHash) };
}

async function findLatestActionEvent(provider, contract, eventName, actionId, fromBlock) {
  const fragment = contract.interface.getEvent(eventName);
  const logs = await provider.getLogs({
    address: await contract.getAddress(),
    fromBlock,
    toBlock: "latest",
    topics: [fragment.topicHash, topicForRequestId(actionId)]
  });
  if (logs.length === 0) return null;
  const log = logs[logs.length - 1];
  return { log, parsed: contract.interface.parseLog(log), receipt: await provider.getTransactionReceipt(log.transactionHash) };
}

async function decodeCallbackInput(provider, txHash) {
  const tx = await provider.getTransaction(txHash);
  if (!tx?.data || tx.data.length < 10 || tx.data.slice(0, 10) !== "0x5dae1f1c") {
    return null;
  }
  const [requestId, rawResult, callbackStatusRaw, receiptId, executionCost] = abi.decode(
    ["uint256", "bytes", "uint256", "uint256", "uint256"],
    `0x${tx.data.slice(10)}`
  );
  return {
    source: "callbackTxInput",
    txTo: tx.to,
    selector: tx.data.slice(0, 10),
    requestId: requestId.toString(),
    rawResult,
    uintResult: decodeUint(rawResult)?.toString() || null,
    callbackStatusRaw: callbackStatusRaw.toString(),
    receiptId: receiptId.toString(),
    executionCostWei: executionCost.toString()
  };
}

async function agentRequestDetails(platform, requestId, fallback) {
  try {
    const details = await platform.getRequest(requestId);
    const response = details.responses.length > 0 ? details.responses[0] : null;
    const rawResult = response ? response.result : "0x";
    return {
      source: "platform.getRequest",
      status: ResponseStatus[Number(details.status)] || String(details.status),
      responseStatus: response ? ResponseStatus[Number(response.status)] || String(response.status) : null,
      responseValidator: response ? response.validator : null,
      rawResult,
      uintResult: decodeUint(rawResult)?.toString() || null,
      remainingBudget: details.remainingBudget.toString(),
      perAgentBudget: details.perAgentBudget.toString(),
      responseCount: details.responseCount.toString(),
      failureCount: details.failureCount.toString(),
      createdAt: details.createdAt.toString(),
      deadline: details.deadline.toString()
    };
  } catch (error) {
    if (!fallback) throw error;
    return {
      ...fallback,
      status: fallback.status || "Success",
      responseStatus: fallback.responseStatus || (fallback.rawResult === "0x" ? null : "Success"),
      responseValidator: null,
      getRequestError: String(error.shortMessage || error.message || error)
    };
  }
}

async function waitExecutorCallback(provider, executor, platform, requestId, fromBlock) {
  await waitFor(() => executor.pendingRequests(requestId).then((pending) => !pending), `executor callback ${requestId}`);
  const completed = await findLatestParsedEvent(provider, executor, "EvaluationCompleted", requestId, fromBlock);
  const failed = await findLatestParsedEvent(provider, executor, "AgentRequestFailed", requestId, fromBlock);
  const event = completed || failed;
  if (!event) throw new Error(`No executor callback event found for request ${requestId}`);
  const eventStatus = event.parsed.name === "AgentRequestFailed" ? ResponseStatus[Number(event.parsed.args.status)] : "Success";
  const decodedCallback = await decodeCallbackInput(provider, event.log.transactionHash);
  const fallback = {
    ...(decodedCallback || {}),
    status: eventStatus,
    responseStatus: eventStatus
  };
  const details = await agentRequestDetails(platform, requestId, fallback);
  return {
    txHash: event.log.transactionHash,
    blockNumber: event.log.blockNumber,
    from: event.receipt.from,
    to: event.receipt.to,
    eventName: event.parsed.name,
    decision: event.parsed.name === "EvaluationCompleted" ? Boolean(event.parsed.args.decision) : null,
    decisionHash: event.parsed.name === "EvaluationCompleted" ? event.parsed.args.decisionHash : null,
    status: eventStatus,
    request: details
  };
}

async function waitChallengeCallback(provider, challenge, platform, requestId, actionId, fromBlock) {
  await waitFor(() => challenge.pendingRequests(requestId).then((pending) => !pending), `challenge callback ${requestId}`);
  const resolved = await findLatestActionEvent(provider, challenge, "ChallengeResolved", actionId, fromBlock);
  const failed = await findLatestActionEvent(provider, challenge, "ChallengeFailed", actionId, fromBlock);
  const event = resolved || failed;
  if (!event) throw new Error(`No challenge callback event found for request ${requestId}`);
  const eventStatus = event.parsed.name === "ChallengeFailed" ? ResponseStatus[Number(event.parsed.args.status)] : "Success";
  const decodedCallback = await decodeCallbackInput(provider, event.log.transactionHash);
  const fallback = {
    ...(decodedCallback || {}),
    status: eventStatus,
    responseStatus: eventStatus
  };
  const details = await agentRequestDetails(platform, requestId, fallback);
  return {
    txHash: event.log.transactionHash,
    blockNumber: event.log.blockNumber,
    from: event.receipt.from,
    to: event.receipt.to,
    eventName: event.parsed.name,
    agreed: event.parsed.name === "ChallengeResolved" ? Boolean(event.parsed.args.agreed) : null,
    rereadDecisionHash: event.parsed.name === "ChallengeResolved" ? event.parsed.args.rereadDecisionHash : null,
    status: eventStatus,
    request: details
  };
}

async function armLiveRule(rules, label, domain, value, params, comparator, threshold) {
  const receipt = await send(
    `${label}.armLiveThresholdRule`,
    rules.armLiveThresholdRule(
      `${label}: live UTC seconds ${comparator === Comparator.Lt ? "<" : ">"} ${threshold.toString()}`,
      domain,
      value,
      params,
      1,
      comparator,
      TIME_URL,
      TIME_SELECTOR,
      0,
      threshold
    )
  );
  const event = parseEvent(rules, receipt, "RuleArmed");
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, ruleId: event.args.ruleId };
}

async function evaluateRule({ provider, rules, executor, platform, vault, ruleId, label, method = "evaluate" }) {
  const beforeNextActionId = await vault.nextActionId();
  const deposit = await executor.requiredDeposit(AgentKind.JsonUint);
  const receipt = await send(`${label}.${method}`, rules[method](ruleId, { value: deposit }));
  const event = parseEvent(rules, receipt, "RuleEvaluationRequested");
  const requestId = event.args.requestId;
  const callback = await waitExecutorCallback(provider, executor, platform, requestId, receipt.blockNumber);
  const afterNextActionId = await vault.nextActionId();
  const actionId = afterNextActionId > beforeNextActionId ? beforeNextActionId : null;
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    method,
    requestId: requestId.toString(),
    depositWei: deposit.toString(),
    callback,
    actionId: actionId === null ? null : actionId.toString()
  };
}

async function challengeAction({ provider, challenge, platform, vault, actionId, label }) {
  const deposit = await challenge.requiredDeposit(AgentKind.JsonUint);
  const receipt = await send(`${label}.challenge`, challenge.challenge(actionId, { value: deposit }));
  const event = parseEvent(challenge, receipt, "ChallengeOpened");
  const requestId = event.args.requestId;
  const callback = await waitChallengeCallback(provider, challenge, platform, requestId, actionId, receipt.blockNumber);
  const action = await vault.getPendingAction(actionId);
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    requestId: requestId.toString(),
    depositWei: deposit.toString(),
    callback,
    finalStatus: ActionStatus[Number(action.status)]
  };
}

async function readVenueState({ provider, deployments, vaultAddress, tokenOut, wNative, predictionMarket, lendingPool }) {
  const blockNumber = await provider.getBlockNumber();
  return {
    blockNumber,
    vaultReservedWei: (await deployments.vault.reserved(deployments.user)).toString(),
    vaultBalanceWei: (await deployments.vault.balances(deployments.user)).toString(),
    predictionYesSharesForVaultWei: (await predictionMarket.yesShares(deployments.marketId, vaultAddress)).toString(),
    lendingSuppliedByVaultWei: (await lendingPool.supplied(vaultAddress)).toString(),
    nativeTrading: {
      vaultTokenOutBalance: (await tokenOut.balanceOf(vaultAddress)).toString(),
      poolWNativeBalance: (await wNative.balanceOf(deployments.nativeTrading.pool)).toString(),
      poolTokenOutBalance: (await tokenOut.balanceOf(deployments.nativeTrading.pool)).toString()
    }
  };
}

async function proveAgree(context) {
  const value = ethers.parseEther("0.02");
  const params = abi.encode(["uint256"], [context.marketId]);
  const arm = await armLiveRule(
    context.rules,
    "agree",
    DOMAINS.PREDICTION,
    value,
    params,
    Comparator.Lt,
    61n
  );
  const evaluation = await evaluateRule({ ...context, ruleId: arm.ruleId, label: "agree" });
  if (!evaluation.actionId || evaluation.callback.decision !== true) {
    throw new Error(`Agree path did not open a pending action: ${JSON.stringify(evaluation)}`);
  }
  const beforeSettlement = await context.state();
  const challenge = await challengeAction({ ...context, actionId: evaluation.actionId, label: "agree" });
  if (challenge.finalStatus !== "Settled" || challenge.callback.agreed !== true) {
    throw new Error(`Agree path did not settle: ${JSON.stringify(challenge)}`);
  }
  const afterSettlement = await context.state();
  return {
    arm,
    evaluation,
    firstReadValue: evaluation.callback.request.uintResult,
    firstDecision: evaluation.callback.decision,
    beforeSettlement,
    challenge,
    rereadValue: challenge.callback.request.uintResult,
    rereadDecision: compare(BigInt(challenge.callback.request.uintResult), Comparator.Lt, 61n),
    afterSettlement
  };
}

async function proveRollback(context) {
  const attempts = [];
  const value = ethers.parseEther("0.02");
  const params = abi.encode(["uint256"], [context.marketId]);
  for (let attempt = 1; attempt <= 10; attempt++) {
    const localSecond = await waitForSecond((seconds) => seconds <= 8, `rollback attempt ${attempt} first-read window`);
    const threshold = BigInt(localSecond + 15);
    const arm = await armLiveRule(
      context.rules,
      `rollback${attempt}`,
      DOMAINS.PREDICTION,
      value,
      params,
      Comparator.Lt,
      threshold
    );
    const evaluation = await evaluateRule({ ...context, ruleId: arm.ruleId, label: `rollback${attempt}` });
    const attemptRecord = {
      attempt,
      localSecondAtArm: localSecond,
      threshold: threshold.toString(),
      arm,
      evaluation,
      firstReadValue: evaluation.callback.request.uintResult,
      firstDecision: evaluation.callback.decision
    };
    if (!evaluation.actionId || evaluation.callback.decision !== true) {
      attempts.push({ ...attemptRecord, outcome: "first_read_false_no_pending_action" });
      continue;
    }

    await waitForSecond(
      (seconds) => seconds > Number(threshold) + 5 && seconds < 55,
      `rollback attempt ${attempt} reread false window`
    );
    const beforeChallenge = await context.state();
    const challenge = await challengeAction({ ...context, actionId: evaluation.actionId, label: `rollback${attempt}` });
    const afterChallenge = await context.state();
    const rereadDecision = compare(BigInt(challenge.callback.request.uintResult), Comparator.Lt, threshold);
    const fullAttempt = {
      ...attemptRecord,
      beforeChallenge,
      challenge,
      rereadValue: challenge.callback.request.uintResult,
      rereadDecision,
      afterChallenge,
      outcome: challenge.finalStatus
    };
    attempts.push(fullAttempt);
    if (challenge.finalStatus === "RolledBack" && challenge.callback.agreed === false && rereadDecision === false) {
      return { attempts, success: fullAttempt };
    }
  }
  throw new Error(`Could not capture a natural live-data rollback after ${attempts.length} attempts: ${JSON.stringify(attempts, null, 2)}`);
}

async function proveNativeTrading(context) {
  const value = ethers.parseEther("0.01");
  const swapPath = pathFor(context.nativeTrading);
  const params = abi.encode(["bytes", "uint256", "uint256"], [swapPath, 0n, 0n]);
  const arm = await armLiveRule(
    context.rules,
    "nativeTrading",
    DOMAINS.TRADING,
    value,
    params,
    Comparator.Lt,
    61n
  );
  const evaluation = await evaluateRule({ ...context, ruleId: arm.ruleId, label: "nativeTrading" });
  if (!evaluation.actionId || evaluation.callback.decision !== true) {
    throw new Error(`Native trading evaluation did not open a pending action: ${JSON.stringify(evaluation)}`);
  }
  const beforeSettlement = await context.state();
  const challenge = await challengeAction({ ...context, actionId: evaluation.actionId, label: "nativeTrading" });
  if (challenge.finalStatus !== "Settled") {
    throw new Error(`Native trading action did not settle: ${JSON.stringify(challenge)}`);
  }
  const afterSettlement = await context.state();
  return {
    arm,
    swapPath,
    evaluation,
    beforeSettlement,
    challenge,
    afterSettlement,
    deltas: {
      vaultTokenOutBalance:
        BigInt(afterSettlement.nativeTrading.vaultTokenOutBalance) -
        BigInt(beforeSettlement.nativeTrading.vaultTokenOutBalance),
      poolWNativeBalance:
        BigInt(afterSettlement.nativeTrading.poolWNativeBalance) -
        BigInt(beforeSettlement.nativeTrading.poolWNativeBalance),
      poolTokenOutBalance:
        BigInt(afterSettlement.nativeTrading.poolTokenOutBalance) -
        BigInt(beforeSettlement.nativeTrading.poolTokenOutBalance)
    }
  };
}

async function proveOnDemandTrigger(context) {
  const value = ethers.parseEther("0.01");
  const arm = await armLiveRule(context.rules, "forceEvaluate", DOMAINS.LENDING, value, "0x", Comparator.Lt, 61n);
  const beforeSettlement = await context.state();
  const evaluation = await evaluateRule({ ...context, ruleId: arm.ruleId, label: "forceEvaluate", method: "forceEvaluate" });
  if (!evaluation.actionId || evaluation.callback.eventName !== "EvaluationCompleted") {
    throw new Error(`forceEvaluate did not produce a real agent callback and pending action: ${JSON.stringify(evaluation)}`);
  }
  const afterPending = await context.state();
  const challenge = await challengeAction({ ...context, actionId: evaluation.actionId, label: "forceEvaluate" });
  const afterSettlement = await context.state();
  return { arm, beforeSettlement, evaluation, afterPending, challenge, afterSettlement };
}

async function proveNonSuccessGuard(context) {
  const nextActionBefore = await context.vault.nextActionId();
  const value = ethers.parseEther("0.01");
  const eventSpec = [
    AgentKind.JsonUint,
    Comparator.Gt,
    "https://httpbin.org/status/500",
    "anything",
    0,
    0,
    "",
    "",
    ""
  ];
  const receipt = await send(
    "nonSuccess.armRule",
    context.rules.armRule("non-success guard: failing JSON endpoint creates no action", eventSpec, actionSpec(DOMAINS.LENDING, value), 1)
  );
  const ruleId = parseEvent(context.rules, receipt, "RuleArmed").args.ruleId;
  const evaluation = await evaluateRule({ ...context, ruleId, label: "nonSuccess" });
  const nextActionAfter = await context.vault.nextActionId();
  const guarded =
    evaluation.callback.eventName === "AgentRequestFailed" && nextActionAfter === nextActionBefore;
  return {
    arm: { txHash: receipt.hash, blockNumber: receipt.blockNumber, ruleId: ruleId.toString() },
    evaluation,
    nextActionBefore: nextActionBefore.toString(),
    nextActionAfter: nextActionAfter.toString(),
    createdNoAction: nextActionAfter === nextActionBefore,
    nonSuccessGuardProven: guarded
  };
}

async function cleanupPendingActions(context) {
  const cleaned = [];
  const before = await context.state();
  const nextActionId = await context.vault.nextActionId();
  for (let actionId = 1n; actionId < nextActionId; actionId++) {
    const action = await context.vault.getPendingAction(actionId);
    if (ActionStatus[Number(action.status)] !== "Pending") continue;
    const challenge = await challengeAction({ ...context, actionId: actionId.toString(), label: `cleanup${actionId}` });
    cleaned.push({ actionId: actionId.toString(), challenge });
  }
  const after = await context.state();
  return { before, cleaned, after };
}

async function main() {
  build();
  const rawDeployments = readDeployments("deployments-v2.json");
  const signer = wallet();
  const provider = signer.provider;
  const user = await signer.getAddress();
  const startingBalance = await provider.getBalance(user);

  const vault = contractAt("Vault.sol", "Vault", rawDeployments.contracts.Vault.address, signer);
  const rules = contractAt("RuleEngine.sol", "RuleEngine", rawDeployments.contracts.RuleEngine.address, signer);
  const executor = contractAt("AgentExecutor.sol", "AgentExecutor", rawDeployments.contracts.AgentExecutor.address, signer);
  const challenge = contractAt("Challenge.sol", "Challenge", rawDeployments.contracts.Challenge.address, signer);
  const platform = contractAt("IAgentRequester.sol", "IAgentRequester", AGENT_PLATFORM_ADDRESS, provider);
  const predictionMarket = contractAt(
    "MinimalPredictionMarket.sol",
    "MinimalPredictionMarket",
    rawDeployments.contracts.MinimalPredictionMarket.address,
    provider
  );
  const lendingPool = contractAt("MiniLendingPool.sol", "MiniLendingPool", rawDeployments.contracts.MiniLendingPool.address, provider);
  const tokenOut = new ethers.Contract(rawDeployments.nativeTrading.tokenOut, erc20Abi, provider);
  const wNative = new ethers.Contract(rawDeployments.nativeTrading.wNative, erc20Abi, provider);
  const vaultAddress = await vault.getAddress();
  const marketId = BigInt(rawDeployments.demoMarketId || 1);

  const txHashes = {};
  const depositReceipt = await send("Vault.depositFor(v2 demo)", vault.depositFor(user, { value: ethers.parseEther("4") }));
  txHashes.deposit = depositReceipt.hash;

  const context = {
    provider,
    user,
    vault,
    rules,
    executor,
    challenge,
    platform,
    marketId,
    nativeTrading: rawDeployments.nativeTrading,
    state: () =>
      readVenueState({
        provider,
        deployments: { vault, user, marketId, nativeTrading: rawDeployments.nativeTrading },
        vaultAddress,
        tokenOut,
        wNative,
        predictionMarket,
        lendingPool
      })
  };

  const cleanup = await cleanupPendingActions(context);
  const initialState = await context.state();
  const rollback = await proveRollback(context);
  const agree = await proveAgree(context);
  const nativeTrading = await proveNativeTrading(context);
  const onDemandTrigger = await proveOnDemandTrigger(context);
  const nonSuccessGuard = await proveNonSuccessGuard(context);
  const finalState = await context.state();
  const endingBalance = await provider.getBalance(user);

  const results = {
    generatedAt: new Date().toISOString(),
    user,
    startingBalanceStt: ethers.formatEther(startingBalance),
    endingBalanceStt: ethers.formatEther(endingBalance),
    sttSpentByWallet: ethers.formatEther(startingBalance - endingBalance),
    depositTxHash: depositReceipt.hash,
    depositBlockNumber: depositReceipt.blockNumber,
    cleanup,
    initialState,
    rollback,
    agree,
    nativeTrading: {
      ...nativeTrading,
      deltas: {
        vaultTokenOutBalance: nativeTrading.deltas.vaultTokenOutBalance.toString(),
        poolWNativeBalance: nativeTrading.deltas.poolWNativeBalance.toString(),
        poolTokenOutBalance: nativeTrading.deltas.poolTokenOutBalance.toString()
      }
    },
    onDemandTrigger,
    nonSuccessGuard,
    finalState,
    txHashes
  };

  writeJson("gap-demo-v2-results.json", results);
  console.log(JSON.stringify(results, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
