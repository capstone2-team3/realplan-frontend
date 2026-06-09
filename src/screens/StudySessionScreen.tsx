import { useState, useEffect } from "react";
import { ChevronLeft, Pause, Play, Square } from "lucide-react";
import type { Task } from "../types";
import { Btn } from "../components/Btn";
import { Modal } from "../components/Modal";
import { Pill } from "../components/Pill";
import { ProgressBar } from "../components/ProgressBar";
import { ProgressSliderWithFlags } from "../components/ProgressSliderWithFlags";
import { fmtDuration, fmtMin } from "../lib/format";
import { percentToLevel } from "../lib/tasks";
import { monoStack, tone } from "../theme/tokens";
import { TASK_TYPE_LABELS } from "../types";

export function StudySessionScreen({
  task,
  onBack,
  onPause,
  onResume,
  onEnd,
}: {
  task: Task;
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: (feedback: {
    progressLevel: 1 | 2 | 3 | 4 | 5;
    progressPercent: number;
    focusLevel: 1 | 2 | 3 | 4;
    notes?: string;
  }) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressTouched, setProgressTouched] = useState(false);
  const [focusLevel, setFocusLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [notes, setNotes] = useState("");

  // Tick
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const elapsedMin = Math.floor(elapsed / 60);
  const totalSpent = task.records.reduce((s, r) => s + r.durationMin, 0) + elapsedMin;
  const expectedPct = Math.round((totalSpent / task.adjustedEstimatedMin) * 100);

  // 직전 세션 종료 시 진행률 (없으면 0)
  const prevPct =
    task.records.length > 0 ? task.records[task.records.length - 1].progressPercent : 0;

  // 종료 다이얼로그 열 때 슬라이더 초기값을 예상 진행률로 세팅
  const openEndDialog = () => {
    if (!progressTouched) {
      setProgressPercent(Math.min(100, Math.max(0, expectedPct)));
    }
    setEndDialogOpen(true);
  };

  // 진행률 → 5단계 라벨 환산 (기록 호환용). 소요 시간은 서버가 계산.
  const handleEnd = () => {
    if (focusLevel === null) return;
    onEnd({
      progressLevel: percentToLevel(progressPercent, expectedPct),
      progressPercent,
      focusLevel,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 500 }}>학습 세션</div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 4 }}>학습 중</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{task.name}</div>
          <Pill variant="muted">{TASK_TYPE_LABELS[task.type]}</Pill>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 200,
              fontFamily: monoStack,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtDuration(elapsed)}
          </div>
          <div style={{ fontSize: 12, color: tone.inkMuted, marginTop: 8 }}>
            예상 {fmtMin(task.adjustedEstimatedMin)} 중
          </div>
          <div style={{ width: "70%", marginTop: 14 }}>
            <ProgressBar percent={expectedPct} />
            <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 6, textAlign: "center" }}>
              실시간 진행률 {expectedPct}%
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "20px 0 30px" }}>
          {running ? (
            <Btn
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => {
                setRunning(false);
                onPause();
              }}
              icon={<Pause size={16} />}
            >
              일시정지
            </Btn>
          ) : (
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                setRunning(true);
                onResume();
              }}
              icon={<Play size={16} />}
            >
              재개
            </Btn>
          )}
          <Btn variant="danger" size="lg" fullWidth onClick={openEndDialog} icon={<Square size={16} />}>
            세션 종료
          </Btn>
        </div>
      </div>

      <Modal
        open={endDialogOpen}
        onClose={() => setEndDialogOpen(false)}
        title="세션 종료"
        size="lg"
        footer={
          <>
            <Btn variant="outline" fullWidth onClick={() => setEndDialogOpen(false)}>
              계속하기
            </Btn>
            <Btn
              variant="primary"
              fullWidth
              onClick={handleEnd}
              disabled={focusLevel === null}
            >
              저장
            </Btn>
          </>
        }
      >
        <div
          style={{
            background: tone.surfaceMuted,
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 4 }}>이번 세션</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: monoStack }}>{elapsedMin}분</div>
        </div>

        <ProgressSliderWithFlags
          percent={progressPercent}
          onPercentChange={(p) => {
            setProgressPercent(p);
            setProgressTouched(true);
          }}
          prevPercent={prevPct}
          expectedPercent={expectedPct}
          hint={`예상 소요 시간(${fmtMin(task.adjustedEstimatedMin)})의 ${expectedPct}%(${totalSpent}분)가 지났습니다. 현재 진행률을 조정해주세요. (역행 가능)`}
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: tone.inkMuted, marginBottom: 10 }}>이번 세션 집중도</div>
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

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            메모 (선택)
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="이번 세션에 대한 메모..."
            rows={2}
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
      </Modal>
    </div>
  );
}
