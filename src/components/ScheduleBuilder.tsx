import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Sparkles, X, Zap } from "lucide-react";
import type { Folder, Task } from "../types";
import { Btn } from "./Btn";
import { Pill } from "./Pill";
import { SLOTS_PER_HOUR, TOTAL_SLOTS, slotIndexToLabel } from "../lib/schedule";
import { buildTaskOrder, colorForTask } from "../lib/tasks";
import { fmtMonthDayWeekday, isSameDay, startOfToday } from "../lib/time";
import { fmtMin, fmtDday } from "../lib/format";
import { monoStack, tone } from "../theme/tokens";
import { FOCUS_BAND_LABELS, TASK_FOCUS_BAND } from "../types";

export function ScheduleBuilder({
  date,
  onDateChange,
  availableSlots,
  hasAvailability,
  recommendation,
  allTasks,
  folders,
  initialSchedule,
  onSave,
  onClose,
}: {
  date: Date;
  onDateChange: (d: Date, currentAssignment: Record<number, string>) => void;
  availableSlots: Set<number>;
  hasAvailability: boolean;
  recommendation: { items: Task[]; total: number } | null;
  allTasks: Task[];
  folders: Folder[];
  initialSchedule: Record<number, string>;
  onSave: (schedule: Record<number, string>) => void;
  onClose: () => void;
}) {
  const recommendedTasks = recommendation?.items ?? [];
  const [assignment, setAssignment] = useState<Record<number, string>>({ ...initialSchedule });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [autoFillInfoOpen, setAutoFillInfoOpen] = useState(false);

  // 날짜가 바뀌면 그 날짜의 저장된 시간표(initialSchedule)로 교체
  // (부모가 이전 날짜의 assignment를 schedulesByDate에 저장해두는 책임)
  const dateStr = date.toISOString();
  useEffect(() => {
    setAssignment({ ...initialSchedule });
    // 새 날짜로 가면 활성 Task도 초기화
    setActiveTaskId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  // 카테고리 펼침 상태: 추천은 기본 열림, 폴더는 기본 닫힘
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { __rec__: true };
    folders.forEach((f) => (init[f.id] = false));
    return init;
  });

  const dragModeRef = useRef<null | "PAINT" | "ERASE">(null);
  const dragStartRef = useRef<number | null>(null);
  const baseAssignRef = useRef<Record<number, string>>({});

  const order = buildTaskOrder(recommendedTasks, allTasks);
  const colorOf = (taskId: string) => colorForTask(taskId, order);
  const taskById = (id: string) => allTasks.find((t) => t.id === id);

  // 가용시간대가 입력되었으면 그 슬롯만 페인트 가능, 아니면 전 슬롯 자유 페인트
  const isPaintable = (idx: number) => (hasAvailability ? availableSlots.has(idx) : true);

  // 추천 Task에 이미 올라온 id는 폴더 목록에서 제외
  const recIds = new Set(recommendedTasks.map((t) => t.id));

  const applyRange = (fromIdx: number, toIdx: number, mode: "PAINT" | "ERASE") => {
    if (!activeTaskId && mode === "PAINT") return;
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    const next = { ...baseAssignRef.current };
    for (let i = lo; i <= hi; i++) {
      if (!isPaintable(i)) continue;
      if (mode === "PAINT" && activeTaskId) next[i] = activeTaskId;
      else delete next[i];
    }
    setAssignment(next);
  };

  const handleStart = (idx: number) => {
    if (!isPaintable(idx)) return;
    const mode: "PAINT" | "ERASE" = assignment[idx] === activeTaskId && assignment[idx] ? "ERASE" : "PAINT";
    dragModeRef.current = mode;
    dragStartRef.current = idx;
    baseAssignRef.current = { ...assignment };
    applyRange(idx, idx, mode);
  };
  const handleEnter = (idx: number) => {
    if (!dragModeRef.current || dragStartRef.current === null) return;
    applyRange(dragStartRef.current, idx, dragModeRef.current);
  };
  const handleEnd = () => {
    dragModeRef.current = null;
    dragStartRef.current = null;
    baseAssignRef.current = {};
  };

  // 시간표 자동 완성: 사용자가 비워둔 가용 슬롯에 추천 Task들을 순서대로 채움
  const handleAutoFill = () => {
    if (recommendedTasks.length === 0) return;
    const next = { ...assignment };
    // 가용 슬롯 중 아직 비어 있는 슬롯 (정렬)
    const emptyAvail: number[] = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (isPaintable(i) && !next[i]) emptyAvail.push(i);
    }
    // Task별로 채울 잔여시간 (이미 배정된 만큼 차감)
    const remainBySlots: Record<string, number> = {};
    for (const t of recommendedTasks) {
      const alreadyMin = Object.entries(next).filter(([, tid]) => tid === t.id).length * 30;
      remainBySlots[t.id] = Math.max(0, Math.ceil((t.remainingMin - alreadyMin) / 30));
    }
    let recIdx = 0;
    for (const slot of emptyAvail) {
      // 다음으로 잔여가 있는 추천 Task 찾기
      let tries = 0;
      while (tries < recommendedTasks.length && remainBySlots[recommendedTasks[recIdx].id] <= 0) {
        recIdx = (recIdx + 1) % recommendedTasks.length;
        tries++;
      }
      const tid = recommendedTasks[recIdx]?.id;
      if (!tid || remainBySlots[tid] <= 0) break;
      next[slot] = tid;
      remainBySlots[tid]--;
    }
    setAssignment(next);
  };

  const allSlots: number[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) allSlots.push(i);

  const assignedCount = Object.keys(assignment).length;
  const toggleCat = (key: string) => setOpenCats((p) => ({ ...p, [key]: !p[key] }));

  // 카테고리: 추천 + 폴더별
  type Category = { key: string; label: string; tasks: Task[]; isRec?: boolean };
  const categories: Category[] = [];
  if (recommendedTasks.length > 0) {
    categories.push({ key: "__rec__", label: "추천 Task", tasks: recommendedTasks, isRec: true });
  }
  folders.forEach((f) => {
    const fTasks = allTasks.filter((t) => t.folderId === f.id && !recIds.has(t.id));
    if (fTasks.length > 0) {
      categories.push({ key: f.id, label: f.name, tasks: fTasks });
    }
  });

  const renderTaskButton = (t: Task, isRec: boolean) => {
    const sel = activeTaskId === t.id;
    const c = colorOf(t.id);
    return (
      <button
        key={t.id}
        onClick={() => setActiveTaskId(t.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "8px 8px",
          borderRadius: 9,
          border: `2px solid ${sel ? c : tone.border}`,
          background: sel ? `${c}14` : tone.surface,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 3, background: c, flexShrink: 0, marginTop: 1 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: sel ? 600 : 500, color: tone.ink, display: "block", lineHeight: 1.3 }}>
            {t.name}
          </span>
          <span style={{ fontSize: 9, color: tone.warn, fontWeight: 600, display: "block", marginTop: 2 }}>
            🔥 {FOCUS_BAND_LABELS[TASK_FOCUS_BAND[t.type]]}
          </span>
          <span
            style={{
              fontSize: 9,
              color: tone.inkSubtle,
              display: "flex",
              gap: 6,
              marginTop: 2,
              fontFamily: monoStack,
              whiteSpace: "nowrap",
            }}
          >
            <span>{fmtDday(t.deadline)}</span>
            <span>·</span>
            <span>{fmtMin(t.remainingMin)} 남음</span>
          </span>
          {isRec && (
            <span style={{ fontSize: 9, color: tone.accent, fontWeight: 600 }}>
              추천 #{recommendedTasks.findIndex((r) => r.id === t.id) + 1}
            </span>
          )}
        </span>
      </button>
    );
  };

  // 날짜 네비
  const canGoPrev = !isSameDay(date, startOfToday); // 오늘 이전으로는 못 감
  const handlePrevDay = () => {
    if (!canGoPrev) return;
    onDateChange(new Date(date.getTime() - 86400000), assignment);
  };
  const handleNextDay = () => {
    onDateChange(new Date(date.getTime() + 86400000), assignment);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28, 27, 26, 0.5)",
        zIndex: 120,
        display: "flex",
        alignItems: "flex-end",
        animation: "fadeIn 0.2s",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchEnd={handleEnd}
        style={{
          width: "100%",
          background: tone.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "94%",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.25s",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px 10px",
            borderBottom: `1px solid ${tone.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={handlePrevDay} disabled={!canGoPrev} style={{ background: "none", border: "none", padding: 4, cursor: canGoPrev ? "pointer" : "not-allowed", opacity: canGoPrev ? 1 : 0.3 }}>
                <ChevronLeft size={16} color={tone.inkMuted} />
              </button>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                  {fmtMonthDayWeekday(date)} 시간표
                  {isSameDay(date, startOfToday) && <Pill variant="accent" size="sm">오늘</Pill>}
                </div>
                <div style={{ fontSize: 10, color: tone.inkMuted, marginTop: 2 }}>
                  Task를 선택하고 시간을 드래그하세요
                </div>
              </div>
              <button onClick={handleNextDay} style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}>
                <ChevronRight size={16} color={tone.inkMuted} />
              </button>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <X size={18} color={tone.inkMuted} />
            </button>
          </div>

          {/* Action row: 시간표 자동 완성 (추천이 있을 때만 노출) */}
          {recommendation && (
            <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={handleAutoFill}
                  icon={<Zap size={12} />}
                >
                  시간표 자동 완성
                </Btn>
                <button
                  onClick={() => setAutoFillInfoOpen((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <Info size={13} color={tone.inkSubtle} />
                </button>
                {autoFillInfoOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: 28,
                      right: 0,
                      width: 230,
                      background: tone.ink,
                      color: tone.surface,
                      borderRadius: 10,
                      padding: 11,
                      fontSize: 10.5,
                      lineHeight: 1.6,
                      zIndex: 30,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
                      시간표 자동 완성
                      <X size={11} style={{ cursor: "pointer" }} onClick={() => setAutoFillInfoOpen(false)} />
                    </div>
                    <div style={{ opacity: 0.9 }}>
                      추천 Task들을 비어있는 가용시간대에 자동 배치합니다. 사용자가 이미 채워놓은 슬롯은 건드리지 않습니다.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasAvailability && (
            <div
              style={{
                marginTop: 10,
                padding: 9,
                background: tone.surfaceMuted,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontSize: 10.5,
                color: tone.inkMuted,
                lineHeight: 1.5,
              }}
            >
              가용시간대 없이도 자유롭게 배치할 수 있어요. 학습 추천을 받으려면 먼저 가용시간대를 입력해주세요.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: task palette */}
          <div
            style={{
              width: 172,
              borderRight: `1px solid ${tone.border}`,
              padding: 10,
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: tone.inkSubtle, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Task 선택
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.map((cat) => {
                const open = openCats[cat.key];
                return (
                  <div key={cat.key}>
                    <button
                      onClick={() => toggleCat(cat.key)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {open ? (
                        <ChevronDown size={13} color={tone.inkMuted} />
                      ) : (
                        <ChevronRight size={13} color={tone.inkMuted} />
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: cat.isRec ? tone.accent : tone.ink,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {cat.isRec && <Sparkles size={11} color={tone.accent} />}
                        {cat.label}
                      </span>
                      <span style={{ fontSize: 9, color: tone.inkSubtle, marginLeft: "auto" }}>
                        {cat.tasks.length}
                      </span>
                    </button>
                    {open && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 4, marginTop: 4 }}>
                        {cat.tasks.map((t) => renderTaskButton(t, !!cat.isRec))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: time grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, userSelect: "none" }}>
            <div style={{ fontSize: 10, color: tone.inkSubtle, marginBottom: 6 }}>
              {hasAvailability
                ? `가용시간대 ${assignedCount}/${availableSlots.size} 슬롯 배정됨`
                : `${assignedCount}개 슬롯 배정됨`}
            </div>
            <div
              style={{
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {allSlots.map((idx) => {
                const paintable = isPaintable(idx);
                const assignedTaskId = assignment[idx];
                const isHourStart = idx % SLOTS_PER_HOUR === 0;
                const c = assignedTaskId ? colorOf(assignedTaskId) : null;
                return (
                  <div
                    key={idx}
                    onMouseDown={() => handleStart(idx)}
                    onMouseEnter={() => handleEnter(idx)}
                    onTouchStart={() => handleStart(idx)}
                    onTouchMove={(e) => {
                      const t = e.touches[0];
                      const el = document.elementFromPoint(t.clientX, t.clientY);
                      const di = el?.getAttribute("data-sb-slot");
                      if (di) handleEnter(parseInt(di));
                    }}
                    data-sb-slot={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr",
                      borderTop: idx === 0 ? "none" : `1px solid ${isHourStart ? tone.borderStrong : tone.border}`,
                      cursor: paintable ? "pointer" : "not-allowed",
                      opacity: paintable ? 1 : 0.4,
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 6px",
                        fontSize: 9,
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
                        padding: "6px 8px",
                        minHeight: 24,
                        background: !paintable
                          ? `repeating-linear-gradient(45deg, ${tone.surfaceMuted}, ${tone.surfaceMuted} 4px, ${tone.surface} 4px, ${tone.surface} 8px)`
                          : c
                            ? c
                            : tone.surface,
                        color: c ? tone.surface : tone.inkSubtle,
                        fontSize: 9,
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        transition: "background 0.1s",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {!paintable ? "" : assignedTaskId ? taskById(assignedTaskId)?.name ?? "" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: 14, borderTop: `1px solid ${tone.border}`, display: "flex", gap: 8 }}>
          <Btn variant="outline" fullWidth onClick={() => setAssignment({})}>
            초기화
          </Btn>
          <Btn variant="primary" fullWidth onClick={() => onSave(assignment)}>
            완료
          </Btn>
        </div>
      </div>
    </div>
  );
}
