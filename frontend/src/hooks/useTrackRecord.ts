import { useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { trackRecordAbi } from "@/config/abis";
import { useMemo } from "react";

export type Totals = {
  evaluations: bigint;
  settled: bigint;
  rolledBack: bigint;
  failed: bigint;
};

export type RuleRecord = Totals & { ruleId: bigint; accuracyBps: bigint };

const ZERO_TOTALS: Totals = { evaluations: 0n, settled: 0n, rolledBack: 0n, failed: 0n };

function asTotals(data: unknown): Totals {
  if (!data) return ZERO_TOTALS;
  if (Array.isArray(data)) {
    const [e, s, r, f] = data as bigint[];
    return { evaluations: e ?? 0n, settled: s ?? 0n, rolledBack: r ?? 0n, failed: f ?? 0n };
  }
  const o = data as Record<string, bigint>;
  return {
    evaluations: o.evaluations ?? 0n,
    settled: o.settled ?? 0n,
    rolledBack: o.rolledBack ?? 0n,
    failed: o.failed ?? 0n
  };
}

export function useTotals() {
  const q = useReadContract({
    address: CONTRACTS.TrackRecord,
    abi: trackRecordAbi,
    functionName: "totals",
    args: [],
    query: {
      staleTime: 10_000,
      refetchInterval: 15_000,
      gcTime: 60_000
    }
  });
  const totals = asTotals(q.data);
  return {
    totals,
    isLoading: q.isLoading,
    error: q.error as Error | null,
    refetch: q.refetch
  };
}

export function useRuleRecords(ruleIds: bigint[]) {
  // Serialise ids to a string so the memo only recomputes when content changes,
  // not when the caller passes a new array reference on every render.
  const ruleIdsKey = ruleIds.map((id) => id.toString()).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contracts = useMemo(
    () =>
      ruleIds.flatMap((id) => [
        {
          address: CONTRACTS.TrackRecord,
          abi: trackRecordAbi,
          functionName: "ruleRecords",
          args: [id]
        } as const,
        {
          address: CONTRACTS.TrackRecord,
          abi: trackRecordAbi,
          functionName: "accuracyBps",
          args: [id]
        } as const
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ruleIdsKey]
  );

  const q = useReadContracts({
    contracts,
    allowFailure: true,
    query: {
      enabled: ruleIds.length > 0,
      staleTime: 10_000,
      refetchInterval: 20_000,
      gcTime: 60_000
    }
  });

  const records: RuleRecord[] = useMemo(() => {
    if (!q.data || ruleIds.length === 0) return [];
    const out: RuleRecord[] = [];
    for (let i = 0; i < ruleIds.length; i++) {
      const rec = q.data[i * 2];
      const acc = q.data[i * 2 + 1];
      const t = asTotals(rec.status === "success" ? rec.result : undefined);
      out.push({
        ruleId: ruleIds[i],
        ...t,
        accuracyBps: (acc.status === "success" ? (acc.result as bigint) : 0n) ?? 0n
      });
    }
    return out;
  }, [q.data, ruleIds]);

  return {
    records,
    isLoading: q.isLoading,
    error: q.error as Error | null,
    refetch: q.refetch
  };
}
