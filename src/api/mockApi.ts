// ───────────────────────── Mock API 구현 ─────────────────────────
// 백엔드 없이 동작하는 가짜 구현. 메모리에 데이터를 들고 있다가 그대로 돌려준다.
// 실제 네트워크 지연을 흉내내기 위해 약간의 delay 를 준다.

import type {
  RealPlanApi, CreateTaskInput, ManualRecordInput, SessionFeedbackInput, DifficultyCorrections,
  WeeklyStats, DailyStudyTime, TypeStat, FocusBucket,
} from "./types";
import type { Task, Folder, User, StudyRecord, DailyPlan, DailyPlanSlot, DailyPlanTask, PlanSourceType, Reminder } from "../types";
import { initialTasks, initialFolders } from "./mockData";
import { today } from "../lib/time";
import { slotIndexToLabel } from "../lib/schedule";
import { getReminderTasks } from "../lib/tasks";

// 확인 처리(read)된 리마인더 taskId. mock 에서는 read 호출 시 목록에서 제외하기 위해 추적한다.
const readReminderIds = new Set<string>();

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// 메모리 상태 (앱 새로고침 전까지 유지)
let tasks: Task[] = initialTasks.map((t) => ({ ...t }));
let folders: Folder[] = initialFolders.map((f) => ({ ...f }));
// 진행 중 타이머 세션 추적 (sessionId → taskId/시작시각)
const activeSessions: Record<string, { taskId: string; startedAt: Date }> = {};

// 기록 1건을 태스크에 추가하고 잔여/완료를 갱신.
function appendRecord(taskId: string, rec: Omit<StudyRecord, "id">) {
  tasks = tasks.map((t) => {
    if (t.id !== taskId) return t;
    const record: StudyRecord = { ...rec, id: `r${Date.now()}` };
    const remaining = Math.max(0, t.remainingMin - rec.durationMin);
    return { ...t, records: [...t.records, record], remainingMin: remaining, completed: remaining === 0 };
  });
}

// DailyPlan mock 상태
const plans: Record<string, DailyPlan> = {};
let idSeq = 1;

function recalcPlanMinutes(plan: DailyPlan) {
  plan.totalMinutes = plan.slots.filter((s) => s.taskId).length * 30;
}
function planTaskFor(plan: DailyPlan, taskId: string, sourceType: PlanSourceType): DailyPlanTask {
  let pt = plan.tasks.find((t) => t.taskId === taskId);
  if (!pt) {
    const task = tasks.find((t) => t.id === taskId);
    pt = {
      dailyPlanTaskId: `dpt${idSeq++}`,
      taskId,
      taskName: task?.name ?? "(알 수 없음)",
      taskTypeCode: task?.type ?? "SATISFACTION_BASED",
      importance: task?.importance ?? "MEDIUM",
      displayOrder: plan.tasks.length,
      sourceType,
      plannedMinutes: 0,
      selected: true,
    };
    plan.tasks.push(pt);
  }
  return pt;
}
function assignSlotTo(plan: DailyPlan, slot: DailyPlanSlot, taskId: string | null, sourceType: PlanSourceType) {
  if (taskId == null) {
    slot.taskId = undefined;
    slot.taskName = undefined;
    slot.dailyPlanTaskId = undefined;
  } else {
    const pt = planTaskFor(plan, taskId, sourceType);
    slot.taskId = taskId;
    slot.taskName = pt.taskName;
    slot.dailyPlanTaskId = pt.dailyPlanTaskId;
  }
  // 태스크별 plannedMinutes 재계산
  for (const pt of plan.tasks) {
    pt.plannedMinutes = plan.slots.filter((s) => s.taskId === pt.taskId).length * 30;
  }
  recalcPlanMinutes(plan);
}

