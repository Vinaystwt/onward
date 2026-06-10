import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Receipt } from "@/hooks/useReceipts";
import { STTLabel, relTime, shortAddr } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function ReceiptCard({ r, compact = false }: { r: Receipt; compact?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card p-5 flex flex-col gap-3 ${compact ? "" : "md:flex-row md:items-center md:gap-6"}`}
    >
      <div className="flex flex-col gap-1 min-w-[10rem]">
        <span className="label">Action</span>
        <span className="font-display text-xl tracking-tight">#{r.actionId.toString()}</span>
        <span className="text-xs text-ink-muted">Rule {r.ruleId.toString()} · {relTime(r.createdAt)}</span>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <div>
          <span className="label">Source</span>
          <p className="text-ink truncate">{r.source || "n/a"}</p>
        </div>
        <div>
          <span className="label">Decision</span>
          <p className="text-ink">{r.decision ? "Fire" : "No fire"}</p>
        </div>
        <div>
          <span className="label">Target</span>
          <p className="text-ink num truncate">{shortAddr(r.target)}</p>
        </div>
        <div>
          <span className="label">Value</span>
          <p className="text-ink num">{STTLabel(r.value)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 items-start md:items-end">
        <StatusBadge status={r.status} />
        <Link
          to={`/receipts/${r.actionId.toString()}`}
          className="text-sm text-brand-deep underline-offset-4 hover:underline"
        >
          Inspect →
        </Link>
      </div>
    </motion.div>
  );
}
