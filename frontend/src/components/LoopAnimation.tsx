import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  { id: "rule", label: "Rule armed", body: "Plain English" },
  { id: "read", label: "Agent reads", body: "Validator consensus" },
  { id: "act", label: "Vault acts", body: "Pending on chain" },
  { id: "proof", label: "Receipt", body: "Auditable forever" }
];

export function LoopAnimation() {
  const reduced = useReducedMotion();
  return (
    <div className="card relative p-8 md:p-10 overflow-hidden">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-signal-mint/10 blur-3xl" />

      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-5">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-ink/5 bg-paper/40 p-5 flex flex-col gap-2 relative"
          >
            <span className="num text-xs text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-display text-xl text-ink leading-tight">{s.label}</span>
            <span className="text-sm text-ink-muted">{s.body}</span>
            {i < STEPS.length - 1 && (
              <motion.span
                aria-hidden
                className="hidden md:block absolute top-1/2 right-[-22px] h-[2px] w-10 bg-brand/60 rounded"
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 + 0.2, duration: 0.4 }}
              />
            )}
          </motion.div>
        ))}
      </div>

      <div className="relative mt-8 flex items-center gap-4">
        <motion.span
          className="h-2 w-2 rounded-full bg-signal-mint"
          animate={reduced ? {} : { opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        />
        <span className="text-sm text-ink-muted">
          Live on Somnia testnet · Validator signed reads · No off chain bot, no key custody
        </span>
      </div>
    </div>
  );
}
