import * as React from "react";
import { tone } from "../theme/tokens";

export function Card({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: tone.surface,
        border: `1px solid ${tone.border}`,
        borderRadius: 14,
        padding: 14,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
