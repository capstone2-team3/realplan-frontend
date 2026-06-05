import { useState } from "react";
import { Bell, Calendar, ChevronLeft, ChevronRight, Clock, Info, Sparkles, X } from "lucide-react";
import type { Folder, Screen, Task } from "../types";
import { Btn } from "../components/Btn";
import { Card } from "../components/Card";
import { ImportancePill } from "../components/ImportancePill";
import { Modal } from "../components/Modal";
import { Pill } from "../components/Pill";
import { ScheduleBuilder } from "../components/ScheduleBuilder";
import { SectionLabel } from "../components/SectionLabel";
import { TimeSlotGrid } from "../components/TimeSlotGrid";
import { TodayScheduleView } from "../components/TodayScheduleView";
import { fmtAgo, fmtDday, fmtMin } from "../lib/format";
import { compressSlots, slotIndexToLabel } from "../lib/schedule";
import { getReminderTasks } from "../lib/tasks";
import { dateKey, fmtMonthDay, fmtMonthDayWeekday, isSameDay, startOfToday, today } from "../lib/time";
import { monoStack, tone } from "../theme/tokens";
import { FOCUS_BAND_LABELS, IMPORTANCE_RANK, TASK_FOCUS_BAND } from "../types";

export function HomeScreen({
  tasks,
  folders,
  onNavigate,
  recommendation,
  setRecommendation,
  userName,
}: {
  tasks: Task[];
  folders: Folder[];
  onNavigate: (s: Screen) => void;
  recommendation: { items: Task[]; total: number } | null;
  setRecommendation: (r: { items: Task[]; total: number } | null) => void;
  userName: string;
}) {
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);
  // 시간표 빌더 열림 상태 (어느 날짜에 대해서 열린 건지 포함)
  const [scheduleOpenFor, setScheduleOpenFor] = useState<Date | null>(null);
  // 날짜별 시간표 저장: { "YYYY-MM-DD": { slotIdx: taskId } }
  const [schedulesByDate, setSchedulesByDate] = useState<Record<string, Record<number, string>>>({});
  // 날짜별 가용시간대 저장: { "YYYY-MM-DD": Set<slotIdx> }
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, Set<number>>>({});
  // "n월 n일 시간표" 섹션에서 현재 열람 중인 날짜 (가용시간/추천/시간표의 공통 축)
  const [viewDate, setViewDate] = useState<Date>(startOfToday);
  // 시간대 입력 모달 (viewDate 기준으로 동작)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftSlots, setDraftSlots] = useState<Set<number>>(new Set());

  const reminderTasks = getReminderTasks(tasks);

  const upcoming = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 3);

  // 현재 viewDate의 가용시간대
  const viewDateKey = dateKey(viewDate);
  const currentAvailability = availabilityByDate[viewDateKey] ?? new Set<number>();
  const availableMin = currentAvailability.size * 30;
  const slotRanges = compressSlots(currentAvailability);

  // viewDate 시간표에서 이미 배정된 슬롯·Task별 분 단위 합계 (추천 계산용)
  const viewDateSchedule = schedulesByDate[viewDateKey] ?? {};
  const assignedMinutesByTask: Record<string, number> = {};
  for (const [slot, tid] of Object.entries(viewDateSchedule)) {
    if (currentAvailability.has(parseInt(slot))) {
      assignedMinutesByTask[tid] = (assignedMinutesByTask[tid] ?? 0) + 30;
    }
  }
  const assignedSlotsInAvail = Object.keys(viewDateSchedule)
    .map((k) => parseInt(k))
    .filter((idx) => currentAvailability.has(idx));
  const minutesAlreadyAssigned = assignedSlotsInAvail.length * 30;

  // 추천 계산: 가용시간 중 이미 배정된 슬롯 제외, 배정된 Task의 잔여시간도 차감
  const generateRecommendation = () => {
    if (availableMin === 0) return;
    let left = availableMin - minutesAlreadyAssigned;
    if (left <= 0) {
      setRecommendation({ items: [], total: minutesAlreadyAssigned });
      setShowAllRecs(false);
      return;
    }
    const picked: Task[] = [];
    const scored = tasks
      .filter((t) => !t.completed)
      .map((t) => {
        const daysLeft = Math.max(0.5, (t.deadline.getTime() - today.getTime()) / 86400000);
        const score = (1 / daysLeft) * 100 + IMPORTANCE_RANK[t.importance] * 15;
        // 이미 사용자가 배정한 시간만큼 잔여시간에서 차감
        const adjustedRemaining = Math.max(0, t.remainingMin - (assignedMinutesByTask[t.id] ?? 0));
        return { task: t, score, adjustedRemaining };
      })
      .filter((s) => s.adjustedRemaining > 0)
      .sort((a, b) => b.score - a.score);

    for (const { task: t, adjustedRemaining } of scored) {
      if (left <= 0) break;
      const alloc = Math.min(adjustedRemaining, left);
      if (alloc >= 15) {
        picked.push(t);
        left -= alloc;
      }
    }
    const recommendedMin = (availableMin - minutesAlreadyAssigned) - left;
    setRecommendation({ items: picked, total: recommendedMin });
    setShowAllRecs(false);
  };

  const openPicker = () => {
    setDraftSlots(new Set(currentAvailability));
    setPickerOpen(true);
  };

  // 가용시간 저장: viewDate 기준 키로
  const saveAvailability = (slots: Set<number>) => {
    setAvailabilityByDate((prev) => ({ ...prev, [viewDateKey]: slots }));
  };

  // viewDate가 바뀌면 추천 결과는 더 이상 유효하지 않으므로 초기화
  const changeViewDate = (delta: number) => {
    setRecommendation(null);
    setShowAllRecs(false);
    setViewDate((d) => new Date(d.getTime() + delta * 86400000));
  };

  const visibleRecs =
    recommendation && !showAllRecs ? recommendation.items.slice(0, 3) : recommendation?.items ?? [];

  // 열람 중인 날짜의 시간표 (viewDateSchedule를 그대로 재사용)
  const viewSchedule = viewDateSchedule;
  const hasViewSchedule = Object.keys(viewSchedule).length > 0;
  const canGoPrevDate = !isSameDay(viewDate, startOfToday);

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <div style={{ padding: "24px 0 14px" }}>
        <div style={{ fontSize: 12, color: tone.inkMuted, marginBottom: 4 }}>
          {today.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
          안녕하세요, <span style={{ color: tone.accent }}>{userName}</span>님
        </div>
      </div>

      {/* Task Reminder */}
      {reminderTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Task 리마인더</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reminderTasks.map((t) => (
              <Card
                key={t.id}
                onClick={() => onNavigate({ name: "taskDetail", taskId: t.id })}
                style={{ borderColor: tone.warnSoft, background: tone.warnSoft }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: tone.warn,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bell size={15} color={tone.surface} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.name}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill variant="default" size="sm">
                        <Clock size={9} /> {fmtMin(t.remainingMin)} 남음
                      </Pill>
                      <Pill variant={fmtDday(t.deadline).startsWith("D-") && parseInt(fmtDday(t.deadline).slice(2)) <= 3 ? "danger" : "muted"} size="sm">
                        {fmtDday(t.deadline)}
                      </Pill>
                      {t.lastNotifiedAt && (
                        <span style={{ fontSize: 10, color: tone.warn, fontWeight: 500 }}>
                          {fmtAgo(t.lastNotifiedAt)} 알림
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} color={tone.warn} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Date-scoped container: 날짜 네비 + 시간표 + 시간표 생성하기 */}
      <div
        style={{
          background: tone.surfaceMuted,
          border: `1px solid ${tone.border}`,
          borderRadius: 14,
          padding: 12,
          marginBottom: 16,
        }}
      >
        {/* Date header: 이 박스 전체가 이 날짜에 대한 영역임을 알리는 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 10,
            marginBottom: 12,
            borderBottom: `1px solid ${tone.border}`,
          }}
        >
          <button
            onClick={() => canGoPrevDate && changeViewDate(-1)}
            disabled={!canGoPrevDate}
            style={{
              background: "none",
              border: "none",
              padding: 4,
              cursor: canGoPrevDate ? "pointer" : "not-allowed",
              opacity: canGoPrevDate ? 1 : 0.3,
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronLeft size={18} color={tone.inkMuted} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {fmtMonthDayWeekday(viewDate)}
            </div>
            {isSameDay(viewDate, startOfToday) && <Pill variant="accent" size="sm">오늘</Pill>}
          </div>
          <button
            onClick={() => changeViewDate(1)}
            style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ChevronRight size={18} color={tone.inkMuted} />
          </button>
        </div>

        {/* Date-scoped schedule view */}
        <div style={{ marginBottom: 12 }}>
          {hasViewSchedule ? (
            <TodayScheduleView
              schedule={viewSchedule}
              recommendedTasks={recommendation?.items ?? []}
              allTasks={tasks}
              onTaskClick={(taskId) => onNavigate({ name: "taskDetail", taskId })}
              showNowIndicator={isSameDay(viewDate, startOfToday)}
            />
          ) : (
            <div
              style={{
                border: `1px dashed ${tone.borderStrong}`,
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
                color: tone.inkMuted,
                fontSize: 12,
                background: tone.surface,
              }}
            >
              {fmtMonthDay(viewDate)}에 생성된 시간표가 없습니다
            </div>
          )}
        </div>

        {/* Schedule generator card */}
        <Card style={{ marginBottom: 0, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Sparkles size={14} color={tone.accent} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>시간표 생성하기</div>
        </div>
        <div style={{ fontSize: 12, color: tone.inkMuted, marginBottom: 12 }}>
          가용시간대를 입력하고 학습 추천을 받거나, 원하는 Task를 직접 배치하세요
        </div>

        {/* Available time slots opener */}
        <div
          onClick={openPicker}
          style={{
            padding: "12px 14px",
            background: tone.surfaceMuted,
            border: `1px solid ${tone.border}`,
            borderRadius: 10,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <Calendar size={15} color={tone.inkMuted} />
              <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                {availableMin === 0 ? (
                  <span style={{ color: tone.inkSubtle }}>시간대 선택</span>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmtMin(availableMin)}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: tone.inkMuted,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slotRanges
                        .map((r) => `${slotIndexToLabel(r.start)}–${slotIndexToLabel(r.end)}`)
                        .join(", ")}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <ChevronRight size={16} color={tone.inkSubtle} />
          </div>
        </div>

        <Btn
          fullWidth
          onClick={generateRecommendation}
          disabled={availableMin === 0}
          icon={<Sparkles size={14} />}
        >
          {recommendation ? "다시 추천받기" : "추천받기"}
        </Btn>

        {recommendation && recommendation.items.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {/* Header with info icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: tone.inkSubtle,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                추천 결과 · {fmtMin(recommendation.total)}
              </div>
              <button
                onClick={() => setScoreInfoOpen((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Info size={14} color={tone.inkSubtle} />
              </button>

              {/* Score info overlay */}
              {scoreInfoOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 22,
                    right: 0,
                    width: 240,
                    background: tone.ink,
                    color: tone.surface,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 11,
                    lineHeight: 1.6,
                    zIndex: 20,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                    추천도 점수 계산
                    <X size={12} style={{ cursor: "pointer" }} onClick={() => setScoreInfoOpen(false)} />
                  </div>
                  <div style={{ opacity: 0.9 }}>
                    마감 긴급도(마감일이 가까울수록 ↑)와 사용자가 지정한 중요도를 합산해 점수를 매깁니다.
                    그 후 가용시간 안에서 점수가 높은 Task부터 채워 넣습니다.
                    <div style={{ marginTop: 6, fontFamily: monoStack, fontSize: 10, opacity: 0.8 }}>
                      점수 = (1 / 마감까지_일수)×100 + 중요도×15
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleRecs.map((t, i) => {
                const band = TASK_FOCUS_BAND[t.type];
                return (
                  <div
                    key={t.id}
                    onClick={() => onNavigate({ name: "taskDetail", taskId: t.id })}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      border: `1px solid ${tone.border}`,
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: tone.ink,
                        color: tone.surface,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 6 }}>
                        {fmtMin(t.remainingMin)} · {fmtDday(t.deadline)}
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <ImportancePill value={t.importance} />
                        <Pill variant="warn" size="sm">🔥 {FOCUS_BAND_LABELS[band]}</Pill>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show more */}
            {recommendation.items.length > 3 && (
              <button
                onClick={() => setShowAllRecs((v) => !v)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "8px 0",
                  background: "transparent",
                  border: `1px solid ${tone.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: tone.inkMuted,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {showAllRecs ? "접기" : `더보기 (+${recommendation.items.length - 3})`}
              </button>
            )}
          </div>
        )}

        {/* Always-visible 일정 추가하기 button (recommendation 있어도, 없어도 노출) */}
        <Btn
          fullWidth
          variant="outline"
          onClick={() => setScheduleOpenFor(viewDate)}
          icon={<Calendar size={14} />}
        >
          <span style={{ marginLeft: 2 }}>일정 추가하기</span>
        </Btn>
      </Card>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>다가오는 마감</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.map((t) => {
              const days = Math.ceil((t.deadline.getTime() - today.getTime()) / 86400000);
              const urgent = days <= 3;
              return (
                <Card key={t.id} onClick={() => onNavigate({ name: "taskDetail", taskId: t.id })}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: tone.inkMuted }}>
                        {fmtMin(t.remainingMin)} 남음
                      </div>
                    </div>
                    <Pill variant={urgent ? "danger" : "muted"}>{fmtDday(t.deadline)}</Pill>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Slot Picker Modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`${fmtMonthDay(viewDate)}의 가용시간대`}
        size="lg"
        footer={
          <>
            <Btn variant="outline" fullWidth onClick={() => setPickerOpen(false)}>취소</Btn>
            <Btn
              variant="primary"
              fullWidth
              onClick={() => {
                saveAvailability(new Set(draftSlots));
                setPickerOpen(false);
              }}
            >
              저장 ({fmtMin(draftSlots.size * 30)})
            </Btn>
          </>
        }
      >
        <TimeSlotGrid
          selected={draftSlots}
          onChange={setDraftSlots}
          disabledSlots={
            new Set(
              Object.keys(viewDateSchedule).map((k) => parseInt(k)),
            )
          }
        />
      </Modal>

      {/* Schedule Builder Overlay */}
      {scheduleOpenFor && (
        <ScheduleBuilder
          date={scheduleOpenFor}
          onDateChange={(d, currentAssignment) => {
            // 현재 작업 중인 날짜의 assignment를 저장하고 새 날짜로 이동
            const prevKey = dateKey(scheduleOpenFor);
            setSchedulesByDate((prev) => ({ ...prev, [prevKey]: currentAssignment }));
            setScheduleOpenFor(d);
          }}
          availableSlots={availabilityByDate[dateKey(scheduleOpenFor)] ?? new Set<number>()}
          hasAvailability={(availabilityByDate[dateKey(scheduleOpenFor)]?.size ?? 0) > 0}
          recommendation={recommendation}
          allTasks={tasks.filter((t) => !t.completed)}
          folders={folders}
          initialSchedule={schedulesByDate[dateKey(scheduleOpenFor)] ?? {}}
          onSave={(s) => {
            const k = dateKey(scheduleOpenFor);
            setSchedulesByDate((prev) => ({ ...prev, [k]: s }));
            setScheduleOpenFor(null);
          }}
          onClose={() => setScheduleOpenFor(null)}
        />
      )}
    </div>
  );
}
