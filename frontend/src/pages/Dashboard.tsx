import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FadeUp, Section } from "@/components/Section";
import { useVaultBalances, useDeposit, useWithdraw } from "@/hooks/useVault";
import { useRules } from "@/hooks/useRules";
import { useTotals } from "@/hooks/useTrackRecord";
import { useReceipts } from "@/hooks/useReceipts";
import { RuleCard } from "@/components/RuleCard";
import { ReceiptCard } from "@/components/ReceiptCard";
import { Modal } from "@/components/Modal";
import { STT, STTLabel, parseSTT, shortAddr } from "@/lib/format";
import { explorerTx } from "@/config/chain";
import { CONTRACTS } from "@/config/contracts";
import { WalletPill } from "@/components/WalletPill";

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: native } = useBalance({ address, query: { refetchInterval: 12_000 } });
  const { balance, reserved, available, refetch: refetchVault } = useVaultBalances();
  const { rules, refetch: refetchRules } = useRules();
  const { totals } = useTotals();
  const { receipts, refetch: refetchReceipts } = useReceipts();
  const [fundOpen, setFundOpen] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<string | null>(null);

  useEffect(() => {
    if (lastTrigger) {
      const t = setTimeout(() => setLastTrigger(null), 12_000);
      return () => clearTimeout(t);
    }
  }, [lastTrigger]);

  if (!isConnected) {
    return <ConnectGate />;
  }

  return (
    <Section className="py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <span className="pill pill-brand mb-2">Your wallet</span>
          <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none">
            Your self driving wallet.
          </h1>
          <p className="text-ink-muted mt-2">
            Fund the vault, arm a rule, watch it run. Trigger any rule on demand for the demo.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/arm" className="btn-primary">Arm a rule</Link>
          <button className="btn-ghost" onClick={() => setFundOpen(true)}>Fund vault</button>
        </div>
      </div>

      <FadeUp>
        <div className="grid md:grid-cols-4 gap-5 mb-10">
          <StatCard label="Wallet" value={shortAddr(address)} sub={`${STT(native?.value)} STT in wallet`} />
          <StatCard label="Vault balance" value={`${STT(balance)} STT`} sub={`${STT(reserved)} reserved`} />
          <StatCard label="Available" value={`${STT(available)} STT`} sub="Withdrawable now" />
          <StatCard label="Evaluations" value={totals.evaluations.toString()} sub={`${totals.settled} settled · ${totals.rolledBack} rolled back`} />
        </div>
      </FadeUp>

      <FadeUp>
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-2xl md:text-3xl tracking-tight">Armed rules</h2>
          <Link to="/arm" className="text-sm text-brand-deep hover:underline">Add another →</Link>
        </div>
        {rules.length === 0 ? (
          <EmptyRules />
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {rules.map((r) => (
              <RuleCard key={r.id.toString()} rule={r} onTriggered={(h) => { setLastTrigger(h); refetchVault(); refetchReceipts(); refetchRules(); }} />
            ))}
          </div>
        )}
      </FadeUp>

      <AnimatePresence>
        {lastTrigger && (
          <motion.div
            className="fixed bottom-6 right-6 z-40 card p-4 flex items-center gap-3 max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="pill pill-mint">Submitted</span>
            <span className="text-sm">
              Evaluation in flight. The agent reads, the vault opens a pending action, the receipt
              follows.
            </span>
            <a href={explorerTx(lastTrigger)} target="_blank" rel="noreferrer" className="text-sm text-brand-deep underline">View tx</a>
          </motion.div>
        )}
      </AnimatePresence>

      <FadeUp>
        <div className="mt-12">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-2xl md:text-3xl tracking-tight">Recent receipts</h2>
            <Link to="/receipts" className="text-sm text-brand-deep hover:underline">See all →</Link>
          </div>
          {receipts.length === 0 ? (
            <div className="card p-8 text-ink-muted">
              No receipts yet. Arm a rule, hit Trigger now, and watch the first one land here.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {receipts.slice(0, 4).map((r) => (
                <ReceiptCard key={r.actionId.toString()} r={r} />
              ))}
            </div>
          )}
        </div>
      </FadeUp>

      <FundModal open={fundOpen} onClose={() => setFundOpen(false)} onDone={() => { refetchVault(); }} maxWei={native?.value ?? 0n} />
    </Section>
  );
}

