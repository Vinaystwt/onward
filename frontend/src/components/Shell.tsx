import { Link, NavLink, useLocation, useOutlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { WalletPill } from "./WalletPill";
import { Logo } from "./Logo";

const navItems = [
  { to: "/app", label: "App" },
  { to: "/arm", label: "Arm a rule" },
  { to: "/receipts", label: "Receipts" },
  { to: "/track", label: "Track record" },
  { to: "/connectors", label: "Connectors" },
  { to: "/docs", label: "Docs" }
];

export function Shell() {
  const loc = useLocation();
  // useOutlet captures the current route element as a snapshot.
  // We do NOT use <Outlet /> directly inside the motion.div because AnimatePresence
  // (mode="wait") keeps the exiting div alive while the live <Outlet /> would update
  // to show the NEW route — causing double-mount and crashes on navigation.
  const outlet = useOutlet();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [loc.key]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/70 border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Logo />
            <span className="font-display text-xl tracking-tightest">Onward</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `relative px-3 py-2 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isActive ? "text-ink" : "text-ink-muted hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-ink/5 rounded-full"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative">{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <WalletPill />
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-ink/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <span className="block w-5 h-px bg-current mb-1.5 transition-transform" style={{ transform: menuOpen ? "translateY(6px) rotate(45deg)" : undefined }} />
              <span className="block w-5 h-px bg-current transition-opacity" style={{ opacity: menuOpen ? 0 : 1 }} />
              <span className="block w-5 h-px bg-current mt-1.5 transition-transform" style={{ transform: menuOpen ? "translateY(-6px) rotate(-45deg)" : undefined }} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-20 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.nav
              className="absolute top-[73px] left-0 right-0 bg-paper border-b border-ink/8 px-4 py-3 flex flex-col gap-1 shadow-card"
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-3 rounded-2xl text-sm font-medium transition ${
                      isActive ? "bg-ink/5 text-ink" : "text-ink-muted hover:text-ink hover:bg-ink/3"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative">
        {/* key=loc.key forces a new motion.div per navigation so old route unmounts
            immediately — no AnimatePresence needed (avoids double-Outlet bug). */}
        <motion.div
          key={loc.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {outlet}
        </motion.div>
      </main>

      <footer className="mt-24 border-t border-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-ink-muted">
          <div className="flex items-center gap-3">
            <Logo small />
            <span className="font-display text-lg tracking-tight text-ink">Onward</span>
            <span className="pill">Somnia testnet</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link to="/docs" className="hover:text-ink transition">Docs</Link>
            <Link to="/connectors" className="hover:text-ink transition">Connectors</Link>
            <Link to="/track" className="hover:text-ink transition">Track record</Link>
            <a href="https://shannon-explorer.somnia.network" target="_blank" rel="noreferrer" className="hover:text-ink transition">Explorer</a>
          </div>
          <span className="num text-xs">Self driving wallet · v0.1</span>
        </div>
      </footer>
    </div>
  );
}
