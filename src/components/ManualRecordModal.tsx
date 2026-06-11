import { useEffect, useState } from "react";
import type { StudyRecord, Task } from "../types";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { ProgressSliderWithFlags } from "./ProgressSliderWithFlags";
import { percentToLevel } from "../lib/tasks";
import { fmtMin } from "../lib/format";
import { monoStack, tone } from "../theme/tokens";

export function ManualRecordModal({
  open,
  task,
  onClose,
  onSave,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (rec: Omit<StudyRecord, "id" | "durationMin" | "source">) => void;
}) {
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressTouched, setProgressTouched] = useState(false);
  const [focusLevel, setFocusLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [notes, setNotes] = useState("");

  const startDate = startedAt ? new Date(startedAt) : null;
  const endDate = endedAt ? new Date(endedAt) : null;
  const validRange = !!(startDate && endDate && endDate > startDate);
  const dur = validRange ? Math.round((endDate!.getTime() - startDate!.getTime()) / 60000) : 0;
  const estimated = task?.adjustedEstimatedMin ?? 0;
  // 직전 기록의 마지막 진행률 = 이번 세션의 시작점 (없으면 0)
  const prevPct =
    task && task.records.length > 0 ? task.records[task.records.length - 1].progressPercent : 0;
  // 이번 세션이 더하는 진행률(델타) = 예상 소요 시간 대비 수행 시간 비율
  const expectedDelta = estimated > 0 ? Math.round((dur / estimated) * 100) : 0;
  // 예상 누적 진행률 = 직전 진행률 + 이번 세션 델타 (슬라이더 기본값 / 🏁 마커 위치)
  const expectedPct = Math.min(100, Math.max(0, prevPct + expectedDelta));

  // 수행 시간을 입력하기 전(또는 사용자가 슬라이더를 건드리기 전)에는 예상 진행률을 따라가게.
  // 시간 미입력 시 델타=0 이므로 기본값은 직전 진행률(prevPct)이 된다.
  const displayedPercent = progressTouched ? progressPercent : expectedPct;

  const reset = () => {
    setStartedAt("");
    setEndedAt("");
    setProgressPercent(0);
    setProgressTouched(false);
    setFocusLevel(null);
    setNotes("");
  };

  // 저장하지 않고 닫으면 입력값을 초기화한다 (모달이 언마운트되지 않고 상태가 유지되는 문제 방지).
  useEffect(() => {
    if (!open) reset();
    // reset 은 상태 setter 들만 사용하는 안정적인 동작이므로 deps 에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (!validRange || focusLevel === null) return;
    onSave({
      startedAt: startDate!,
      endedAt: endDate!,
      progressLevel: percentToLevel(displayedPercent - prevPct, expectedDelta),
      progressPercent: displayedPercent,
      focusLevel,
      notes: notes.trim() || undefined,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="학습 기록 추가"
      footer={
        <>
          <Btn variant="outline" fullWidth onClick={onClose}>취소</Btn>
          <Btn fullWidth disabled={!validRange || focusLevel === null} onClick={handleSave}>
            저장
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
              시작 시각
            </div>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: monoStack,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
              종료 시각
            </div>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: monoStack,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {startDate && endDate && endDate <= startDate && (
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: tone.danger }}>
              종료 시각은 시작 시각보다 뒤여야 합니다.
            </div>
          )}
          {validRange && (
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: tone.inkMuted }}>
              수행 시간: {fmtMin(dur)}
            </div>
          )}
        </div>

        <ProgressSliderWithFlags
          percent={displayedPercent}
          onPercentChange={(p) => {
            setProgressPercent(p);
            setProgressTouched(true);
          }}
          prevPercent={prevPct}
          expectedPercent={expectedPct}
          hint={
            dur > 0 && estimated > 0
              ? `입력한 수행 시간(${fmtMin(dur)})은 예상 소요 시간(${fmtMin(estimated)})의 ${expectedDelta}%로, 직전 진행률 ${prevPct}%에서 ${expectedPct}%가 예상됩니다. 실제 진행률을 조정해주세요. (역행 가능)`
              : "수행 시간을 입력하면 예상 진행률이 표시됩니다. 실제 진행률을 조정해주세요."
          }
        />

        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 8, fontWeight: 500 }}>
            집중도
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { v: 1, label: "산만했어" },
              { v: 2, label: "보통이야" },
              { v: 3, label: "꽤 집중했어" },
              { v: 4, label: "완전 몰입" },
            ].map((opt) => {
              const sel = focusLevel === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => setFocusLevel(opt.v as 1 | 2 | 3 | 4)}
                  style={{
                    padding: "11px 12px",
                    borderRadius: 10,
                    border: `1px solid ${sel ? tone.ink : tone.border}`,
                    background: sel ? tone.ink : tone.surface,
                    color: sel ? tone.surface : tone.ink,
                    fontSize: 12,
                    fontWeight: sel ? 600 : 400,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            메모 (선택)
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="기록할 내용..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 13,
              background: tone.surface,
              border: `1px solid ${tone.border}`,
              borderRadius: 8,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
