import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CONTRACTS } from "@/config/contracts";
import { ruleEngineAbi } from "@/config/abis";
import { useCallback, useState } from "react";

export type Rule = {
  id: bigint;
  wallet: `0x${string}`;
  plainText: string;
  eventSpec: {
    kind: number;
    comparator: number;
    url: string;
    selector: string;
    decimals: number;
    threshold: bigint;
    expected: string;
    prompt: string;
    systemOrDescription: string;
  };
  actionSpec: {
    domain: `0x${string}`;
    actionType: number;
    value: bigint;
    params: `0x${string}`;
  };
  limitsRef: bigint;
  active: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function useRules() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const idsQuery = useReadContract({
    address: CONTRACTS.RuleEngine,
    abi: ruleEngineAbi,
    functionName: "getRulesByWallet",
    args: [address ?? ZERO],
    query: {
      enabled: !!address,
      staleTime: 5_000,
      refetchInterval: 15_000,
      gcTime: 60_000
    }
  });

  const ids = (idsQuery.data ?? []) as readonly bigint[];

  const rulesQuery = useQuery<Rule[]>({
    enabled: !!publicClient && !!address && ids.length > 0,
    queryKey: ["rules", address, ids.map((i) => i.toString()).join(",")],
    staleTime: 8_000,
    refetchInterval: 18_000,
    gcTime: 60_000,
    queryFn: async () => {
      if (!publicClient || ids.length === 0) return [];
      const list = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: CONTRACTS.RuleEngine,
            abi: ruleEngineAbi,
            functionName: "getRule",
            args: [id]
          }) as Promise<Rule>
        )
      );
      return list.slice().reverse();
    }
  });

  return {
    rules: rulesQuery.data ?? [],
    ids,
    isLoading: idsQuery.isLoading || rulesQuery.isLoading,
    isFetching: idsQuery.isFetching || rulesQuery.isFetching,
    error: (idsQuery.error || rulesQuery.error) as Error | null,
    refetch: async () => {
      await idsQuery.refetch();
      await rulesQuery.refetch();
    }
  };
}

export function useArmRule() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState<bigint | null>(null);

  const arm = useCallback(
    async (input: {
      plainText: string;
      eventSpec: Rule["eventSpec"];
      actionSpec: Rule["actionSpec"];
      limitsRef: bigint;
    }) => {
      if (!walletClient || !publicClient) {
        setError("Wallet not ready");
        return null;
      }
      setStatus("pending");
      setError(null);
      setTxHash(null);
      setRuleId(null);
      try {
        const hash = await walletClient.writeContract({
          address: CONTRACTS.RuleEngine,
          abi: ruleEngineAbi,
          functionName: "armRule",
          args: [input.plainText, input.eventSpec, input.actionSpec, input.limitsRef]
        });
        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const log = receipt.logs.find(
          (l) => l.address.toLowerCase() === CONTRACTS.RuleEngine.toLowerCase() && l.topics[1]
        );
        if (log && log.topics[1]) setRuleId(BigInt(log.topics[1]));
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

  return { arm, status, error, txHash, ruleId };
}
