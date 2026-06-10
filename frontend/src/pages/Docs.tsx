import { NavLink, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Section } from "@/components/Section";
import { CONTRACTS, CONTRACT_PURPOSES, AGENT_IDS } from "@/config/contracts";
import { explorerAddress } from "@/config/chain";
import { shortAddr } from "@/lib/format";
import { FAQ, SAFETY_BULLETS } from "@/lib/copy";
import type { ReactNode } from "react";
import proofData from "../../../rollback-proof.json";

// ── Responsive diagram with caption ─────────────────────────────────────────
function DocDiagram({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-8">
      <div className="rounded-2xl border border-ink/10 bg-paper-warm/40 p-2 md:p-4">
        <img
          src={src}
          alt={alt}
          className="w-full h-auto rounded-xl max-w-[680px] mx-auto block"
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="mt-3 text-sm text-ink-muted text-center">{caption}</figcaption>
    </figure>
  );
}

// ── Rollback proof timeline helpers ─────────────────────────────────────────
const EXPLORER = "https://shannon-explorer.somnia.network";

function shortTx(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

type ProofStepProps = {
  index?: number;
  label: string;
  detail?: string;
  txHash?: string;
  tone?: "brand" | "mint" | "rose" | "amber" | "neutral";
};

function ProofStep({ index, label, detail, txHash, tone = "neutral" }: ProofStepProps) {
  const dot =
    tone === "brand" ? "bg-brand" :
    tone === "mint"  ? "bg-signal-mint" :
    tone === "rose"  ? "bg-signal-rose" :
    tone === "amber" ? "bg-signal-amber" :
    "bg-ink/20";
  return (
    <div className="flex gap-3 min-w-0">
      <div className="flex flex-col items-center shrink-0">
        <span className={`h-2.5 w-2.5 rounded-full mt-1.5 ${dot}`} />
        <span className="w-px flex-1 bg-ink/8 mt-1" />
      </div>
      <div className="pb-5 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="num text-xs text-ink-muted shrink-0">0{index}</span>
          <span className="font-display text-base leading-tight">{label}</span>
        </div>
        {detail && <p className="text-sm text-ink-muted mt-0.5">{detail}</p>}
        {txHash && (
          <a
            href={`${EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="num text-xs text-brand-deep underline-offset-2 hover:underline mt-1 inline-block"
          >
            {shortTx(txHash)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function ProofTimeline({
  title,
  outcome,
  steps
}: {
  title: string;
  outcome: "rolled back" | "settled";
  steps: ProofStepProps[];
}) {
  const outTone = outcome === "rolled back" ? "rose" : "mint";
  const outLabel = outcome === "rolled back"
    ? "Rolled back. Reserved funds returned."
    : "Settled. Action executed on venue.";
  return (
    <div className="card p-6 md:p-7">
      <div className="flex items-center gap-2 mb-5">
        <span className={`pill ${outcome === "rolled back" ? "pill-rose" : "pill-mint"}`}>{outcome}</span>
        <span className="font-display text-xl tracking-tight">{title}</span>
      </div>
      <div className="relative">
        {steps.map((s, i) => (
          <ProofStep key={i} {...s} index={i + 1} />
        ))}
        <div className={`flex gap-3`}>
          <div className="flex flex-col items-center shrink-0">
            <span className={`h-2.5 w-2.5 rounded-full mt-1.5 ${outTone === "rose" ? "bg-signal-rose" : "bg-signal-mint"}`} />
          </div>
          <p className={`text-sm font-medium pb-2 ${outTone === "rose" ? "text-signal-rose" : "text-[#0A6F55]"}`}>
            {outLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar sections ─────────────────────────────────────────────────────────
const sections = [
  { id: "about", label: "About" },
  { id: "how-it-works", label: "How it works" },
  { id: "challenge", label: "Self correcting challenge" },
  { id: "architecture", label: "Architecture" },
  { id: "features", label: "Features" },
  { id: "connectors", label: "Connectors" },
  { id: "safety", label: "Safety" },
  { id: "contracts", label: "Smart contracts" },
  { id: "faq", label: "FAQ" },
  { id: "roadmap", label: "Roadmap" }
];

export function Docs() {
  const { section } = useParams();
  const active = section ?? "about";
  return (
    <Section className="py-10 md:py-14">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6 lg:gap-10">
        <aside className="lg:sticky lg:top-24 self-start min-w-0">
          <span className="pill pill-brand mb-3">Docs</span>
          {/* On mobile: horizontal scrolling pill nav. On desktop: vertical sidebar. */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {sections.map((s) => (
              <NavLink
                key={s.id}
                to={`/docs/${s.id}`}
                className={({ isActive }) => {
                  const on = isActive || (s.id === "about" && active === "about");
                  return `text-sm px-3 py-2 rounded-xl transition whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    on ? "bg-ink/5 text-ink font-medium" : "text-ink-muted hover:text-ink"
                  }`;
                }}
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 lg:mt-8 rounded-2xl bg-paper-warm/60 border border-ink/5 p-4 text-xs text-ink-muted hidden lg:block">
            <p className="font-display text-sm text-ink mb-1">Live on Somnia testnet</p>
            <p>Chain id 50312 · STT for gas</p>
            <p className="num mt-2">Vault {shortAddr(CONTRACTS.Vault)}</p>
          </div>
        </aside>

        <article className="max-w-3xl min-w-0">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {active === "about" && <About />}
            {active === "how-it-works" && <HowItWorks />}
            {active === "challenge" && <ChallengeDoc />}
            {active === "architecture" && <Architecture />}
            {active === "features" && <Features />}
            {active === "connectors" && <ConnectorsDoc />}
            {active === "safety" && <Safety />}
            {active === "contracts" && <ContractsDoc />}
            {active === "faq" && <FaqDoc />}
            {active === "roadmap" && <RoadmapDoc />}
          </motion.div>
        </article>
      </div>
    </Section>
  );
}

// ── Doc primitives ───────────────────────────────────────────────────────────
function H({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none mb-4">{children}</h1>;
}
function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl tracking-tight mt-12 mb-3">{children}</h2>;
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-xl tracking-tight mt-8 mb-2">{children}</h3>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-ink/90 leading-relaxed mb-4">{children}</p>;
}
function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-ink/90 mb-4">
      {items.map((i, idx) => <li key={idx}>{i}</li>)}
    </ul>
  );
}
function Note({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "mint" | "amber" }) {
  const cls = tone === "brand" ? "pill-brand" : tone === "mint" ? "pill-mint" : "pill-amber";
  return (
    <div className="card p-5 my-5 flex gap-3">
      <span className={`pill ${cls} shrink-0 mt-0.5`}>Note</span>
      <p className="text-sm text-ink/90 leading-relaxed">{children}</p>
    </div>
  );
}

// ── About ────────────────────────────────────────────────────────────────────
function About() {
  return (
    <>
      <H>About Onward</H>
      <P>
        Onward is a self driving wallet on the Somnia blockchain. The user writes one sentence in
        plain English. Onward turns that sentence into an on chain trigger: a Somnia validator
        subcommittee reads an external source by consensus, the vault acts on the consensus
        result, and the challenge mechanism can run a fresh consensus reading before settlement
        to catch a disagreement and roll the action back.
      </P>

      <H2>The problem</H2>
      <P>
        Acting on external conditions in crypto is a job for a person who never sleeps. Prices
        move at three in the morning. Elections settle on the wrong continent. A funding rate
        flips for an hour and the moment passes. Anyone who has tried to automate this has felt
        the same two pains.
      </P>
      <P>
        First, off chain bots are fragile. They lose state, get rate limited, get gamed by a
        malicious upstream, and need a private key that lives in a server somewhere. Second, even
        when the bot works, the user can never quite trust it, because no one outside the operator
        can see what the bot saw or why it acted. The audit log lives in a database the operator
        owns.
      </P>
      <P>
        The result is a quiet ceiling on what autonomous money can do. The interesting strategies
        are exactly the ones that require trust, and trust is exactly what off chain automation
        cannot deliver.
      </P>

      <H2>What Onward does</H2>
      <P>
        Onward moves the agent on chain. Somnia validators run the read inside the consensus
        protocol and must agree on what they fetched. The vault opens a pending action, a short
        challenge window allows a fresh consensus reading to catch a disagreement before
        settlement, and only then does the action execute. Every move carries a receipt that
        anyone can audit, on the same chain that signed it.
      </P>
      <P>
        The user never gives up custody. The vault holds STT under their address. Each rule has
        a per fire cap, a per period cap, and a trust ceiling that scales with track record.
        Withdraw is always one click, on chain, on demand.
      </P>

      <H2>Who it is for</H2>
      <UL items={[
        "Retail users who want their wallet to do one thing very well. Buy a dip. Take a profit. Move into a yield position when an index closes above a level. Hedge into stables when funding goes wild.",
        "DAOs and treasuries that need on chain proof of every move, not a spreadsheet from an operations contractor. The receipt is the audit.",
        "On chain funds and market makers that already think in rules and want a custody safe execution layer that can also defend a bad call.",
        "Builders who want to compose a self driving primitive into a bigger product. Onward exposes adapters that route to any venue."
      ]} />

      <H2>The vision</H2>
      <P>
        The end state is a wallet that does what you would do, if you were paying attention all
        the time, and proves to anyone who looks that it never did anything else. Onward is the
        first product that gets to argue this is possible, because the Somnia consensus AI
        primitive is the first chain feature that makes the on chain fresh reading and pre settlement
        rollback possible.
      </P>
    </>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <>
      <H>How it works</H>
      <P>
        Onward is a four step loop. Each step happens on chain, in order. No off chain worker
        sits between any two of them.
      </P>

      <DocDiagram
        src="/onward-loop.svg"
        alt="Four step on chain loop: arm rule, agent reads by consensus, vault opens pending action, receipt and challenge settle"
        caption="The loop runs entirely on chain. No off chain worker sits between any two steps."
      />

      <H2>Step one. Arm a rule</H2>
      <P>
        The user picks a template, sets a threshold and a cap, and signs one transaction. The
        RuleEngine contract stores the plain text, the event spec, and the action spec. The
        PolicyLimits contract attaches a per fire cap and a per period cap referenced by the
        rule. A unique rule id is emitted and watched by the dashboard.
      </P>
      <P>
        Plain text is required, not optional. Every receipt later carries it. A receipt that
        cannot be explained to a non technical reader is not a useful receipt.
      </P>

      <H2>Step two. Validators fetch and reach consensus</H2>
      <P>
        When the dashboard hits Trigger now, or any external scheduler calls
        <code className="num"> evaluate</code> on the rule, the AgentExecutor creates a request on
        the Somnia agent platform. The request names an agent kind. The kinds Onward uses today are
        a JSON URL reader, a parsing agent, and an inference agent.
      </P>
      <P>
        A subcommittee of Somnia validators picks up the request. Each validator fetches the
        configured external URL independently, signs its result, and submits it back to the chain.
        The chain reaches consensus on a single canonical reading and posts it as the response.
        The AgentExecutor's <code className="num"> handleResponse</code> is then invoked as an
        asynchronous callback.
      </P>
      <P>
        The crucial property is that the reading is part of block consensus. No single off chain
        worker can substitute a different value. The validators must agree, and their agreement is
        part of the block. This is what replaces a trusted single party oracle.
      </P>

      <Note>
        The agent platform on Somnia testnet is at
        <span className="num"> 0x037B…6776</span>. The Onward AgentExecutor sets the JSON URL
        agent id from <code className="num">deployments-v3.json</code> at deploy time so the rule
        templates and the executor agree.
      </Note>

      <H2>Step three. Vault opens a pending action</H2>
      <P>
        If the consensus read clears the rule's threshold, the AgentExecutor asks the right
        adapter to encode the venue call, then calls the Vault. The Vault reserves the per fire
        cap, opens a pending action with a challenge deadline, and asks the ReceiptLog to write a
        fresh receipt. Nothing has actually moved on the venue yet. The funds sit reserved.
      </P>

      <H2>Step four. Receipt, challenge, settle</H2>
      <P>
        The challenge window is short by design. Anyone, including the user and watchers, can
        call <code className="num">Challenge.challenge</code> on the open action. The contract
        opens a fresh consensus read of the same source. If the new consensus result agrees with
        the original, the Vault settles the action immediately. If it disagrees, the Vault rolls
        it back and marks the receipt as RolledBack. If no one challenges, the window expires and
        anyone can call <code className="num">settle</code> directly.
      </P>
      <P>
        Either way the receipt is permanent. The source, the raw output, the decision hash, the
        target, the value, and the final status are all on chain. Every receipt on Onward links to
        Shannon explorer, so the audit is one click from the action.
      </P>

      <H2>Why consensus reading and not a traditional oracle</H2>
      <P>
        A traditional oracle reports a value. It cannot run the same read again on demand under
        the same trust assumptions. The Onward challenge calls a fresh Somnia consensus reading
        against the original event spec. If the consensus result disagrees, the vault rolls back
        before settlement. That combination, a protocol native reading and a pre settlement rollback,
        is not possible with an off chain operator or a push oracle.
      </P>

      <H2>Agent ids</H2>
      <pre className="num text-xs bg-paper-warm/70 border border-ink/5 rounded-2xl p-4 overflow-x-auto">
{Object.entries(AGENT_IDS).map(([k, v]) => `${k.padEnd(22)} ${v}`).join("\n")}
      </pre>
    </>
  );
}

// ── Self correcting challenge ────────────────────────────────────────────────
const rb = proofData.rollback;
const st = proofData.settle;

function ChallengeDoc() {
  return (
    <>
      <H>The self correcting challenge</H>
      <P>
        A self driving wallet is only safe if it can roll back a wrong action before it settles.
        The challenge mechanism does this without any human in the loop: any party calls it, the
        Somnia network runs a fresh consensus reading of the same source, and the vault acts on
        the new result immediately.
      </P>

      <DocDiagram
        src="/onward-challenge.svg"
        alt="Challenge sequence: any party calls challenge, contract opens a fresh consensus agent request, validators return a new decision, vault settles or rolls back"
        caption="Two outcomes only. Consensus agrees: settles. Consensus disagrees: rolls back and returns reserved funds."
      />

      <H2>The window</H2>
      <P>
        Every pending action carries a deadline equal to <code className="num">createdAt + challengeWindow</code>.
        While the window is open, the action sits in the vault with funds reserved but not yet
        sent to the venue. The deadline is configurable per deployment. The current testnet uses
        a window long enough for a fresh consensus request to complete and short enough that the
        user feels the action settle within a few minutes.
      </P>

      <H2>Opening a challenge</H2>
      <P>
        Any address can call <code className="num">Challenge.challenge(actionId)</code> with a
        deposit equal to the agent platform's required deposit plus the per agent budget for the
        subcommittee. The contract then opens a fresh consensus request that mirrors the original
        rule's event spec but runs in a completely independent validator execution.
      </P>

      <H2>Resolution</H2>
      <UL items={[
        "Agreed. The fresh consensus decision hash matches the original. The Vault settles the action immediately, before the natural window would have expired. The receipt is marked Settled.",
        "Disagreed. The fresh consensus decision hash does not match. The Vault rolls the action back, returns the reserved STT to the available balance, and marks the receipt RolledBack. The challenger is rewarded by the platform.",
        "Inconclusive. The fresh request times out or fails to reach quorum. Nothing changes. The natural window keeps ticking. Anyone can challenge again or wait for the window to expire."
      ]} />

      <H2>Why consensus reading is the right primitive</H2>
      <P>
        For the challenge to be trustworthy, the second read must be independent and must carry
        the same trust weight as the first. Off chain bots can rerun a read but they cannot prove
        they did it honestly. A traditional push oracle cannot rerun the same read on demand.
        Only Somnia's consensus AI gives the contract a way to ask the same question again under
        the same validator quorum assumptions and to act on the answer atomically. That is the
        only design where the chain can enforce a pre settlement rollback without an off chain
        operator.
      </P>

      <H2>Live rollback proof</H2>
      <P>
        Both sequences below were executed on Somnia testnet and are permanently recorded on
        chain. Every transaction exists and succeeded. The wallet is{" "}
        <span className="num text-sm break-all">{proofData.wallet}</span>. Each tx hash is a live link to
        Shannon explorer.
      </P>

      <div className="grid md:grid-cols-2 gap-5 my-6">
        <ProofTimeline
          title="Source changed. Rolled back."
          outcome="rolled back"
          steps={[
            {
              label: "Arm rule",
              detail: `"${rb.ruleText.slice(0, 72)}…"`,
              txHash: rb.sequence[0].txHash,
              tone: "neutral"
            },
            {
              label: "Evaluate: first consensus read",
              detail: `Source returned ${rb.firstRead.value}. Decision: ${rb.firstRead.decision ? "fire" : "no fire"}. Action opened.`,
              txHash: rb.sequence[2].txHash,
              tone: "brand"
            },
            {
              label: "Source updated",
              detail: `Owner changed source from ${rb.stateChange.beforeValue} to ${rb.stateChange.afterValue} via HTTP PUT.`,
              tone: "amber"
            },
            {
              label: "Challenge called",
              detail: "Fresh consensus reading requested.",
              txHash: rb.sequence[3].txHash,
              tone: "neutral"
            },
            {
              label: "Challenge resolved: disagreed",
              detail: `Fresh reading returned ${rb.reread.value}. Decision: ${rb.reread.decision ? "fire" : "no fire"}. Disagreed with original.`,
              txHash: rb.sequence[4].txHash,
              tone: "rose"
            }
          ]}
        />

        <ProofTimeline
          title="Source unchanged. Settled."
          outcome="settled"
          steps={[
            {
              label: "Arm rule",
              detail: `"${st.ruleText.slice(0, 72)}…"`,
              txHash: st.sequence[0].txHash,
              tone: "neutral"
            },
            {
              label: "Evaluate: first consensus read",
              detail: `Source returned ${st.firstRead.value}. Decision: ${st.firstRead.decision ? "fire" : "no fire"}. Action opened.`,
              txHash: st.sequence[2].txHash,
              tone: "brand"
            },
            {
              label: "No source change",
              detail: "Source value remained at 1.",
              tone: "neutral"
            },
            {
              label: "Challenge called",
              detail: "Fresh consensus reading requested.",
              txHash: st.sequence[3].txHash,
              tone: "neutral"
            },
            {
              label: "Challenge resolved: agreed",
              detail: `Fresh reading returned ${st.reread.value}. Decision: ${st.reread.decision ? "fire" : "no fire"}. Agreed with original.`,
              txHash: st.sequence[4].txHash,
              tone: "mint"
            }
          ]}
        />
      </div>

      <Note tone="mint">
        Both final receipts are on chain at ReceiptLog{" "}
        <span className="num">{shortAddr(CONTRACTS.ReceiptLog)}</span>. Action{" "}
        {rb.finalOutcome.actionId} is RolledBack. Action {st.finalOutcome.actionId} is Settled.
        Read them with <code className="num">ReceiptLog.getReceipt(id)</code> or inspect them in
        Shannon explorer.
      </Note>
    </>
  );
}

// ── Architecture ─────────────────────────────────────────────────────────────
function Architecture() {
  return (
    <>
      <H>Architecture</H>
      <P>
        Onward is nine small contracts that together act as a wallet that drives itself. Every
        line of behavior lives in the contracts. There is no off chain worker, no relayer service,
        no API key in a vault somewhere.
      </P>

      <DocDiagram
        src="/onward-architecture.svg"
        alt="Nine contract architecture: RuleEngine connects to AgentExecutor and PolicyLimits. AgentExecutor calls back to Vault. Vault connects to ReceiptLog and TrackRecord. AdapterRegistry routes to trading, prediction, and lending adapters."
        caption="Nine contracts, each with one job. Every line of behavior is on chain."
      />

      <H2>The core</H2>
      <UL items={[
        <><b>RuleEngine.</b> Stores rules. Emits the events the dashboard listens to. Calls the AgentExecutor when a rule is evaluated.</>,
        <><b>AgentExecutor.</b> Wraps the Somnia agent platform. Builds the request payload, opens the consensus request, handles the async callback, and decides whether to ask the Vault to open a pending action.</>,
        <><b>Vault.</b> Custody for STT and the home of all pending actions. Reserves balance on open, settles or rolls back on close.</>,
        <><b>Challenge.</b> Opens a fresh consensus request against an open action. Settles or rolls back based on the new consensus result.</>,
        <><b>PolicyLimits.</b> Per rule maximum spend, per period rate, and the trust ceiling that scales with the chain wide settled vs rolled back ratio.</>,
        <><b>ReceiptLog.</b> Writes the receipt at open time, updates the status on close. Indexes receipts by rule and by wallet.</>,
        <><b>TrackRecord.</b> Counts evaluations, settlements, rollbacks, and failures per rule and overall. The trust ceiling reads from here.</>,
        <><b>Registry.</b> Lookup for supported event and action types.</>,
        <><b>AdapterRegistry.</b> Maps a domain (trading, prediction, lending) to the adapter that knows how to encode an action for that domain.</>
      ]} />

      <H2>The adapters and venues</H2>
      <P>
        Every venue Onward acts on is reached through a small <code className="num">IVenueAdapter</code>
        contract. The adapter encodes the call data and points at the target. The Vault is the
        only address that ever calls the venue.
      </P>
      <UL items={[
        <><b>NativeAlgebraTradingAdapter.</b> Encodes an Algebra exact input swap against the native Somnia Exchange router. This is the live, third party connector.</>,
        <><b>PredictionMarketAdapter and MinimalPredictionMarket.</b> Reference venue. Real YES and NO balance accounting, real settlement.</>,
        <><b>LendingAdapter and MiniLendingPool.</b> Reference venue. Real supply accounting, no third party protocol.</>
      ]} />

      <H2>The agent platform</H2>
      <P>
        The Somnia agent platform exposes a tiny interface: a caller pays a deposit and asks a
        named agent to run. The validator subcommittee returns a signed result. Onward speaks this
        interface through <code className="num">AgentCodec</code>, which builds the payload and
        decodes the consensus response into a yes or no decision plus a stable decision hash.
      </P>
    </>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────
function Features() {
  return (
    <>
      <H>Features</H>
      <UL items={[
        <><b>Plain English rules.</b> Three templates ship in the app today. Custom rules expose the full event spec and action spec.</>,
        <><b>Trigger now.</b> Fire any rule on demand from the dashboard. No waiting for external conditions.</>,
        <><b>Three connectors.</b> Native Algebra trading on Somnia Exchange, reference prediction venue, reference lending venue.</>,
        <><b>On chain receipts.</b> Source, raw output, decision, target, value, status. Linked to Shannon explorer.</>,
        <><b>Self correcting challenge.</b> Any party can force a fresh consensus reading against an open action and roll it back on disagreement.</>,
        <><b>Track record.</b> Per rule and overall counters. Accuracy in basis points. Visible in the app and on chain.</>,
        <><b>Rising trust ceiling.</b> The fraction of vault balance a single action may spend scales with the chain wide accuracy.</>,
        <><b>Per fire and per period caps.</b> Every rule must declare both at arm time.</>,
        <><b>Vault custody.</b> STT lives in the Vault under your address. Withdraw what is not reserved at any time.</>,
        <><b>Pause and resume.</b> Toggle a rule without redeploying.</>,
        <><b>Multi rule wallet.</b> Many rules per wallet, each independently tracked.</>,
        <><b>Adapter SDK.</b> Add a new venue by implementing one interface and registering the domain.</>,
        <><b>Live events.</b> The dashboard subscribes to RuleArmed, RuleEvaluationRequested, AgentRequestCreated, EvaluationCompleted, PendingActionOpened, Receipt, ChallengeResolved, ActionSettled, and ActionRolledBack.</>
      ]} />
    </>
  );
}

// ── Connectors ───────────────────────────────────────────────────────────────
function ConnectorsDoc() {
  return (
    <>
      <H>Connectors</H>
      <P>
        Onward routes every action through a small adapter contract. The adapter knows the venue's
        function selector and how to build the call data. The Vault is the only caller. This
        keeps Onward composable: a new venue is one contract, not a fork.
      </P>

      <H2>Native trading on Somnia Exchange</H2>
      <P>
        The trading connector is real. It calls <code className="num">exactInput</code> on the
        native Algebra SwapRouter that ships with Somnia Exchange. The path is packed at arm time
        as a sequence of token addresses. Slippage and deadline come in through the rule's action
        params, so the user controls both. The Vault sends STT, the router swaps, and the output
        token lands at the configured recipient.
      </P>
      <P>
        This is the only third party venue in the current v3 stack. It is the venue that proves
        Onward can act on real liquidity.
      </P>

      <H2>Reference prediction</H2>
      <P>
        <code className="num">MinimalPredictionMarket</code> is a reference venue, not a third
        party protocol. It implements a real <code className="num">buyYes</code> with real YES
        and NO balances and real settle accounting. The adapter encodes a market id and routes
        the call. The venue exists so the end to end loop, including a buy action, is honest.
        Any real prediction protocol can replace it by implementing the same adapter shape.
      </P>

      <H2>Reference lending</H2>
      <P>
        <code className="num">MiniLendingPool</code> is a reference lending venue with real
        supply and borrow accounting. The adapter calls <code className="num">supply</code> with
        the rule's spend amount. A real lending protocol slots in the same way, with a slightly
        wider adapter that also handles a market id or a token address.
      </P>

      <H2>Adapter interface</H2>
      <pre className="num text-xs bg-paper-warm/70 border border-ink/5 rounded-2xl p-4 overflow-x-auto">
{`interface IVenueAdapter {
  function domain() external view returns (bytes32);
  function venue() external view returns (address);
  function encodeAction(
    address wallet,
    uint256 ruleId,
    uint256 value,
    bytes calldata params
  ) external view returns (
    address target,
    uint256 callValue,
    bytes memory data
  );
}`}
      </pre>
      <H3>Adding a new venue</H3>
      <UL items={[
        "Pick a domain hash for the venue's category, or reuse an existing one.",
        "Implement IVenueAdapter. The encodeAction function does all the work.",
        "Deploy the adapter and call AdapterRegistry.setAdapter(domain, address).",
        "Author a rule template in the app that points at the new domain. Onward will route there from the next evaluation."
      ]} />
    </>
  );
}

// ── Safety ────────────────────────────────────────────────────────────────────
function Safety() {
  return (
    <>
      <H>Safety</H>
      <UL items={SAFETY_BULLETS} />

      <H2>What this system does and does not guarantee</H2>
      <div className="card p-5 my-4 border-signal-amber/30 bg-signal-amber/5">
        <p className="text-sm font-medium text-ink mb-2">What it guarantees</p>
        <p className="text-sm text-ink/90 leading-relaxed">
          An action executes only when the Somnia consensus reading at challenge time still agrees
          with the original decision. If the consensus result changed between the first read and
          the fresh reading, the vault rolls the action back before any funds move to the venue.
        </p>
        <p className="text-sm font-medium text-ink mt-4 mb-2">What it does not guarantee</p>
        <p className="text-sm text-ink/90 leading-relaxed">
          The system does not guarantee that the external source URL returns accurate or timely
          real world data. The Somnia validators fetch and agree on what the URL returned, not on
          whether that value is correct. A source that is wrong, delayed, or controlled by a
          single publisher will produce a consensus read of that wrong value, and the challenge
          mechanism will agree with it. Users should understand the source they configure.
        </p>
      </div>

      <H2>The trust ceiling</H2>
      <P>
        Every action is capped not only by the per fire limit set at arm time but also by the
        global trust ceiling computed in <code className="num">PolicyLimits.trustCeilingBps</code>.
        The ceiling starts at 25 percent of the vault balance. Each settled action raises it by
        five percentage points. Each rolled back action lowers it by ten. The maximum is 95
        percent. The minimum is 10 percent.
      </P>
      <P>
        The intent is that a brand new Onward wallet acts conservatively while it earns track
        record, and an established Onward wallet that has settled cleanly for a long time can act
        with most of its balance. A single rollback noticeably hurts the ceiling, which is the
        right shape: the system should be defensive after any miss.
      </P>

      <H2>Bad read guard</H2>
      <P>
        Every evaluation requires a non zero action value. The AgentExecutor checks the request
        status before opening any pending action. If the agent platform reports anything other
        than success, the executor emits <code className="num">AgentRequestFailed</code> and the
        flow exits cleanly without touching the vault.
      </P>

      <H2>Key custody</H2>
      <P>
        Onward never holds your private key. The agent runs on chain, not in a server, so there
        is no private key for an Onward operator to lose. Every transaction the app submits is
        signed by the connected wallet.
      </P>
    </>
  );
}

// ── Smart contracts ───────────────────────────────────────────────────────────
function ContractsDoc() {
  return (
    <>
      <H>Smart contracts</H>
      <P>
        Every Onward contract lives on Somnia testnet. Click any row to open Shannon explorer for
        source, events, and recent activity. Addresses come from
        <code className="num"> deployments-v3.json</code> at build time so the app and the chain
        always agree.
      </P>
      <div className="overflow-x-auto rounded-2xl border border-ink/5">
        <table className="w-full text-sm">
          <thead className="bg-paper-warm/60 text-ink-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Contract</th>
              <th className="text-left px-4 py-3 font-medium">Address</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CONTRACTS).map(([name, addr]) => (
              <tr key={name} className="border-t border-ink/5 hover:bg-paper-warm/40">
                <td className="px-4 py-3 font-display">{name}</td>
                <td className="px-4 py-3 num">
                  <a
                    className="text-brand-deep underline"
                    target="_blank"
                    rel="noreferrer"
                    href={explorerAddress(addr)}
                  >
                    {shortAddr(addr)}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink-muted">{CONTRACT_PURPOSES[name as keyof typeof CONTRACTS]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Useful selectors</H2>
      <pre className="num text-xs bg-paper-warm/70 border border-ink/5 rounded-2xl p-4 overflow-x-auto">
{`Vault.depositFor(address wallet) payable
Vault.withdraw(uint256 amount)
Vault.settle(uint256 actionId)
RuleEngine.armRule(string plainText, EventSpec eventSpec, ActionSpec actionSpec, uint256 limitsRef)
RuleEngine.forceEvaluate(uint256 ruleId) payable
RuleEngine.setRuleActive(uint256 ruleId, bool active)
Challenge.challenge(uint256 actionId) payable
ReceiptLog.getReceipt(uint256 actionId)
ReceiptLog.getActionsByWallet(address wallet)
ReceiptLog.getActionsByRule(uint256 ruleId)
TrackRecord.totals()
TrackRecord.accuracyBps(uint256 ruleId)`}
      </pre>
    </>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FaqDoc() {
  return (
    <>
      <H>FAQ</H>
      <div className="flex flex-col gap-3 mt-4">
        {FAQ.map((q, i) => (
          <details key={i} className="card p-5 group">
            <summary className="cursor-pointer font-display text-xl tracking-tight flex items-center justify-between">
              {q.q}
              <span className="text-ink-muted group-open:rotate-45 transition" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-ink/90 leading-relaxed">{q.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}

// ── Roadmap ────────────────────────────────────────────────────────────────────
type RoadmapItemData = { title: string; body: string };

function RoadmapItem({ title, body, live = false }: RoadmapItemData & { live?: boolean }) {
  return (
    <li className="flex gap-3 min-w-0">
      <span
        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
          live ? "bg-signal-mint" : "bg-brand/40"
        }`}
      />
      <div className="min-w-0">
        <span className="font-display text-base leading-snug">{title}</span>
        <p className="text-sm text-ink/80 leading-relaxed mt-0.5">{body}</p>
      </div>
    </li>
  );
}

function RoadmapQuarter({
  quarter,
  title,
  items
}: {
  quarter: string;
  title: string;
  items: RoadmapItemData[];
}) {
  return (
    <div className="card p-6 md:p-7 mb-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="pill pill-brand">{quarter}</span>
        <span className="font-display text-xl tracking-tight">{title}</span>
      </div>
      <ul className="space-y-4">
        {items.map((it, i) => (
          <RoadmapItem key={i} title={it.title} body={it.body} />
        ))}
      </ul>
    </div>
  );
}

function RoadmapDoc() {
  const shipped: RoadmapItemData[] = [
    {
      title: "Plain English rules",
      body: "Users arm rules in natural language with spend caps enforced at the contract level."
    },
    {
      title: "Autonomous execution",
      body: "An on chain agent reads a source through Somnia consensus AI and executes the action within caps, writing an auditable on chain receipt."
    },
    {
      title: "The self correcting challenge",
      body: "A pending action can be challenged, the network performs a fresh consensus reading, and the action is rolled back before settlement if the answer changed. Proven on testnet with linkable transactions."
    },
    {
      title: "Receipts with provenance",
      body: "Every receipt field is tagged by origin: user defined, source, agent inferred, on chain enforced, or consensus verified."
    },
    {
      title: "Native venue connector and reference adapters",
      body: "A Somnia Exchange connector plus two real deployed reference venues, behind a pluggable adapter interface."
    }
  ];

  const q3: RoadmapItemData[] = [
    {
      title: "Challenge bonds and rewards",
      body: "A challenger posts a bond. A successful challenge earns a reward from the action fee. A failed challenge is slashed to the wallet owner. The self correction works permissionlessly in the open, not only when the owner triggers it."
    },
    {
      title: "Multi source reads",
      body: "Each rule can read several independent sources, so a single source cannot decide an action on its own."
    },
    {
      title: "A second native venue integration",
      body: "A second native venue beyond Somnia Exchange, expanding the set of actions a rule can take."
    }
  ];

  const q4: RoadmapItemData[] = [
    {
      title: "Composable rule builder",
      body: "A rule builder beyond templates, with multi condition logic and multi step actions."
    },
    {
      title: "Broader interpretive conditions",
      body: "As the on chain model improves: broader condition types with bounded, auditable outputs."
    },
    {
      title: "Open adapter interface",
      body: "Third parties can add their own venues, with documentation and a reference adapter."
    }
  ];

  const q1: RoadmapItemData[] = [
    {
      title: "Public track record and reputation layer",
      body: "Rule types and agents accumulate verifiable on chain history, visible to anyone evaluating an action before acting on it."
    },
    {
      title: "Mainnet readiness",
      body: "Third party audits, monitoring, and the safety guarantees turned into enforced on chain invariants."
    },
    {
      title: "Early partner integrations",
      body: "The first partner products built on Onward, announced closer to mainnet."
    }
  ];

  return (
    <>
      <H>Roadmap</H>
      <P>
        Onward is live on Somnia testnet. The core loop, the challenge mechanism, and the provenance
        receipt system are all working today. The items below show what is already real and where
        the product goes next.
      </P>

      {/* Shipped */}
      <div className="card p-6 md:p-7 border-signal-mint/30 bg-signal-mint/5 mb-5 mt-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="pill pill-mint">Live today</span>
          <span className="font-display text-xl tracking-tight">Shipped</span>
        </div>
        <ul className="space-y-4">
          {shipped.map((it, i) => (
            <RoadmapItem key={i} title={it.title} body={it.body} live />
          ))}
        </ul>
      </div>

      <RoadmapQuarter quarter="Q3 2026" title="Trust and incentives" items={q3} />
      <RoadmapQuarter quarter="Q4 2026" title="Expressive rules" items={q4} />
      <RoadmapQuarter quarter="Q1 2027" title="Open network and mainnet" items={q1} />
    </>
  );
}
