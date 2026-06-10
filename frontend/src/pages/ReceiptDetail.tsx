import { useParams, Link } from "react-router-dom";
import { usePublicClient } from "wagmi";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { FadeUp, Section } from "@/components/Section";
import { useReceipt } from "@/hooks/useReceipts";
import { useChallenge, useSettle } from "@/hooks/useChallenge";
import { useVaultBalances } from "@/hooks/useVault";
import { StatusBadge } from "@/components/StatusBadge";
import { ProvenanceBadge, ProvenanceLegend } from "@/components/ProvenanceBadge";
import { FIELD_PROV, type ProvTier } from "@/lib/provenance";
import { STTLabel, shortAddr, shortHash, relTime, domainLabel } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { vaultAbi } from "@/config/abis";
import { explorerAddress, explorerTx } from "@/config/chain";

export function ReceiptDetail() {
  const { id } = useParams();
  // Guard against non-numeric ids (would throw if BigInt receives a non-integer string).
  let actionId: bigint | undefined;
  try { actionId = id ? BigInt(id) : undefined; } catch { actionId = undefined; }
  const { receipt, isLoading: receiptLoading, error, refetch } = useReceipt(actionId);
  const [pending, setPending] = useState<{ challengeDeadline: bigint; createdAt: bigint; domain: `0x${string}` } | null>(null);
  const publicClient = usePublicClient();
  const { challenge, status: cStatus, error: cError, txHash: cTx } = useChallenge();
  const { settle, status: sStatus, error: sError } = useSettle();
  const { challengeWindow } = useVaultBalances();

  useEffect(() => {
    if (!publicClient || actionId === undefined) return;
    publicClient
      .readContract({ address: CONTRACTS.Vault, abi: vaultAbi, functionName: "getPendingAction", args: [actionId] })
      .then((v: unknown) => {
        const view = v as { challengeDeadline: bigint; createdAt: bigint; domain: `0x${string}` };
        setPending({ challengeDeadline: view.challengeDeadline, createdAt: view.createdAt, domain: view.domain });
      })
      .catch(() => {});
  }, [publicClient, actionId, receipt]);

  if (!receipt) {
    return (
      <Section className="py-20">
        <div className="card p-10 flex items-center justify-between gap-4">
          {actionId === undefined ? (
            <span className="text-ink-muted">Receipt id not found in URL.</span>
          ) : error ? (
            <>
              <span className="text-signal-rose text-sm">Could not load receipt. {(error as Error).message?.slice(0, 120)}</span>
              <button className="btn-ghost text-sm" onClick={() => refetch()}>Retry</button>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse shrink-0" />
              <span className="text-ink-muted flex-1">Loading receipt…</span>
            </>
          )}
        </div>
      </Section>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const windowOpen = receipt.status === 1 && pending && Number(pending.challengeDeadline) > now;

  return (
    <Section className="py-10 md:py-14">
      <Link to="/receipts" className="text-sm text-ink-muted hover:text-ink">← All receipts</Link>
      <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <span className="pill pill-brand">Action #{receipt.actionId.toString()}</span>
          <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none mt-2">
            {receipt.decision ? "Fired." : "Did not fire."}
          </h1>
          <p className="text-ink-muted mt-2">
            Triggered from rule #{receipt.ruleId.toString()} · {relTime(receipt.createdAt)}
          </p>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      {receipt.status === 3 && (
        <FadeUp>
          <motion.div
            className="mt-6 card p-6 md:p-8 bg-signal-rose/5 border-signal-rose/30 relative overflow-hidden"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-signal-rose/15 blur-3xl" />
            <span className="pill pill-rose">Rolled back</span>
            <h2 className="font-display text-2xl mt-2">A fresh consensus reading caught it before settlement.</h2>
            <p className="text-ink-muted mt-2 max-w-2xl">
              The Somnia validator network ran a second independent read of the same source. The new consensus
              decision disagreed with the original. The vault returned the reserved funds before settlement.
              The receipt stays sealed as proof that the protocol self corrected.
            </p>
          </motion.div>
        </FadeUp>
      )}

      <FadeUp>
        {/* Provenance legend */}
        <div className="mt-8 card p-4">
          <ProvenanceLegend />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-4">
          <div className="lg:col-span-2 card p-6 md:p-8">
            <h2 className="font-display text-2xl tracking-tight mb-4">What the agent saw</h2>
            <Field label="Source" value={receipt.source || "n/a"} tier="SOURCE" />
            <Field label="Raw output" value={shortHash(receipt.rawOutput)} mono tier="SOURCE" />
            <Field label="Decision" value={receipt.decision ? "Fire" : "No fire"} tier="AGENT_INFERRED" />
            <Field label="Decision hash" value={shortHash(receipt.rawOutput)} mono tier="AGENT_INFERRED" />
            <h2 className="font-display text-2xl tracking-tight mt-8 mb-4">What the vault did</h2>
            <Field label="Domain" value={pending ? domainLabel(pending.domain) : "Pending lookup"} tier="AGENT_INFERRED" />
            <Field label="Target" tier="AGENT_INFERRED" value={
              <a className="num text-brand-deep underline" target="_blank" rel="noreferrer" href={explorerAddress(receipt.target)}>
                {shortAddr(receipt.target)}
              </a>
            } />
            <Field label="Value" value={STTLabel(receipt.value)} tier="ON_CHAIN_ENFORCED" />
            <Field label="Calldata" value={shortHash(receipt.data)} mono tier="AGENT_INFERRED" />
            <Field label="Created" value={relTime(receipt.createdAt)} tier="ON_CHAIN_ENFORCED" />
            <Field label="Updated" value={relTime(receipt.updatedAt)} tier="CONSENSUS_VERIFIED" />
            <Field label="Status" value={
              <StatusBadge status={receipt.status} />
            } tier="CONSENSUS_VERIFIED" />
          </div>

          <div className="card p-6 flex flex-col gap-3">
            <span className="label">Window</span>
            {receipt.status === 1 && pending ? (
              <>
                <p className="font-display text-3xl tracking-tight">
                  {Math.max(0, Number(pending.challengeDeadline) - now)}s
                </p>
                <p className="text-sm text-ink-muted">
                  Challenge window. While open, anyone can force a fresh consensus reading.
                </p>
                <button
                  className="btn-primary mt-3"
                  disabled={cStatus === "pending"}
                  onClick={() => challenge(receipt.actionId).then(() => refetch())}
                >
                  {cStatus === "pending" ? "Challenging…" : "Force fresh read"}
                </button>
                <button
                  className="btn-ghost"
                  disabled={!windowOpen ? false : true}
                  onClick={() => settle(receipt.actionId).then(() => refetch())}
                >
                  {sStatus === "pending" ? "Settling…" : "Settle on chain"}
                </button>
                {cError && <p className="text-sm text-signal-rose">{cError}</p>}
                {sError && <p className="text-sm text-signal-rose">{sError}</p>}
                {cTx && (
                  <p className="text-xs num text-ink-muted">
                    Challenge tx <a target="_blank" rel="noreferrer" className="text-brand-deep underline" href={explorerTx(cTx)}>{cTx.slice(0,14)}…</a>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-display text-3xl tracking-tight">{Number(challengeWindow ?? 0n)}s</p>
                <p className="text-sm text-ink-muted">Default window for this vault.</p>
              </>
            )}

            <div className="ink-divider mt-3 pt-3">
              <span className="label">Receipt stored at</span>
              <p className="text-sm text-ink-muted mt-1">
                <a className="num text-brand-deep underline" target="_blank" rel="noreferrer" href={explorerAddress(CONTRACTS.ReceiptLog)}>{shortAddr(CONTRACTS.ReceiptLog)}</a>
              </p>
            </div>
          </div>
        </div>
      </FadeUp>
    </Section>
  );
}

function Field({
  label,
  value,
  mono = false,
  tier
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tier: ProvTier;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_2fr] py-3 ink-divider first:border-t-0 first:pt-0 gap-2 items-start">
      <span className="label pt-0.5">{label}</span>
      <ProvenanceBadge tier={tier} />
      <span className={`${mono ? "num text-sm" : ""}`}>{value}</span>
    </div>
  );
}
