import { Badge } from "@/components/ui/badge";

export function StatusPill({ value }: { value: string | null | undefined }) {
  const label = value ?? "unknown";
  const variant =
    label === "completed"
      ? "secondary"
      : label === "running"
      ? "outline"
      : label === "cancelled"
      ? "secondary"
      : label === "failed"
      ? "destructive"
      : label === "valid"
      ? "secondary"
      : label === "invalid"
      ? "destructive"
      : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}
