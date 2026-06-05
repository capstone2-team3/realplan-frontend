import { useState, useEffect, useRef } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import type { Difficulty, Folder, Importance, Task, TaskTypeCode } from "../types";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { today } from "../lib/time";
import { monoStack, tone } from "../theme/tokens";
import { DIFFICULTY_LABELS, IMPORTANCE_LABELS, TASK_TYPE_DESC, TASK_TYPE_LABELS } from "../types";
import { api } from "../api";

export function TaskFormModal({
  open,
  onClose,
  onSubmit,
  folders,
  defaultFolderId,
  editingTask,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (t: Omit<Task, "id" | "records" | "createdAt">, editingId?: string) => void;
  folders: Folder[];
  defaultFolderId: string;
  editingTask?: Task | null;
}) {
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [type, setType] = useState<TaskTypeCode>("SATISFACTION_BASED");
  const [estimatedMin, setEstimatedMin] = useState("");
  const [correctionEnabled, setCorrectionEnabled] = useState(true);
  const [importance, setImportance] = useState<Importance>("MEDIUM");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  // 자동 유형 분류: 사용자가 유형을 직접 고르면 자동 추천이 덮어쓰지 않도록 추적
  const [typeAutoFilled, setTypeAutoFilled] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const typeManuallySetRef = useRef(false);
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset/preload form values when modal opens or editingTask changes
  useEffect(() => {
    if (!open) return;
    setTypeAutoFilled(false);
    setClassifying(false);
    if (editingTask) {
      setName(editingTask.name);
      setFolderId(editingTask.folderId);
      setType(editingTask.type);
      setEstimatedMin(String(editingTask.originalEstimatedMin));
      setCorrectionEnabled(editingTask.correctionEnabled);
      setImportance(editingTask.importance);
      setDifficulty(editingTask.difficulty);
      setNotes(editingTask.notes || "");
      setDeadline(editingTask.deadline.toISOString().split("T")[0]);
      // 편집 모드: 기존 유형을 그대로 존중 (자동 분류로 덮지 않음)
      typeManuallySetRef.current = true;
    } else {
      setName("");
      setFolderId(defaultFolderId);
      setType("SATISFACTION_BASED");
      setEstimatedMin("");
      setCorrectionEnabled(true);
      setImportance("MEDIUM");
      setDifficulty("MEDIUM");
      setNotes("");
      setDeadline("");
      typeManuallySetRef.current = false;
    }
  }, [open, editingTask, defaultFolderId]);

  // 이름 입력이 멈추고 500ms 후 유형 자동 분류 (사용자가 직접 고른 적 없을 때만)
  useEffect(() => {
    if (!open) return;
    if (typeManuallySetRef.current) return; // 직접 선택했으면 자동 분류 안 함
    const trimmed = name.trim();
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    if (trimmed.length < 2) {
      setClassifying(false);
      return;
    }
    setClassifying(true);
    classifyTimerRef.current = setTimeout(async () => {
      try {
        const suggested = await api.classifyTaskType(trimmed);
        // 호출이 끝나기 전에 사용자가 직접 골랐다면 무시
        if (!typeManuallySetRef.current) {
          setType(suggested);
          setTypeAutoFilled(true);
        }
      } catch (e) {
        console.error("유형 자동 분류 실패:", e);
      } finally {
        setClassifying(false);
      }
    }, 500);
    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    };
  }, [name, open]);

  const COEF: Record<TaskTypeCode, number> = {
    TIME_BASED: 1.0,
    QUANTITY_BASED: 1.3,
    SATISFACTION_BASED: 1.6,
  };

  const applyCorrection = !(type === "TIME_BASED" && !correctionEnabled);
  const baseMin = parseInt(estimatedMin || "0");
  const correctedMin = applyCorrection ? Math.round(baseMin * COEF[type]) : baseMin;
  const showCorrection = baseMin > 0 && correctedMin !== baseMin;

  const handleSubmit = () => {
    if (!name.trim() || baseMin <= 0 || !deadline) return;
    const oldSpent = editingTask
      ? editingTask.adjustedEstimatedMin - editingTask.remainingMin
      : 0;
    onSubmit(
      {
        folderId,
        name: name.trim(),
        type,
        correctionEnabled,
        importance,
        difficulty,
        notes: notes.trim() || undefined,
        originalEstimatedMin: baseMin,
        adjustedEstimatedMin: correctedMin,
        remainingMin: Math.max(0, correctedMin - oldSpent),
        deadline: new Date(deadline),
        completed: editingTask?.completed || false,
      },
      editingTask?.id,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTask ? "Task 정보 수정" : "새 Task"}
      size="lg"
      footer={
        <>
          <Btn variant="outline" fullWidth onClick={onClose}>취소</Btn>
          <Btn
            fullWidth
            disabled={!name.trim() || baseMin <= 0 || !deadline}
            onClick={handleSubmit}
          >
            {editingTask ? "저장" : "생성"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            Task 이름
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 운영체제 보고서 작성"
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
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>폴더</div>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
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
            }}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              color: tone.inkMuted,
              marginBottom: 6,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Task 유형
            {classifying && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: tone.accent, fontSize: 10 }}>
                <Sparkles size={10} />
                AI 분류 중...
              </span>
            )}
            {!classifying && typeAutoFilled && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: tone.accent, fontSize: 10 }}>
                <Sparkles size={10} />
                AI 추천됨 · 직접 변경 가능
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["TIME_BASED", "QUANTITY_BASED", "SATISFACTION_BASED"] as TaskTypeCode[]).map((t) => {
              const sel = type === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setType(t);
                    typeManuallySetRef.current = true;
                    setTypeAutoFilled(false);
                    setClassifying(false);
                  }}
                  style={{
                    padding: "11px 12px",
                    borderRadius: 10,
                    border: `1px solid ${sel ? tone.ink : tone.border}`,
                    background: sel ? tone.ink : tone.surface,
                    color: sel ? tone.surface : tone.ink,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {TASK_TYPE_LABELS[t]}
                  </div>
                  <div style={{ fontSize: 10, color: sel ? tone.surfaceMuted : tone.inkSubtle, lineHeight: 1.4 }}>
                    {TASK_TYPE_DESC[t]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {type === "TIME_BASED" && (
          <div
            style={{
              padding: 11,
              background: tone.accentSoft,
              borderRadius: 10,
              border: `1px solid ${tone.accentSoft}`,
            }}
          >
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={correctionEnabled}
                onChange={(e) => setCorrectionEnabled(e.target.checked)}
                style={{ marginTop: 2, accentColor: tone.accent }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: tone.accent, marginBottom: 2 }}>
                  난이도 보정 적용
                </div>
                <div style={{ fontSize: 10, color: tone.accent, lineHeight: 1.4 }}>
                  시간형은 완료 시점이 명확하므로 보정을 끌 수 있습니다. 끄면 입력한 시간 그대로 사용됩니다.
                </div>
              </div>
            </label>
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            예상 소요 시간 (분)
          </div>
          <input
            type="number"
            value={estimatedMin}
            onChange={(e) => setEstimatedMin(e.target.value)}
            placeholder="60"
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

          {showCorrection && (
            <div
              style={{
                marginTop: 8,
                padding: 11,
                background: tone.warnSoft,
                borderRadius: 10,
                border: `1px solid ${tone.warnSoft}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <AlertCircle size={12} color={tone.warn} />
                <div style={{ fontSize: 11, fontWeight: 600, color: tone.warn }}>
                  계획 오류 보정 미리보기
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ background: tone.surface, padding: 8, borderRadius: 7, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: tone.inkMuted, marginBottom: 2 }}>내 예측</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: monoStack }}>{baseMin}분</div>
                </div>
                <div style={{ background: tone.warn, padding: 8, borderRadius: 7, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: tone.warnSoft, marginBottom: 2 }}>AI 보정 (×{COEF[type]})</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: monoStack, color: tone.surface }}>
                    {correctedMin}분
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Importance (NEW) */}
        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 6, fontWeight: 500 }}>
            중요도
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {(["HIGH", "MEDIUM", "LOW"] as Importance[]).map((imp) => {
              const sel = importance === imp;
              const icon = imp === "HIGH" ? <ArrowUp size={11} /> : imp === "LOW" ? <ArrowDown size={11} /> : null;
              return (
                <button
                  key={imp}
                  onClick={() => setImportance(imp)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${sel ? tone.ink : tone.border}`,
                    background: sel ? tone.ink : tone.surface,
                    color: sel ? tone.surface : tone.ink,
                    fontSize: 12,
                    fontWeight: sel ? 600 : 400,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {icon}
                  {IMPORTANCE_LABELS[imp]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty (NEW: 상/중/하/모름) */}
        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 6, fontWeight: 500 }}>
            난이도
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {(["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as Difficulty[]).map((d) => {
              const sel = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    padding: "10px 8px",
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
                  {DIFFICULTY_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>마감일</div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={today.toISOString().split("T")[0]}
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
            }}
          />
        </div>

        {/* Notes (NEW: 추가 정보) */}
        <div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
            추가 정보 (선택)
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="참고사항, 자료 링크, 메모 등"
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
