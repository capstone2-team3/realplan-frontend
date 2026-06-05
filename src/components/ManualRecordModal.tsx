import { useState } from "react";
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
  onSave: (rec: Omit<StudyRecord, "id" | "startedAt" | "endedAt" | "source">) => void;
}) {
  const [durationMin, setDurationMin] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressTouched, setProgressTouched] = useState(false);
  const [focusLevel, setFocusLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [notes, setNotes] = useState("");

  const dur = parseInt(durationMin) || 0;
  const estimated = task?.adjustedEstimatedMin ?? 0;
  // 이번에 입력한 수행 시간 기준 "예상 진행률" (세션 종료의 expectedPct 와 동일 개념)
  const expectedPct = estimated > 0 ? Math.round((dur / estimated) * 100) : 0;
  // 이전 기록의 마지막 진행률 (깃발 마커용)
  const prevPct =
    task && task.records.length > 0 ? task.records[task.records.length - 1].progressPercent : 0;

  // 수행 시간을 입력하기 전(또는 사용자가 슬라이더를 건드리기 전)에는 예상 진행률을 따라가게
  const displayedPercent = progressTouched ? progressPercent : Math.min(100, Math.max(0, expectedPct));

  const reset = () => {
    setDurationMin("");
    setProgressPercent(0);
    setProgressTouched(false);
    setFocusLevel(null);
    setNotes("");
  };

  const handleSave = () => {
    if (!durationMin || focusLevel === null) return;
    onSave({
      durationMin: dur,
      progressLevel: percentToLevel(displayedPercent, expectedPct),
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
          <Btn fullWidth disabled={!durationMin || focusLevel === null} onClick={handleSave}>
            저장
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            수행 시간 (분)
          </div>
          <input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="45"
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
              ? `입력한 수행 시간(${fmtMin(dur)})은 예상 소요 시간(${fmtMin(estimated)})의 ${expectedPct}%입니다. 실제 진행률을 조정해주세요. (역행 가능)`
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
