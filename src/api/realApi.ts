// ───────────────────────── 실제 백엔드 API 구현 ─────────────────────────
// 통합 설계서 §4 REST API 엔드포인트 기준. Base URL 은 client.ts 의 API_BASE_URL (=/api/v1).
// 합치는 날: src/api/index.ts 에서 이 realApi 를 쓰도록 전환 + .env 설정.

import type {
  RealPlanApi, CreateTaskInput, DifficultyCorrections,
  WeeklyStats, DailyStudyTime, TypeStat, FocusBucket,
} from "./types";
import type { Task, TaskTypeCode, Difficulty } from "../types";
import { http, setTokens, clearTokens, getRefreshToken, ApiError } from "./client";
import type { TaskDTO, FolderDTO, UserDTO, SessionDTO, DailyPlanDTO, PlanRecommendationDTO, AuthResultDTO } from "./dto";
import { mapTask, mapFolder, mapUser, mapSession, mapDailyPlan, mapPlanRecommendations, taskToBody, TASK_TYPE_ID, fromFocusLevel, toLocalDateTime } from "./mappers";

// 세션 변경 후 태스크 본문 + 기록 목록을 함께 최신화한다.
async function reloadTask(id: string): Promise<Task> {
  const [taskDto, sessions] = await Promise.all([
    http.get<TaskDTO>(`/tasks/${id}`),
    http.get<SessionDTO[]>(`/tasks/${id}/sessions`),
  ]);
  return mapTask(taskDto, sessions);
}

