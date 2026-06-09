import { ethers } from "ethers";
import {
  AGENT_PLATFORM_ADDRESS,
  DOMAINS,
  build,
  contractAt,
  parseEvent,
  readDeployments,
  readJson,
  send,
  sleep,
  waitFor,
  wallet,
  writeJson
} from "./lib.js";

const EXPLORER = "https://shannon-explorer.somnia.network";
const SIGNAL_INITIAL = ethers.parseEther("0.001");
const SIGNAL_TOP_UP = ethers.parseEther("0.002");
const SIGNAL_THRESHOLD = ethers.parseEther("0.002");
const AgentKind = { JsonUint: 0, InferString: 1, ParseString: 2, ParseNumber: 3 };
const Comparator = { Gt: 0, Gte: 1, Lt: 2, Lte: 3, Eq: 4, StringEq: 5 };
const ActionStatus = ["None", "Pending", "Settled", "RolledBack", "Failed"];
const ResponseStatus = ["None", "Pending", "Success", "Failed", "TimedOut"];
const abi = ethers.AbiCoder.defaultAbiCoder();

function txLink(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

function signalUrl(address) {
  return `${EXPLORER}/api/v2/addresses/${address}`;
}

function topicFor(value) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
}

function decodeRaw(kind, raw) {
  if (!raw || raw === "0x") return { raw, type: "empty", value: null };
  if (kind === AgentKind.JsonUint || kind === AgentKind.ParseNumber) {
    return { raw, type: "uint256", value: abi.decode(["uint256"], raw)[0].toString() };
  }
  return { raw, type: "string", value: abi.decode(["string"], raw)[0] };
}

function decisionFor(kind, value, comparator, threshold, expected) {
  if (kind === AgentKind.JsonUint || kind === AgentKind.ParseNumber) {
    const actual = BigInt(value);
    const target = BigInt(threshold);
    if (comparator === Comparator.Gt) return actual > target;
    if (comparator === Comparator.Gte) return actual >= target;
    if (comparator === Comparator.Lt) return actual < target;
    if (comparator === Comparator.Lte) return actual <= target;
    return actual === target;
  }
  return value === expected;
}

async function addressBalanceFromExplorer(address) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(signalUrl(address), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Shannon address API ${response.status}`);
  const json = await response.json();
  if (json.coin_balance === null || json.coin_balance === undefined) return null;
  return BigInt(json.coin_balance);
}

async function waitExplorerBalance(address, predicate, label, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const balance = await addressBalanceFromExplorer(address);
      if (balance !== null && predicate(balance)) return balance;
      lastError = balance === null ? new Error("Shannon address API returned no coin_balance") : null;
    } catch (error) {
      lastError = error;
    }
    await sleep(7000);
  }
  const detail = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for Shannon balance: ${label}.${detail}`);
}

async function txSummary(provider, hash, note = "") {
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) throw new Error(`Missing tx receipt ${hash}`);
  const tx = await provider.getTransaction(hash);
  return {
    note,
    txHash: hash,
    explorerUrl: txLink(hash),
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    from: receipt.from,
    to: receipt.to,
    valueWei: tx?.value?.toString() || "0"
  };
}

async function findEvent(provider, contract, eventName, indexedValue, fromBlock) {
  const fragment = contract.interface.getEvent(eventName);
  const logs = await provider.getLogs({
    address: await contract.getAddress(),
    fromBlock,
    toBlock: "latest",
    topics: [fragment.topicHash, topicFor(indexedValue)]
  });
  if (logs.length === 0) return null;
  const log = logs[logs.length - 1];
  return { log, parsed: contract.interface.parseLog(log), receipt: await provider.getTransactionReceipt(log.transactionHash) };
}

async function decodeCallbackInput(provider, txHash, kind) {
  const tx = await provider.getTransaction(txHash);
  if (!tx?.data || tx.data.slice(0, 10) !== "0x5dae1f1c") {
    return { raw: "0x", type: "unknown", value: null };
  }
  const [requestId, rawResult, callbackStatusRaw, receiptId, executionCost] = abi.decode(
    ["uint256", "bytes", "uint256", "uint256", "uint256"],
    `0x${tx.data.slice(10)}`
  );
  return {
    requestId: requestId.toString(),
    callbackStatusRaw: callbackStatusRaw.toString(),
    receiptId: receiptId.toString(),
    executionCostWei: executionCost.toString(),
    ...decodeRaw(kind, rawResult)
  };
}

