import { encodeAbiParameters, encodePacked, parseEther, zeroAddress } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { DOMAIN_HASHES } from "@/lib/format";

export type AgentKind = 0 | 1 | 2 | 3;
export type Comparator = 0 | 1 | 2 | 3 | 4 | 5;

export type EventSpec = {
  kind: number;
  comparator: number;
  url: string;
  selector: string;
  decimals: number;
  threshold: bigint;
  expected: string;
  prompt: string;
  systemOrDescription: string;
};

export type ActionSpec = {
  domain: `0x${string}`;
  actionType: number;
  value: bigint;
  params: `0x${string}`;
};

export type RuleTemplate = {
  id: string;
  title: string;
  blurb: string;
  domainLabel: "Trading" | "Prediction" | "Lending";
  defaultCap: string;
  defaultThreshold: string;
  thresholdUnit: string;
  thresholdHint: string;
  plain: (threshold: string, cap: string) => string;
  buildEventSpec: (threshold: string) => EventSpec;
  buildActionSpec: (cap: string) => ActionSpec;
};

const TIME_URL = "https://timeapi.io/api/time/current/zone?timeZone=UTC";
const ETH_PRICE_URL = "https://api.coinbase.com/v2/prices/ETH-USD/spot";

// Helper: build a native Algebra swap path. The demo harness packs three addresses
// (wNative, pathDeployer or zero, tokenOut). We do not have a real on-chain test pair
// to lean on from the web app, so for the template we encode an empty placeholder
// and let the user edit the address fields in advanced mode. For the demo trigger
// flow on the dashboard we instead arm a rule whose action is a tiny prediction buy,
// which is the cheapest, deterministic on-chain action the v2 stack supports.
const PREDICTION_MARKET_ID = 1n;

export const ruleTemplates: RuleTemplate[] = [
  {
    id: "time-prediction",
    title: "Buy a YES share when the clock crosses a second",
    blurb: "Reads live UTC seconds from a public time API. When the second is below your threshold, Onward buys a YES share on the prediction venue. This is the easiest rule to fire on demand, which makes it the right first rule to try.",
    domainLabel: "Prediction",
    defaultCap: "0.02",
    defaultThreshold: "60",
    thresholdUnit: "UTC seconds",
    thresholdHint: "Try 60 so the rule fires immediately on the next Trigger now.",
    plain: (threshold, cap) =>
      `When live UTC seconds drop below ${threshold}, buy a YES share on the prediction venue with up to ${cap} STT.`,
    buildEventSpec: (threshold) => ({
      kind: 0,
      comparator: 2,
      url: TIME_URL,
      selector: "seconds",
      decimals: 0,
      threshold: BigInt(threshold || "60"),
      expected: "",
      prompt: "",
      systemOrDescription: ""
    }),
    buildActionSpec: (cap) => ({
      domain: DOMAIN_HASHES.PREDICTION,
      actionType: 0,
      value: parseEther((cap || "0.02") as `${number}`),
      params: encodeAbiParameters([{ type: "uint256" }], [PREDICTION_MARKET_ID])
    })
  },
  {
    id: "eth-price-supply",
    title: "Supply STT to lending when ETH is above a price",
    blurb: "Reads ETH USD spot from Coinbase. When the price clears your threshold, Onward supplies a small slice of STT into the reference lending pool. Reference venue with real supply accounting.",
    domainLabel: "Lending",
    defaultCap: "0.02",
    defaultThreshold: "1500",
    thresholdUnit: "USD",
    thresholdHint: "Set high to test the no fire path. Set low to fire immediately.",
    plain: (threshold, cap) =>
      `When ETH USD goes above ${threshold}, supply ${cap} STT into the reference lending pool.`,
    buildEventSpec: (threshold) => ({
      kind: 0,
      comparator: 0,
      url: ETH_PRICE_URL,
      selector: "data.amount",
      decimals: 0,
      threshold: BigInt(threshold || "1500"),
      expected: "",
      prompt: "",
      systemOrDescription: ""
    }),
    buildActionSpec: (cap) => ({
      domain: DOMAIN_HASHES.LENDING,
      actionType: 0,
      value: parseEther((cap || "0.02") as `${number}`),
      params: "0x"
    })
  },
  {
    id: "time-prediction-late",
    title: "Buy a YES share late in the minute",
    blurb: "Same clock signal, opposite side. Fires when seconds climb above your threshold. Useful for showing both the fire and no fire paths in a row.",
    domainLabel: "Prediction",
    defaultCap: "0.02",
    defaultThreshold: "30",
    thresholdUnit: "UTC seconds",
    thresholdHint: "Set 0 to always fire. Set 59 to almost never fire.",
    plain: (threshold, cap) =>
      `When live UTC seconds rise above ${threshold}, buy a YES share with up to ${cap} STT.`,
    buildEventSpec: (threshold) => ({
      kind: 0,
      comparator: 0,
      url: TIME_URL,
      selector: "seconds",
      decimals: 0,
      threshold: BigInt(threshold || "30"),
      expected: "",
      prompt: "",
      systemOrDescription: ""
    }),
    buildActionSpec: (cap) => ({
      domain: DOMAIN_HASHES.PREDICTION,
      actionType: 0,
      value: parseEther((cap || "0.02") as `${number}`),
      params: encodeAbiParameters([{ type: "uint256" }], [PREDICTION_MARKET_ID])
    })
  }
];

export const DEFAULT_LIMITS_REF = 1n;

// Encodes a packed Algebra path (kept for future advanced templates).
export function encodeAlgebraPath(wNative: `0x${string}`, mid: `0x${string}`, tokenOut: `0x${string}`) {
  return encodePacked(["address", "address", "address"], [wNative, mid || zeroAddress, tokenOut]);
}

export const KNOWN_TARGETS: Record<string, string> = {
  [CONTRACTS.MinimalPredictionMarket.toLowerCase()]: "Prediction venue",
  [CONTRACTS.MiniLendingPool.toLowerCase()]: "Lending venue"
};
