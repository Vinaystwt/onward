import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { LoopAnimation } from "@/components/LoopAnimation";
import { RollbackMoment } from "@/components/RollbackMoment";
import { FadeUp, Section } from "@/components/Section";
import { HERO, PILLARS, HOW_IT_WORKS } from "@/lib/copy";
import { CONTRACTS } from "@/config/contracts";
import { shortAddr } from "@/lib/format";

export function Landing() {
  const reduced = useReducedMotion();
  return (
    <div className="relative overflow-x-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[640px] bg-gradient-to-b from-brand-tint/60 via-paper to-paper pointer-events-none" />
      <div aria-hidden className="absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[680px] rounded-full bg-brand/15 blur-[120px]" />

      <Section className="relative pt-16 pb-24 md:pt-28 md:pb-32">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <motion.span
              className="pill pill-brand mb-6"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {HERO.eyebrow}
            </motion.span>
            <motion.h1
              className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tightest text-ink"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              {HERO.title}
            </motion.h1>
            <motion.p
              className="mt-6 text-lg md:text-xl text-ink-muted max-w-2xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
            >
              {HERO.sub}
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.45 }}
            >
              <Link to="/app" className="btn-primary">
                {HERO.ctaPrimary}
                <span aria-hidden>↗</span>
              </Link>
              <Link to="/docs" className="btn-ghost">{HERO.ctaSecondary}</Link>
              <span className="pill num">Vault {shortAddr(CONTRACTS.Vault)}</span>
            </motion.div>
          </div>

          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.55 }}
          >
            <HeroCard />
          </motion.div>
        </div>
      </Section>

      <Section className="pb-20">
        <FadeUp>
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display text-3xl md:text-4xl tracking-tightest">The loop, end to end.</h2>
            <Link to="/docs/how-it-works" className="text-sm text-ink-muted hover:text-ink">Read the long version →</Link>
          </div>
          <LoopAnimation />
        </FadeUp>
      </Section>

      <Section className="pb-20">
        <FadeUp>
          <RollbackMoment />
        </FadeUp>
      </Section>

      <Section className="pb-24">
        <FadeUp>
          <h2 className="font-display text-3xl md:text-4xl tracking-tightest mb-10">Why people trust it.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="card p-6 flex flex-col gap-2"
              >
                <span className="num text-xs text-ink-muted">0{i + 1}</span>
                <h3 className="font-display text-2xl leading-tight tracking-tight">{p.label}</h3>
                <p className="text-ink-muted text-sm">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </FadeUp>
      </Section>

      <Section className="pb-24">
        <FadeUp>
          <div className="card p-8 md:p-12">
            <span className="pill pill-brand mb-4">How it works</span>
            <h2 className="font-display text-3xl md:text-4xl tracking-tightest mb-8">Four moves. No magic.</h2>
            <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {HOW_IT_WORKS.map((s) => (
                <li key={s.n} className="rounded-2xl bg-paper-warm/50 border border-ink/5 p-5 flex flex-col gap-2">
                  <span className="num text-xs text-brand-deep">{s.n}</span>
                  <span className="font-display text-xl leading-tight">{s.title}</span>
                  <span className="text-sm text-ink-muted">{s.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </FadeUp>
      </Section>

      <Section className="pb-24">
        <FadeUp>
          <div className="card p-8 md:p-12 grid lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2">
              <span className="pill pill-mint mb-4">Connectors</span>
              <h2 className="font-display text-3xl md:text-4xl tracking-tightest">
                Lead with native Somnia Exchange. Reference venues for prediction and lending.
              </h2>
              <p className="mt-4 text-ink-muted max-w-xl">
                The trading connector is a real Algebra exact input swap on Somnia Exchange. Prediction and
                lending ship as reference venues so the full loop is end to end, even with no upstream protocol.
              </p>
              <Link to="/connectors" className="btn-ghost mt-6">See connectors</Link>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <ConnectorChip label="Native trading" sub="Somnia Exchange Algebra" tone="brand" />
              <ConnectorChip label="Prediction" sub="MinimalPredictionMarket" tone="mint" />
              <ConnectorChip label="Lending" sub="MiniLendingPool" tone="amber" />
            </div>
          </div>
        </FadeUp>
      </Section>

      <Section className="pb-32">
        <FadeUp>
          <div className="card p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <motion.div
              aria-hidden
              className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl"
              animate={reduced ? {} : { scale: [1, 1.05, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative">
              <h2 className="font-display text-3xl md:text-5xl tracking-tightest max-w-2xl">
                Tell your wallet what to do once. Watch it keep doing it.
              </h2>
              <p className="text-ink-muted mt-3 max-w-xl">
                Open the app, fund a small balance, arm a template rule, and hit Trigger now. The first move is
                under two minutes.
              </p>
            </div>
            <Link to="/app" className="btn-primary relative">Open the app</Link>
          </div>
        </FadeUp>
      </Section>
    </div>
  );
}

function HeroCard() {
  const reduced = useReducedMotion();
  return (
    <div className="card p-6 md:p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4">
        <span className="pill pill-brand">Live rule</span>
        <span className="pill num text-xs">Rule #07</span>
      </div>
      <p className="font-display text-2xl leading-tight tracking-tight mb-5">
        When live UTC seconds drop below 60, buy a YES share with up to 0.02 STT.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Mini label="Source" value="timeapi.io" />
        <Mini label="Cap" value="0.02 STT" />
        <Mini label="Domain" value="Prediction" />
      </div>
      <div className="rounded-2xl bg-paper-warm/60 border border-ink/5 p-4 flex flex-col gap-3 relative">
        <Step label="Reads validator signed seconds" tone="brand" delay={0} />
        <Step label="Opens pending action in vault" tone="amber" delay={0.4} />
        <Step label="Settles, receipt posted" tone="mint" delay={0.8} />
        <motion.span
          aria-hidden
          className="absolute left-[18px] top-6 bottom-6 w-px bg-ink/10"
          initial={{ scaleY: 0, originY: 0 }}
          animate={reduced ? { scaleY: 1 } : { scaleY: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-warm/60 border border-ink/5 p-3">
      <span className="label">{label}</span>
      <p className="num text-sm mt-1">{value}</p>
    </div>
  );
}

function Step({ label, tone, delay }: { label: string; tone: "brand" | "amber" | "mint"; delay: number }) {
  const color = tone === "brand" ? "bg-brand" : tone === "amber" ? "bg-signal-amber" : "bg-signal-mint";
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45 }}
    >
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-sm">{label}</span>
    </motion.div>
  );
}

function ConnectorChip({ label, sub, tone }: { label: string; sub: string; tone: "brand" | "mint" | "amber" }) {
  const cls =
    tone === "brand" ? "bg-brand text-paper" : tone === "mint" ? "bg-signal-mint/15 text-ink" : "bg-signal-amber/15 text-ink";
  return (
    <div className={`rounded-2xl p-4 ${cls} flex flex-col`}>
      <span className="font-display text-lg leading-tight">{label}</span>
      <span className="text-xs opacity-80">{sub}</span>
    </div>
  );
}
