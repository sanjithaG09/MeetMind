import { cn } from "@/lib/utils";

type Status = "pending" | "processing" | "completed" | "failed" | "resolved";

const config: Record<Status, { label: string; classes: string }> = {
  pending:    { label: "Pending",    classes: "bg-gray-100 text-gray-600" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700 animate-pulse" },
  completed:  { label: "Completed",  classes: "bg-green-100 text-green-700" },
  failed:     { label: "Failed",     classes: "bg-red-100 text-red-700" },
  resolved:   { label: "Resolved",   classes: "bg-green-100 text-green-700" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = config[status] ?? config.pending;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", classes)}>
      {label}
    </span>
  );
}
