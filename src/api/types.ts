// ───────────────────────── API 인터페이스 정의 ─────────────────────────
// 화면(screens)은 이 인터페이스만 보고 데이터를 요청한다.
// mock 구현(mockApi)과 실제 구현(realApi)이 이 인터페이스를 똑같이 만족하므로,
// 합치는 날 index.ts 의 한 줄만 바꾸면 전체가 실제 서버로 전환된다.

import type { Task, Folder, User, TaskTypeCode, Difficulty } from "../types";

export type CreateTaskInput = Omit<Task, "id" | "records" | "createdAt">;

export type StudyRecordInput = {
  durationMin: number;
  progressLevel: 1 | 2 | 3 | 4 | 5;
  progressPercent: number;
  focusLevel: 1 | 2 | 3 | 4;
  notes?: string;
  source: "TIMER" | "MANUAL";
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

export interface RealPlanApi {
  // 인증
  login(email: string, password: string): Promise<User>;
  signup(name: string, email: string, password: string): Promise<User>;

  // 조회
  fetchFolders(): Promise<Folder[]>;
  fetchTasks(): Promise<Task[]>;

  // Task
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: CreateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Folder
  createFolder(name: string): Promise<Folder>;

  // 학습 기록
  addRecord(taskId: string, record: StudyRecordInput): Promise<Task>;

  // Task 유형 자동 분류 (이름 텍스트 → 유형 추천)
  classifyTaskType(title: string): Promise<TaskTypeCode>;

  // Analytics — 개인화 보정 계수
  fetchTypeCorrections(): Promise<TypeCorrections>;
  fetchDifficultyCorrections(): Promise<DifficultyCorrections>;
}