async function waitEvaluation({ provider, executor, requestId, kind, fromBlock }) {
  await waitFor(() => executor.pendingRequests(requestId).then((pending) => !pending), `evaluation callback ${requestId}`);
  const completed = await findEvent(provider, executor, "EvaluationCompleted", requestId, fromBlock);
  const failed = await findEvent(provider, executor, "AgentRequestFailed", requestId, fromBlock);
  const event = completed || failed;
  if (!event) throw new Error(`No evaluation callback event for request ${requestId}`);
  const callback = await decodeCallbackInput(provider, event.log.transactionHash, kind);
  return {
    tx: await txSummary(provider, event.log.transactionHash, event.parsed.name),
    eventName: event.parsed.name,
    requestId: requestId.toString(),
    decision: event.parsed.name === "EvaluationCompleted" ? Boolean(event.parsed.args.decision) : null,
    decisionHash: event.parsed.name === "EvaluationCompleted" ? event.parsed.args.decisionHash : null,
    status: event.parsed.name === "AgentRequestFailed" ? ResponseStatus[Number(event.parsed.args.status)] : "Success",
    callback
  };
}

async function waitChallenge({ provider, challenge, requestId, actionId, kind, fromBlock }) {
  await waitFor(() => challenge.pendingRequests(requestId).then((pending) => !pending), `challenge callback ${requestId}`);
  const resolved = await findEvent(provider, challenge, "ChallengeResolved", actionId, fromBlock);
  const failed = await findEvent(provider, challenge, "ChallengeFailed", actionId, fromBlock);
  const read = await findEvent(provider, challenge, "ChallengeRead", actionId, fromBlock);
  const event = resolved || failed;
  if (!event) throw new Error(`No challenge callback event for request ${requestId}`);
  const callback = await decodeCallbackInput(provider, event.log.transactionHash, kind);
  return {
    tx: await txSummary(provider, event.log.transactionHash, event.parsed.name),
    eventName: event.parsed.name,
    requestId: requestId.toString(),
    agreed: event.parsed.name === "ChallengeResolved" ? Boolean(event.parsed.args.agreed) : null,
    rereadDecisionHash: event.parsed.name === "ChallengeResolved" ? event.parsed.args.rereadDecisionHash : null,
    status: event.parsed.name === "ChallengeFailed" ? ResponseStatus[Number(event.parsed.args.status)] : "Success",
    challengeReadEvent: read
      ? {
          txHash: read.log.transactionHash,
          source: read.parsed.args.source,
          rawOutput: read.parsed.args.rawOutput,
          decision: Boolean(read.parsed.args.decision),
          decisionHash: read.parsed.args.decisionHash,
          agreed: Boolean(read.parsed.args.agreed)
        }
      : null,
    callback
  };
}

function eventSpec(kind, comparator, url, selector, threshold, expected = "", prompt = "", description = "") {
  return [kind, comparator, url, selector, 0, threshold, expected, prompt, description];
}

function actionSpec(domain, value, params = "0x") {
  return [domain, 0, value, params];
}

async function armRule({ rules, label, plainText, eventSpec_, actionSpec_ }) {
  const receipt = await send(`${label}.armRule`, rules.armRule(plainText, eventSpec_, actionSpec_, 1));
  const event = parseEvent(rules, receipt, "RuleArmed");
  return { ruleId: event.args.ruleId, tx: receipt };
}

async function evaluateRule({ provider, rules, executor, vault, ruleId, kind, label }) {
  const nextActionBefore = await vault.nextActionId();
  const deposit = await executor.requiredDeposit(kind);
  const receipt = await send(`${label}.evaluate`, rules.evaluate(ruleId, { value: deposit }));
  const event = parseEvent(rules, receipt, "RuleEvaluationRequested");
  const requestId = event.args.requestId;
  const callback = await waitEvaluation({ provider, executor, requestId, kind, fromBlock: receipt.blockNumber });
  const nextActionAfter = await vault.nextActionId();
  return {
    tx: receipt,
    requestId,
    callback,
    actionId: nextActionAfter > nextActionBefore ? nextActionBefore : null
  };
}

async function challengeAction({ provider, challenge, vault, actionId, kind, label }) {
  const deposit = await challenge.requiredDeposit(kind);
  const receipt = await send(`${label}.challenge`, challenge.challenge(actionId, { value: deposit }));
  const event = parseEvent(challenge, receipt, "ChallengeOpened");
  const requestId = event.args.requestId;
  const callback = await waitChallenge({ provider, challenge, requestId, actionId, kind, fromBlock: receipt.blockNumber });
  const action = await vault.getPendingAction(actionId);
  return { tx: receipt, requestId, callback, finalAction: action };
}

