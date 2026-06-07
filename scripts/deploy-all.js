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

  const deployments = {
    generatedAt: new Date().toISOString(),
    network: {
      name: "Somnia Testnet",
      chainId: Number(CHAIN_ID),
      rpcUrl: "https://dream-rpc.somnia.network",
      agentPlatform: AGENT_PLATFORM_ADDRESS
    },
    deployer,
    agentIds: AGENTS,
    contracts: {},
    setupTransactions: [],
    venueScan: {
      prediction: {
        option: "C",
        chosen: "Onward MinimalPredictionMarket",
        reason:
          "Prophecy Social is live on Somnia, but public docs did not expose a stable permissionless contract ABI during the scan; deployed a real Onward venue with real balances."
      },
      trading: {
        option: "C",
        chosen: "Onward ConstantProductAMM",
        reason:
          "Somnex and Somnia Exchange are live trading venues, but public docs did not expose safe router addresses/ABI during the scan; deployed a real constant-product AMM."
      },
      lending: {
        option: "C",
        chosen: "Onward MiniLendingPool",
        reason:
          "DreamLend publishes a Somnia testnet address, but ABI discovery was incomplete for autonomous vault calls; deployed a minimal real lending pool."
      }
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
  const token = await remember("OnwardToken", "OnwardToken.sol", ["Onward Demo USD", "ODUSD", 18]);
  const amm = await remember("ConstantProductAMM", "ConstantProductAMM.sol", [await token.getAddress()]);
  const predictionMarket = await remember("MinimalPredictionMarket", "MinimalPredictionMarket.sol");
  const lendingPool = await remember("MiniLendingPool", "MiniLendingPool.sol");
  const predictionAdapter = await remember("PredictionMarketAdapter", "PredictionMarketAdapter.sol", [
    await predictionMarket.getAddress()
  ]);
  const tradingAdapter = await remember("TradingAdapter", "TradingAdapter.sol", [await amm.getAddress()]);
  const lendingAdapter = await remember("LendingAdapter", "LendingAdapter.sol", [await lendingPool.getAddress()]);
  const primitiveSpike = await remember("PrimitiveSpike", "PrimitiveSpike.sol", [AGENT_PLATFORM_ADDRESS]);
  void primitiveSpike;

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
  await setup("AdapterRegistry.setAdapter(TRADING)", adapterRegistry.setAdapter(DOMAINS.TRADING, await tradingAdapter.getAddress()));
  await setup("AdapterRegistry.setAdapter(LENDING)", adapterRegistry.setAdapter(DOMAINS.LENDING, await lendingAdapter.getAddress()));

  await setup("OnwardToken.mint(deployer)", token.mint(deployer, ethers.parseEther("1000000")));
  await setup("OnwardToken.approve(AMM)", token.approve(await amm.getAddress(), ethers.parseEther("500000")));
  await setup("ConstantProductAMM.seed", amm.seed(ethers.parseEther("500000"), { value: ethers.parseEther("10") }));
  const marketReceipt = await send(
    "MinimalPredictionMarket.createMarket",
    predictionMarket.createMarket("Will BTC be above the Onward demo threshold?")
  );
  deployments.setupTransactions.push({ label: "MinimalPredictionMarket.createMarket", txHash: marketReceipt.hash });
  deployments.demoMarketId = 1;
  await setup("MiniLendingPool.supply(seed)", lendingPool.supply({ value: ethers.parseEther("1") }));

  const balanceAfter = await rpc.getBalance(deployer);
  deployments.balanceBeforeStt = ethers.formatEther(balanceBefore);
  deployments.balanceAfterStt = ethers.formatEther(balanceAfter);
  deployments.sttConsumedDeploy = ethers.formatEther(balanceBefore - balanceAfter);

  writeJson("deployments.json", deployments);
  console.log("wrote deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
