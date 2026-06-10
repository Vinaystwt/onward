import { useCallback, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { challengeAbi, vaultAbi } from "@/config/abis";

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
        const deposit = (await publicClient.readContract({
          address: CONTRACTS.Challenge,
          abi: challengeAbi,
          functionName: "requiredDeposit",
          args: [0]
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
        setError(msg.split("\n")[0]);
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
      setError(msg.split("\n")[0]);
      setStatus("error");
      return null;
    }
  }, [walletClient, publicClient]);

  return { settle, status, error };
}