async function finalReceipt(receiptLog, actionId) {
  const receipt = await receiptLog.getReceipt(actionId);
  return {
    actionId: receipt.actionId.toString(),
    ruleId: receipt.ruleId.toString(),
    wallet: receipt.wallet,
    source: receipt.source,
    rawOutput: receipt.rawOutput,
    decision: Boolean(receipt.decision),
    target: receipt.target,
    valueWei: receipt.value.toString(),
    data: receipt.data,
    status: ActionStatus[Number(receipt.status)],
    createdAt: receipt.createdAt.toString(),
    updatedAt: receipt.updatedAt.toString()
  };
}

async function buildSignalSequence(context, mode) {
  const { signer, provider, vault, rules, executor, challenge, receiptLog, marketId } = context;
  const signal = ethers.Wallet.createRandom();
  const initialFund = await send(`${mode}.fundSignalInitial`, signer.sendTransaction({ to: signal.address, value: SIGNAL_INITIAL }));
  await waitExplorerBalance(signal.address, (balance) => balance === SIGNAL_INITIAL, `${mode} initial signal balance`);

  const source = signalUrl(signal.address);
  const rollbackText = `If the Shannon-reported signal balance for ${signal.address} is below 0.002 STT, buy YES; challenge after funding the signal above the threshold.`;
  const settleText = `If the Shannon-reported signal balance for ${signal.address} is below 0.002 STT, buy YES; challenge without changing the signal.`;
  const ruleText = mode === "rollback" ? rollbackText : settleText;
  const eventSpec_ = eventSpec(AgentKind.JsonUint, Comparator.Lt, source, "coin_balance", SIGNAL_THRESHOLD);
  const actionValue = ethers.parseEther("0.01");
  const actionSpec_ = actionSpec(DOMAINS.PREDICTION, actionValue, abi.encode(["uint256"], [marketId]));
  const armed = await armRule({ rules, label: mode, plainText: ruleText, eventSpec_, actionSpec_ });
  const evaluation = await evaluateRule({ provider, rules, executor, vault, ruleId: armed.ruleId, kind: AgentKind.JsonUint, label: mode });
  if (!evaluation.actionId || evaluation.callback.decision !== true) {
    throw new Error(`${mode} did not open a pending action with a true first read`);
  }

  let stateChange = null;
  if (mode === "rollback") {
    const receipt = await send("rollback.fundSignalForDisagreement", signer.sendTransaction({ to: signal.address, value: SIGNAL_TOP_UP }));
    const balance = await waitExplorerBalance(signal.address, (value) => value >= SIGNAL_INITIAL + SIGNAL_TOP_UP, "rollback changed signal balance");
    stateChange = { tx: receipt, signalBalanceAfterWei: balance.toString() };
  }

  const beforeChallenge = {
    reservedWei: (await vault.reserved(await signer.getAddress())).toString(),
    signalBalanceWei: (await addressBalanceFromExplorer(signal.address)).toString()
  };
  const challenged = await challengeAction({
    provider,
    challenge,
    vault,
    actionId: evaluation.actionId,
    kind: AgentKind.JsonUint,
    label: mode
  });
  const afterChallenge = {
    reservedWei: (await vault.reserved(await signer.getAddress())).toString(),
    signalBalanceWei: (await addressBalanceFromExplorer(signal.address)).toString()
  };

  const firstValue = evaluation.callback.callback.value;
  const rereadValue = challenged.callback.callback.value;
  const expectedStatus = mode === "rollback" ? "RolledBack" : "Settled";
  const finalStatus = ActionStatus[Number(challenged.finalAction.status)];
  if (finalStatus !== expectedStatus) {
    throw new Error(`${mode} expected ${expectedStatus}, got ${finalStatus}`);
  }

  const sequence = [
    await txSummary(provider, initialFund.hash, "owner funds fresh signal address with 1 wei"),
    await txSummary(provider, armed.tx.hash, "arm rule"),
    await txSummary(provider, evaluation.tx.hash, "evaluate and create first agent request"),
    evaluation.callback.tx
  ];
  if (stateChange) {
    sequence.push(await txSummary(provider, stateChange.tx.hash, "owner causes real on-chain signal balance change"));
  }
  sequence.push(await txSummary(provider, challenged.tx.hash, "challenge pending action"));
  sequence.push(challenged.callback.tx);

  return {
    ruleText,
    condition: `${source}#coin_balance < ${SIGNAL_THRESHOLD.toString()} wei`,
    signalAddress: signal.address,
    firstRead: {
      requestId: evaluation.requestId.toString(),
      valueWei: firstValue,
      decision: evaluation.callback.decision,
      callbackTx: evaluation.callback.tx.txHash
    },
    stateChange: stateChange
      ? {
          txHash: stateChange.tx.hash,
          explorerUrl: txLink(stateChange.tx.hash),
          blockNumber: stateChange.tx.blockNumber,
          signalBalanceAfterWei: stateChange.signalBalanceAfterWei
        }
      : null,
    reread: {
      requestId: challenged.requestId.toString(),
      valueWei: rereadValue,
      decision: decisionFor(AgentKind.JsonUint, rereadValue, Comparator.Lt, SIGNAL_THRESHOLD, ""),
      agreed: challenged.callback.agreed,
      callbackTx: challenged.callback.tx.txHash
    },
    finalOutcome: {
      actionId: evaluation.actionId.toString(),
      status: finalStatus,
      outcomeTxHash: challenged.callback.tx.txHash,
      explorerUrl: challenged.callback.tx.explorerUrl
    },
    beforeChallenge,
    afterChallenge,
    finalReceipt: await finalReceipt(receiptLog, evaluation.actionId),
    sequence,
    summary:
      mode === "rollback"
        ? `First read saw ${firstValue} wei (<${SIGNAL_THRESHOLD.toString()}) and opened action; owner funded signal to ${afterChallenge.signalBalanceWei} wei; challenge reread disagreed and rolled back.`
        : `First read saw ${firstValue} wei (<${SIGNAL_THRESHOLD.toString()}); no state change occurred; challenge reread ${rereadValue} wei agreed and settled.`
  };
}

