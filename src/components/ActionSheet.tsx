import * as React from "react";
import { tone } from "../theme/tokens";

export function ActionSheet({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[];
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28, 27, 26, 0.4)",
        zIndex: 150,
        display: "flex",
        alignItems: "flex-end",
        animation: "fadeIn 0.18s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: tone.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 10,
          paddingBottom: 24,
          animation: "slideUp 0.22s",
        }}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              a.onClick();
              onClose();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              background: "transparent",
              border: "none",
              fontFamily: "inherit",
              fontSize: 14,
              color: a.danger ? tone.danger : tone.ink,
              cursor: "pointer",
              borderRadius: 10,
              textAlign: "left",
            }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: tone.surface,
            border: `1px solid ${tone.border}`,
            borderRadius: 10,
            fontFamily: "inherit",
            fontSize: 13,
            color: tone.inkMuted,
            cursor: "pointer",
            marginTop: 6,
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
