import * as React from "react";
import { tone } from "../theme/tokens";

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  icon,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const palette: Record<string, React.CSSProperties> = {
    primary: { background: tone.ink, color: tone.surface, border: `1px solid ${tone.ink}` },
    ghost: { background: "transparent", color: tone.ink, border: "1px solid transparent" },
    outline: { background: tone.surface, color: tone.ink, border: `1px solid ${tone.borderStrong}` },
    danger: { background: tone.danger, color: tone.surface, border: `1px solid ${tone.danger}` },
  };
  const sizes: Record<string, React.CSSProperties> = {
    sm: { fontSize: 12, padding: "6px 10px", borderRadius: 8 },
    md: { fontSize: 13, padding: "10px 14px", borderRadius: 10 },
    lg: { fontSize: 14, padding: "14px 18px", borderRadius: 12 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontWeight: 500,
        fontFamily: "inherit",
        width: fullWidth ? "100%" : "auto",
        ...palette[variant],
        ...sizes[size],
      }}
    >
      {icon}
      {children}
    </button>
  );
}
