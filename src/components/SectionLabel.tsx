import * as React from "react";
import { tone } from "../theme/tokens";

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: tone.inkSubtle,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {children}
      </div>
      {action}
    </div>
  );
}
