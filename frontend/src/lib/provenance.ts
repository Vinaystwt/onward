/**
 * Five-tier receipt provenance model.
 *
 * Every value that appears on a receipt originates from exactly one tier.
 * The tiers match the on-chain event and call mapping in rollback-proof.json.
 */

export type ProvTier =
  | "USER_DEFINED"
  | "SOURCE"
  | "AGENT_INFERRED"
  | "ON_CHAIN_ENFORCED"
  | "CONSENSUS_VERIFIED";

export const PROV_META: Record<
  ProvTier,
  { label: string; short: string; description: string; className: string }
> = {
  USER_DEFINED: {
    label: "User defined",
    short: "User",
    description:
      "Set by the wallet owner when arming the rule: plain text, event spec, action spec, spend cap.",
    className:
      "bg-signal-amber/12 text-[#7A4B07] border border-signal-amber/25"
  },
  SOURCE: {
    label: "Source read",
    short: "Source",
    description:
      "The raw value the agent platform fetched from the configured external URL during consensus.",
    className:
      "bg-brand/8 text-brand-deep border border-brand/18"
  },
  AGENT_INFERRED: {
    label: "Agent inferred",
    short: "Agent",
    description:
      "The decision and action encoding produced by the Somnia consensus AI after comparing source to threshold.",
    className:
      "bg-[#7B5EA7]/10 text-[#4B2D7A] border border-[#7B5EA7]/20"
  },
  ON_CHAIN_ENFORCED: {
    label: "On chain enforced",
    short: "Chain",
    description:
      "Values enforced by the vault and policy contracts: spend cap check, pending action reservation.",
    className:
      "bg-ink/6 text-ink border border-ink/12"
  },
  CONSENSUS_VERIFIED: {
    label: "Consensus verified",
    short: "Verified",
    description:
      "The final status produced by the challenge reading: agreed settles, disagreed rolls back.",
    className:
      "bg-signal-mint/12 text-[#0A6F55] border border-signal-mint/25"
  }
};

/** Map each visible receipt field name to its provenance tier. */
export const FIELD_PROV: Record<string, ProvTier> = {
  // USER_DEFINED
  "Rule": "USER_DEFINED",
  "Cap per fire": "USER_DEFINED",
  "Threshold": "USER_DEFINED",
  // SOURCE
  "Source": "SOURCE",
  "Raw output": "SOURCE",
  // AGENT_INFERRED
  "Decision": "AGENT_INFERRED",
  "Decision hash": "AGENT_INFERRED",
  "Domain": "AGENT_INFERRED",
  "Target": "AGENT_INFERRED",
  "Calldata": "AGENT_INFERRED",
  // ON_CHAIN_ENFORCED
  "Value": "ON_CHAIN_ENFORCED",
  "Created": "ON_CHAIN_ENFORCED",
  // CONSENSUS_VERIFIED
  "Status": "CONSENSUS_VERIFIED",
  "Updated": "CONSENSUS_VERIFIED"
};
