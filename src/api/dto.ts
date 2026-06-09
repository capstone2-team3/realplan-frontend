// ───────────────────────── 서버 DTO 타입 ─────────────────────────
// 통합 설계서(RealPlan_통합_설계서.pdf) §2 DB 스키마 / §4 REST API 기준.
//
// ⚠️ DB 컬럼은 snake_case 지만, REST 응답 JSON 직렬화 키는 백엔드 합의가 필요하다.
//    Spring 기본 Jackson 설정은 camelCase 이므로, 여기서는 camelCase 응답을 가정한다.
//    실제 응답이 snake_case 라면 이 파일의 키만 바꾸면 된다. (변환은 mappers.ts)
//
// enum 값은 설계서 기준 소문자: priority low/medium/high, difficulty low/medium/high/unknown,
// status pending/in_progress/completed, focusLevel low/medium/high/very_high.

// Task (Swagger §Tasks 응답 기준)
export type TaskDTO = {
  taskId: number;
  folderId: number;
  folderName?: string;
  taskTypeId: number;
  taskTypeCode?: string;      // TIME_BASED / QUANTITY_BASED / SATISFACTION_BASED
  taskTypeNameKo?: string;    // "시간형" 등 (표시용)
  name: string;
  description: string | null;
  dueDate: string | null;     // ISO
  importance: string;         // HIGH / MEDIUM / LOW
  status: string;             // PENDING / IN_PROGRESS / COMPLETED
  difficulty: string;         // LOW / MEDIUM / HIGH / UNKNOWN
  correctionEnabled: boolean;
  userEstimated: number | null;
  aiEstimated: number | null;
  finalEstimated: number | null;
  remainingMin: number;       // 서버 계산 잔여 시간(분)
  progressPercent: number;    // 0-100
  totalTime: number;          // 누적 실제 소요(분)
  completedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Folder (Swagger §Folders 응답 기준)
// ⚠️ boolean getter 가 Jackson 으로 직렬화되며 키가 `default` 다 (isDefault 아님).
export type FolderDTO = {
  folderId: number;
  name: string;
  default: boolean;
  createdAt: string;
  updatedAt: string;
};

// FocusSession 응답 (Swagger §FocusSession). 학습 기록 1건.
export type SessionFeedbackDTO = {
  feedbackId: number;
  progressLevel: number;            // 1-5
  progressPercentAfter: number;
  focusLevel: string;               // LOW / MEDIUM / HIGH / VERY_HIGH
  note: string | null;
  // 이하 AI 보정 관련 필드들 (프론트 미사용)
  aiRemainingBefore?: number;
  aiRemainingAfter?: number;
  previousAiTotalMinutes?: number;
  updatedAiTotalMinutes?: number;
  progressBasedRemainingMinutes?: number;
  normalizedRemainingMinutes?: number;
  blendingWeight?: number;
  focusWeight?: number;
};

export type SessionPauseEventDTO = {
  pauseEventId: number;
  pausedAt: string;
  resumedAt: string | null;
};

export type SessionDTO = {
  sessionId: number;
  taskId: number;
  taskName: string;
  dailyPlanTaskId: number | null;
  dailyPlanSessionId: number | null;
  source: string;             // SESSION / MANUAL
  sessionStatus: string;      // ACTIVE / PAUSED / ENDED / ABANDONED
  startedAt: string;
  endedAt: string | null;
  actualMinutes: number | null;
  plannedMinutes: number | null;
  aiRemainingBefore: number | null;
  feedback: SessionFeedbackDTO | null;   // 종료 전이면 null
  pauseEvents: SessionPauseEventDTO[];
  createdAt: string;
};

// Users (설계서 §2-1)
export type UserDTO = {
  userId: number;
  email: string;
  nickname: string;
};

// 인증 응답 (register / login / refresh 공통)
// Swagger §Auth: data 에 토큰만 내려오고 사용자 정보는 포함되지 않는다.
//   { tokenType: "Bearer", accessToken, refreshToken, accessTokenExpiresIn(ms) }
export type AuthResultDTO = {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
};

// DailyPlan (Swagger §DailyPlan). 모든 plan 엔드포인트가 동일한 형태를 반환.
export type DailyPlanSlotDTO = {
  slotId: number;
  slotIndex: number;
  timeLabel: string;
  dailyPlanTaskId: number | null;
  taskId: number | null;
  taskName: string | null;
};

export type DailyPlanTaskDTO = {
  dailyPlanTaskId: number;
  taskId: number;
  taskName: string;
  taskTypeCode: string;
  importance: string;       // HIGH / MEDIUM / LOW
  displayOrder: number;
  sourceType: string;       // AI / USER / BOTH
  plannedMinutes: number;
  selected: boolean;
};

export type DailyPlanDTO = {
  dailyPlanId: number;
  planDate: string;         // YYYY-MM-DD
  availableMinutes: number;
  totalMinutes: number;
  status: string;           // RECOMMENDED / CONFIRMED / ENDED / REJECTED
  confirmedAt: string | null;
  slots: DailyPlanSlotDTO[];
  tasks: DailyPlanTaskDTO[];
  createdAt: string;
  updatedAt: string;
};

// AI 태스크 추천 (GET /daily-plans/{id}/recommend) — DB 저장 없는 추천 순위
export type PlanRecommendationItemDTO = {
  rank: number;
  taskId: number;
  name: string;
  remainingMin: number;
  recommendScore: number;
  deadlineScore: number;
  workloadUrgencyScore: number;
  importanceScore: number;
  deadlineLabel: string;
  importanceLabel: string;
  recommendedTimeBand: string;
  recommendedTimeBandLabel: string;
  requiredFocusLevel: string;   // HIGH / MEDIUM / LOW / FLEXIBLE
  reason: string;
  dueToday: boolean;
};
export type PlanRecommendationDTO = {
  targetDate: string;
  availableMinutes: number;
  recommendations: PlanRecommendationItemDTO[];
  message: string;
};
