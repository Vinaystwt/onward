import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FadeUp, Section } from "@/components/Section";
import { CONTRACTS } from "@/config/contracts";
import { explorerAddress } from "@/config/chain";
import { shortAddr } from "@/lib/format";

const connectors = [
  {
    label: "Native trading",
    venue: "Somnia Exchange Algebra SwapRouter",
    adapter: CONTRACTS.NativeAlgebraTradingAdapter,
    blurb: "Real DEX. Onward calls exactInput on the native Algebra router and sends the output back to the vault. This is the only live, third party venue in the v2 stack.",
    tone: "brand" as const
  },
  {
    label: "Prediction",
    venue: "MinimalPredictionMarket",
    adapter: CONTRACTS.PredictionMarketAdapter,
    blurb: "Reference venue. Real YES and NO balances, real settle accounting, so the end to end loop is honest. Not a third party protocol.",
    tone: "mint" as const
  },
  {
    label: "Lending",
    venue: "MiniLendingPool",
    adapter: CONTRACTS.LendingAdapter,
    blurb: "Reference venue. Real supply and borrow accounting, no third party protocol. Slots into the adapter interface the same way a Compound v3 fork would.",
    tone: "amber" as const
  }
];

export function Connectors() {
  return (
    <Section className="py-10 md:py-14">
      <div className="mb-10 max-w-3xl">
        <span className="pill pill-brand mb-2">Connectors</span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest leading-none">
          Three venues. One honest interface.
        </h1>
        <p className="text-ink-muted mt-2">
          Each domain plugs in through a small adapter contract. Trading is native. Prediction and lending
          ship as reference venues so the demo is end to end, not stubbed.
        </p>
      </div>

      <FadeUp>
        <div className="grid lg:grid-cols-3 gap-5">
          {connectors.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card p-6 flex flex-col gap-3 relative overflow-hidden"
            >
              <span className={`pill ${c.tone === "brand" ? "pill-brand" : c.tone === "mint" ? "pill-mint" : "pill-amber"}`}>{c.label}</span>
              <h3 className="font-display text-2xl tracking-tight">{c.venue}</h3>
              <p className="text-ink-muted text-sm">{c.blurb}</p>
              <div className="mt-auto pt-3 ink-divider grid grid-cols-2 text-xs">
                <div>
                  <span className="label">Adapter</span>
                  <a className="num block text-brand-deep underline mt-1" target="_blank" rel="noreferrer" href={explorerAddress(c.adapter)}>{shortAddr(c.adapter)}</a>
                </div>
                <div>
                  <span className="label">Routes through</span>
                  <span className="block mt-1">AdapterRegistry</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </FadeUp>

      <FadeUp>
        <div className="card p-8 mt-10 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="pill mb-3">For builders</span>
            <h3 className="font-display text-2xl tracking-tight mb-2">Add a venue with one contract.</h3>
            <p className="text-ink-muted">
              Implement IVenueAdapter, register the domain, and Onward will route there. Trading already
              speaks Algebra. Prediction and lending show the simplest possible adapter shape.
            </p>
            <Link to="/docs/connectors" className="btn-ghost mt-5">Read the adapter docs</Link>
          </div>
          <pre className="num text-xs leading-relaxed bg-paper-warm/60 border border-ink/5 rounded-2xl p-5 overflow-x-auto">
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
        </div>
      </FadeUp>
    </Section>
  );
}
