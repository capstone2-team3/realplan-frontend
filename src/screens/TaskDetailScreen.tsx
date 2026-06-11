import { AlertCircle, Calendar, Check, ChevronLeft, Clock, Edit2, Info, Play, Plus } from "lucide-react";
import type { Task } from "../types";
import { Btn } from "../components/Btn";
import { Card } from "../components/Card";
import { ImportancePill } from "../components/ImportancePill";
import { Pill } from "../components/Pill";
import { ProgressBar } from "../components/ProgressBar";
import { SectionLabel } from "../components/SectionLabel";
import { fmtDday, fmtMin } from "../lib/format";
import { monoStack, tone } from "../theme/tokens";
import { DIFFICULTY_LABELS, FOCUS_LABELS, PROGRESS_LABELS, TASK_TYPE_LABELS } from "../types";

export function TaskDetailScreen({
  task,
  onBack,
  onStartSession,
  onAddManualRecord,
  onEditTask,
  onCompleteTask,
}: {
  task: Task;
  onBack: () => void;
  onStartSession: () => void;
  onAddManualRecord: () => void;
  onEditTask: () => void;
  onCompleteTask: () => void;
}) {
  const totalStudied = task.records.reduce((s, r) => s + r.durationMin, 0);
  const progressPct = Math.round((totalStudied / task.adjustedEstimatedMin) * 100);
  // 보정이 명시적으로 꺼진 경우(TIME형 보정 OFF)만 카드를 숨긴다.
  const correctionDisabled = task.type === "TIME_BASED" && !task.correctionEnabled;
  const showEstimate = !correctionDisabled;
  // 실제로 보정값이 내 예측과 다를 때만 "보정 적용됨"으로 강조. 같으면(콜드스타트) 보정 대기 상태로 표시.
  const corrected = task.adjustedEstimatedMin !== task.originalEstimatedMin;

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Task 상세</div>
        </div>
        <button
          onClick={onEditTask}
          style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}
        >
          <Edit2 size={16} color={tone.inkMuted} />
        </button>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <Pill variant={task.completed ? "accent" : "default"}>
              {task.completed ? "완료" : "진행 중"}
            </Pill>
            <Pill variant="muted">{TASK_TYPE_LABELS[task.type]}</Pill>
            <ImportancePill value={task.importance} />
            <Pill variant="muted" size="sm">난이도 {DIFFICULTY_LABELS[task.difficulty]}</Pill>
            {task.type === "TIME_BASED" && !task.correctionEnabled && (
              <Pill variant="muted">보정 OFF</Pill>
            )}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{task.name}</div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: tone.inkMuted, marginBottom: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} />
              {fmtMin(task.remainingMin)} 남음
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} />
              {fmtDday(task.deadline)}
            </span>
          </div>
          {task.notes && (
            <div
              style={{
                background: tone.surfaceMuted,
                padding: 10,
                borderRadius: 8,
                fontSize: 12,
                color: tone.inkMuted,
                lineHeight: 1.5,
                marginTop: 8,
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <Info size={12} color={tone.inkSubtle} style={{ marginTop: 2, flexShrink: 0 }} />
              {task.notes}
            </div>
          )}
        </div>

        {showEstimate && (
          <Card
            style={{
              background: corrected ? tone.warnSoft : tone.surfaceMuted,
              borderColor: corrected ? tone.warnSoft : tone.border,
              marginBottom: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <AlertCircle size={14} color={corrected ? tone.warn : tone.inkMuted} />
              <div style={{ fontSize: 12, fontWeight: 600, color: corrected ? tone.warn : tone.inkMuted }}>
                {corrected ? "AI 계획 오류 보정 적용됨" : "AI 예측 · 보정 대기 중"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <div style={{ background: tone.surface, padding: 9, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: tone.inkMuted, marginBottom: 3, fontWeight: 500 }}>내 예측</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: monoStack }}>{task.originalEstimatedMin}분</div>
              </div>
              <div style={{ background: corrected ? tone.warn : tone.surface, padding: 9, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: corrected ? tone.warnSoft : tone.inkMuted, marginBottom: 3, fontWeight: 500 }}>AI 보정</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: monoStack, color: corrected ? tone.surface : tone.ink }}>
                  {task.adjustedEstimatedMin}분
                </div>
              </div>
              <div style={{ background: tone.surface, padding: 9, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: tone.inkMuted, marginBottom: 3, fontWeight: 500 }}>실제 누적</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: monoStack }}>{totalStudied}분</div>
              </div>
            </div>
            {!corrected && (
              <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 8, lineHeight: 1.5 }}>
                아직 학습 데이터가 부족해 보정이 적용되지 않았어요. 이 유형의 Task를 완료할수록 내 예측 대비 보정이 자동으로 적용됩니다.
              </div>
            )}
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <Card style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: tone.inkMuted, marginBottom: 4 }}>진행률</div>
            <div style={{ fontSize: 19, fontWeight: 700, fontFamily: monoStack }}>{progressPct}%</div>
            <div style={{ marginTop: 6 }}>
              <ProgressBar percent={progressPct} />
            </div>
          </Card>
          <Card style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: tone.inkMuted, marginBottom: 4 }}>세션</div>
            <div style={{ fontSize: 19, fontWeight: 700, fontFamily: monoStack }}>{task.records.length}</div>
            <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 6 }}>회</div>
          </Card>
          <Card style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: tone.inkMuted, marginBottom: 4 }}>평균 집중도</div>
            <div style={{ fontSize: 19, fontWeight: 700, fontFamily: monoStack }}>
              {task.records.length > 0
                ? (task.records.reduce((s, r) => s + r.focusLevel, 0) / task.records.length).toFixed(1)
                : "-"}
            </div>
            <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 6 }}>/4.0</div>
          </Card>
        </div>

        {!task.completed && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Btn variant="outline" onClick={onAddManualRecord} icon={<Plus size={13} />} fullWidth>
                기록 추가
              </Btn>
              <Btn variant="primary" onClick={onStartSession} icon={<Play size={13} />} fullWidth>
                학습 시작
              </Btn>
            </div>
            <Btn variant="outline" onClick={onCompleteTask} icon={<Check size={13} />} fullWidth>
              완료 처리
            </Btn>
          </div>
        )}

        <SectionLabel>학습 기록</SectionLabel>
        {task.records.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${tone.borderStrong}`,
              borderRadius: 12,
              padding: 28,
              textAlign: "center",
              color: tone.inkMuted,
              fontSize: 12,
            }}
          >
            아직 학습 기록이 없습니다
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...task.records].reverse().map((r) => (
              <Card key={r.id}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                  <Pill variant="default" size="sm">{r.durationMin}분</Pill>
                  <Pill variant="muted" size="sm">집중 {FOCUS_LABELS[r.focusLevel]}</Pill>
                  <Pill variant="accent" size="sm">{PROGRESS_LABELS[r.progressLevel]} ({r.progressPercent}%)</Pill>
                  {r.source === "MANUAL" && <Pill variant="muted" size="sm">수동</Pill>}
                </div>
                <div style={{ fontSize: 11, color: tone.inkMuted }}>
                  {r.endedAt.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                {r.notes && (
                  <div style={{ fontSize: 11, color: tone.inkMuted, marginTop: 6, lineHeight: 1.5 }}>
                    {r.notes}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
