import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { agentExecutorAbi, ruleEngineAbi } from "@/config/abis";

export function useEvaluationDeposit() {
  const q = useReadContract({
    address: CONTRACTS.AgentExecutor,
    abi: agentExecutorAbi,
    functionName: "requiredDeposit",
    args: [0],
    query: { staleTime: 30_000, refetchInterval: 60_000 }
  });
  return {
    deposit: (q.data as bigint | undefined) ?? 0n,
    isLoading: q.isLoading,
    error: q.error as Error | null
  };
}

export function useTrigger() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { deposit } = useEvaluationDeposit();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const trigger = useCallback(
    async (ruleId: bigint) => {
      if (!walletClient || !publicClient || !address) {
        setError("Wallet not ready");
        return null;
      }
      setStatus("pending");
      setError(null);
      setTxHash(null);
      try {
        // Always fetch a fresh deposit number at trigger time to avoid stale value.
        let needed = deposit;
        if (needed === 0n) {
          needed = (await publicClient.readContract({
            address: CONTRACTS.AgentExecutor,
            abi: agentExecutorAbi,
            functionName: "requiredDeposit",
            args: [0]
          })) as bigint;
        }
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
        setError(msg.split("\n")[0]);
        setStatus("error");
        return null;
      }
    },
    [walletClient, publicClient, address, deposit]
  );

  return { trigger, status, error, txHash };
}
