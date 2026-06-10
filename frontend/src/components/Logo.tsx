import { motion } from "framer-motion";

export function Logo({ small = false }: { small?: boolean }) {
  const size = small ? 24 : 32;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      initial={{ rotate: -8, opacity: 0.0 }}
      animate={{ rotate: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      <defs>
        <linearGradient id="onward-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1F4BFF" />
          <stop offset="100%" stopColor="#7C9CFF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="#0B0B0F" />
      <path
        d="M9 21 L9 13 a4 4 0 0 1 4 -4 h6 a4 4 0 0 1 4 4 v8"
        stroke="url(#onward-grad)"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22.5" cy="21.5" r="2" fill="#1FC79E" />
    </motion.svg>
  );
}
