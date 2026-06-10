import { useCallback, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { challengeAbi, vaultAbi, ruleEngineAbi } from "@/config/abis";

function humaniseError(msg: string): string {
  const revertMap: Record<string, string> = {
    NOT_PENDING: "This action is no longer pending.",
    UNDERFUNDED_AGENT: "Insufficient deposit for the challenge agent.",
    REFUND_FAILED: "Deposit refund failed.",
    ONLY_PLATFORM: "Only the platform can call this.",
    UNKNOWN_REQUEST: "Unknown agent request."
  };
  const m = msg.match(/reverted[^:]*:\s*([A-Z_]+)/) || msg.match(/reason:\s*([A-Z_]+)/i);
  if (m && revertMap[m[1]]) return revertMap[m[1]];
  if (msg.toLowerCase().includes("user rejected")) return "Transaction rejected.";
  return msg.split("\n")[0].slice(0, 240).replace(/^Error:\s*/, "");
}

export function useChallenge() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const open = useCallback(
    async (actionId: bigint) => {
      if (!walletClient || !publicClient) return null;
      setStatus("pending");
      setError(null);
      setTxHash(null);
      try {
        // Resolve the rule's agent kind so we compute the exact required deposit.
        const action = (await publicClient.readContract({
          address: CONTRACTS.Vault,
          abi: vaultAbi,
          functionName: "getPendingAction",
          args: [actionId]
        })) as { ruleId: bigint };
        const rule = (await publicClient.readContract({
          address: CONTRACTS.RuleEngine,
          abi: ruleEngineAbi,
          functionName: "getRule",
          args: [action.ruleId]
        })) as { eventSpec: { kind: number } };
        const deposit = (await publicClient.readContract({
          address: CONTRACTS.Challenge,
          abi: challengeAbi,
          functionName: "requiredDeposit",
          args: [rule.eventSpec.kind]
        })) as bigint;
        const hash = await walletClient.writeContract({
          address: CONTRACTS.Challenge,
          abi: challengeAbi,
          functionName: "challenge",
          args: [actionId],
          value: deposit
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
    [walletClient, publicClient]
  );

  return { challenge: open, status, error, txHash };
}

export function useSettle() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const settle = useCallback(async (actionId: bigint) => {
    if (!walletClient || !publicClient) return null;
    setStatus("pending");
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.Vault,
        abi: vaultAbi,
        functionName: "settle",
        args: [actionId]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      return hash;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const revertMap: Record<string, string> = {
        NOT_PENDING: "This action is no longer pending.",
        WINDOW_OPEN: "Challenge window is still open."
      };
      const m = msg.match(/reverted[^:]*:\s*([A-Z_]+)/) || msg.match(/reason:\s*([A-Z_]+)/i);
      setError(m && revertMap[m[1]] ? revertMap[m[1]] : msg.split("\n")[0].slice(0, 240));
      setStatus("error");
      return null;
    }
  }, [walletClient, publicClient]);

  return { settle, status, error };
}
