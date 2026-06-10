import { motion } from "framer-motion";

export function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <motion.div
        className="card p-10 flex items-center gap-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />
        <span className="text-ink-muted">Loading screen…</span>
      </motion.div>
    </div>
  );
}
