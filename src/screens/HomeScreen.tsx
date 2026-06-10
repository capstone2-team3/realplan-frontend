import { useState, useEffect, useRef } from "react";
import { Bell, Calendar, ChevronLeft, ChevronRight, Clock, Info, Sparkles, X } from "lucide-react";
import type { Folder, Screen, Task, HomeRecommendation, Reminder } from "../types";
import { api } from "../api";
import { ApiError } from "../api/client";
import type { FocusBucket } from "../api/types";
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
import { dateKey, fmtMonthDay, fmtMonthDayWeekday, isSameDay, startOfToday, today } from "../lib/time";
import { monoStack, tone } from "../theme/tokens";

// 추천 집중시간대 밴드 (추천 AI와 동일한 06-12 / 12-18 / 18-24 3구간).
const RECO_BANDS = [
  { label: "06-12시", hours: [6, 8, 10] },
  { label: "12-18시", hours: [12, 14, 16] },
  { label: "18-24시", hours: [18, 20, 22] },
];

// focus-by-hour(2시간 버킷) → 밴드별 (세션 가중) 평균 집중도. 실제 데이터가 있는 밴드만 반환한다.
function bandFocusStats(buckets: FocusBucket[]) {
  return RECO_BANDS.map((b) => {
    const inBand = buckets.filter((x) => b.hours.includes(x.startHour) && x.sessionCount > 0);
    const sessions = inBand.reduce((s, x) => s + x.sessionCount, 0);
    const avg = sessions > 0 ? inBand.reduce((s, x) => s + x.averageFocus * x.sessionCount, 0) / sessions : 0;
    return { label: b.label, avg, sessions };
  }).filter((b) => b.sessions > 0);
}

