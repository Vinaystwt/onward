import { motion, useReducedMotion } from "framer-motion";

export function RollbackMoment() {
  const reduced = useReducedMotion();
  return (
    <div className="card relative overflow-hidden p-8 md:p-10">
      <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-signal-rose/15 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-signal-mint/10 blur-3xl" />
      <div className="relative grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="pill pill-rose mb-4">Self correcting</span>
          <h3 className="font-display text-3xl md:text-4xl leading-tight tracking-tightest mb-3">
            A second look that the chain itself trusts.
          </h3>
          <p className="text-ink-muted">
            Pending actions sit in a short challenge window. A fresh validator read can reach a
            different decision. When it does, Onward rolls the action back before settlement and
            the vault stays whole. When it agrees, Onward settles immediately.
          </p>
        </div>
        <div className="relative h-64">
          <motion.div
            className="absolute inset-x-8 top-6 h-14 rounded-2xl bg-paper-warm border border-ink/10 flex items-center px-5 gap-3"
            initial={{ x: -20, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
          >
            <span className="pill pill-amber">Pending</span>
            <span className="text-sm">Action #128 reserved 0.02 STT</span>
          </motion.div>
          <motion.div
            className="absolute inset-x-10 top-24 h-14 rounded-2xl bg-paper-warm border border-ink/10 flex items-center px-5 gap-3"
            initial={{ x: 20, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            viewport={{ once: true }}
          >
            <span className="pill">Re read</span>
            <span className="text-sm">Validators disagree with the first call</span>
          </motion.div>
          <motion.div
            className="absolute inset-x-6 top-44 h-14 rounded-2xl bg-signal-mint/15 border border-signal-mint/40 flex items-center px-5 gap-3"
            initial={{ y: 14, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            viewport={{ once: true }}
          >
            <motion.span
              className="pill pill-mint"
              animate={reduced ? {} : { scale: [1, 1.05, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Rolled back
            </motion.span>
            <span className="text-sm">Funds returned. Receipt sealed.</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
