import type { Rule } from "@/hooks/useRules";

/**
 * Returns false for rules that are diagnostic experiments or scaffolding tests.
 * Only product-grade rules reach the UI. On-chain state is never touched.
 *
 * Filtered patterns (by plainText content or eventSpec.url):
 *   - Starts with "Diagnostic:" — internal experiment rule
 *   - Contains a raw 40-hex Ethereum address — test/signal-balance experiment
 *   - eventSpec.url is an RPC endpoint — uses chain RPC as a data source (not a product pattern)
 */
export function isProductRule(rule: Rule): boolean {
  const t = rule.plainText;
  if (t.startsWith("Diagnostic:")) return false;
  if (/0x[0-9a-fA-F]{40}/.test(t)) return false;
  if (rule.eventSpec.url.startsWith("https://dream-rpc.somnia.network")) return false;
  return true;
}

/**
 * Translates raw on-chain plainText to clean user-facing copy.
 * The on-chain value is unchanged and still appears verbatim in receipt detail.
 * Only rewrites strings that contain operator scaffolding language.
 */
export function productRuleTitle(plainText: string): string {
  if (plainText.includes("jsonblob.com") && plainText.includes("below 2")) {
    return "Buy a YES share when the source value drops below 2.";
  }
  if (
    plainText.startsWith("Interpretive demo:") ||
    plainText.includes("SAFE_TO_EXECUTE")
  ) {
    return "Classify the operations bulletin as safe before supplying lending liquidity.";
  }
  return plainText;
}
