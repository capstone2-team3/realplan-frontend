import { ArrowDown, ArrowUp } from "lucide-react";
import type { Importance } from "../types";
import { Pill } from "./Pill";
import { IMPORTANCE_LABELS } from "../types";

export function ImportancePill({ value }: { value: Importance }) {
  const variant = value === "HIGH" ? "danger" : value === "MEDIUM" ? "default" : "muted";
  const icon = value === "HIGH" ? <ArrowUp size={9} /> : value === "LOW" ? <ArrowDown size={9} /> : null;
  return (
    <Pill variant={variant} size="sm">
      {icon}
      중요도 {IMPORTANCE_LABELS[value]}
    </Pill>
  );
}
