// ───────────────────────── DTO ↔ 프론트 타입 변환 ─────────────────────────
// 백엔드 enum 값은 모두 대문자(LOW/MEDIUM/HIGH 등)로 내려오고,
// 프론트 타입도 동일하게 대문자다. 따라서 값 형태가 같은 enum은 변환하지 않고
// 그대로 통과(cast)시키고, 형태가 다른 것만 변환한다.
//   - task.status(enum)        → completed(boolean)
//   - focus_level(enum)        → 1~4(number)
//   - focus_session.source     → TIMER / MANUAL  (SESSION만 TIMER로 다름)

import type {
  Task, Folder, StudyRecord, User, TaskTypeCode, Importance, Difficulty,
  DailyPlan, DailyPlanStatus, PlanSourceType, PlanRecommendations, Reminder,
} from "../types";
import type { TaskDTO, FolderDTO, SessionDTO, UserDTO, DailyPlanDTO, PlanRecommendationDTO, ReminderDTO } from "./dto";

// task_type.code: TIME_BASED / QUANTITY_BASED / SATISFACTION_BASED.
// 값은 프론트와 동일하지만 join 시 undefined 가능 → 기본값만 보정.
const toTaskType = (code: string | undefined): TaskTypeCode => {
  const up = (code ?? "").toUpperCase();
  if (up === "TIME_BASED" || up === "QUANTITY_BASED" || up === "SATISFACTION_BASED") return up;
  return "SATISFACTION_BASED";
};

