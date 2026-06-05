import type { Task } from "../types";
import { Card } from "./Card";
import { HOUR_START, SLOTS_PER_HOUR, slotIndexToLabel } from "../lib/schedule";
import { buildTaskOrder, colorForTask } from "../lib/tasks";
import { monoStack, tone } from "../theme/tokens";

export function TodayScheduleView({
  schedule,
  recommendedTasks,
  allTasks,
  onTaskClick,
  showNowIndicator = true,
}: {
  schedule: Record<number, string>;
  recommendedTasks: Task[];
  allTasks: Task[];
  onTaskClick: (taskId: string) => void;
  showNowIndicator?: boolean;
}) {
  const order = buildTaskOrder(recommendedTasks, allTasks);
  const taskById = (id: string) => allTasks.find((t) => t.id === id);

  // 연속 슬롯을 동일 task 블록으로 묶기
  const blocks: { taskId: string; start: number; end: number }[] = [];
  const sortedIdx = Object.keys(schedule)
    .map((k) => parseInt(k))
    .sort((a, b) => a - b);
  for (const idx of sortedIdx) {
    const tid = schedule[idx];
    const last = blocks[blocks.length - 1];
    if (last && last.taskId === tid && last.end === idx) {
      last.end = idx + 1;
    } else {
      blocks.push({ taskId: tid, start: idx, end: idx + 1 });
    }
  }

  // 표시 범위: 배정된 첫 슬롯 ~ 마지막 슬롯 (여유 없이)
  const minSlot = sortedIdx[0];
  const maxSlot = sortedIdx[sortedIdx.length - 1] + 1;
  const rangeSlots = maxSlot - minSlot;
  const ROW_H = 21; // 슬롯당 px (기존 30의 약 70%)

  // 현재 시각 → 슬롯 좌표
  const now = new Date();
  const nowMinFromGridStart = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
  const nowSlotFloat = nowMinFromGridStart / 30; // 슬롯 단위 (소수 포함)
  const nowWithinRange = nowSlotFloat >= minSlot && nowSlotFloat <= maxSlot;
  const nowTopPx = (nowSlotFloat - minSlot) * ROW_H;

  return (
    <Card style={{ padding: 12 }}>
      <div
        style={{
          position: "relative",
          height: rangeSlots * ROW_H,
          display: "flex",
        }}
      >
        {/* Time labels column */}
        <div style={{ width: 46, flexShrink: 0, position: "relative" }}>
          {Array.from({ length: rangeSlots + 1 }).map((_, i) => {
            const slot = minSlot + i;
            const isHour = slot % SLOTS_PER_HOUR === 0;
            if (!isHour) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: i * ROW_H - 6,
                  left: 0,
                  fontSize: 9,
                  color: tone.inkSubtle,
                  fontFamily: monoStack,
                }}
              >
                {slotIndexToLabel(slot)}
              </div>
            );
          })}
        </div>

        {/* Track */}
        <div
          style={{
            flex: 1,
            position: "relative",
            borderLeft: `1px solid ${tone.border}`,
          }}
        >
          {/* Hour gridlines */}
          {Array.from({ length: rangeSlots + 1 }).map((_, i) => {
            const slot = minSlot + i;
            const isHour = slot % SLOTS_PER_HOUR === 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: i * ROW_H,
                  left: 0,
                  right: 0,
                  borderTop: `1px solid ${isHour ? tone.border : "transparent"}`,
                }}
              />
            );
          })}

          {/* Task blocks */}
          {blocks.map((b, i) => {
            const t = taskById(b.taskId);
            if (!t) return null;
            const c = colorForTask(b.taskId, order);
            const top = (b.start - minSlot) * ROW_H;
            const height = (b.end - b.start) * ROW_H;
            return (
              <div
                key={i}
                onClick={() => onTaskClick(b.taskId)}
                style={{
                  position: "absolute",
                  top: top + 2,
                  left: 4,
                  right: 4,
                  height: height - 4,
                  background: c,
                  borderRadius: 8,
                  padding: "5px 9px",
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: tone.surface,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.name}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", fontFamily: monoStack }}>
                  {slotIndexToLabel(b.start)}–{slotIndexToLabel(b.end)}
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {showNowIndicator && nowWithinRange && (
            <div
              style={{
                position: "absolute",
                top: nowTopPx,
                left: -3,
                right: 0,
                height: 0,
                borderTop: `2px solid ${tone.danger}`,
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -3,
                  top: -4,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: tone.danger,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 2,
                  top: -16,
                  fontSize: 9,
                  fontWeight: 700,
                  color: tone.danger,
                  fontFamily: monoStack,
                  background: tone.bg,
                  padding: "0 3px",
                }}
              >
                지금 {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 8, textAlign: "center" }}>
        블록을 누르면 Task 상세로 이동합니다
      </div>
    </Card>
  );
}
