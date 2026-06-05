import { tone } from "../theme/tokens";

export function ProgressBar({ percent, danger = false }: { percent: number; danger?: boolean }) {
  const p = Math.min(Math.max(percent, 0), 100);
  return (
    <div
      style={{
        height: 6,
        width: "100%",
        background: tone.surfaceMuted,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${p}%`,
          background: danger || p > 100 ? tone.danger : tone.accent,
          transition: "width 0.4s",
        }}
      />
    </div>
  );
}
