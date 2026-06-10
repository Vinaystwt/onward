// Centralised marketing and product copy. This file must never contain
// hyphens or em/en dashes used as punctuation. House style: rewrite sentences instead.

export const HERO = {
  eyebrow: "Self driving wallet on Somnia",
  title: "A wallet that runs itself on your rules, and proves it never went off script.",
  sub: "Onward reads external sources through Somnia consensus AI, acts on chain when conditions are met, and records every move. A protocol native challenge reads the source again before settlement and rolls the action back if the consensus result changed.",
  ctaPrimary: "Open the app",
  ctaSecondary: "See how it works"
};

export const PILLARS = [
  {
    label: "Plain English rules",
    body: "Describe what you want in one sentence. Onward turns it into an on chain trigger that the validator network evaluates by consensus."
  },
  {
    label: "Consensus reads",
    body: "Onward reads external sources through Somnia consensus AI: validators fetch and agree on the result, and that agreement is part of the block."
  },
  {
    label: "Receipt on every move",
    body: "Every action carries a receipt with the source, the consensus decision, and the on chain proof, linkable to the explorer."
  },
  {
    label: "Pre settlement rollback",
    body: "A fresh consensus reading can catch a changed result and roll back the action before any funds leave the vault."
  }
];

export const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Arm a rule",
    body: "Pick a template, set a threshold and a cap, point it at a connector. Plain text, signed by you."
  },
  {
    n: "02",
    title: "Validators reach consensus",
    body: "A Somnia validator subcommittee fetches the configured source, signs the result, and the chain agrees on one canonical reading."
  },
  {
    n: "03",
    title: "Vault opens a pending action",
    body: "If the consensus reading clears the threshold, the vault reserves the cap and posts a receipt. Nothing has moved yet."
  },
  {
    n: "04",
    title: "Challenge window",
    body: "Anyone can request a fresh consensus reading. If the new result disagrees, the action rolls back and funds stay in the vault. If it agrees, the action settles on chain."
  }
];

export const SAFETY_BULLETS = [
  "Vault holds your STT. You can withdraw what is not reserved at any time.",
  "Every rule has a per call cap, a per period cap, and a trust ceiling that scales with track record.",
  "Pending actions sit in a challenge window before settlement. A fresh consensus reading that disagrees rolls them back.",
  "Onward never holds your private key. The agent runs on chain, not in a server."
];

export const FAQ = [
  {
    q: "Why does this need consensus AI?",
    a: "A self driving wallet is only useful if the action can be challenged before it executes. Somnia validators fetch the same source independently and must agree on the result. That consensus reading is part of the block, so the challenge mechanism can request a fresh one and the chain can act on it atomically. Off chain bots cannot provide this guarantee."
  },
  {
    q: "What if the data source goes down?",
    a: "If the read fails, the rule does not fire. No action, no settlement, no rollback needed. The vault is untouched."
  },
  {
    q: "What is in a receipt?",
    a: "Source, raw output, consensus decision, decision hash, the target contract, the on chain tx, and the final status. Each receipt links to Shannon explorer."
  },
  {
    q: "Can I write my own rule logic?",
    a: "Yes. Templates cover the common cases. Advanced mode exposes the full event spec and action spec, including custom JSON selectors and bespoke connectors."
  },
  {
    q: "Is the money real?",
    a: "On Somnia testnet today, STT is test currency. The contracts, the consensus reads, and the receipts are real."
  },
  {
    q: "Does Onward guarantee the source data is correct?",
    a: "No. The system guarantees that an action executes only when the consensus reading at challenge time still agrees with the original. It does not verify that the external URL returns accurate real world data. Users should understand and trust the source they configure."
  }
];
