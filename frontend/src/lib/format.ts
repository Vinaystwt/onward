import { formatUnits, parseEther, keccak256, stringToBytes } from "viem";

export const STT = (wei: bigint | undefined | null, dp = 4) => {
  if (wei === undefined || wei === null) return "0";
  const s = formatUnits(wei, 18);
  const [whole, frac = ""] = s.split(".");
  if (dp === 0) return whole;
  const truncated = frac.slice(0, dp).replace(/0+$/, "");
  return truncated ? `${whole}.${truncated}` : whole;
};

export const STTLabel = (wei: bigint | undefined | null, dp = 4) => `${STT(wei, dp)} STT`;

export const shortAddr = (addr?: string | null) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export const shortHash = (hash?: string | null) =>
  hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "";

export const parseSTT = (input: string): bigint => {
  const clean = input.trim().replace(/[, ]/g, "");
  if (!clean) return 0n;
  return parseEther(clean as `${number}`);
};

export const relTime = (s: bigint | number | undefined | null) => {
  if (!s) return "just now";
  const seconds = typeof s === "bigint" ? Number(s) : s;
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const DOMAIN_HASHES = {
  PREDICTION: keccak256(stringToBytes("PREDICTION")),
  TRADING: keccak256(stringToBytes("TRADING")),
  LENDING: keccak256(stringToBytes("LENDING"))
} as const;

export const domainLabel = (domainHash: string) => {
  const hash = domainHash.toLowerCase();
  if (hash === DOMAIN_HASHES.PREDICTION.toLowerCase()) return "Prediction";
  if (hash === DOMAIN_HASHES.TRADING.toLowerCase()) return "Trading";
  if (hash === DOMAIN_HASHES.LENDING.toLowerCase()) return "Lending";
  return "Custom";
};

export const STATUS_LABEL: Record<number, string> = {
  0: "None",
  1: "Pending",
  2: "Settled",
  3: "RolledBack",
  4: "Failed"
};

export const COMPARATOR_LABEL: Record<number, string> = {
  0: "greater than",
  1: "at or above",
  2: "below",
  3: "at or below",
  4: "equal to",
  5: "matches"
};

export const COMPARATOR_SYMBOL: Record<number, string> = {
  0: ">",
  1: "≥",
  2: "<",
  3: "≤",
  4: "=",
  5: "≡"
};
