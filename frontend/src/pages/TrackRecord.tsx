import { useMemo } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { FadeUp, Section } from "@/components/Section";
import { useTotals, useRuleRecords } from "@/hooks/useTrackRecord";
import { useRules } from "@/hooks/useRules";
import { Link } from "react-router-dom";
import { productRuleTitle } from "@/lib/rules";

export function TrackRecordPage() {
  const { isConnected } = useAccount();
  const { totals, isLoading: totalsLoading, error: totalsError, refetch: refetchTotals } = useTotals();
  const { rules, isLoading: rulesLoading, error: rulesError, refetch: refetchRules } = useRules();
  // Stabilise the id array so useRuleRecords does not get a new reference every render.
  const ruleIds = useMemo(() => rules.map((r) => r.id), [rules]);
  const { records } = useRuleRecords(ruleIds);
  const isLoading = totalsLoading || rulesLoading;
  const chainError = totalsError || rulesError;

  const accuracyOverall = useMemo(() => {
    try {
      const s = totals.settled ?? 0n;
      const rb = totals.rolledBack ?? 0n;
      const outcomes = s + rb;
      if (outcomes === 0n) return 0;
      return Number((s * 10000n) / outcomes) / 100;
    } catch {
      return 0;
    }
  }, [totals]);

  return (
    <Section className="py-10 md:py-14">
      <div className="mb-10 max-w-3xl">
        <span className="pill pill-brand mb-2">Track record</span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none">
          Onward earns its trust ceiling.
        </h1>
        <p className="text-ink-muted mt-2">
          Every settled action raises the cap. Every rollback shrinks it. Trust is a number anyone can read.
        </p>
      </div>

      {chainError && (
        <div className="card p-5 mb-8 border-signal-rose/30 bg-signal-rose/5 flex items-center justify-between gap-3">
          <span className="text-signal-rose text-sm">Could not load chain data. {chainError.message?.slice(0, 120)}</span>
          <button className="btn-ghost text-sm" onClick={() => { refetchTotals(); refetchRules(); }}>Retry</button>
        </div>
      )}

      {isLoading && rules.length === 0 && (
        <div className="card p-6 mb-8 flex items-center gap-3 text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse shrink-0" />
          Reading chain data…
        </div>
      )}

      <FadeUp>
        <div className="grid md:grid-cols-4 gap-5 mb-10">
          <Big label="Evaluations" value={(totals.evaluations ?? 0n).toString()} />
          <Big label="Settled" value={(totals.settled ?? 0n).toString()} tone="mint" />
          <Big label="Rolled back" value={(totals.rolledBack ?? 0n).toString()} tone="rose" />
          <Big label="Accuracy" value={`${accuracyOverall.toFixed(1)}%`} tone="brand" />
        </div>
      </FadeUp>

      <FadeUp>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[540px]">
              <div className="grid grid-cols-12 px-6 py-4 border-b border-ink/5 text-xs uppercase tracking-widest text-ink-muted">
                <div className="col-span-1">Rule</div>
                <div className="col-span-5">Plain text</div>
                <div className="col-span-2 text-right">Settled</div>
                <div className="col-span-2 text-right">Rolled back</div>
                <div className="col-span-2 text-right">Accuracy</div>
              </div>
              {rules.length === 0 ? (
                <div className="p-6 text-ink-muted">
                  {isConnected ? "Arm a rule to start building track record." : "Connect to see your rule track record."}
                </div>
              ) : (
                rules.map((r) => {
                  const rec = records.find((x) => x.ruleId === r.id);
                  const acc = rec ? Number(rec.accuracyBps) / 100 : 0;
                  return (
                    <motion.div
                      key={r.id.toString()}
                      layout
                      className="grid grid-cols-12 px-6 py-5 border-b border-ink/5 items-center hover:bg-paper-warm/40"
                    >
                      <div className="col-span-1 num text-ink-muted">#{r.id.toString()}</div>
                      <div className="col-span-5 pr-3">
                        <Link to={`/receipts?rule=${r.id.toString()}`} className="font-display text-lg leading-tight hover:text-brand-deep">
                          {productRuleTitle(r.plainText)}
                        </Link>
                      </div>
                      <div className="col-span-2 text-right num">{rec?.settled.toString() ?? "0"}</div>
                      <div className="col-span-2 text-right num">{rec?.rolledBack.toString() ?? "0"}</div>
                      <div className="col-span-2 text-right">
                        <span className="pill pill-brand num">{acc.toFixed(1)}%</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </FadeUp>
    </Section>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone?: "mint" | "rose" | "brand" }) {
  const accent = tone === "mint" ? "text-signal-mint" : tone === "rose" ? "text-signal-rose" : tone === "brand" ? "text-brand-deep" : "text-ink";
  return (
    <div className="card p-6">
      <span className="label">{label}</span>
      <p className={`font-display text-4xl mt-1 tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}