function ConnectGate() {
  return (
    <Section className="py-20 md:py-32">
      <div className="card p-10 md:p-14 text-center max-w-2xl mx-auto">
        <span className="pill pill-brand mb-4">Step 01</span>
        <h1 className="font-display text-4xl tracking-tightest mb-3">Connect to start.</h1>
        <p className="text-ink-muted mb-6">
          Onward runs on Somnia testnet. Connect a browser wallet, switch to Somnia if needed, then fund the vault to arm your first rule.
        </p>
        <div className="flex items-center justify-center">
          <WalletPill />
        </div>
        <p className="num text-xs text-ink-muted mt-6">Chain id 50312 · Vault {shortAddr(CONTRACTS.Vault)}</p>
      </div>
    </Section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <span className="label">{label}</span>
      <p className="font-display text-2xl mt-1 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

function EmptyRules() {
  return (
    <div className="card p-10 md:p-14 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex-1">
        <span className="pill pill-brand mb-3">No rules yet</span>
        <h3 className="font-display text-3xl tracking-tightest mb-2">Arm your first rule in under a minute.</h3>
        <p className="text-ink-muted max-w-lg">
          Pick a template, set a threshold and a small cap, and Onward arms it on chain. Then hit Trigger now to fire an
          evaluation without waiting for the world.
        </p>
        <Link to="/arm" className="btn-primary mt-5 inline-flex">Arm a rule</Link>
      </div>
      <div className="relative rounded-2xl bg-paper-warm/60 border border-ink/5 p-5 w-full md:w-80">
        <span className="num text-xs text-ink-muted">Template</span>
        <p className="font-display text-xl leading-tight mt-1">
          When live UTC seconds drop below 60, buy a YES share with up to 0.02 STT.
        </p>
        <p className="text-xs text-ink-muted mt-3">Fires reliably. Costs cents. Good first rule.</p>
      </div>
    </div>
  );
}

function FundModal({ open, onClose, onDone, maxWei }: { open: boolean; onClose: () => void; onDone: () => void; maxWei: bigint }) {
  const [amount, setAmount] = useState("0.05");
  const { deposit, status, error, txHash, reset } = useDeposit();
  const { withdraw, status: wStatus, error: wError } = useWithdraw();
  const { available } = useVaultBalances();

  const onDeposit = async () => {
    const wei = parseSTT(amount);
    if (wei === 0n) return;
    const h = await deposit(wei);
    if (h) {
      onDone();
      setTimeout(() => { onClose(); reset(); }, 1400);
    }
  };
  const onWithdraw = async () => {
    const wei = parseSTT(amount);
    if (wei === 0n) return;
    const h = await withdraw(wei);
    if (h) {
      onDone();
      setTimeout(() => { onClose(); }, 1400);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Fund the vault">
      <p className="text-sm text-ink-muted mb-4">
        Move STT from your wallet into the Onward vault. It backs every rule and stays withdrawable
        until reserved.
      </p>
      <label className="label">Amount</label>
      <div className="flex items-center gap-2 mt-2">
        <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <span className="pill num">STT</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 text-xs text-ink-muted">
        <button className="pill" onClick={() => setAmount("0.05")}>0.05</button>
        <button className="pill" onClick={() => setAmount("0.2")}>0.2</button>
        <button className="pill" onClick={() => setAmount("1")}>1.0</button>
        <span className="ml-auto num">Wallet: {STTLabel(maxWei)}</span>
        <span className="num">Available: {STTLabel(available)}</span>
      </div>
      <div className="flex items-center justify-end gap-2 mt-6">
        <button className="btn-ghost" onClick={onWithdraw} disabled={wStatus === "pending"}>
          {wStatus === "pending" ? "Withdrawing…" : "Withdraw"}
        </button>
        <button className="btn-primary" onClick={onDeposit} disabled={status === "pending"}>
          {status === "pending" ? "Depositing…" : "Deposit"}
        </button>
      </div>
      {(error || wError) && <p className="text-sm text-signal-rose mt-3">{error || wError}</p>}
      {txHash && (
        <p className="text-xs num text-ink-muted mt-3">
          Deposit tx <a className="text-brand-deep underline" target="_blank" rel="noreferrer" href={explorerTx(txHash)}>{txHash.slice(0, 14)}…</a>
        </p>
      )}
    </Modal>
  );
}
