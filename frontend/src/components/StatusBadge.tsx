import { STATUS_LABEL } from "@/lib/format";

export function StatusBadge({ status }: { status: number }) {
  const label = STATUS_LABEL[status] ?? "Unknown";
  const className =
    status === 1
      ? "pill pill-amber"
      : status === 2
        ? "pill pill-mint"
        : status === 3
          ? "pill pill-rose"
          : status === 4
            ? "pill pill-rose"
            : "pill";
  return (
    <span className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label === "RolledBack" ? "Rolled back" : label}
    </span>
  );
}
