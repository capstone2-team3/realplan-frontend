import * as React from "react";
import { tone } from "../theme/tokens";

export function Pill({
  children,
  variant = "default",
  size = "md",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "warn" | "danger" | "muted";
  size?: "sm" | "md";
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: tone.surfaceMuted, color: tone.ink, borderColor: tone.border },
    accent: { background: tone.accentSoft, color: tone.accent, borderColor: tone.accentSoft },
    warn: { background: tone.warnSoft, color: tone.warn, borderColor: tone.warnSoft },
    danger: { background: tone.dangerSoft, color: tone.danger, borderColor: tone.dangerSoft },
    muted: { background: "transparent", color: tone.inkMuted, borderColor: tone.border },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: size === "sm" ? 10 : 11,
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        borderRadius: 999,
        border: "1px solid",
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}