async function buildInterpretiveSequence(context) {
  const { provider, vault, rules, executor, challenge, receiptLog } = context;
  const sourceText =
    "Onward operator bulletin: Somnia Exchange venue is open, demo liquidity is normal, and no emergency pause is active.";
  const prompt = [
    "Classify this operational status source for an autonomous wallet.",
    `Source text: ${sourceText}`,
    "Return SAFE_TO_EXECUTE only if the text says the venue is open/normal and no emergency pause is active.",
    "Return no otherwise."
  ].join("\n");
  const plainText =
    "Interpretive demo: classify an unstructured Onward operations bulletin as SAFE_TO_EXECUTE before supplying lending liquidity.";
  const eventSpec_ = eventSpec(
    AgentKind.InferString,
    Comparator.StringEq,
    "controlled:onward-operator-bulletin",
    "classification",
    0,
    "SAFE_TO_EXECUTE",
    prompt,
    "You are a deterministic safety classifier. Return only one allowed value."
  );
  const actionValue = ethers.parseEther("0.01");
  const actionSpec_ = actionSpec(DOMAINS.LENDING, actionValue, "0x");
  const armed = await armRule({ rules, label: "interpretive", plainText, eventSpec_, actionSpec_ });
  const evaluation = await evaluateRule({
    provider,
    rules,
    executor,
    vault,
    ruleId: armed.ruleId,
    kind: AgentKind.InferString,
    label: "interpretive"
  });
  if (!evaluation.actionId || evaluation.callback.decision !== true) {
    throw new Error("interpretive rule did not open a pending action");
  }
  const challenged = await challengeAction({
    provider,
    challenge,
    vault,
    actionId: evaluation.actionId,
    kind: AgentKind.InferString,
    label: "interpretive"
  });
  const finalStatus = ActionStatus[Number(challenged.finalAction.status)];
  if (finalStatus !== "Settled") throw new Error(`interpretive final status ${finalStatus}`);

  return {
    ruleText: plainText,
    condition: "inferString classifies controlled unstructured operations bulletin as SAFE_TO_EXECUTE/no",
    sourceText,
    firstRead: {
      requestId: evaluation.requestId.toString(),
      value: evaluation.callback.callback.value,
      decision: evaluation.callback.decision,
      callbackTx: evaluation.callback.tx.txHash
    },
    reread: {
      requestId: challenged.requestId.toString(),
      value: challenged.callback.callback.value,
      decision: challenged.callback.callback.value === "SAFE_TO_EXECUTE",
      agreed: challenged.callback.agreed,
      callbackTx: challenged.callback.tx.txHash
    },
    finalOutcome: {
      actionId: evaluation.actionId.toString(),
      status: finalStatus,
      outcomeTxHash: challenged.callback.tx.txHash,
      explorerUrl: challenged.callback.tx.explorerUrl
    },
    finalReceipt: await finalReceipt(receiptLog, evaluation.actionId),
    sequence: [
      await txSummary(provider, armed.tx.hash, "arm interpretive rule"),
      await txSummary(provider, evaluation.tx.hash, "evaluate inferString rule"),
      evaluation.callback.tx,
      await txSummary(provider, challenged.tx.hash, "challenge interpretive pending action"),
      challenged.callback.tx
    ],
    summary: `inferString classified the bulletin as ${evaluation.callback.callback.value}; challenge reread agreed and settled.`
  };
}

