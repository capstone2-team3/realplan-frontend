import { monoStack, tone } from "../theme/tokens";

export function ProgressSliderWithFlags({
  percent,
  onPercentChange,
  prevPercent,
  expectedPercent,
  hint,
}: {
  percent: number;
  onPercentChange: (p: number) => void;
  prevPercent: number;
  expectedPercent: number;
  hint?: string;
}) {
  const clampedExpected = Math.min(100, Math.max(0, expectedPercent));
  const clampedPrev = Math.min(100, Math.max(0, prevPercent));

  return (
    <div>
      <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 8, fontWeight: 500 }}>
        진행률
      </div>
      {hint && (
        <div
          style={{
            background: tone.surfaceMuted,
            padding: 10,
            borderRadius: 8,
            fontSize: 11,
            color: tone.inkMuted,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          {hint}
        </div>
      )}

      <div style={{ padding: "4px 4px 0" }}>
        {/* Current value */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, fontFamily: monoStack, color: tone.ink }}>
            {percent}%
          </span>
        </div>

        {/* Flag markers row (above the track) */}
        <div style={{ position: "relative", height: 26, marginBottom: 2 }}>
          {/* 직전 세션 진행률 flag */}
          <div
            style={{
              position: "absolute",
              left: `${clampedPrev}%`,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>🚩</span>
          </div>
          {/* 예상 진행률 flag */}
          <div
            style={{
              position: "absolute",
              left: `${clampedExpected}%`,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>🏁</span>
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(e) => onPercentChange(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: tone.accent, cursor: "pointer" }}
        />

        {/* Tick labels 0/25/50/75/100 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontSize: 9,
            color: tone.inkSubtle,
            fontFamily: monoStack,
          }}
        >
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        {/* Flag legend */}
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            marginTop: 12,
            fontSize: 10,
            color: tone.inkMuted,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            🚩 직전 세션 ({clampedPrev}%)
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            🏁 예상 진행률 ({clampedExpected}%)
          </span>
        </div>
      </div>
    </div>
  );
}
