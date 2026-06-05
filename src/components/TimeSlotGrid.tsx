import { useState, useRef } from "react";
import { fmtMin } from "../lib/format";
import { HOUR_START, SLOTS_PER_HOUR, TOTAL_SLOTS, compressSlots, slotIndexToLabel } from "../lib/schedule";
import { monoStack, tone } from "../theme/tokens";

export function TimeSlotGrid({
  selected,
  onChange,
  disabledSlots,
}: {
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  disabledSlots?: Set<number>;
}) {
  const [dragging, setDragging] = useState<null | "ADD" | "REMOVE">(null);
  const dragStartRef = useRef<number | null>(null);     // 드래그 시작 슬롯 인덱스
  const baseSetRef = useRef<Set<number>>(new Set());     // 드래그 시작 시점의 선택 상태 스냅샷

  const isDisabled = (i: number) => disabledSlots?.has(i) ?? false;

  // 시작 슬롯 ~ 현재 슬롯 사이의 모든 인덱스를 채우거나 비움 (연속 범위)
  // 단, 비활성 슬롯은 건드리지 않음.
  const applyRange = (fromIdx: number, toIdx: number, mode: "ADD" | "REMOVE") => {
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    const next = new Set(baseSetRef.current);
    for (let i = lo; i <= hi; i++) {
      if (isDisabled(i)) continue;
      if (mode === "ADD") next.add(i);
      else next.delete(i);
    }
    onChange(next);
  };

  const handleStart = (idx: number) => {
    if (isDisabled(idx)) return;
    const mode: "ADD" | "REMOVE" = selected.has(idx) ? "REMOVE" : "ADD";
    setDragging(mode);
    dragStartRef.current = idx;
    baseSetRef.current = new Set(selected);
    applyRange(idx, idx, mode);
  };

  const handleEnter = (idx: number) => {
    if (!dragging || dragStartRef.current === null) return;
    // 시작점부터 현재점까지 매 이동마다 다시 계산 → 사이 슬롯이 모두 채워짐
    applyRange(dragStartRef.current, idx, dragging);
  };

  const handleEnd = () => {
    setDragging(null);
    dragStartRef.current = null;
    baseSetRef.current = new Set();
  };

  // 그리드: 각 행 = 30분 슬롯 1개 (세로 1열). 세로 드래그가 슬롯 인덱스 순서와 일치
  const allSlots: number[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) allSlots.push(i);

  const ranges = compressSlots(selected);
  const totalMin = selected.size * 30;

  return (
    <div onMouseUp={handleEnd} onMouseLeave={handleEnd} onTouchEnd={handleEnd}>
      {/* Header summary */}
      <div
        style={{
          padding: "10px 12px",
          background: tone.accentSoft,
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: tone.accent, fontWeight: 600, marginBottom: 4 }}>
          선택된 가용시간 · 총 <strong>{fmtMin(totalMin)}</strong>
        </div>
        <div style={{ fontSize: 11, color: tone.accent, lineHeight: 1.5 }}>
          {ranges.length === 0
            ? "아래에서 시간 슬롯을 위아래로 드래그해 선택하세요"
            : ranges
                .map((r) => `${slotIndexToLabel(r.start)}–${slotIndexToLabel(r.end)}`)
                .join(", ")}
        </div>
      </div>

      <div style={{ fontSize: 10, color: tone.inkSubtle, marginBottom: 6 }}>
        세로로 드래그해 구간 선택 · 다시 드래그하면 해제 · 30분 단위
      </div>

      {/* Grid (vertical single column) */}
      <div
        style={{
          background: tone.surface,
          border: `1px solid ${tone.border}`,
          borderRadius: 10,
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {allSlots.map((idx) => {
          const sel = selected.has(idx);
          const disabled = isDisabled(idx);
          const isHourStart = idx % SLOTS_PER_HOUR === 0;
          return (
            <div
              key={idx}
              onMouseDown={() => handleStart(idx)}
              onMouseEnter={() => handleEnter(idx)}
              onTouchStart={() => handleStart(idx)}
              onTouchMove={(e) => {
                const t = e.touches[0];
                const el = document.elementFromPoint(t.clientX, t.clientY);
                const dataIdx = el?.getAttribute("data-slot");
                if (dataIdx) handleEnter(parseInt(dataIdx));
              }}
              data-slot={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                borderTop: idx === 0 ? "none" : `1px solid ${isHourStart ? tone.borderStrong : tone.border}`,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  padding: "7px 8px",
                  fontSize: 10,
                  color: isHourStart ? tone.ink : tone.inkSubtle,
                  fontWeight: isHourStart ? 600 : 400,
                  fontFamily: monoStack,
                  borderRight: `1px solid ${tone.border}`,
                  background: tone.surfaceMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {slotIndexToLabel(idx)}
              </div>
              <div
                style={{
                  padding: "7px 10px",
                  background: disabled
                    ? `repeating-linear-gradient(45deg, ${tone.surfaceMuted}, ${tone.surfaceMuted} 4px, ${tone.surface} 4px, ${tone.surface} 8px)`
                    : sel
                      ? tone.accent
                      : tone.surface,
                  color: sel && !disabled ? tone.surface : tone.inkSubtle,
                  fontSize: 10,
                  fontFamily: monoStack,
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
              >
                {disabled ? "일정 있음" : sel ? "선택됨" : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick presets */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { label: "오전 (9–12)", range: [9, 12] },
          { label: "오후 (13–18)", range: [13, 18] },
          { label: "저녁 (19–22)", range: [19, 22] },
          { label: "심야 (23–27)", range: [23, 27] },
          { label: "초기화", clear: true },
        ].map((p, i) => (
          <button
            key={i}
            onClick={() => {
              if (p.clear) {
                // 초기화는 비활성 슬롯도 건드리지 않음 (어차피 selected에 없어야 하지만 방어적으로)
                const next = new Set<number>();
                onChange(next);
                return;
              }
              const next = new Set(selected);
              const [from, to] = p.range!;
              for (let h = from; h < to; h++) {
                const s1 = (h - HOUR_START) * SLOTS_PER_HOUR;
                const s2 = s1 + 1;
                if (!isDisabled(s1)) next.add(s1);
                if (!isDisabled(s2)) next.add(s2);
              }
              onChange(next);
            }}
            style={{
              padding: "5px 9px",
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: tone.surface,
              fontSize: 10,
              color: tone.inkMuted,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