// 태스크별 집중시간대 라벨. 추천 API의 recommendedTimeBand 는 "현재 시각 이후"로만 필터되고
// 콜드스타트엔 기본값이 채워져 정보가 왜곡되므로, 실제 집중 데이터(focus-by-hour)로 직접 계산한다.
// - 데이터가 전혀 없으면 매핑에서 제외 → 화면에서 "분석 전"으로 표시된다(시각과 무관).
// - requiredFocusLevel 이 LOW 면 집중도가 가장 낮은 밴드, 그 외(HIGH/MEDIUM/FLEXIBLE)는 가장 높은 밴드.
function computeTimeBandByTask(
  items: { taskId: string; requiredFocusLevel: string }[],
  buckets: FocusBucket[],
): Record<string, string> {
  const stats = bandFocusStats(buckets);
  const result: Record<string, string> = {};
  if (stats.length === 0) return result; // 콜드스타트: 집중 데이터 없음
  const byFocusDesc = [...stats].sort((a, b) => b.avg - a.avg);
  for (const it of items) {
    const isLow = (it.requiredFocusLevel || "").toUpperCase() === "LOW";
    result[it.taskId] = (isLow ? byFocusDesc[byFocusDesc.length - 1] : byFocusDesc[0]).label;
  }
  return result;
}

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
  recommendation: HomeRecommendation | null;
  setRecommendation: (r: HomeRecommendation | null) => void;
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
  // 날짜별 서버 플랜 ID (DailyPlan API 호출에 사용)
  const [planIdByDate, setPlanIdByDate] = useState<Record<string, string>>({});
  // API 호출 중 버튼 중복 클릭 방지
  const [busy, setBusy] = useState(false);
  // 현재 빌더 세션에서 편집(날짜 이동 포함)한 날짜들 — 완료 시 모두 저장하기 위해 추적
  const builderDirtyDates = useRef<Set<string>>(new Set());

  // Task 리마인더: 서버(GET /tasks/reminders)가 노출 대상을 선별해 내려준다. 최대 3개.
  // 단, 서버 getReminders 는 "알림 이후 학습한 Task 제외" 필터가 없으므로, 각 리마인더의
  // ENDED 세션을 조회해 lastNotifiedAt 이후에 학습 기록이 생긴 Task 는 프론트에서 제외한다.
  // (이상적으로는 백엔드 getReminders 가 서버에서 걸러주는 게 맞다 — TODO(backend).)
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api.fetchReminders(3);
        const studiedAfterNotify = await Promise.all(
          list.map(async (r) => {
            if (!r.lastNotifiedAt) return false; // 알림 시각이 없으면 비교 불가 → 유지
            try {
              const sessions = await api.fetchTaskSessions(r.taskId);
              return sessions.some((s) => s.endedAt.getTime() > r.lastNotifiedAt!.getTime());
            } catch {
              return false;
            }
          }),
        );
        if (!alive) return;
        setReminders(list.filter((_, i) => !studiedAfterNotify[i]));
      } catch (e) {
        console.error("리마인더 조회 실패:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const upcoming = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 3);

  // 현재 viewDate의 가용시간대
  const viewDateKey = dateKey(viewDate);
  const currentAvailability = availabilityByDate[viewDateKey] ?? new Set<number>();
  const availableMin = currentAvailability.size * 30;
  const slotRanges = compressSlots(currentAvailability);

  // 열람 날짜가 바뀌면 서버에서 그 날짜의 플랜(가용시간·시간표)을 불러와 로컬 상태에 반영한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const plan = await api.fetchDailyPlan(viewDateKey);
        if (!alive) return;
        if (plan) {
          const avail = new Set<number>(plan.slots.map((s) => s.slotIndex));
          const sched: Record<number, string> = {};
          for (const s of plan.slots) if (s.taskId) sched[s.slotIndex] = s.taskId;
          setPlanIdByDate((p) => ({ ...p, [viewDateKey]: plan.id }));
          setAvailabilityByDate((p) => ({ ...p, [viewDateKey]: avail }));
          setSchedulesByDate((p) => ({ ...p, [viewDateKey]: sched }));
        } else {
          setPlanIdByDate((p) => {
            const n = { ...p };
            delete n[viewDateKey];
            return n;
          });
          setAvailabilityByDate((p) => ({ ...p, [viewDateKey]: new Set<number>() }));
          setSchedulesByDate((p) => ({ ...p, [viewDateKey]: {} }));
        }
      } catch (e) {
        console.error("플랜 조회 실패:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewDateKey]);

  // viewDate 시간표 (표시 + 가용시간 모달 disabledSlots 계산에 사용)
  const viewDateSchedule = schedulesByDate[viewDateKey] ?? {};

  // 가용시간으로 만든 서버 플랜의 ID 확보(없으면 생성). 추천·배정 호출 전에 사용.
  const ensurePlan = async (dateStr: string, slotIndexes: number[]): Promise<string> => {
    const cached = planIdByDate[dateStr];
    if (cached) return cached;
    const existing = await api.fetchDailyPlan(dateStr);
    const id = existing ? existing.id : (await api.createDailyPlan(dateStr, slotIndexes)).id;
    setPlanIdByDate((p) => ({ ...p, [dateStr]: id }));
    return id;
  };

  // 특정 날짜의 시간표(배정 맵)를 서버에 저장하고 플랜을 확정한다. 로컬 상태도 함께 갱신.
  const persistSchedule = async (dateStr: string, assignment: Record<number, string>) => {
    const avail = availabilityByDate[dateStr] ?? new Set<number>();
    // 플랜 슬롯 = 가용시간(있으면) 또는 배치된 슬롯들(가용시간 없이 자유 배치한 경우)
    const planSlots = (avail.size > 0 ? [...avail] : Object.keys(assignment).map(Number)).sort((a, b) => a - b);
    const existingId = planIdByDate[dateStr] ?? (await api.fetchDailyPlan(dateStr))?.id;
    let planId: string;
    if (existingId) {
      // 슬롯을 재생성해 깨끗한 슬레이트로 만든 뒤 현재 배정을 그대로 기록
      await api.replacePlanSlots(existingId, planSlots);
      planId = existingId;
    } else {
      planId = (await api.createDailyPlan(dateStr, planSlots)).id;
    }
    // 배정 맵(slotIndex→taskId)을 taskId별 slotIndexes 블록으로 묶어 일괄 배정
    const blocks: Record<string, number[]> = {};
    for (const [slot, tid] of Object.entries(assignment)) (blocks[tid] ??= []).push(Number(slot));
    const scheduleBlocks = Object.entries(blocks).map(([taskId, slotIndexes]) => ({ taskId, slotIndexes }));
    if (scheduleBlocks.length > 0) {
      await api.batchAssignSlots(planId, scheduleBlocks);
    }
    await api.updateDailyPlanStatus(planId, "CONFIRMED");
    setPlanIdByDate((p) => ({ ...p, [dateStr]: planId }));
    setSchedulesByDate((prev) => ({ ...prev, [dateStr]: assignment }));
    if (avail.size === 0) setAvailabilityByDate((prev) => ({ ...prev, [dateStr]: new Set(planSlots) }));
  };

  // 추천: 서버 DailyPlan AI 추천(GET /daily-plans/{id}/recommend)을 호출하고,
  // 추천된 taskId를 현재 태스크 목록의 Task 객체로 되돌려 기존 UI 형태({items: Task[]})로 매핑한다.
  const generateRecommendation = async () => {
    if (availableMin === 0 || busy) return;
    try {
      setBusy(true);
      const planId = await ensurePlan(viewDateKey, [...currentAvailability].sort((a, b) => a - b));
      const [recs, focusBuckets] = await Promise.all([
        api.fetchPlanRecommendations(planId),
        api.fetchFocusByHour().catch(() => [] as FocusBucket[]),
      ]);
      const byId = new Map(tasks.map((t) => [t.id, t]));
      const items = recs.items
        .map((r) => byId.get(r.taskId))
        .filter((t): t is Task => !!t && !t.completed);
      // 집중시간대 태그: 실제 집중 패턴(focus-by-hour)으로 시각과 무관하게 계산.
      // 데이터 없는 태스크는 매핑에서 빠져 "분석 전"으로 표시된다.
      const timeBandByTask = computeTimeBandByTask(recs.items, focusBuckets);
      const total = Math.min(availableMin, items.reduce((s, t) => s + t.remainingMin, 0));
      setRecommendation({ items, total, timeBandByTask });
      setShowAllRecs(false);
    } catch (e) {
      console.error("추천 조회 실패:", e);
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => {
    setDraftSlots(new Set(currentAvailability));
    setPickerOpen(true);
  };

  // 가용시간 저장: 서버에 플랜을 생성(POST)하거나 슬롯 교체(PUT)한다.
  // 슬롯 교체(replacePlanSlots)는 서버에서 배정을 초기화하므로, 기존 시간표 배정을
  // 보존해 재적용한다. 즉 가용시간을 "추가"해도 기존 시간표는 그대로 유지되고,
  // 가용시간을 "줄이면" 빠진 슬롯의 배정만 자연스럽게 제거된다.
  const saveAvailability = async (slots: Set<number>) => {
    const slotIndexes = [...slots].sort((a, b) => a - b);
    const newSlotSet = new Set(slotIndexes);
    try {
      setBusy(true);
      const existingId = planIdByDate[viewDateKey] ?? (await api.fetchDailyPlan(viewDateKey))?.id;
      let plan;
      if (existingId) {
        // 교체 전 현재 시간표를 캡처해 두고, 새 가용시간에 포함되는 배정만 다시 적용한다.
        const prevSchedule = schedulesByDate[viewDateKey] ?? {};
        plan = await api.replacePlanSlots(existingId, slotIndexes);
        const blocks: Record<string, number[]> = {};
        for (const [slot, tid] of Object.entries(prevSchedule)) {
          if (newSlotSet.has(Number(slot))) (blocks[tid] ??= []).push(Number(slot));
        }
        const scheduleBlocks = Object.entries(blocks).map(([taskId, idxs]) => ({ taskId, slotIndexes: idxs }));
        if (scheduleBlocks.length > 0) {
          plan = await api.batchAssignSlots(plan.id, scheduleBlocks);
        }
      } else if (slotIndexes.length > 0) {
        plan = await api.createDailyPlan(viewDateKey, slotIndexes);
      } else {
        // 저장할 가용시간도, 기존 플랜도 없으면 아무 것도 하지 않는다.
        setAvailabilityByDate((prev) => ({ ...prev, [viewDateKey]: new Set<number>() }));
        return;
      }
      const sched: Record<number, string> = {};
      for (const s of plan.slots) if (s.taskId) sched[s.slotIndex] = s.taskId;
      setPlanIdByDate((p) => ({ ...p, [viewDateKey]: plan!.id }));
      setAvailabilityByDate((prev) => ({ ...prev, [viewDateKey]: new Set(plan!.slots.map((s) => s.slotIndex)) }));
      setSchedulesByDate((prev) => ({ ...prev, [viewDateKey]: sched }));
    } catch (e) {
      console.error("가용시간 저장 실패:", e);
    } finally {
      setBusy(false);
    }
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
      {reminders.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Task 리마인더</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reminders.map((t) => (
              <Card
                key={t.taskId}
                onClick={() => onNavigate({ name: "taskDetail", taskId: t.taskId })}
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
                      <Pill variant={fmtDday(t.dueDate).startsWith("D-") && parseInt(fmtDday(t.dueDate).slice(2)) <= 3 ? "danger" : "muted"} size="sm">
                        {fmtDday(t.dueDate)}
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
                  <span style={{ color: tone.inkSubtle }}>가용시간대 선택</span>
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
          disabled={availableMin === 0 || busy}
          icon={<Sparkles size={14} />}
        >
          {busy ? "처리 중…" : recommendation ? "다시 추천받기" : "추천받기"}
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
                    마감까지 남은 일수 대비 남은 작업량이 많을수록 커지는 작업 압박도와
                    사용자가 지정한 중요도를 가중 합산해 점수를 매깁니다.
                    점수가 높은 Task부터 최대 4개를 추천하며, 오늘 마감인 Task를 먼저 보여줍니다.
                    <div style={{ marginTop: 6, fontFamily: monoStack, fontSize: 10, opacity: 0.8 }}>
                      점수 = 0.7×작업압박도 + 0.3×중요도
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleRecs.map((t, i) => {
                const timeBand = recommendation?.timeBandByTask[t.id];
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
                        {timeBand ? (
                          <Pill variant="warn" size="sm">🔥 {timeBand}</Pill>
                        ) : (
                          <Pill variant="muted" size="sm">🕐 집중시간대 분석 전</Pill>
                        )}
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
          onClick={() => {
            builderDirtyDates.current = new Set([dateKey(viewDate)]);
            setScheduleOpenFor(viewDate);
          }}
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
              onClick={async () => {
                setPickerOpen(false);
                await saveAvailability(new Set(draftSlots));
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
            // 현재 작업 중인 날짜의 assignment를 스태시하고 새 날짜로 이동.
            // 두 날짜 모두 "이번 세션에서 편집한 날짜"로 표시해 완료 시 함께 저장한다.
            const prevKey = dateKey(scheduleOpenFor);
            builderDirtyDates.current.add(prevKey);
            builderDirtyDates.current.add(dateKey(d));
            setSchedulesByDate((prev) => ({ ...prev, [prevKey]: currentAssignment }));
            setScheduleOpenFor(d);
          }}
          availableSlots={availabilityByDate[dateKey(scheduleOpenFor)] ?? new Set<number>()}
          hasAvailability={(availabilityByDate[dateKey(scheduleOpenFor)]?.size ?? 0) > 0}
          recommendation={recommendation}
          allTasks={tasks.filter((t) => !t.completed)}
          folders={folders}
          initialSchedule={schedulesByDate[dateKey(scheduleOpenFor)] ?? {}}
          onSave={async (s) => {
            if (!scheduleOpenFor) return;
            const finalKey = dateKey(scheduleOpenFor);
            // 이 빌더 세션에서 편집한 모든 날짜 + 현재 날짜를 함께 저장한다.
            const dates = new Set<string>([...builderDirtyDates.current, finalKey]);
            // 현재 날짜의 배정은 builder 가 넘겨준 s, 나머지는 날짜 이동 시 스태시해 둔 schedulesByDate 사용.
            const assignmentFor = (d: string) => (d === finalKey ? s : schedulesByDate[d] ?? {});
            try {
              setBusy(true);
              for (const d of dates) {
                await persistSchedule(d, assignmentFor(d));
              }
              builderDirtyDates.current = new Set();
              setScheduleOpenFor(null);
            } catch (e) {
              console.error("시간표 저장 실패:", e);
            } finally {
              setBusy(false);
            }
          }}
          onClose={() => setScheduleOpenFor(null)}
        />
      )}
    </div>
  );
}
