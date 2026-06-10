import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CONTRACTS } from "@/config/contracts";
import { receiptLogAbi } from "@/config/abis";

export type Receipt = {
  actionId: bigint;
  ruleId: bigint;
  wallet: `0x${string}`;
  source: string;
  rawOutput: `0x${string}`;
  decision: boolean;
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  createdAt: bigint;
  updatedAt: bigint;
  status: number;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function useReceipts({ ruleId }: { ruleId?: bigint } = {}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const byRule = ruleId !== undefined;

  const idsQuery = useReadContract({
    address: CONTRACTS.ReceiptLog,
    abi: receiptLogAbi,
    functionName: byRule ? "getActionsByRule" : "getActionsByWallet",
    args: byRule ? [ruleId!] : [address ?? ZERO],
    query: {
      enabled: byRule || !!address,
      staleTime: 5_000,
      refetchInterval: 12_000,
      gcTime: 60_000
    }
  });

  const ids = (idsQuery.data ?? []) as readonly bigint[];

  const receiptsQuery = useQuery<Receipt[]>({
    enabled: !!publicClient && ids.length > 0,
    queryKey: ["receipts", byRule ? `rule:${ruleId?.toString()}` : `wallet:${address}`, ids.map((i) => i.toString()).join(",")],
    staleTime: 5_000,
    refetchInterval: 12_000,
    gcTime: 60_000,
    queryFn: async () => {
      if (!publicClient) return [];
      const out = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: CONTRACTS.ReceiptLog,
            abi: receiptLogAbi,
            functionName: "getReceipt",
            args: [id]
          }) as Promise<Receipt>
        )
      );
      return out.slice().reverse();
    }
  });

  return {
    receipts: receiptsQuery.data ?? [],
    isLoading: idsQuery.isLoading || (ids.length > 0 && receiptsQuery.isLoading),
    isFetching: idsQuery.isFetching || receiptsQuery.isFetching,
    error: (idsQuery.error || receiptsQuery.error) as Error | null,
    refetch: async () => {
      await idsQuery.refetch();
      await receiptsQuery.refetch();
    }
  };
}

export function useReceipt(actionId: bigint | undefined) {
  const q = useReadContract({
    address: CONTRACTS.ReceiptLog,
    abi: receiptLogAbi,
    functionName: "getReceipt",
    args: actionId !== undefined ? [actionId] : undefined,
    query: {
      enabled: actionId !== undefined,
      staleTime: 4_000,
      refetchInterval: 8_000
    }
  });
  return {
    receipt: (q.data as Receipt | undefined) ?? null,
    isLoading: q.isLoading,
    error: q.error as Error | null,
    refetch: q.refetch
  };
}
