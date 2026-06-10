import { type ProvTier, PROV_META } from "@/lib/provenance";

export function ProvenanceBadge({ tier }: { tier: ProvTier }) {
  const m = PROV_META[tier];
  return (
    <span
      title={m.description}
      aria-label={`Provenance: ${m.label}. ${m.description}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide leading-none ${m.className}`}
    >
      {m.short}
    </span>
  );
}

/**
 * One-row legend strip. Place it near any section that uses provenance badges.
 */
export function ProvenanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <span className="font-medium text-ink">Provenance</span>
      {(Object.keys(PROV_META) as ProvTier[]).map((tier) => (
        <span key={tier} className="flex items-center gap-1">
          <ProvenanceBadge tier={tier} />
          <span>{PROV_META[tier].label}</span>
        </span>
      ))}
    </div>
  );
}