function provenanceMapping(deployments) {
  return {
    USER_DEFINED: [
      `RuleEngine.getRule(ruleId) on ${deployments.contracts.RuleEngine.address}: plainText, eventSpec, actionSpec, limitsRef`,
      `PolicyLimits.limits(wallet, ruleId) on ${deployments.contracts.PolicyLimits.address}: maxSpend, periodSeconds, maxSpendPerPeriod`
    ],
    ORACLE_SOURCE: [
      `ReceiptLog.getReceipt(actionId) on ${deployments.contracts.ReceiptLog.address}: source and rawOutput`,
      "ReceiptLog.Receipt(actionId, ruleId, wallet, decision, Pending)"
    ],
    AGENT_INFERRED: [
      "AgentExecutor.EvaluationCompleted(requestId, ruleId, decision, decisionHash)",
      "Vault.getPendingAction(actionId): rawOutput and originalDecisionHash",
      "ReceiptLog.getReceipt(actionId): decision, rawOutput, target, value, data"
    ],
    ON_CHAIN_ENFORCED: [
      "Vault.SpendLimitEnforced(actionId, ruleId, wallet, value)",
      "Vault.PendingActionOpened(actionId, ruleId, wallet, target, value)",
      "PolicyLimits.usages(wallet, ruleId) and limits(wallet, ruleId)"
    ],
    CONSENSUS_VERIFIED: [
      "Challenge.ChallengeRead(actionId, requestId, source, rawOutput, decision, decisionHash, agreed)",
      "Challenge.ChallengeResolved(actionId, agreed, rereadDecisionHash)",
      "Vault.ActionRolledBack(actionId) or Vault.ActionSettled(actionId, target, value)",
      "ReceiptLog.getReceipt(actionId).status"
    ]
  };
}

async function main() {
  build();
  const mode = process.argv[2] || "all";
  const deployments = readDeployments("deployments-v3.json");
  const signer = wallet();
  const provider = signer.provider;
  const walletAddress = await signer.getAddress();
  const balanceBefore = await provider.getBalance(walletAddress);

  const vault = contractAt("Vault.sol", "Vault", deployments.contracts.Vault.address, signer);
  const rules = contractAt("RuleEngine.sol", "RuleEngine", deployments.contracts.RuleEngine.address, signer);
  const executor = contractAt("AgentExecutor.sol", "AgentExecutor", deployments.contracts.AgentExecutor.address, signer);
  const challenge = contractAt("Challenge.sol", "Challenge", deployments.contracts.Challenge.address, signer);
  const receiptLog = contractAt("ReceiptLog.sol", "ReceiptLog", deployments.contracts.ReceiptLog.address, provider);
  const marketId = BigInt(deployments.demoMarketId || 1);

  const deposit = await send("proof.depositFor", vault.depositFor(walletAddress, { value: ethers.parseEther("1") }));
  const context = { signer, provider, vault, rules, executor, challenge, receiptLog, marketId };

  const prior = (() => {
    try {
      return readJson("rollback-proof.json");
    } catch {
      return {};
    }
  })();

  const report = {
    ...prior,
    generatedAt: new Date().toISOString(),
    chain: { name: "Somnia Testnet", chainId: 50312, rpc: "https://dream-rpc.somnia.network", explorer: EXPLORER },
    wallet: walletAddress,
    deploymentsFile: "deployments-v3.json",
    deposit: await txSummary(provider, deposit.hash, "deposit proof funds into Vault"),
    provenanceMapping: provenanceMapping(deployments)
  };

  if (mode === "rollback" || mode === "all") {
    report.rollback = await buildSignalSequence(context, "rollback");
  }
  if (mode === "settle" || mode === "all") {
    report.settle = await buildSignalSequence(context, "settle");
  }
  if (mode === "interpretive" || mode === "all") {
    report.interpretive = await buildInterpretiveSequence(context);
  }

  const balanceAfter = await provider.getBalance(walletAddress);
  report.balance = {
    beforeStt: ethers.formatEther(balanceBefore),
    afterStt: ethers.formatEther(balanceAfter),
    spentStt: ethers.formatEther(balanceBefore - balanceAfter),
    vaultBalanceWei: (await vault.balances(walletAddress)).toString(),
    vaultReservedWei: (await vault.reserved(walletAddress)).toString()
  };

  writeJson("rollback-proof.json", report);
  console.log(JSON.stringify(report, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
