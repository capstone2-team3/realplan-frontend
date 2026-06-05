// ───────────────────────── DTO ↔ 프론트 타입 변환 ─────────────────────────
// 서버(소문자 enum, camelCase) ↔ 프론트(대문자 enum, camelCase) 변환.
// 통합 설계서의 enum 표기가 소문자(low/medium/high 등)이므로 여기서 대문자로 바꾼다.

import type {
  Task, Folder, StudyRecord, User, TaskTypeCode, Importance, Difficulty,
} from "../types";
import type { TaskDTO, FolderDTO, StudyRecordDTO, UserDTO } from "./dto";

const toTaskType = (code: string | undefined): TaskTypeCode => {
  const up = (code ?? "").toUpperCase();
  if (up === "TIME_BASED" || up === "QUANTITY_BASED" || up === "SATISFACTION_BASED") return up;
  return "SATISFACTION_BASED";
};
// 설계서 priority: low/medium/high → 프론트 Importance HIGH/MEDIUM/LOW
const toImportance = (p: string): Importance => {
  switch ((p ?? "").toLowerCase()) {
    case "high": return "HIGH";
    case "low": return "LOW";
    default: return "MEDIUM";
  }
};
const fromImportance = (imp: Importance): string => imp.toLowerCase(); // high/medium/low

// 설계서 difficulty: low/medium/high/unknown
const toDifficulty = (d: string): Difficulty => {
  switch ((d ?? "").toLowerCase()) {
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
    default: return "UNKNOWN";
  }
};
const fromDifficulty = (d: Difficulty): string => d.toLowerCase(); // low/medium/high/unknown

// 설계서 focusLevel: low/medium/high/very_high → 프론트 1~4
const toFocusLevel = (f: string | null): 1 | 2 | 3 | 4 => {
  switch ((f ?? "").toLowerCase()) {
    case "low": return 1;
    case "medium": return 2;
    case "high": return 3;
    case "very_high": return 4;
    default: return 2;
  }
};
// 프론트 1~4 → 설계서 focusLevel
export const fromFocusLevel = (n: 1 | 2 | 3 | 4): string =>
  ["", "low", "medium", "high", "very_high"][n];

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
    source: dto.source === "manual" ? "MANUAL" : "TIMER",
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
    importance: toImportance(dto.priority),
    difficulty: toDifficulty(dto.difficulty),
    notes: dto.description ?? undefined,
    originalEstimatedMin: original,
    adjustedEstimatedMin: adjusted,
    remainingMin: Math.max(0, adjusted - spent),
    deadline: dto.dueDate ? new Date(dto.dueDate) : new Date(),
    completed: dto.status === "completed" || dto.completedAt != null,
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
export function taskToBody(t: Omit<Task, "id" | "records" | "createdAt">) {
  return {
    folderId: Number(t.folderId),
    title: t.name,
    taskTypeCode: t.type,
    difficulty: fromDifficulty(t.difficulty),
    priority: fromImportance(t.importance),
    userEstimated: t.originalEstimatedMin,
    description: t.notes ?? null,
    dueDate: t.deadline.toISOString(),
  };
}
