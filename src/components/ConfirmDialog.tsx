import { Btn } from "./Btn";
import { tone } from "../theme/tokens";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  variant = "primary",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28, 27, 26, 0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: tone.surface,
          borderRadius: 16,
          width: "100%",
          maxWidth: 320,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12, color: tone.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" fullWidth onClick={onCancel}>취소</Btn>
          <Btn variant={variant} fullWidth onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}
