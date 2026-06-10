import { ReactNode } from "react";
import { motion } from "framer-motion";

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`max-w-7xl mx-auto px-4 sm:px-6 ${className}`}>{children}</section>
  );
}

export function FadeUp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
