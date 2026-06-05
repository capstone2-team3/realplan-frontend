import * as React from "react";
import { X } from "lucide-react";
import { tone } from "../theme/tokens";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28, 27, 26, 0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        animation: "fadeIn 0.2s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: tone.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: size === "lg" ? "92%" : "85%",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.25s",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: `1px solid ${tone.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={18} color={tone.inkMuted} />
          </button>
        </div>
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: 14,
              borderTop: `1px solid ${tone.border}`,
              display: "flex",
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
