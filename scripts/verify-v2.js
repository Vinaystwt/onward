import { ethers } from "ethers";
import {
  AGENT_PLATFORM_ADDRESS,
  build,
  contractAt,
  provider,
  readDeployments,
  readJson,
  wallet,
  withRetry,
  writeJson
} from "./lib.js";

const erc20Abi = ["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];
const statusNames = ["None", "Pending", "Settled", "RolledBack", "Failed"];
const responseStatusNames = ["None", "Pending", "Success", "Failed", "TimedOut"];
const abi = ethers.AbiCoder.defaultAbiCoder();

async function getExplorerContract(address) {
  const url = `https://shannon-explorer.somnia.network/api/v2/smart-contracts/${address}`;
  try {
    const response = await fetch(url);
    const json = await response.json();
    return {
      url,
      ok: response.ok,
      name: json.name || null,
      isVerified: Boolean(json.is_verified || json.is_fully_verified),
      abiEntries: Array.isArray(json.abi) ? json.abi.length : 0,
      compilerVersion: json.compiler_version || null,
      filePath: json.file_path || null,
      error: null
    };
  } catch (error) {
    return { url, ok: false, name: null, isVerified: false, abiEntries: 0, compilerVersion: null, filePath: null, error: String(error.message || error) };
  }
}

function decodeUint(raw) {
  if (!raw || raw === "0x") return null;
  return abi.decode(["uint256"], raw)[0].toString();
}

async function decodeCallbackInput(rpc, txHash) {
  const tx = await rpc.getTransaction(txHash);
  if (!tx?.data || tx.data.length < 10 || tx.data.slice(0, 10) !== "0x5dae1f1c") {
    return null;
  }
  const [requestId, rawResult, callbackStatusRaw, receiptId, executionCost] = abi.decode(
    ["uint256", "bytes", "uint256", "uint256", "uint256"],
    `0x${tx.data.slice(10)}`
  );
  return {
    source: "callbackTxInput",
    txHash,
    txFrom: tx.from,
    txTo: tx.to,
    selector: tx.data.slice(0, 10),
    requestId: requestId.toString(),
    rawResult,
    uintResult: decodeUint(rawResult),
    callbackStatusRaw: callbackStatusRaw.toString(),
    receiptId: receiptId.toString(),
    executionCostWei: executionCost.toString()
  };
}

async function txSummary(rpc, hash, expectedFrom) {
  const receipt = await rpc.getTransactionReceipt(hash);
  if (!receipt) return { hash, exists: false };
  const tx = await rpc.getTransaction(hash);
  return {
    hash,
    exists: true,
    status: receipt.status === 1 ? "success" : "failed",
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    fromMatchesWallet: receipt.from.toLowerCase() === expectedFrom.toLowerCase(),
    to: receipt.to,
    contractAddress: receipt.contractAddress,
    transactionTo: tx?.to || null,
    valueWei: tx?.value?.toString() || null
  };
}

async function codeSummary(rpc, address) {
  const code = await rpc.getCode(address);
  return { address, verdict: code === "0x" ? "EMPTY" : "EXISTS", codeBytes: code === "0x" ? 0 : (code.length - 2) / 2 };
}

function collectTxs(deployments, demo) {
  const txs = {};
  for (const [name, item] of Object.entries(deployments.contracts)) {
    txs[`deploy:${name}`] = item.txHash;
  }
  for (const item of deployments.setupTransactions || []) {
    txs[`setup:${item.label}`] = item.txHash;
  }
  if (demo?.depositTxHash) txs["demo:deposit"] = demo.depositTxHash;
  for (const item of demo?.cleanup?.cleaned || []) {
    if (item.challenge?.txHash) txs[`cleanup:${item.actionId}:challenge`] = item.challenge.txHash;
    if (item.challenge?.callback?.txHash) txs[`cleanup:${item.actionId}:callback`] = item.challenge.callback.txHash;
  }

  const paths = [
    ["rollback", demo?.rollback?.success],
    ["agree", demo?.agree],
    ["nativeTrading", demo?.nativeTrading],
    ["onDemandTrigger", demo?.onDemandTrigger],
    ["nonSuccessGuard", demo?.nonSuccessGuard]
  ];
  for (const [label, item] of paths) {
    if (!item) continue;
    if (item.arm?.txHash) txs[`${label}:arm`] = item.arm.txHash;
    if (item.evaluation?.txHash) txs[`${label}:evaluate`] = item.evaluation.txHash;
    if (item.evaluation?.callback?.txHash) txs[`${label}:evaluationCallback`] = item.evaluation.callback.txHash;
    if (item.challenge?.txHash) txs[`${label}:challenge`] = item.challenge.txHash;
    if (item.challenge?.callback?.txHash) txs[`${label}:challengeCallback`] = item.challenge.callback.txHash;
  }
  return txs;
}

async function platformRequest(platform, rpc, requestId, callbackTxHash, eventStatus = "Success") {
  try {
    const details = await platform.getRequest(requestId);
    const first = details.responses.length > 0 ? details.responses[0] : null;
    return {
      source: "platform.getRequest",
      requestId: requestId.toString(),
      status: responseStatusNames[Number(details.status)] || String(details.status),
      responseCount: details.responseCount.toString(),
      failureCount: details.failureCount.toString(),
      perAgentBudgetWei: details.perAgentBudget.toString(),
      remainingBudgetWei: details.remainingBudget.toString(),
      rawResult: first?.result || "0x",
      uintResult: first?.result ? decodeUint(first.result) : null,
      responseStatus: first ? responseStatusNames[Number(first.status)] || String(first.status) : null,
      responseValidator: first?.validator || null
    };
  } catch (error) {
    const fallback = callbackTxHash ? await decodeCallbackInput(rpc, callbackTxHash) : null;
    if (!fallback) throw error;
    return {
      ...fallback,
      status: eventStatus,
      responseStatus: eventStatus,
      getRequestError: String(error.shortMessage || error.message || error)
    };
  }
}

async function actionSummary(vault, receiptLog, actionId) {
  const action = await vault.getPendingAction(actionId);
  const receipt = await receiptLog.getReceipt(actionId);
  return {
    actionId: actionId.toString(),
    ruleId: action.ruleId.toString(),
    wallet: action.wallet,
    target: action.target,
    valueWei: action.value.toString(),
    status: statusNames[Number(action.status)],
    originalDecisionHash: action.originalDecisionHash,
    rawOutput: action.rawOutput,
    rawOutputUint: decodeUint(action.rawOutput),
    receiptStatus: statusNames[Number(receipt.status)],
    receiptRawOutputUint: decodeUint(receipt.rawOutput),
    receiptDecision: Boolean(receipt.decision)
  };
}

async function main() {
  build();
  const rpc = provider();
  const signer = wallet();
  const walletAddress = await signer.getAddress();
  const deployments = readDeployments("deployments-v2.json");
  const demo = readJson("gap-demo-v2-results.json");
  const latestBlock = await rpc.getBlockNumber();
  const balance = await rpc.getBalance(walletAddress);
  const nonce = await rpc.getTransactionCount(walletAddress);

  const contracts = {};
  for (const [name, item] of Object.entries(deployments.contracts)) {
    contracts[name] = await codeSummary(rpc, item.address);
  }
  const native = {};
  for (const [name, address] of Object.entries(deployments.nativeTrading)) {
    if (ethers.isAddress(address) && address !== ethers.ZeroAddress) native[name] = await codeSummary(rpc, address);
  }

  const txs = {};
  for (const [label, hash] of Object.entries(collectTxs(deployments, demo))) {
    txs[label] = await txSummary(rpc, hash, walletAddress);
  }

  const vault = contractAt("Vault.sol", "Vault", deployments.contracts.Vault.address, rpc);
  const receiptLog = contractAt("ReceiptLog.sol", "ReceiptLog", deployments.contracts.ReceiptLog.address, rpc);
  const platform = contractAt("IAgentRequester.sol", "IAgentRequester", AGENT_PLATFORM_ADDRESS, rpc);
  const market = contractAt("MinimalPredictionMarket.sol", "MinimalPredictionMarket", deployments.contracts.MinimalPredictionMarket.address, rpc);
  const lending = contractAt("MiniLendingPool.sol", "MiniLendingPool", deployments.contracts.MiniLendingPool.address, rpc);
  const tokenOut = new ethers.Contract(deployments.nativeTrading.tokenOut, erc20Abi, rpc);
  const wNative = new ethers.Contract(deployments.nativeTrading.wNative, erc20Abi, rpc);
  const vaultAddress = deployments.contracts.Vault.address;
  const marketId = BigInt(deployments.demoMarketId || 1);

  const importantActions = {
    rollback: demo.rollback.success.evaluation.actionId,
    agree: demo.agree.evaluation.actionId,
    nativeTrading: demo.nativeTrading.evaluation.actionId,
    onDemandTrigger: demo.onDemandTrigger.evaluation.actionId
  };
  const actions = {};
  for (const [label, actionId] of Object.entries(importantActions)) {
    actions[label] = await actionSummary(vault, receiptLog, actionId);
  }

  const requests = {};
  const requestPaths = {
    rollbackFirst: [demo.rollback.success.evaluation.requestId, demo.rollback.success.evaluation.callback.txHash, demo.rollback.success.evaluation.callback.status],
    rollbackReread: [demo.rollback.success.challenge.requestId, demo.rollback.success.challenge.callback.txHash, demo.rollback.success.challenge.callback.status],
    agreeFirst: [demo.agree.evaluation.requestId, demo.agree.evaluation.callback.txHash, demo.agree.evaluation.callback.status],
    agreeReread: [demo.agree.challenge.requestId, demo.agree.challenge.callback.txHash, demo.agree.challenge.callback.status],
    nativeTradingFirst: [demo.nativeTrading.evaluation.requestId, demo.nativeTrading.evaluation.callback.txHash, demo.nativeTrading.evaluation.callback.status],
    nativeTradingReread: [demo.nativeTrading.challenge.requestId, demo.nativeTrading.challenge.callback.txHash, demo.nativeTrading.challenge.callback.status],
    onDemandFirst: [demo.onDemandTrigger.evaluation.requestId, demo.onDemandTrigger.evaluation.callback.txHash, demo.onDemandTrigger.evaluation.callback.status],
    onDemandReread: [demo.onDemandTrigger.challenge.requestId, demo.onDemandTrigger.challenge.callback.txHash, demo.onDemandTrigger.challenge.callback.status],
    nonSuccess: [demo.nonSuccessGuard.evaluation.requestId, demo.nonSuccessGuard.evaluation.callback.txHash, demo.nonSuccessGuard.evaluation.callback.status]
  };
  for (const [label, [requestId, callbackTxHash, eventStatus]] of Object.entries(requestPaths)) {
    requests[label] = await platformRequest(platform, rpc, BigInt(requestId), callbackTxHash, eventStatus);
  }

  const currentState = {
    blockNumber: await rpc.getBlockNumber(),
    vaultUserBalanceWei: (await vault.balances(walletAddress)).toString(),
    vaultUserReservedWei: (await vault.reserved(walletAddress)).toString(),
    predictionYesSharesForVaultWei: (await market.yesShares(marketId, vaultAddress)).toString(),
    lendingSuppliedByVaultWei: (await lending.supplied(vaultAddress)).toString(),
    nativeTrading: {
      vaultTokenOutBalance: (await tokenOut.balanceOf(vaultAddress)).toString(),
      poolWNativeBalance: (await wNative.balanceOf(deployments.nativeTrading.pool)).toString(),
      poolTokenOutBalance: (await tokenOut.balanceOf(deployments.nativeTrading.pool)).toString()
    }
  };

  const discovery = {
    router: await getExplorerContract(deployments.nativeTrading.router),
    factory: await getExplorerContract(deployments.nativeTrading.factory),
    poolDeployer: await getExplorerContract(deployments.nativeTrading.poolDeployer),
    pool: await getExplorerContract(deployments.nativeTrading.pool),
    tokenOutSymbol: await withRetry(() => tokenOut.symbol(), "tokenOut symbol"),
    wNativeSymbol: await withRetry(() => wNative.symbol(), "wNative symbol")
  };

  const report = {
    generatedAt: new Date().toISOString(),
    wallet: {
      address: walletAddress,
      latestBlock,
      balanceWei: balance.toString(),
      balanceStt: ethers.formatEther(balance),
      nonce
    },
    deployments: {
      generatedAt: deployments.generatedAt,
      contracts,
      nativeTrading: native
    },
    transactions: txs,
    explorerDiscovery: discovery,
    actions,
    agentRequests: requests,
    demoStateSnapshots: {
      initial: demo.initialState,
      rollbackBeforeChallenge: demo.rollback.success.beforeChallenge,
      rollbackAfterChallenge: demo.rollback.success.afterChallenge,
      agreeBeforeSettlement: demo.agree.beforeSettlement,
      agreeAfterSettlement: demo.agree.afterSettlement,
      nativeTradingBeforeSettlement: demo.nativeTrading.beforeSettlement,
      nativeTradingAfterSettlement: demo.nativeTrading.afterSettlement,
      onDemandBefore: demo.onDemandTrigger.beforeSettlement,
      onDemandAfterPending: demo.onDemandTrigger.afterPending,
      onDemandAfterSettlement: demo.onDemandTrigger.afterSettlement,
      final: demo.finalState,
      current: currentState
    },
    assertions: {
      allContractsExist: Object.values(contracts).every((item) => item.verdict === "EXISTS"),
      nativeTradingVenueExists: Object.values(native).every((item) => item.verdict === "EXISTS"),
      allRecordedTxsExist: Object.values(txs).every((item) => item.exists),
      allRecordedTxsFromWalletWhenUserTx:
        Object.entries(txs)
          .filter(([label]) => !label.includes("Callback"))
          .every(([, item]) => item.fromMatchesWallet),
      rollbackIsRealDisagreement:
        actions.rollback.status === "RolledBack" &&
        requests.rollbackFirst.uintResult !== requests.rollbackReread.uintResult &&
        demo.rollback.success.firstDecision === true &&
        demo.rollback.success.rereadDecision === false &&
        demo.rollback.success.challenge.callback.agreed === false,
      rollbackReservedReturnedToZero: demo.rollback.success.afterChallenge.vaultReservedWei === "0",
      agreeSettled: actions.agree.status === "Settled" && demo.agree.challenge.callback.agreed === true,
      nativeTradingStateChanged:
        BigInt(demo.nativeTrading.deltas.vaultTokenOutBalance) > 0n &&
        BigInt(demo.nativeTrading.deltas.poolWNativeBalance) > 0n &&
        BigInt(demo.nativeTrading.deltas.poolTokenOutBalance) < 0n,
      forceEvaluateUsedAgentCallback:
        demo.onDemandTrigger.evaluation.method === "forceEvaluate" &&
        demo.onDemandTrigger.evaluation.callback.eventName === "EvaluationCompleted" &&
        Boolean(demo.onDemandTrigger.evaluation.callback.txHash),
      nonSuccessCreatedNoAction:
        demo.nonSuccessGuard.createdNoAction === true &&
        demo.nonSuccessGuard.evaluation.callback.eventName === "AgentRequestFailed"
    }
  };

  writeJson("verification-v2.json", report);
  console.log(JSON.stringify(report, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
