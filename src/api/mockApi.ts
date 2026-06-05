// ───────────────────────── Mock API 구현 ─────────────────────────
// 백엔드 없이 동작하는 가짜 구현. 메모리에 데이터를 들고 있다가 그대로 돌려준다.
// 실제 네트워크 지연을 흉내내기 위해 약간의 delay 를 준다.

import type {
  RealPlanApi, CreateTaskInput, StudyRecordInput, TypeCorrections, DifficultyCorrections,
} from "./types";
import type { Task, Folder, User, StudyRecord } from "../types";
import { initialTasks, initialFolders } from "./mockData";
import { today } from "../lib/time";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// 메모리 상태 (앱 새로고침 전까지 유지)
let tasks: Task[] = initialTasks.map((t) => ({ ...t }));
let folders: Folder[] = initialFolders.map((f) => ({ ...f }));

export const mockApi: RealPlanApi = {
  async login(email) {
    await delay();
    return { name: email.split("@")[0], email };
  },
  async signup(name, email) {
    await delay();
    return { name, email } as User;
  },

  async fetchFolders() {
    await delay();
    return folders.map((f) => ({ ...f }));
  },
  async fetchTasks() {
    await delay();
    return tasks.map((t) => ({ ...t }));
  },

  async createTask(input: CreateTaskInput) {
    await delay();
    const task: Task = { ...input, id: `t${Date.now()}`, records: [], createdAt: new Date() };
    tasks = [...tasks, task];
    return { ...task };
  },
  async updateTask(id, input) {
    await delay();
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...input } : t));
    return { ...tasks.find((t) => t.id === id)! };
  },
  async deleteTask(id) {
    await delay();
    tasks = tasks.filter((t) => t.id !== id);
  },

  async createFolder(name) {
    await delay();
    const folder: Folder = { id: `f${Date.now()}`, name, isDefault: false };
    folders = [...folders, folder];
    return { ...folder };
  },

  async addRecord(taskId, record: StudyRecordInput) {
    await delay();
    tasks = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const now = new Date();
      const rec: StudyRecord = {
        id: `r${Date.now()}`,
        startedAt: new Date(now.getTime() - record.durationMin * 60000),
        endedAt: now,
        durationMin: record.durationMin,
        progressLevel: record.progressLevel,
        progressPercent: record.progressPercent,
        focusLevel: record.focusLevel,
        notes: record.notes,
        source: record.source,
      };
      const remaining = Math.max(0, t.remainingMin - record.durationMin);
      return { ...t, records: [...t.records, rec], remainingMin: remaining, completed: remaining === 0 };
    });
    return { ...tasks.find((t) => t.id === taskId)! };
  },

  // Task 유형 자동 분류 (목업: 키워드 규칙 기반. 실제로는 AI 서비스가 분류)
  async classifyTaskType(title: string) {
    await delay(200);
    const t = title.toLowerCase();
    // 분량형: 개수/문제 풀이 등 완료 기준이 명확
    if (/문제|풀기|개|문항|챕터|장|페이지|쪽|단어|암기|외우/.test(t)) return "QUANTITY_BASED";
    // 만족형: 글쓰기/기획/창작 등 완료 기준이 주관적
    if (/보고서|작성|글|에세이|기획|아이디어|초안|발표\s*자료|디자인|설계|구상|레포트|리포트/.test(t))
      return "SATISFACTION_BASED";
    // 시간형: 강의/시청/읽기 등 시점이 명확
    if (/강의|영상|시청|듣기|읽기|복습|정리|수강|클래스/.test(t)) return "TIME_BASED";
    // 기본값
    return "SATISFACTION_BASED";
  },
  async fetchTypeCorrections() {
    await delay();
    const data: TypeCorrections = {
      TIME_BASED: { coefficient: 1.0, sampleCount: 12 },
      QUANTITY_BASED: { coefficient: 1.3, sampleCount: 8 },
      SATISFACTION_BASED: { coefficient: 1.6, sampleCount: 5 },
    };
    return data;
  },
  async fetchDifficultyCorrections() {
    await delay();
    const data: DifficultyCorrections = {
      LOW: { coefficient: 1.05, sampleCount: 9 },
      MEDIUM: { coefficient: 1.25, sampleCount: 11 },
      HIGH: { coefficient: 1.7, sampleCount: 6 },
      UNKNOWN: { coefficient: 1.45, sampleCount: 3 },
    };
    return data;
  },
};