export const mockApi: RealPlanApi = {
  async login(email) {
    await delay();
    return { name: email.split("@")[0], email };
  },
  async signup(name, email) {
    await delay();
    return { name, email } as User;
  },
  async refresh() {
    await delay();
  },
  async logout() {
    await delay();
  },
  async updateProfile(input) {
    await delay();
    // mock 은 email 을 알 수 없으므로 비워 반환 (App 에서 기존 email 유지)
    return { name: input.nickname ?? "", email: "" } as User;
  },
  async resetData() {
    await delay();
    tasks = [];
    folders = [];
  },
  async withdraw() {
    await delay();
    tasks = [];
    folders = [];
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
  async completeTask(id) {
    await delay();
    tasks = tasks.map((t) => (t.id === id ? { ...t, completed: true } : t));
    return { ...tasks.find((t) => t.id === id)! };
  },

  async createFolder(name) {
    await delay();
    const folder: Folder = { id: `f${Date.now()}`, name, isDefault: false };
    folders = [...folders, folder];
    return { ...folder };
  },
  async updateFolder(id, name) {
    await delay();
    folders = folders.map((f) => (f.id === id ? { ...f, name } : f));
    return { ...folders.find((f) => f.id === id)! };
  },
  async deleteFolder(id) {
    await delay();
    folders = folders.filter((f) => f.id !== id);
    // 삭제 폴더의 태스크는 기본 폴더로 이동 (서버 동작 모사)
    const def = folders.find((f) => f.isDefault);
    if (def) tasks = tasks.map((t) => (t.folderId === id ? { ...t, folderId: def.id } : t));
  },

  async startSession(taskId) {
    await delay();
    const id = `s${Date.now()}`;
    activeSessions[id] = { taskId, startedAt: new Date() };
    return id;
  },
  async pauseSession() {
    await delay();
  },
  async resumeSession() {
    await delay();
  },
  async abandonSession(sessionId) {
    await delay();
    delete activeSessions[sessionId];
  },
  async endSession(sessionId, fb: SessionFeedbackInput) {
    await delay();
    const sess = activeSessions[sessionId];
    if (!sess) return { ...tasks[0] };
    const now = new Date();
    const durationMin = Math.max(1, Math.round((now.getTime() - sess.startedAt.getTime()) / 60000));
    appendRecord(sess.taskId, {
      startedAt: sess.startedAt,
      endedAt: now,
      durationMin,
      progressLevel: fb.progressLevel,
      progressPercent: fb.progressPercent,
      focusLevel: fb.focusLevel,
      notes: fb.notes,
      source: "TIMER",
    });
    delete activeSessions[sessionId];
    return { ...tasks.find((t) => t.id === sess.taskId)! };
  },
  async addManualRecord(taskId, input: ManualRecordInput) {
    await delay();
    const durationMin = Math.max(
      1,
      Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60000),
    );
    appendRecord(taskId, {
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMin,
      progressLevel: input.progressLevel,
      progressPercent: input.progressPercent,
      focusLevel: input.focusLevel,
      notes: input.notes,
      source: "MANUAL",
    });
    return { ...tasks.find((t) => t.id === taskId)! };
  },
  async fetchTaskSessions(taskId) {
    await delay();
    const t = tasks.find((t) => t.id === taskId);
    return (t?.records ?? []).map((r) => ({ ...r }));
  },

  // ── DailyPlan (mock) ──
  async createDailyPlan(planDate, slotIndexes) {
    await delay();
    const id = `dp${idSeq++}`;
    const slots: DailyPlanSlot[] = [...slotIndexes]
      .sort((a, b) => a - b)
      .map((idx) => ({ slotId: `slot${idSeq++}`, slotIndex: idx, timeLabel: slotIndexToLabel(idx) }));
    const plan: DailyPlan = {
      id,
      planDate,
      availableMinutes: slotIndexes.length * 30,
      totalMinutes: 0,
      status: "RECOMMENDED",
      slots,
      tasks: [],
    };
    plans[id] = plan;
    return structuredClone(plan);
  },
  async assignPlanTask(planId, taskId, slotIndexes) {
    await delay();
    const plan = plans[planId];
    for (const idx of slotIndexes) {
      const slot = plan.slots.find((s) => s.slotIndex === idx);
      if (slot) assignSlotTo(plan, slot, taskId, "USER");
    }
    return structuredClone(plan);
  },
  async autoAssignPlan(planId, input) {
    await delay();
    const plan = plans[planId];
    const empty = plan.slots.filter((s) => !s.taskId);
    const ids = input.taskIds.slice(0, input.maxTasks ?? input.taskIds.length);
    // 빈 슬롯을 태스크들에 순서대로 분배 (단순 fallback)
    empty.forEach((slot, i) => {
      const taskId = ids[i % Math.max(1, ids.length)];
      if (taskId) assignSlotTo(plan, slot, taskId, "AI");
    });
    return structuredClone(plan);
  },
  async updateDailyPlanStatus(planId, status) {
    await delay();
    const plan = plans[planId];
    plan.status = status;
    if (status === "CONFIRMED") plan.confirmedAt = new Date();
    return structuredClone(plan);
  },
  async updatePlanTask(planId, dailyPlanTaskId, patch) {
    await delay();
    const plan = plans[planId];
    const pt = plan.tasks.find((t) => t.dailyPlanTaskId === dailyPlanTaskId);
    if (pt) {
      if (patch.isSelected !== undefined) pt.selected = patch.isSelected;
      if (patch.displayOrder !== undefined) pt.displayOrder = patch.displayOrder;
    }
    return structuredClone(plan);
  },
  async assignPlanSlot(planId, slotId, taskId) {
    await delay();
    const plan = plans[planId];
    const slot = plan.slots.find((s) => s.slotId === slotId);
    if (slot) assignSlotTo(plan, slot, taskId, "USER");
    return structuredClone(plan);
  },
  async fetchDailyPlan(date) {
    await delay();
    const plan = Object.values(plans).find((p) => p.planDate === date);
    return plan ? structuredClone(plan) : null;
  },
  async fetchPlanRecommendations(planId) {
    await delay();
    const plan = plans[planId];
    const items = tasks
      .filter((t) => !t.completed)
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .map((t, i) => ({
        rank: i + 1,
        taskId: t.id,
        name: t.name,
        remainingMin: t.remainingMin,
        recommendScore: Math.max(0.1, 1 - i * 0.1),
        deadlineLabel: "",
        importanceLabel: t.importance,
        recommendedTimeBandLabel: "",
        requiredFocusLevel: "MEDIUM",
        reason: "mock 추천",
        dueToday: false,
      }));
    return {
      targetDate: plan?.planDate ?? "",
      availableMinutes: plan?.availableMinutes ?? 0,
      items,
      message: "mock",
    };
  },
  async replacePlanSlots(planId, slotIndexes) {
    await delay();
    const plan = plans[planId];
    const keep = new Map(
      plan.slots.filter((s) => slotIndexes.includes(s.slotIndex)).map((s) => [s.slotIndex, s]),
    );
    plan.slots = [...slotIndexes]
      .sort((a, b) => a - b)
      .map(
        (idx) =>
          keep.get(idx) ?? { slotId: `slot${idSeq++}`, slotIndex: idx, timeLabel: slotIndexToLabel(idx) },
      );
    plan.availableMinutes = slotIndexes.length * 30;
    for (const pt of plan.tasks) {
      pt.plannedMinutes = plan.slots.filter((s) => s.taskId === pt.taskId).length * 30;
    }
    recalcPlanMinutes(plan);
    return structuredClone(plan);
  },
  async batchAssignSlots(planId, blocks) {
    await delay();
    const plan = plans[planId];
    // 기존 AI 배정 초기화
    for (const s of plan.slots) {
      const pt = plan.tasks.find((t) => t.dailyPlanTaskId === s.dailyPlanTaskId);
      if (pt?.sourceType === "AI") {
        s.taskId = undefined;
        s.taskName = undefined;
        s.dailyPlanTaskId = undefined;
      }
    }
    for (const block of blocks) {
      for (const idx of block.slotIndexes) {
        const slot = plan.slots.find((s) => s.slotIndex === idx);
        if (slot) assignSlotTo(plan, slot, block.taskId, "AI");
      }
    }
    return structuredClone(plan);
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
  async fetchReminders(limit?: number): Promise<Reminder[]> {
    await delay();
    const list = getReminderTasks(tasks).filter((t) => !readReminderIds.has(t.id));
    const sliced = limit != null ? list.slice(0, limit) : list;
    return sliced.map((t) => ({
      taskId: t.id,
      name: t.name,
      dueDate: t.deadline,
      importance: t.importance,
      status: t.completed ? "COMPLETED" : "IN_PROGRESS",
      remainingMin: t.remainingMin,
      progressPercent: 0,
      reminderType: "DUE_SOON",
      message: "마감이 얼마 남지 않았어요",
      priority: 0,
      lastNotifiedAt: t.lastNotifiedAt,
    }));
  },
  async markRemindersRead(taskIds: string[]): Promise<void> {
    await delay(150);
    taskIds.forEach((id) => readReminderIds.add(id));
  },
  async fetchWeeklyStats(): Promise<WeeklyStats> {
    await delay();
    return {
      weekStart: "2026-06-08",
      weekEnd: "2026-06-14",
      totalMinutes: { current: 870, previous: 705, diff: 165 },
      averageFocus: { current: 3.6, previous: 3.2, diff: 0.4 },
      completedTasks: { current: 4, previous: 3, diff: 1 },
    };
  },
  async fetchDailyStudyTime(weeks = 2): Promise<DailyStudyTime> {
    await delay();
    const days = [120, 95, 180, 60, 200, 150, 65].map((totalMinutes, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, totalMinutes };
    });
    return { weeks, startDate: days[0].date, endDate: days[days.length - 1].date, days };
  },
  async fetchTypeStats(): Promise<TypeStat[]> {
    await delay();
    return [
      { taskTypeId: 1, taskTypeCode: "TIME_BASED", taskTypeName: "시간형", sampleCount: 12, plannedMinutes: 120, actualMinutes: 110, errorRatio: -0.08, biasCorrectionFactor: 1.0, lastCalculatedAt: null },
      { taskTypeId: 2, taskTypeCode: "QUANTITY_BASED", taskTypeName: "분량형", sampleCount: 8, plannedMinutes: 90, actualMinutes: 130, errorRatio: 0.44, biasCorrectionFactor: 1.3, lastCalculatedAt: null },
      { taskTypeId: 3, taskTypeCode: "SATISFACTION_BASED", taskTypeName: "만족형", sampleCount: 5, plannedMinutes: 180, actualMinutes: 245, errorRatio: 0.36, biasCorrectionFactor: 1.6, lastCalculatedAt: null },
    ];
  },
  async fetchFocusByHour(): Promise<FocusBucket[]> {
    await delay();
    return [1.5, 2.1, 2.8, 3.4, 3.6, 3.2, 2.5, 2.0, 2.3, 3.0, 3.5, 2.9].map((averageFocus, i) => ({
      startHour: i * 2,
      endHour: i * 2 + 2,
      label: `${i * 2}-${i * 2 + 2}시`,
      averageFocus,
      sessionCount: 3,
    }));
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
