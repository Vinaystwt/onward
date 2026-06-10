import deployments from "../../../deployments-v3.json";

type DeploymentEntry = { address: `0x${string}`; txHash: string; purpose: string };
type Deployments = {
  generatedAt: string;
  network: { name: string; chainId: number; rpcUrl: string; agentPlatform: `0x${string}` };
  deployer: `0x${string}`;
  agentIds: Record<string, string>;
  contracts: Record<string, DeploymentEntry>;
};

const d = deployments as unknown as Deployments;

export const AGENT_PLATFORM = d.network.agentPlatform;

export const CONTRACTS = {
  PolicyLimits: d.contracts.PolicyLimits.address,
  ReceiptLog: d.contracts.ReceiptLog.address,
  TrackRecord: d.contracts.TrackRecord.address,
  Vault: d.contracts.Vault.address,
  Registry: d.contracts.Registry.address,
  AdapterRegistry: d.contracts.AdapterRegistry.address,
  RuleEngine: d.contracts.RuleEngine.address,
  AgentExecutor: d.contracts.AgentExecutor.address,
  Challenge: d.contracts.Challenge.address,
  MinimalPredictionMarket: d.contracts.MinimalPredictionMarket.address,
  MiniLendingPool: d.contracts.MiniLendingPool.address,
  PredictionMarketAdapter: d.contracts.PredictionMarketAdapter.address,
  NativeAlgebraTradingAdapter: d.contracts.NativeAlgebraTradingAdapter.address,
  LendingAdapter: d.contracts.LendingAdapter.address
} as const;

export const CONTRACT_PURPOSES: Record<keyof typeof CONTRACTS, string> = {
  PolicyLimits: d.contracts.PolicyLimits.purpose,
  ReceiptLog: d.contracts.ReceiptLog.purpose,
  TrackRecord: d.contracts.TrackRecord.purpose,
  Vault: d.contracts.Vault.purpose,
  Registry: d.contracts.Registry.purpose,
  AdapterRegistry: d.contracts.AdapterRegistry.purpose,
  RuleEngine: d.contracts.RuleEngine.purpose,
  AgentExecutor: d.contracts.AgentExecutor.purpose,
  Challenge: d.contracts.Challenge.purpose,
  MinimalPredictionMarket: d.contracts.MinimalPredictionMarket.purpose,
  MiniLendingPool: d.contracts.MiniLendingPool.purpose,
  PredictionMarketAdapter: d.contracts.PredictionMarketAdapter.purpose,
  NativeAlgebraTradingAdapter: d.contracts.NativeAlgebraTradingAdapter.purpose,
  LendingAdapter: d.contracts.LendingAdapter.purpose
};

export const AGENT_IDS = d.agentIds;
export const DEPLOYER = d.deployer;
export const GENERATED_AT = d.generatedAt;