// session_feedback.focus_level: LOW / MEDIUM / HIGH / VERY_HIGH → 프론트 1~4
const toFocusLevel = (f: string | null): 1 | 2 | 3 | 4 => {
  switch ((f ?? "").toUpperCase()) {
    case "LOW": return 1;
    case "MEDIUM": return 2;
    case "HIGH": return 3;
    case "VERY_HIGH": return 4;
    default: return 2;
  }
};
// 프론트 1~4 → session_feedback.focus_level
export const fromFocusLevel = (n: 1 | 2 | 3 | 4): string =>
  ["", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"][n];

// SessionDTO(피드백 포함) → 프론트 학습 기록 1건.
// 종료 전 세션은 feedback 이 null 이므로 방어적으로 처리한다.
export function mapSession(dto: SessionDTO): StudyRecord {
  const f = dto.feedback;
  return {
    id: String(dto.sessionId),
    startedAt: new Date(dto.startedAt),
    endedAt: dto.endedAt ? new Date(dto.endedAt) : new Date(dto.startedAt),
    durationMin: dto.actualMinutes ?? 0,
    progressLevel: (f?.progressLevel ?? 3) as 1 | 2 | 3 | 4 | 5,
    progressPercent: f?.progressPercentAfter ?? 0,
    focusLevel: toFocusLevel(f?.focusLevel ?? null),
    notes: f?.note ?? undefined,
    // focus_session.source: SESSION / MANUAL → 프론트 TIMER / MANUAL
    source: dto.source === "MANUAL" ? "MANUAL" : "TIMER",
  };
}

export function mapTask(dto: TaskDTO, sessions: SessionDTO[] = []): Task {
  const original = dto.userEstimated ?? 0;
  const adjusted = dto.finalEstimated ?? dto.aiEstimated ?? original;
  return {
    id: String(dto.taskId),
    folderId: String(dto.folderId),
    name: dto.name,
    type: toTaskType(dto.taskTypeCode),
    correctionEnabled: dto.correctionEnabled,
    // importance / difficulty: 백엔드 값과 프론트 타입이 동일 → 그대로 통과
    importance: dto.importance as Importance,
    difficulty: dto.difficulty as Difficulty,
    notes: dto.description ?? undefined,
    originalEstimatedMin: original,
    adjustedEstimatedMin: adjusted,
    remainingMin: dto.remainingMin ?? Math.max(0, adjusted - (dto.totalTime ?? 0)),
    deadline: dto.dueDate ? new Date(dto.dueDate) : new Date(),
    // status: PENDING / IN_PROGRESS / COMPLETED → completed(boolean)
    completed: dto.status === "COMPLETED" || dto.completedAt != null,
    createdAt: new Date(dto.createdAt),
    lastNotifiedAt: dto.lastNotifiedAt ? new Date(dto.lastNotifiedAt) : undefined,
    records: sessions.map(mapSession),
  };
}

export function mapReminder(dto: ReminderDTO): Reminder {
  return {
    taskId: String(dto.taskId),
    name: dto.name,
    dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(),
    importance: (dto.importance?.toUpperCase() as Importance) ?? "MEDIUM",
    status: dto.status,
    remainingMin: dto.remainingMin ?? 0,
    progressPercent: dto.progressPercent ?? 0,
    reminderType: dto.reminderType,
    message: dto.message,
    priority: dto.priority ?? 0,
    lastNotifiedAt: dto.lastNotifiedAt ? new Date(dto.lastNotifiedAt) : undefined,
  };
}

export function mapFolder(dto: FolderDTO): Folder {
  return { id: String(dto.folderId), name: dto.name, isDefault: dto.default };
}

export function mapUser(dto: UserDTO): User {
  return { name: dto.nickname, email: dto.email };
}

// DailyPlan: 모든 plan 엔드포인트가 동일한 형태를 반환하므로 공용으로 매핑.
export function mapDailyPlan(dto: DailyPlanDTO): DailyPlan {
  return {
    id: String(dto.dailyPlanId),
    planDate: dto.planDate,
    availableMinutes: dto.availableMinutes,
    totalMinutes: dto.totalMinutes,
    status: dto.status as DailyPlanStatus,
    confirmedAt: dto.confirmedAt ? new Date(dto.confirmedAt) : undefined,
    slots: dto.slots.map((s) => ({
      slotId: String(s.slotId),
      slotIndex: s.slotIndex,
      timeLabel: s.timeLabel,
      dailyPlanTaskId: s.dailyPlanTaskId != null ? String(s.dailyPlanTaskId) : undefined,
      taskId: s.taskId != null ? String(s.taskId) : undefined,
      taskName: s.taskName ?? undefined,
    })),
    tasks: dto.tasks.map((t) => ({
      dailyPlanTaskId: String(t.dailyPlanTaskId),
      taskId: String(t.taskId),
      taskName: t.taskName,
      taskTypeCode: toTaskType(t.taskTypeCode),
      importance: t.importance as Importance,
      displayOrder: t.displayOrder,
      sourceType: t.sourceType as PlanSourceType,
      plannedMinutes: t.plannedMinutes,
      selected: t.selected,
    })),
  };
}

export function mapPlanRecommendations(dto: PlanRecommendationDTO): PlanRecommendations {
  return {
    targetDate: dto.targetDate,
    availableMinutes: dto.availableMinutes,
    message: dto.message,
    items: dto.recommendations.map((r) => ({
      rank: r.rank,
      taskId: String(r.taskId),
      name: r.name,
      remainingMin: r.remainingMin,
      recommendScore: r.recommendScore,
      deadlineLabel: r.deadlineLabel,
      importanceLabel: r.importanceLabel,
      recommendedTimeBandLabel: r.recommendedTimeBandLabel,
      requiredFocusLevel: r.requiredFocusLevel,
      reason: r.reason,
      dueToday: r.dueToday,
    })),
  };
}

// taskType 코드 → id 매핑.
// 백엔드 마이그레이션 V2__init_tasktype_data.sql 의 삽입 순서로 확정됨
// (BIGSERIAL 채번: TIME_BASED=1, QUANTITY_BASED=2, SATISFACTION_BASED=3).
// 별도 task-type 목록 조회 API 가 없으므로 이 상수를 단일 소스로 사용한다.
export const TASK_TYPE_ID: Record<TaskTypeCode, number> = {
  TIME_BASED: 1,
  QUANTITY_BASED: 2,
  SATISFACTION_BASED: 3,
};

// 백엔드가 LocalDateTime(타임존 없음)으로 파싱하도록 타임존 없는 로컬 시각 문자열로 변환.
// toISOString() 은 UTC 로 변환되며 끝에 'Z' 가 붙어 ISO_LOCAL_DATE_TIME 파싱에 실패하므로 사용 금지.
export function toLocalDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ── 프론트 → 서버 (수정 요청 바디; PATCH /tasks/{id}) ──
// PATCH 는 taskType 을 받지 않으므로 공통 필드만 보낸다.
// importance/difficulty 는 프론트 값이 곧 서버 enum 값이라 그대로 전송.
export function taskToBody(t: Omit<Task, "id" | "records" | "createdAt">) {
  return {
    folderId: Number(t.folderId),
    name: t.name,
    description: t.notes ?? null,
    dueDate: toLocalDateTime(t.deadline),
    importance: t.importance,
    difficulty: t.difficulty,
    correctionEnabled: t.correctionEnabled,
    userEstimated: t.originalEstimatedMin,
  };
}
