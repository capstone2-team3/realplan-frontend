// ───────────────────────── DTO ↔ 프론트 타입 변환 ─────────────────────────
// 백엔드 enum 값은 모두 대문자(LOW/MEDIUM/HIGH 등)로 내려오고,
// 프론트 타입도 동일하게 대문자다. 따라서 값 형태가 같은 enum은 변환하지 않고
// 그대로 통과(cast)시키고, 형태가 다른 것만 변환한다.
//   - task.status(enum)        → completed(boolean)
//   - focus_level(enum)        → 1~4(number)
//   - focus_session.source     → TIMER / MANUAL  (SESSION만 TIMER로 다름)

import type {
  Task, Folder, StudyRecord, User, TaskTypeCode, Importance, Difficulty,
} from "../types";
import type { TaskDTO, FolderDTO, StudyRecordDTO, UserDTO } from "./dto";

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

export function mapStudyRecord(dto: StudyRecordDTO): StudyRecord {
  return {
    id: String(dto.sessionId),
    startedAt: new Date(dto.startedAt),
    endedAt: dto.endedAt ? new Date(dto.endedAt) : new Date(dto.startedAt),
    durationMin: dto.actualMinutes ?? 0,
    progressLevel: (dto.progressLevel ?? 3) as 1 | 2 | 3 | 4 | 5,
    progressPercent: dto.progressPercentAfter ?? 0,
    focusLevel: toFocusLevel(dto.focusLevel),
    notes: dto.note ?? undefined,
    // focus_session.source: SESSION / MANUAL → 프론트 TIMER / MANUAL
    source: dto.source === "MANUAL" ? "MANUAL" : "TIMER",
  };
}

export function mapTask(dto: TaskDTO, records: StudyRecordDTO[] = []): Task {
  const original = dto.userEstimated ?? 0;
  const adjusted = dto.finalEstimated ?? dto.aiEstimated ?? original;
  const spent = dto.totalTime ?? 0;
  return {
    id: String(dto.taskId),
    folderId: String(dto.folderId),
    name: dto.title,
    type: toTaskType(dto.taskTypeCode),
    correctionEnabled: dto.aiEstimated != null,
    // task.importance / task.difficulty: 백엔드 값과 프론트 타입이 동일 → 그대로 통과
    importance: dto.priority as Importance,
    difficulty: dto.difficulty as Difficulty,
    notes: dto.description ?? undefined,
    originalEstimatedMin: original,
    adjustedEstimatedMin: adjusted,
    remainingMin: Math.max(0, adjusted - spent),
    deadline: dto.dueDate ? new Date(dto.dueDate) : new Date(),
    // task.status: PENDING / IN_PROGRESS / COMPLETED → completed(boolean)
    completed: dto.status === "COMPLETED" || dto.completedAt != null,
    createdAt: new Date(dto.createdAt),
    lastNotifiedAt: dto.lastNotifiedAt ? new Date(dto.lastNotifiedAt) : undefined,
    records: records.map(mapStudyRecord),
  };
}

export function mapFolder(dto: FolderDTO): Folder {
  return { id: String(dto.folderId), name: dto.name, isDefault: dto.isDefault };
}

export function mapUser(dto: UserDTO): User {
  return { name: dto.nickname, email: dto.email };
}

// ── 프론트 → 서버 (생성/수정 요청 바디) ──
// 통합 설계서 §4-4 Tasks. 부분 업데이트(PATCH)도 같은 형태를 사용.
// difficulty/priority/taskTypeCode 는 프론트 값이 곧 서버 enum 값이라 그대로 전송.
export function taskToBody(t: Omit<Task, "id" | "records" | "createdAt">) {
  return {
    folderId: Number(t.folderId),
    title: t.name,
    taskTypeCode: t.type,
    difficulty: t.difficulty,
    priority: t.importance,
    userEstimated: t.originalEstimatedMin,
    description: t.notes ?? null,
    dueDate: t.deadline.toISOString(),
  };
}
