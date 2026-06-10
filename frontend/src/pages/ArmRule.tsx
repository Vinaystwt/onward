import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { FadeUp, Section } from "@/components/Section";
import { ruleTemplates, DEFAULT_LIMITS_REF, RuleTemplate } from "@/lib/ruleTemplates";
import { useArmRule } from "@/hooks/useRules";
import { useVaultBalances } from "@/hooks/useVault";
import { explorerTx } from "@/config/chain";
import { STTLabel } from "@/lib/format";
import { WalletPill } from "@/components/WalletPill";

export function ArmRule() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const [selected, setSelected] = useState<RuleTemplate>(ruleTemplates[0]);
  const [threshold, setThreshold] = useState(ruleTemplates[0].defaultThreshold);
  const [cap, setCap] = useState(ruleTemplates[0].defaultCap);
  const { arm, status, error, txHash, ruleId } = useArmRule();
  const { available } = useVaultBalances();

  const plain = useMemo(() => selected.plain(threshold, cap), [selected, threshold, cap]);

  const onSelect = (t: RuleTemplate) => {
    setSelected(t);
    setThreshold(t.defaultThreshold);
    setCap(t.defaultCap);
  };

  const onArm = async () => {
    const eventSpec = selected.buildEventSpec(threshold);
    const actionSpec = selected.buildActionSpec(cap);
    const h = await arm({
      plainText: plain,
      eventSpec,
      actionSpec,
      limitsRef: DEFAULT_LIMITS_REF
    });
    if (h) {
      setTimeout(() => navigate("/app"), 1600);
    }
  };

  if (!isConnected) {
    return (
      <Section className="py-20 md:py-32">
        <div className="card p-12 text-center max-w-lg mx-auto">
          <h1 className="font-display text-3xl tracking-tightest mb-2">Connect to arm.</h1>
          <p className="text-ink-muted mb-6">Arming a rule signs an on chain message. You need a connected wallet.</p>
          <div className="flex justify-center"><WalletPill /></div>
        </div>
      </Section>
    );
  }

  return (
    <Section className="py-10 md:py-14">
      <div className="mb-10 max-w-3xl">
        <span className="pill pill-brand mb-3">Arm a rule</span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none">
          Tell the wallet, once.
        </h1>
        <p className="text-ink-muted mt-2">
          Pick a template. Set a threshold and a cap. Onward writes the rule on chain and starts watching.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-10">
        {ruleTemplates.map((t) => {
          const active = t.id === selected.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => onSelect(t)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              className={`card text-left p-6 flex flex-col gap-2 transition relative ${active ? "ring-2 ring-brand" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`pill ${active ? "pill-brand" : ""}`}>{t.domainLabel}</span>
                {active && <span className="pill pill-mint">Selected</span>}
              </div>
              <h3 className="font-display text-xl tracking-tight">{t.title}</h3>
              <p className="text-sm text-ink-muted">{t.blurb}</p>
            </motion.button>
          );
        })}
      </div>

      <FadeUp>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card p-6 md:p-8">
            <span className="label">Plain English</span>
            <p className="font-display text-2xl md:text-3xl tracking-tightest leading-tight mt-1">{plain}</p>

            <div className="grid md:grid-cols-2 gap-5 mt-8">
              <div>
                <label className="label">Threshold ({selected.thresholdUnit})</label>
                <input
                  className="input num mt-2"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                />
                <p className="text-xs text-ink-muted mt-2">{selected.thresholdHint}</p>
              </div>
              <div>
                <label className="label">Cap per fire (STT)</label>
                <input
                  className="input num mt-2"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  inputMode="decimal"
                />
                <p className="text-xs text-ink-muted mt-2">
                  Vault available: <span className="num">{STTLabel(available)}</span>. The cap also enforces a per period limit.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted max-w-md">
                Arming signs one transaction. The rule is on chain immediately. You can pause or fire it from the dashboard.
              </p>
              <button className="btn-primary" disabled={status === "pending"} onClick={onArm}>
                {status === "pending" ? "Arming…" : "Arm rule"}
              </button>
            </div>
            {error && <p className="text-sm text-signal-rose mt-3">{error}</p>}
            {txHash && (
              <p className="text-xs num text-ink-muted mt-3">
                Arm tx <a target="_blank" rel="noreferrer" className="text-brand-deep underline" href={explorerTx(txHash)}>{txHash.slice(0, 14)}…</a>
                {ruleId !== null && <> · rule id #{ruleId.toString()}</>}
              </p>
            )}
          </div>

          <div className="card p-6 flex flex-col gap-3">
            <span className="label">What happens next</span>
            <Step n="01" label="Sign the arm tx" body="The rule lands on RuleEngine and starts watching." />
            <Step n="02" label="Hit Trigger now" body="forceEvaluate fires an agent read on demand." />
            <Step n="03" label="Receipt lands" body="Decision, source, and tx hash on chain." />
            <Step n="04" label="Challenge window" body="A fresh re read can roll back a bad call." />
          </div>
        </div>
      </FadeUp>
    </Section>
  );
}

function Step({ n, label, body }: { n: string; label: string; body: string }) {
  return (
    <div className="rounded-2xl bg-paper-warm/60 border border-ink/5 p-4">
      <span className="num text-xs text-brand-deep">{n}</span>
      <p className="font-display text-lg leading-tight mt-1">{label}</p>
      <p className="text-sm text-ink-muted">{body}</p>
    </div>
  );
}
