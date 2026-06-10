import { useAccount, usePublicClient, useReadContracts, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { vaultAbi } from "@/config/abis";
import { useCallback, useState } from "react";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function useVaultBalances() {
  const { address } = useAccount();
  const enabled = !!address;
  const q = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: CONTRACTS.Vault, abi: vaultAbi, functionName: "balances", args: [address ?? ZERO] },
      { address: CONTRACTS.Vault, abi: vaultAbi, functionName: "reserved", args: [address ?? ZERO] },
      { address: CONTRACTS.Vault, abi: vaultAbi, functionName: "challengeWindow", args: [] }
    ],
    query: { enabled, staleTime: 6_000, refetchInterval: 12_000, gcTime: 60_000 }
  });

  const balance = (q.data?.[0]?.status === "success" ? (q.data[0].result as bigint) : 0n) ?? 0n;
  const reserved = (q.data?.[1]?.status === "success" ? (q.data[1].result as bigint) : 0n) ?? 0n;
  const challengeWindow = (q.data?.[2]?.status === "success" ? (q.data[2].result as bigint) : 0n) ?? 0n;

  return {
    balance,
    reserved,
    available: balance > reserved ? balance - reserved : 0n,
    challengeWindow,
    refetch: q.refetch,
    isLoading: q.isLoading,
    error: q.error as Error | null
  };
}

export function useDeposit() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(async (valueWei: bigint) => {
    if (!walletClient || !address || !publicClient) {
      setError("Wallet not ready");
      return null;
    }
    if (valueWei <= 0n) {
      setError("Enter an amount greater than zero");
      return null;
    }
    setStatus("pending");
    setError(null);
    setTxHash(null);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.Vault,
        abi: vaultAbi,
        functionName: "depositFor",
        args: [address],
        value: valueWei
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      return hash;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(humanise(msg));
      setStatus("error");
      return null;
    }
  }, [walletClient, address, publicClient]);

  return {
    deposit,
    status,
    txHash,
    error,
    reset: () => {
      setStatus("idle");
      setError(null);
      setTxHash(null);
    }
  };
}

export function useWithdraw() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const withdraw = useCallback(async (valueWei: bigint) => {
    if (!walletClient || !publicClient) {
      setError("Wallet not ready");
      return null;
    }
    if (valueWei <= 0n) {
      setError("Enter an amount greater than zero");
      return null;
    }
    setStatus("pending");
    setError(null);
    setTxHash(null);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.Vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [valueWei]
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      return hash;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(humanise(msg));
      setStatus("error");
      return null;
    }
  }, [walletClient, publicClient]);

  return { withdraw, status, error, txHash };
}

function humanise(msg: string) {
  return msg.split("\n")[0].slice(0, 240).replace(/^Error: /, "");
}
