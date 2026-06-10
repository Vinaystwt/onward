import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { agentExecutorAbi, ruleEngineAbi } from "@/config/abis";

function humaniseError(msg: string): string {
  const revertMap: Record<string, string> = {
    RULE_INACTIVE: "Rule is not active.",
    ONLY_RULE_WALLET: "Only the rule owner can trigger this rule.",
    UNDERFUNDED_AGENT: "Insufficient agent deposit. Please try again.",
    EXECUTOR_MISSING: "Agent executor not configured.",
    REFUND_FAILED: "Deposit refund failed."
  };
  const m = msg.match(/reverted[^:]*:\s*([A-Z_]+)/) || msg.match(/reason:\s*([A-Z_]+)/i);
  if (m && revertMap[m[1]]) return revertMap[m[1]];
  if (msg.toLowerCase().includes("user rejected")) return "Transaction rejected.";
  return msg.split("\n")[0].slice(0, 240).replace(/^Error:\s*/, "");
}

export function useTrigger() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const trigger = useCallback(
    async (ruleId: bigint, kind: number) => {
      if (!walletClient || !publicClient || !address) {
        setError("Wallet not ready");
        return null;
      }
      setStatus("pending");
      setError(null);
      setTxHash(null);
      try {
        // Fetch the deposit for this rule's exact agent kind so we never undercut.
        const needed = (await publicClient.readContract({
          address: CONTRACTS.AgentExecutor,
          abi: agentExecutorAbi,
          functionName: "requiredDeposit",
          args: [kind]
        })) as bigint;
        const hash = await walletClient.writeContract({
          address: CONTRACTS.RuleEngine,
          abi: ruleEngineAbi,
          functionName: "forceEvaluate",
          args: [ruleId],
          value: needed
        });
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus("success");
        return hash;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(humaniseError(msg));
        setStatus("error");
        return null;
      }
    },
    [walletClient, publicClient, address]
  );

  return { trigger, status, error, txHash };
}
