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
const JSONBLOB_BASE = "https://jsonblob.com";
const SIGNAL_INITIAL = 1n;
const SIGNAL_CHANGED = 3n;
const SIGNAL_THRESHOLD = 2n;
const AgentKind = { JsonUint: 0, InferString: 1, ParseString: 2, ParseNumber: 3 };
const Comparator = { Gt: 0, Gte: 1, Lt: 2, Lte: 3, Eq: 4, StringEq: 5 };
const ActionStatus = ["None", "Pending", "Settled", "RolledBack", "Failed"];
const ResponseStatus = ["None", "Pending", "Success", "Failed", "TimedOut"];
const abi = ethers.AbiCoder.defaultAbiCoder();

function txLink(hash) {
  return `${EXPLORER}/tx/${hash}`;
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function createSignalSource(value, label) {
  const body = { value: Number(value), label, updatedAt: new Date().toISOString() };
  const response = await fetchWithTimeout(`${JSONBLOB_BASE}/api/jsonBlob`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (response.status !== 201) throw new Error(`JSONBlob create failed: ${response.status} ${await response.text()}`);
  const location = response.headers.get("location");
  if (!location) throw new Error("JSONBlob create did not return a Location header");
  const url = new URL(location, JSONBLOB_BASE).toString();
  return { url, body: await response.json() };
}

async function readSignalSource(url) {
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`JSONBlob read failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  return { body, value: BigInt(body.value), fetchedAt: new Date().toISOString() };
}

async function updateSignalSource(url, value, label) {
  const body = { value: Number(value), label, updatedAt: new Date().toISOString() };
  const response = await fetchWithTimeout(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`JSONBlob update failed: ${response.status} ${await response.text()}`);
  return { body: await response.json(), updatedAt: body.updatedAt };
}

async function waitSignalSource(url, predicate, label, timeoutMs = 2 * 60 * 1000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await readSignalSource(url);
      if (predicate(result.value)) return result;
      lastError = new Error(`JSONBlob value was ${result.value.toString()}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(3000);
  }
  const detail = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for JSONBlob source: ${label}.${detail}`);
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
  if (event.parsed.name === "AgentRequestFailed") {
    callback.type = "failure-debug-bytes";
    callback.value = null;
  }
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
  if (event.parsed.name === "ChallengeFailed") {
    callback.type = "failure-debug-bytes";
    callback.value = null;
  }
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
  const source = await createSignalSource(SIGNAL_INITIAL, `onward-${mode}-signal`);
  const initialRead = await waitSignalSource(source.url, (value) => value === SIGNAL_INITIAL, `${mode} initial source value`);

  const rollbackText = `If the controlled JSON source value at ${source.url} is below 2, buy YES; challenge after the owner updates the source above the threshold.`;
  const settleText = `If the controlled JSON source value at ${source.url} is below 2, buy YES; challenge without changing the source.`;
  const ruleText = mode === "rollback" ? rollbackText : settleText;
  const eventSpec_ = eventSpec(AgentKind.JsonUint, Comparator.Lt, source.url, "value", SIGNAL_THRESHOLD);
  const actionValue = ethers.parseEther("0.01");
  const actionSpec_ = actionSpec(DOMAINS.PREDICTION, actionValue, abi.encode(["uint256"], [marketId]));
  const armed = await armRule({ rules, label: mode, plainText: ruleText, eventSpec_, actionSpec_ });
  const evaluation = await evaluateRule({ provider, rules, executor, vault, ruleId: armed.ruleId, kind: AgentKind.JsonUint, label: mode });
  if (!evaluation.actionId || evaluation.callback.decision !== true) {
    throw new Error(`${mode} did not open a pending action with a true first read`);
  }

  let stateChange = null;
  if (mode === "rollback") {
    const before = await readSignalSource(source.url);
    const update = await updateSignalSource(source.url, SIGNAL_CHANGED, "onward-rollback-signal");
    const after = await waitSignalSource(source.url, (value) => value === SIGNAL_CHANGED, "rollback changed source value");
    stateChange = { before, update, after };
  }

  const beforeChallenge = {
    reservedWei: (await vault.reserved(await signer.getAddress())).toString(),
    sourceValue: (await readSignalSource(source.url)).value.toString()
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
    sourceValue: (await readSignalSource(source.url)).value.toString()
  };

  const firstValue = evaluation.callback.callback.value;
  const rereadValue = challenged.callback.callback.value;
  const expectedStatus = mode === "rollback" ? "RolledBack" : "Settled";
  const finalStatus = ActionStatus[Number(challenged.finalAction.status)];
  if (finalStatus !== expectedStatus) {
    throw new Error(`${mode} expected ${expectedStatus}, got ${finalStatus}`);
  }

  const sequence = [
    await txSummary(provider, armed.tx.hash, "arm rule"),
    await txSummary(provider, evaluation.tx.hash, "evaluate and create first agent request"),
    evaluation.callback.tx
  ];
  sequence.push(await txSummary(provider, challenged.tx.hash, "challenge pending action"));
  sequence.push(challenged.callback.tx);

  return {
    ruleText,
    condition: `${source.url}#value < ${SIGNAL_THRESHOLD.toString()}`,
    source: {
      kind: "controlled-json",
      url: source.url,
      selector: "value",
      initialHttpRead: {
        value: initialRead.value.toString(),
        body: initialRead.body,
        fetchedAt: initialRead.fetchedAt
      }
    },
    firstRead: {
      requestId: evaluation.requestId.toString(),
      value: firstValue,
      decision: evaluation.callback.decision,
      callbackTx: evaluation.callback.tx.txHash
    },
    stateChange: stateChange
      ? {
          kind: "HTTP PUT",
          url: source.url,
          beforeValue: stateChange.before.value.toString(),
          beforeBody: stateChange.before.body,
          updateBody: stateChange.update.body,
          afterValue: stateChange.after.value.toString(),
          afterBody: stateChange.after.body,
          updatedAt: stateChange.update.updatedAt,
          fetchedAt: stateChange.after.fetchedAt
        }
      : null,
    reread: {
      requestId: challenged.requestId.toString(),
      value: rereadValue,
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
        ? `First read saw ${firstValue} (<${SIGNAL_THRESHOLD.toString()}) and opened action; owner updated source to ${afterChallenge.sourceValue}; challenge reread disagreed and rolled back.`
        : `First read saw ${firstValue} (<${SIGNAL_THRESHOLD.toString()}); no source change occurred; challenge reread ${rereadValue} agreed and settled.`
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

async function diagnoseReadPaths(context) {
  const { provider, rules, executor, vault } = context;
  const blockNumber = await provider.getBlockNumber();
  const rpcGetUrl = `https://dream-rpc.somnia.network?jsonrpc=2.0&method=eth_blockNumber&params=[]&id=1`;
  let localRpcGet = null;
  try {
    const response = await fetchWithTimeout(rpcGetUrl);
    localRpcGet = {
      url: rpcGetUrl,
      status: response.status,
      body: (await response.text()).slice(0, 500)
    };
  } catch (error) {
    localRpcGet = { url: rpcGetUrl, error: error.message };
  }

  const eventSpec_ = eventSpec(AgentKind.JsonUint, Comparator.Eq, rpcGetUrl, "result", 0);
  const actionSpec_ = actionSpec(DOMAINS.LENDING, ethers.parseEther("0.001"), "0x");
  const armed = await armRule({
    rules,
    label: "diagnose.rpcGet",
    plainText: "Diagnostic: try to read Somnia RPC through the JSON API GET primitive.",
    eventSpec_,
    actionSpec_
  });
  const evaluation = await evaluateRule({
    provider,
    rules,
    executor,
    vault,
    ruleId: armed.ruleId,
    kind: AgentKind.JsonUint,
    label: "diagnose.rpcGet"
  });

  const source = await createSignalSource(SIGNAL_INITIAL, "onward-diagnostic-source");
  const first = await waitSignalSource(source.url, (value) => value === SIGNAL_INITIAL, "diagnostic initial JSONBlob value");
  const update = await updateSignalSource(source.url, SIGNAL_CHANGED, "onward-diagnostic-source");
  const second = await waitSignalSource(source.url, (value) => value === SIGNAL_CHANGED, "diagnostic changed JSONBlob value");

  return {
    latestRpcBlockAtDiagnosis: blockNumber,
    rpcPostPath: {
      usable: false,
      reason:
        "The deployed Somnia JSON API agent interface accepts a GET URL and selector only; it exposes no POST body field for JSON-RPC."
    },
    rpcGetPath: {
      localFetch: localRpcGet,
      agentProbe: {
        armRule: await txSummary(provider, armed.tx.hash, "arm RPC GET diagnostic rule"),
        evaluate: await txSummary(provider, evaluation.tx.hash, "evaluate RPC GET diagnostic rule"),
        callback: evaluation.callback.tx,
        callbackEvent: evaluation.callback.eventName,
        callbackStatus: evaluation.callback.status,
        decodedCallback: evaluation.callback.callback,
        openedActionId: evaluation.actionId ? evaluation.actionId.toString() : null
      }
    },
    controlledJsonPath: {
      usable: true,
      url: source.url,
      selector: "value",
      initial: {
        value: first.value.toString(),
        body: first.body,
        fetchedAt: first.fetchedAt
      },
      update: {
        method: "PUT",
        body: update.body,
        updatedAt: update.updatedAt
      },
      changed: {
        value: second.value.toString(),
        body: second.body,
        fetchedAt: second.fetchedAt
      }
    }
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

  if (mode === "all") {
    report.sourceDiagnostics = await diagnoseReadPaths(context);
  }
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
