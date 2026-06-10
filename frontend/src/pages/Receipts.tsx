import { useSearchParams, Link } from "react-router-dom";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { FadeUp, Section } from "@/components/Section";
import { useReceipts } from "@/hooks/useReceipts";
import { ReceiptCard } from "@/components/ReceiptCard";
import { WalletPill } from "@/components/WalletPill";
import { ProvenanceLegend } from "@/components/ProvenanceBadge";

export function Receipts() {
  const [params] = useSearchParams();
  const ruleParam = params.get("rule");
  const ruleId = ruleParam ? BigInt(ruleParam) : undefined;
  const { receipts, isLoading, error, refetch } = useReceipts({ ruleId });
  const { isConnected } = useAccount();

  const grouped = useMemo(() => {
    const groups: Record<string, typeof receipts> = { Pending: [], Settled: [], "Rolled back": [], Other: [] };
    receipts.forEach((r) => {
      const bucket = r.status === 1 ? "Pending" : r.status === 2 ? "Settled" : r.status === 3 ? "Rolled back" : "Other";
      groups[bucket].push(r);
    });
    return groups;
  }, [receipts]);

  return (
    <Section className="py-10 md:py-14">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="pill pill-brand mb-2">Receipts</span>
          <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none">
            Every move on chain, with its reasons.
          </h1>
          <p className="text-ink-muted mt-2">
            Each receipt links the agent read to the on chain action and the final state.
          </p>
        </div>
        {!isConnected && <WalletPill />}
      </div>

      {/* Provenance legend + proof link */}
      <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <ProvenanceLegend />
        <Link to="/docs/challenge" className="text-xs text-brand-deep hover:underline shrink-0">
          Live rollback proof →
        </Link>
      </div>

      {ruleId !== undefined && (
        <div className="mb-6"><span className="pill pill-brand num">Filter · rule #{ruleId.toString()}</span></div>
      )}

      {error && (
        <div className="card p-6 border-signal-rose/30 bg-signal-rose/5 text-signal-rose flex items-center justify-between gap-3 mb-6">
          <span>Could not load receipts. {error.message.slice(0, 160)}</span>
          <button className="btn-ghost" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!error && receipts.length === 0 && (
        <div className="card p-10 text-ink-muted">
          {isLoading
            ? "Reading the receipt log…"
            : ruleId !== undefined
              ? "No receipts for this rule yet. Hit Trigger now from the dashboard to fire one."
              : isConnected
                ? "No receipts yet. Fund the vault, arm a rule, and trigger it to see your first receipt land here."
                : "Connect your wallet to load receipts for it."}
        </div>
      )}

      <FadeUp>
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([label, list]) =>
            list.length === 0 ? null : (
              <div key={label}>
                <h2 className="font-display text-2xl tracking-tight mb-3">{label} <span className="text-ink-muted text-base">· {list.length}</span></h2>
                <div className="flex flex-col gap-3">
                  {list.map((r) => (
                    <ReceiptCard key={r.actionId.toString()} r={r} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </FadeUp>
    </Section>
  );
}
