import { ethers } from "ethers";
import {
  AGENT_PLATFORM_ADDRESS,
  AGENTS,
  CHAIN_ID,
  DOMAINS,
  PURPOSES,
  build,
  deploy,
  provider,
  send,
  wallet,
  writeJson
} from "./lib.js";

const NATIVE_TRADING = {
  router: "0xE94de02e52Eaf9F0f6Bf7f16E4927FcBc2c09bC7",
  factory: "0x0BFaCE9a5c9F884a4f09fadB83b69e81EA41424B",
  poolDeployer: "0x15fCbF9bC0797567053A8265b7E6f4eC43EA7327",
  pathDeployer: ethers.ZeroAddress,
  wNative: "0x4A3BC48C156384f9564Fd65A53a2f3D534D8f2b7",
  tokenOut: "0xDa4FDE38bE7a2b959BF46E032ECfA21e64019b76",
  tokenOutSymbol: "USDT.g",
  pool: "0xebF1d0F21fE80A52B264FB3a9e7a9384d583a134"
};

const signer = wallet();
const rpc = provider();

async function main() {
  build();
  const network = await rpc.getNetwork();
  if (network.chainId !== CHAIN_ID) {
    throw new Error(`Wrong chain: got ${network.chainId}, expected ${CHAIN_ID}`);
  }

  const deployer = await signer.getAddress();
  const balanceBefore = await rpc.getBalance(deployer);
  console.log(`deployer ${deployer}`);
  console.log(`balance before ${ethers.formatEther(balanceBefore)} STT`);

  for (const [label, address] of Object.entries(NATIVE_TRADING)) {
    if (!ethers.isAddress(address) || address === ethers.ZeroAddress) continue;
    const code = await rpc.getCode(address);
    if (code === "0x") throw new Error(`Native trading ${label} has no code: ${address}`);
  }

  const deployments = {
    generatedAt: new Date().toISOString(),
    network: {
      name: "Somnia Testnet",
      chainId: Number(CHAIN_ID),
      rpcUrl: "https://dream-rpc.somnia.network",
      explorer: "https://shannon-explorer.somnia.network",
      agentPlatform: AGENT_PLATFORM_ADDRESS
    },
    deployer,
    agentIds: AGENTS,
    contracts: {},
    setupTransactions: [],
    nativeTrading: NATIVE_TRADING,
    provenanceEvents: {
      Vault: ["SpendLimitEnforced"],
      Challenge: ["ChallengeRead", "ChallengeResolved"]
    }
  };

  async function remember(name, file, args = []) {
    const item = await deploy(name, file, args, signer);
    deployments.contracts[name] = {
      address: item.address,
      txHash: item.txHash,
      purpose: PURPOSES[name] || ""
    };
    return item.contract;
  }

  const policy = await remember("PolicyLimits", "PolicyLimits.sol");
  const receiptLog = await remember("ReceiptLog", "ReceiptLog.sol");
  const trackRecord = await remember("TrackRecord", "TrackRecord.sol");
  const vault = await remember("Vault", "Vault.sol", [
    await policy.getAddress(),
    await receiptLog.getAddress(),
    await trackRecord.getAddress(),
    3600
  ]);
  const registry = await remember("Registry", "Registry.sol");
  void registry;
  const adapterRegistry = await remember("AdapterRegistry", "AdapterRegistry.sol");
  const ruleEngine = await remember("RuleEngine", "RuleEngine.sol", [await policy.getAddress()]);
  const agentExecutor = await remember("AgentExecutor", "AgentExecutor.sol", [
    AGENT_PLATFORM_ADDRESS,
    await ruleEngine.getAddress(),
    await adapterRegistry.getAddress(),
    await vault.getAddress()
  ]);
  const challenge = await remember("Challenge", "Challenge.sol", [
    AGENT_PLATFORM_ADDRESS,
    await ruleEngine.getAddress(),
    await vault.getAddress()
  ]);
  const predictionMarket = await remember("MinimalPredictionMarket", "MinimalPredictionMarket.sol");
  const lendingPool = await remember("MiniLendingPool", "MiniLendingPool.sol");
  const predictionAdapter = await remember("PredictionMarketAdapter", "PredictionMarketAdapter.sol", [
    await predictionMarket.getAddress()
  ]);
  const nativeTradingAdapter = await remember("NativeAlgebraTradingAdapter", "NativeAlgebraTradingAdapter.sol", [
    NATIVE_TRADING.router,
    await vault.getAddress()
  ]);
  const lendingAdapter = await remember("LendingAdapter", "LendingAdapter.sol", [await lendingPool.getAddress()]);

  async function setup(label, txPromise) {
    const receipt = await send(label, txPromise);
    deployments.setupTransactions.push({ label, txHash: receipt.hash });
  }

  await setup("PolicyLimits.setVault", policy.setVault(await vault.getAddress()));
  await setup("PolicyLimits.setRuleEngine", policy.setRuleEngine(await ruleEngine.getAddress()));
  await setup("PolicyLimits.setTrackRecord", policy.setTrackRecord(await trackRecord.getAddress()));
  await setup("ReceiptLog.setWriter(Vault)", receiptLog.setWriter(await vault.getAddress(), true));
  await setup("TrackRecord.setWriter(Vault)", trackRecord.setWriter(await vault.getAddress(), true));
  await setup("Vault.setExecutor", vault.setExecutor(await agentExecutor.getAddress()));
  await setup("Vault.setChallenge", vault.setChallenge(await challenge.getAddress()));
  await setup("RuleEngine.setExecutor", ruleEngine.setExecutor(await agentExecutor.getAddress()));
  await setup("AdapterRegistry.setAdapter(PREDICTION)", adapterRegistry.setAdapter(DOMAINS.PREDICTION, await predictionAdapter.getAddress()));
  await setup("AdapterRegistry.setAdapter(TRADING_NATIVE)", adapterRegistry.setAdapter(DOMAINS.TRADING, await nativeTradingAdapter.getAddress()));
  await setup("AdapterRegistry.setAdapter(LENDING)", adapterRegistry.setAdapter(DOMAINS.LENDING, await lendingAdapter.getAddress()));

  const marketReceipt = await send(
    "MinimalPredictionMarket.createMarket",
    predictionMarket.createMarket("Onward v3 proof market")
  );
  deployments.setupTransactions.push({ label: "MinimalPredictionMarket.createMarket", txHash: marketReceipt.hash });
  deployments.demoMarketId = 1;
  await setup("MiniLendingPool.supply(seed)", lendingPool.supply({ value: ethers.parseEther("1") }));

  const balanceAfter = await rpc.getBalance(deployer);
  deployments.balanceBeforeStt = ethers.formatEther(balanceBefore);
  deployments.balanceAfterStt = ethers.formatEther(balanceAfter);
  deployments.sttConsumedDeploy = ethers.formatEther(balanceBefore - balanceAfter);

  writeJson("deployments-v3.json", deployments);
  console.log("wrote deployments-v3.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
