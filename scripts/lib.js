import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

export const ROOT = process.cwd();
export const RPC_URL = process.env.RPC_URL || "https://dream-rpc.somnia.network";
export const CHAIN_ID = BigInt(process.env.CHAIN_ID || "50312");
export const AGENT_PLATFORM_ADDRESS =
  process.env.AGENT_PLATFORM_ADDRESS || "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

export const DOMAINS = {
  PREDICTION: ethers.id("PREDICTION"),
  TRADING: ethers.id("TRADING"),
  LENDING: ethers.id("LENDING")
};

export const AGENTS = {
  JSON_API: "13174292974160097713",
  LLM_INFERENCE: "12847293847561029384",
  LLM_PARSE_WEBSITE: "12875401142070969085"
};

export const PURPOSES = {
  PolicyLimits: "Per-rule spend caps, rate limits, and trust ceiling",
  ReceiptLog: "Queryable audit receipts for pending, settled, and rolled-back actions",
  TrackRecord: "Accuracy counters and rule leaderboard",
  Vault: "Custodies STT, reserves pending actions, settles or rolls back",
  Registry: "Supported event and action type registry",
  AdapterRegistry: "Domain-to-adapter routing registry",
  RuleEngine: "Stores user rules and starts evaluation cycles",
  AgentExecutor: "Creates Somnia Agent requests and opens pending vault actions",
  Challenge: "Runs independent rereads and settles or rolls back pending actions",
  OnwardToken: "Demo ERC20 token used by the AMM trading venue",
  ConstantProductAMM: "Option C trading venue with live AMM reserves",
  MinimalPredictionMarket: "Option C prediction venue with real YES/NO balances",
  MiniLendingPool: "Option C lending venue with real supply/borrow accounting",
  PredictionMarketAdapter: "Encodes prediction market buy-YES actions",
  TradingAdapter: "Encodes AMM buy-token actions",
  LendingAdapter: "Encodes lending supply actions",
  PrimitiveSpike: "Day-0 primitive agent callback and determinism harness"
};

export function requireEnv() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is missing from .env");
  }
}

export function build() {
  execFileSync("forge", ["build"], { stdio: "inherit" });
}

export function provider() {
  return new ethers.JsonRpcProvider(RPC_URL, Number(CHAIN_ID));
}

export function wallet() {
  requireEnv();
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider());
}

export function artifact(file, name) {
  const artifactPath = path.join(ROOT, "out", file, `${name}.json`);
  const raw = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return {
    abi: raw.abi,
    bytecode: typeof raw.bytecode === "string" ? raw.bytecode : raw.bytecode.object
  };
}

export function contractAt(file, name, address, signerOrProvider) {
  const item = artifact(file, name);
  return new ethers.Contract(address, item.abi, signerOrProvider);
}

export async function deploy(name, file, args = [], signer = wallet()) {
  const item = artifact(file, name);
  const factory = new ethers.ContractFactory(item.abi, item.bytecode, signer);
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  console.log(`deploying ${name}: ${tx.hash}`);
  await contract.waitForDeployment();
  const receipt = await tx.wait();
  const address = await contract.getAddress();
  console.log(`${name} -> ${address}`);
  return { contract, address, txHash: receipt.hash };
}

export async function send(label, txPromise) {
  const tx = await txPromise;
  console.log(`${label}: ${tx.hash}`);
  const receipt = await tx.wait();
  return receipt;
}

export function readDeployments() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "deployments.json"), "utf8"));
}

export function writeJson(file, value) {
  fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`);
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(predicate, label, timeoutMs = 20 * 60 * 1000, intervalMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export function parseEvent(contract, receipt, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) return parsed;
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return null;
}
