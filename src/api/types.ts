// ───────────────────────── API 인터페이스 정의 ─────────────────────────
// 화면(screens)은 이 인터페이스만 보고 데이터를 요청한다.
// mock 구현(mockApi)과 실제 구현(realApi)이 이 인터페이스를 똑같이 만족하므로,
// 합치는 날 index.ts 의 한 줄만 바꾸면 전체가 실제 서버로 전환된다.

import type { Task, Folder, User, StudyRecord, DailyPlan, DailyPlanStatus, PlanRecommendations, TaskTypeCode, Difficulty } from "../types";

export type CreateTaskInput = Omit<Task, "id" | "records" | "createdAt">;

// 타이머 세션 종료 시 피드백 (소요 시간은 서버가 계산)
export type SessionFeedbackInput = {
  progressLevel: 1 | 2 | 3 | 4 | 5;
  progressPercent: number;
  focusLevel: 1 | 2 | 3 | 4;
  notes?: string;
};

// 수동 기록 — 시작/종료 시각을 직접 입력받아 전송 (소요 시간은 서버가 계산)
export type ManualRecordInput = SessionFeedbackInput & {
  startedAt: Date;
  endedAt: Date;
};

// 보정 계수 한 항목 (유형별/난이도별 공용)
// coefficient: 사용자 예상 시간 대비 보정 배율 (예: 1.3 = +30%)
// sampleCount: 집계에 쓰인 세션 수 (데이터가 적으면 신뢰도 낮음)
export type CorrectionEntry = {
  coefficient: number;
  sampleCount: number;
};
export type TypeCorrections = Record<TaskTypeCode, CorrectionEntry>;
export type DifficultyCorrections = Record<Difficulty, CorrectionEntry>;

// ── Analytics 응답 타입 ──
// 주간 통계 지표 (현재/지난주/증감). averageFocus 는 1~4 스케일.
export type WeeklyMetric = { current: number; previous: number; diff: number };
export type WeeklyStats = {
  weekStart: string;   // YYYY-MM-DD
  weekEnd: string;
  totalMinutes: WeeklyMetric;
  averageFocus: WeeklyMetric;
  completedTasks: WeeklyMetric;
};
// 일별 학습 시간 (막대 그래프용)
export type DailyStudyDay = { date: string; totalMinutes: number };
export type DailyStudyTime = {
  weeks: number;
  startDate: string;
  endDate: string;
  days: DailyStudyDay[];
};
// 유형별 통계 (UserTaskTypeProfile 기반: 예상 vs 실제, 보정 계수)
export type TypeStat = {
  taskTypeId: number;
  taskTypeCode: TaskTypeCode;
  taskTypeName: string;
  sampleCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  errorRatio: number;
  biasCorrectionFactor: number;     // = 보정 배율
  lastCalculatedAt: string | null;
};
// 시간대별(2시간 단위) 평균 집중도 버킷. averageFocus 는 1~4 (데이터 없으면 0).
export type FocusBucket = {
  startHour: number;
  endHour: number;
  label: string;
  averageFocus: number;
  sessionCount: number;
};

// DailyPlan AI 자동 배치 옵션
export type AutoAssignInput = {
  taskIds: string[];
  maxTasks?: number;
  maxContinuousSchedulableMinutes?: number;
};
// 플랜 태스크 부분 수정 (선택/해제, 순서)
export type PlanTaskPatch = {
  isSelected?: boolean;
  displayOrder?: number;
};

export interface RealPlanApi {
  // 인증
  login(email: string, password: string): Promise<User>;
  signup(name: string, email: string, password: string): Promise<User>;
  refresh(): Promise<void>;
  logout(): Promise<void>;

  // 프로필 (PATCH /users/me 는 nickname·password 만 수정)
  updateProfile(input: { nickname?: string; password?: string }): Promise<User>;
  resetData(): Promise<void>;   // 계정 유지, 데이터만 초기화 (DELETE /users/me)
  withdraw(): Promise<void>;    // 데이터 + 계정 삭제 (DELETE /users/me/withdraw)

  // 조회
  fetchFolders(): Promise<Folder[]>;
  fetchTasks(): Promise<Task[]>;

  // Task
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: CreateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  completeTask(id: string): Promise<Task>;

  // Folder
  createFolder(name: string): Promise<Folder>;
  updateFolder(id: string, name: string): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  // 학습 세션 (FocusSession)
  startSession(taskId: string): Promise<string>;                 // POST /sessions → sessionId
  pauseSession(sessionId: string): Promise<void>;                // PATCH /sessions/{id}/pause
  resumeSession(sessionId: string): Promise<void>;               // PATCH /sessions/{id}/resume
  abandonSession(sessionId: string): Promise<void>;              // ⚠️ 백엔드 추가 요청: 세션 무효화
  endSession(sessionId: string, feedback: SessionFeedbackInput): Promise<Task>; // POST /sessions/{id}/end
  addManualRecord(taskId: string, input: ManualRecordInput): Promise<Task>;     // POST /sessions/manual
  fetchTaskSessions(taskId: string): Promise<StudyRecord[]>;     // GET /tasks/{id}/sessions

  // DailyPlan (하루 플랜)
  fetchDailyPlan(date: string): Promise<DailyPlan | null>;                               // GET /daily-plans?date=
  fetchPlanRecommendations(planId: string): Promise<PlanRecommendations>;               // GET /{id}/recommend
  createDailyPlan(planDate: string, slotIndexes: number[]): Promise<DailyPlan>;          // POST /daily-plans
  replacePlanSlots(planId: string, slotIndexes: number[]): Promise<DailyPlan>;           // PUT /{id}/slots
  batchAssignSlots(planId: string, blocks: { taskId: string; slotIndexes: number[] }[]): Promise<DailyPlan>; // PUT /{id}/slots/batch
  assignPlanTask(planId: string, taskId: string, slotIndexes: number[]): Promise<DailyPlan>; // POST /{id}/tasks
  autoAssignPlan(planId: string, input: AutoAssignInput): Promise<DailyPlan>;            // POST /{id}/tasks/auto
  updateDailyPlanStatus(planId: string, status: DailyPlanStatus): Promise<DailyPlan>;    // PATCH /{id}
  updatePlanTask(planId: string, dailyPlanTaskId: string, patch: PlanTaskPatch): Promise<DailyPlan>; // PATCH /{id}/tasks/{dptId}
  assignPlanSlot(planId: string, slotId: string, taskId: string | null): Promise<DailyPlan>; // PATCH /{id}/slots/{slotId}

  // Task 유형 자동 분류 (이름 텍스트 → 유형 추천)
  classifyTaskType(title: string): Promise<TaskTypeCode>;

  // Analytics
  fetchWeeklyStats(): Promise<WeeklyStats>;                  // GET /analytics/weekly
  fetchDailyStudyTime(weeks?: number): Promise<DailyStudyTime>; // GET /analytics/daily?weeks=
  fetchTypeStats(): Promise<TypeStat[]>;                     // GET /analytics/type-stats
  fetchFocusByHour(): Promise<FocusBucket[]>;                // GET /analytics/focus-by-hour
  // 난이도별 보정: 백엔드에 대응 엔드포인트 없음 → 기본값 반환 (TODO: difficulty-stats 추가 시 연동)
  fetchDifficultyCorrections(): Promise<DifficultyCorrections>;
}
