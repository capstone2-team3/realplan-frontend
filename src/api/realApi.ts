// ───────────────────────── 실제 백엔드 API 구현 ─────────────────────────
// 통합 설계서 §4 REST API 엔드포인트 기준. Base URL 은 client.ts 의 API_BASE_URL (=/api/v1).
// 합치는 날: src/api/index.ts 에서 이 realApi 를 쓰도록 전환 + .env 설정.

import type {
  RealPlanApi, CreateTaskInput, StudyRecordInput, TypeCorrections, DifficultyCorrections,
} from "./types";
import type { TaskTypeCode, Difficulty } from "../types";
import { http, setToken } from "./client";
import type { TaskDTO, FolderDTO, AuthResultDTO } from "./dto";
import { mapTask, mapFolder, mapUser, taskToBody, fromFocusLevel } from "./mappers";

export const realApi: RealPlanApi = {
  // §4-1 Auth
  async login(email, password) {
    const data = await http.post<AuthResultDTO>("/auth/login", { email, password });
    setToken(data.accessToken);
    return mapUser(data.user);
  },
  async signup(name, email, password) {
    // §4-1 POST /auth/register { email, password, nickname }
    await http.post("/auth/register", { email, password, nickname: name });
    // 가입 후 자동 로그인
    const data = await http.post<AuthResultDTO>("/auth/login", { email, password });
    setToken(data.accessToken);
    return mapUser(data.user);
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
    const data = await http.post<TaskDTO>("/tasks", taskToBody(input));
    return mapTask(data);
  },
  async updateTask(id, input) {
    // §4-4 PATCH /tasks/{id} 부분 업데이트
    const data = await http.patch<TaskDTO>(`/tasks/${id}`, taskToBody(input));
    return mapTask(data);
  },
  async deleteTask(id) {
    await http.del<void>(`/tasks/${id}`);
  },

  async createFolder(name) {
    const data = await http.post<FolderDTO>("/folders", { name });
    return mapFolder(data);
  },

  // §4-6 Focus Sessions — 수동 기록 추가 (POST /sessions/manual)
  // 타이머 세션 종료(POST /sessions/{id}/end)도 동일하게 갱신된 task 를 받아온다고 가정.
  async addRecord(taskId, record: StudyRecordInput) {
    const data = await http.post<TaskDTO>("/sessions/manual", {
      taskId: Number(taskId),
      durationMin: record.durationMin,
      progressLevel: record.progressLevel,
      progressPercentAfter: record.progressPercent,
      focusLevel: fromFocusLevel(record.focusLevel),
      note: record.notes ?? null,
      source: record.source === "MANUAL" ? "manual" : "session",
    });
    return mapTask(data);
  },

  // Task 유형 자동 분류
  // ⚠️ 프론트→백엔드 분류 엔드포인트는 통합 설계서에 없음 — 백엔드와 합의 필요.
  // 제안: POST /tasks/classify  { title }  →  { taskTypeCode }
  // (백엔드가 내부적으로 AI 서비스의 /tasks/classify 를 호출해서 결과를 돌려준다고 가정)
  async classifyTaskType(title: string) {
    const data = await http.post<{ taskTypeCode: string }>("/tasks/classify", { title });
    const code = (data.taskTypeCode ?? "").toUpperCase();
    if (code === "TIME_BASED" || code === "QUANTITY_BASED" || code === "SATISFACTION_BASED") return code;
    return "SATISFACTION_BASED";
  },
  // 유형별 보정: GET /analytics/type-stats (UserTaskTypeProfile 기반)
  // 응답 예시 가정: [{ taskTypeCode, biasCorrectionFactor, sampleCount }, ...]
  async fetchTypeCorrections() {
    type Row = { taskTypeCode: string; biasCorrectionFactor: number | null; sampleCount: number };
    const rows = await http.get<Row[]>("/analytics/type-stats");
    const result = {
      TIME_BASED: { coefficient: 1, sampleCount: 0 },
      QUANTITY_BASED: { coefficient: 1, sampleCount: 0 },
      SATISFACTION_BASED: { coefficient: 1, sampleCount: 0 },
    } as TypeCorrections;
    for (const r of rows) {
      const code = (r.taskTypeCode ?? "").toUpperCase() as TaskTypeCode;
      if (code in result) {
        result[code] = { coefficient: r.biasCorrectionFactor ?? 1, sampleCount: r.sampleCount };
      }
    }
    return result;
  },
  // 난이도별 보정: ⚠️ 신규 엔드포인트 — 백엔드와 합의 필요.
  // 제안: GET /analytics/difficulty-stats
  // 응답 예시 가정: [{ difficulty, biasCorrectionFactor, sampleCount }, ...]
  async fetchDifficultyCorrections() {
    type Row = { difficulty: string; biasCorrectionFactor: number | null; sampleCount: number };
    const rows = await http.get<Row[]>("/analytics/difficulty-stats");
    const result = {
      LOW: { coefficient: 1, sampleCount: 0 },
      MEDIUM: { coefficient: 1, sampleCount: 0 },
      HIGH: { coefficient: 1, sampleCount: 0 },
      UNKNOWN: { coefficient: 1, sampleCount: 0 },
    } as DifficultyCorrections;
    for (const r of rows) {
      const d = (r.difficulty ?? "").toUpperCase() as Difficulty;
      if (d in result) {
        result[d] = { coefficient: r.biasCorrectionFactor ?? 1, sampleCount: r.sampleCount };
      }
    }
    return result;
  },
};
