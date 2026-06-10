import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { STTLabel, domainLabel, COMPARATOR_SYMBOL } from "@/lib/format";
import type { Rule } from "@/hooks/useRules";
import { useState } from "react";
import { useTrigger } from "@/hooks/useTrigger";
import { productRuleTitle } from "@/lib/rules";

export function RuleCard({ rule, onTriggered }: { rule: Rule; onTriggered?: (txHash: string) => void }) {
  const [pulse, setPulse] = useState(false);
  const { trigger, status, error, txHash } = useTrigger();

  const onClick = async () => {
    setPulse(true);
    const hash = await trigger(rule.id, rule.eventSpec.kind);
    setPulse(false);
    if (hash && onTriggered) onTriggered(hash);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card p-6 flex flex-col gap-4 relative overflow-hidden"
    >
      <motion.div
        aria-hidden
        className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-brand-glow/30 blur-3xl"
        animate={{ opacity: pulse ? 0.9 : 0.35 }}
        transition={{ duration: 0.5 }}
      />
      <div className="flex items-center justify-between relative">
        <span className="pill pill-brand">Rule #{rule.id.toString()}</span>
        <span className={`pill ${rule.active ? "pill-mint" : ""}`}>
          {rule.active ? "Watching" : "Paused"}
        </span>
      </div>
      <p className="font-display text-2xl leading-tight tracking-tightest text-ink relative">
        {productRuleTitle(rule.plainText)}
      </p>
      <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-ink-muted">
        <div>
          <dt className="label">Source</dt>
          <dd className="text-ink truncate">{shortUrl(rule.eventSpec.url)}</dd>
        </div>
        <div>
          <dt className="label">Trigger</dt>
          <dd className="text-ink num">
            {rule.eventSpec.selector || "value"} {COMPARATOR_SYMBOL[rule.eventSpec.comparator]} {rule.eventSpec.threshold.toString()}
          </dd>
        </div>
        <div>
          <dt className="label">Acts on</dt>
          <dd className="text-ink">{domainLabel(rule.actionSpec.domain)}</dd>
        </div>
        <div>
          <dt className="label">Cap per fire</dt>
          <dd className="text-ink num">{STTLabel(rule.actionSpec.value)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 relative">
        <Link
          to={`/receipts?rule=${rule.id.toString()}`}
          className="btn-ghost text-sm"
        >
          See receipts
        </Link>
        <button
          type="button"
          onClick={onClick}
          disabled={status === "pending"}
          className="btn-primary text-sm"
        >
          {status === "pending" ? "Triggering…" : "Trigger now"}
        </button>
      </div>
      {error && <p className="text-sm text-signal-rose">{error}</p>}
      {txHash && (
        <p className="text-xs num text-ink-muted truncate">
          Trigger tx <a className="text-brand-deep underline" target="_blank" rel="noreferrer"
            href={`https://shannon-explorer.somnia.network/tx/${txHash}`}>{txHash.slice(0, 14)}…</a>
        </p>
      )}
    </motion.div>
  );
}

function shortUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url || "n/a";
  }
}