export const realApi: RealPlanApi = {
  // Auth — 응답에 토큰만 내려오므로, 토큰 저장 후 GET /users/me 로 프로필을 받아온다.
  async login(email, password) {
    const data = await http.post<AuthResultDTO>("/auth/login", { email, password });
    setTokens(data.accessToken, data.refreshToken);
    const me = await http.get<UserDTO>("/users/me");
    return mapUser(me);
  },
  async signup(name, email, password) {
    // POST /auth/register { email, password, nickname } → 토큰 반환(자동 로그인)
    const data = await http.post<AuthResultDTO>("/auth/register", {
      email, password, nickname: name,
    });
    setTokens(data.accessToken, data.refreshToken);
    const me = await http.get<UserDTO>("/users/me");
    return mapUser(me);
  },
  // POST /auth/refresh { refreshToken } → 새 토큰 저장
  async refresh() {
    const rt = getRefreshToken();
    if (!rt) throw new ApiError("NO_REFRESH_TOKEN", "재발급 토큰이 없습니다.");
    const data = await http.post<AuthResultDTO>("/auth/refresh", { refreshToken: rt });
    setTokens(data.accessToken, data.refreshToken);
  },
  // DELETE /auth/logout { refreshToken } → 서버 무효화 후 로컬 토큰 삭제
  async logout() {
    const rt = getRefreshToken();
    try {
      if (rt) await http.del("/auth/logout", { refreshToken: rt });
    } finally {
      clearTokens();
    }
  },

  // §Users PATCH /users/me { nickname, password } → 수정된 프로필 반환
  // (email 은 이 엔드포인트로 수정 불가)
  async updateProfile(input) {
    const data = await http.patch<UserDTO>("/users/me", {
      nickname: input.nickname,
      password: input.password,
    });
    return mapUser(data);
  },
  // §Users DELETE /users/me — 계정은 유지, 데이터만 초기화
  async resetData() {
    await http.del("/users/me");
  },
  // §Users DELETE /users/me/withdraw — 데이터 + 계정 삭제 후 로컬 토큰 정리
  async withdraw() {
    try {
      await http.del("/users/me/withdraw");
    } finally {
      clearTokens();
    }
  },

  // §4-3 Folders
  async fetchFolders() {
    const data = await http.get<FolderDTO[]>("/folders");
    return data.map(mapFolder);
  },
  // §4-4 Tasks
  async fetchTasks() {
    const data = await http.get<TaskDTO[]>("/tasks");
    return data.map((t) => mapTask(t));
  },

  async createTask(input: CreateTaskInput) {
    // POST /tasks — taskTypeId 포함
    const data = await http.post<TaskDTO>("/tasks", {
      taskTypeId: TASK_TYPE_ID[input.type],
      ...taskToBody(input),
    });
    return mapTask(data);
  },
  async updateTask(id, input) {
    // PATCH /tasks/{id} 부분 업데이트 — 유형 변경도 지원하므로 taskTypeId 포함
    const data = await http.patch<TaskDTO>(`/tasks/${id}`, {
      taskTypeId: TASK_TYPE_ID[input.type],
      ...taskToBody(input),
    });
    return mapTask(data);
  },
  async deleteTask(id) {
    await http.del<void>(`/tasks/${id}`);
  },
  async completeTask(id) {
    // POST /tasks/{id}/complete → 완료 처리된 task 반환
    const data = await http.post<TaskDTO>(`/tasks/${id}/complete`);
    return mapTask(data);
  },

  async createFolder(name) {
    const data = await http.post<FolderDTO>("/folders", { name });
    return mapFolder(data);
  },
  async updateFolder(id, name) {
    // PATCH /folders/{id} 폴더명 수정
    const data = await http.patch<FolderDTO>(`/folders/${id}`, { name });
    return mapFolder(data);
  },
  async deleteFolder(id) {
    // DELETE /folders/{id} — 서버가 해당 폴더의 태스크를 기본 폴더로 이동시킴
    await http.del<void>(`/folders/${id}`);
  },

  // ── FocusSession ──
  // POST /sessions — 즉석 세션 시작. 같은 태스크에 ACTIVE/PAUSED 세션 있으면 400.
  async startSession(taskId) {
    const s = await http.post<SessionDTO>("/sessions", { taskId: Number(taskId) });
    return String(s.sessionId);
  },
  // PATCH /sessions/{id}/pause — ACTIVE → PAUSED
  async pauseSession(sessionId) {
    await http.patch<SessionDTO>(`/sessions/${sessionId}/pause`);
  },
  // PATCH /sessions/{id}/resume — PAUSED → ACTIVE
  async resumeSession(sessionId) {
    await http.patch<SessionDTO>(`/sessions/${sessionId}/resume`);
  },
  // ⚠️ 백엔드 추가 요청 엔드포인트 — 종료하지 않고 이탈한 세션을 무효화(ABANDONED).
  //    구현 전까지는 404 로 무시되며 로컬 상태만 정리된다.
  async abandonSession(sessionId) {
    await http.patch<SessionDTO>(`/sessions/${sessionId}/abandon`);
  },
  // POST /sessions/{id}/end — 종료 + 피드백 저장. 소요 시간은 서버가 계산.
  async endSession(sessionId, fb) {
    const s = await http.post<SessionDTO>(`/sessions/${sessionId}/end`, {
      progressLevel: fb.progressLevel,
      progressPercentAfter: fb.progressPercent,
      focusLevel: fromFocusLevel(fb.focusLevel),
      note: fb.notes ?? null,
    });
    return reloadTask(String(s.taskId));
  },
  // POST /sessions/manual — 타이머 없이 직접 기록. 시작/종료 시각을 그대로 전송.
  async addManualRecord(taskId, input) {
    await http.post<SessionDTO>("/sessions/manual", {
      taskId: Number(taskId),
      startedAt: toLocalDateTime(input.startedAt),
      endedAt: toLocalDateTime(input.endedAt),
      progressLevel: input.progressLevel,
      progressPercentAfter: input.progressPercent,
      focusLevel: fromFocusLevel(input.focusLevel),
      note: input.notes ?? null,
    });
    return reloadTask(taskId);
  },
  // GET /tasks/{id}/sessions — 태스크 학습 기록 목록 (최신순)
  async fetchTaskSessions(taskId) {
    const sessions = await http.get<SessionDTO[]>(`/tasks/${taskId}/sessions`);
    return sessions.map(mapSession);
  },

  // ── DailyPlan ──
  // GET /daily-plans?date= — 날짜별 플랜 조회.
  // 백엔드는 플랜이 없으면 404(PLAN_NOT_FOUND)를 던지므로, 이를 null 로 변환한다.
  async fetchDailyPlan(date) {
    try {
      const data = await http.get<DailyPlanDTO | null>(`/daily-plans?date=${date}`);
      return data ? mapDailyPlan(data) : null;
    } catch (e) {
      if (e instanceof ApiError && e.code === "PLAN_NOT_FOUND") return null;
      throw e;
    }
  },
  // GET /daily-plans/{id}/recommend — AI 태스크 추천 순위 (저장 없음)
  async fetchPlanRecommendations(planId) {
    const data = await http.get<PlanRecommendationDTO>(`/daily-plans/${planId}/recommend`);
    return mapPlanRecommendations(data);
  },
  // POST /daily-plans — 가용 슬롯으로 플랜 생성 (태스크 배정 전)
  async createDailyPlan(planDate, slotIndexes) {
    const data = await http.post<DailyPlanDTO>("/daily-plans", { planDate, slotIndexes });
    return mapDailyPlan(data);
  },
  // PUT /daily-plans/{id}/slots — 가용시간 슬롯 전체 교체
  async replacePlanSlots(planId, slotIndexes) {
    const data = await http.put<DailyPlanDTO>(`/daily-plans/${planId}/slots`, { slotIndexes });
    return mapDailyPlan(data);
  },
  // PUT /daily-plans/{id}/slots/batch — AI 자동배치 결과 일괄 적용
  async batchAssignSlots(planId, blocks) {
    const data = await http.put<DailyPlanDTO>(`/daily-plans/${planId}/slots/batch`, {
      scheduleBlocks: blocks.map((b) => ({ taskId: Number(b.taskId), slotIndexes: b.slotIndexes })),
    });
    return mapDailyPlan(data);
  },
  // POST /daily-plans/{id}/tasks — 여러 슬롯에 태스크 하나 직접 배정
  async assignPlanTask(planId, taskId, slotIndexes) {
    const data = await http.post<DailyPlanDTO>(`/daily-plans/${planId}/tasks`, {
      taskId: Number(taskId),
      slotIndexes,
    });
    return mapDailyPlan(data);
  },
  // POST /daily-plans/{id}/tasks/auto — AI(또는 fallback) 자동 배치
  async autoAssignPlan(planId, input) {
    const data = await http.post<DailyPlanDTO>(`/daily-plans/${planId}/tasks/auto`, {
      taskIds: input.taskIds.map(Number),
      maxTasks: input.maxTasks,
      maxContinuousSchedulableMinutes: input.maxContinuousSchedulableMinutes,
    });
    return mapDailyPlan(data);
  },
  // PATCH /daily-plans/{id} — 플랜 상태 변경 (CONFIRMED / REJECTED 등)
  async updateDailyPlanStatus(planId, status) {
    const data = await http.patch<DailyPlanDTO>(`/daily-plans/${planId}`, { status });
    return mapDailyPlan(data);
  },
  // PATCH /daily-plans/{id}/tasks/{dptId} — 플랜 태스크 선택/해제·순서 변경
  async updatePlanTask(planId, dailyPlanTaskId, patch) {
    const data = await http.patch<DailyPlanDTO>(`/daily-plans/${planId}/tasks/${dailyPlanTaskId}`, {
      isSelected: patch.isSelected,
      displayOrder: patch.displayOrder,
    });
    return mapDailyPlan(data);
  },
  // PATCH /daily-plans/{id}/slots/{slotId} — 슬롯 단건 배정 (taskId=null 이면 해제)
  async assignPlanSlot(planId, slotId, taskId) {
    const data = await http.patch<DailyPlanDTO>(`/daily-plans/${planId}/slots/${slotId}`, {
      taskId: taskId != null ? Number(taskId) : null,
    });
    return mapDailyPlan(data);
  },

  // Task 유형 자동 분류: POST /tasks/classify
  // 요청: { name, user_history: [{ name, task_type }] }  (DB 저장 없이 추천만)
  // 응답: { taskTypeId, task_type, taskTypeNameKo, reason, source }
  async classifyTaskType(title: string) {
    const data = await http.post<{ task_type: string }>("/tasks/classify", {
      name: title,
      user_history: [],
    });
    const code = (data.task_type ?? "").toUpperCase();
    if (code === "TIME_BASED" || code === "QUANTITY_BASED" || code === "SATISFACTION_BASED") return code;
    return "SATISFACTION_BASED";
  },
  // 주간 통계: GET /analytics/weekly
  async fetchWeeklyStats() {
    return await http.get<WeeklyStats>("/analytics/weekly");
  },
  // 일별 학습 시간: GET /analytics/daily?weeks=
  async fetchDailyStudyTime(weeks = 2) {
    return await http.get<DailyStudyTime>(`/analytics/daily?weeks=${weeks}`);
  },
  // 유형별 통계: GET /analytics/type-stats → { types: [...] }
  async fetchTypeStats() {
    type Raw = {
      taskTypeId: number; taskTypeCode: string; taskTypeName: string;
      sampleCount: number; plannedMinutes: number; actualMinutes: number;
      errorRatio: number | null; biasCorrectionFactor: number | null; lastCalculatedAt: string | null;
    };
    const data = await http.get<{ types: Raw[] }>("/analytics/type-stats");
    return (data.types ?? []).map((t): TypeStat => ({
      taskTypeId: t.taskTypeId,
      taskTypeCode: (t.taskTypeCode ?? "").toUpperCase() as TaskTypeCode,
      taskTypeName: t.taskTypeName,
      sampleCount: t.sampleCount,
      plannedMinutes: t.plannedMinutes,
      actualMinutes: t.actualMinutes,
      errorRatio: Number(t.errorRatio ?? 0),
      biasCorrectionFactor: Number(t.biasCorrectionFactor ?? 1),
      lastCalculatedAt: t.lastCalculatedAt ?? null,
    }));
  },
  // 시간대별 평균 집중도: GET /analytics/focus-by-hour → { buckets: [...] }
  async fetchFocusByHour() {
    type Raw = { startHour: number; endHour: number; label: string; averageFocus: number | null; sessionCount: number };
    const data = await http.get<{ buckets: Raw[] }>("/analytics/focus-by-hour");
    return (data.buckets ?? []).map((b): FocusBucket => ({
      startHour: b.startHour,
      endHour: b.endHour,
      label: b.label,
      averageFocus: b.averageFocus ?? 0,
      sessionCount: b.sessionCount,
    }));
  },
  // 난이도별 보정: 백엔드에 대응 엔드포인트(difficulty-stats)가 없어 기본값(보정 없음)을 반환한다.
  // TODO(backend): 난이도별 UserTaskTypeProfile 유사 분석 + GET /analytics/difficulty-stats 추가 시 실제 연동.
  async fetchDifficultyCorrections() {
    return {
      LOW: { coefficient: 1, sampleCount: 0 },
      MEDIUM: { coefficient: 1, sampleCount: 0 },
      HIGH: { coefficient: 1, sampleCount: 0 },
      UNKNOWN: { coefficient: 1, sampleCount: 0 },
    } as DifficultyCorrections;
  },
};
