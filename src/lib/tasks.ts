// ───────────────────────── Task 정렬/필터/색상 유틸 ─────────────────────────
import type { Task, SortKey, FilterKey } from "../types";
import { IMPORTANCE_RANK, TASK_PALETTE } from "../types";

export const sortTasks = (list: Task[], key: SortKey): Task[] => {
  const arr = [...list];
  switch (key) {
    case "RECENT":
      arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "CREATED":
      arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
    case "DEADLINE":
      arr.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
      break;
    case "IMPORTANCE":
      arr.sort((a, b) => IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance]);
      break;
  }
  return arr;
};

export const filterTasks = (list: Task[], key: FilterKey): Task[] => {
  if (key === "ACTIVE") return list.filter((t) => !t.completed);
  if (key === "COMPLETED") return list.filter((t) => t.completed);
  return list;
};

// Task 리마인더: 최근 Push 알림을 받았고(lastNotifiedAt 존재),
// 그 알림 이후로 수행 기록이 없는 미완료 Task. 알림 최신순, 최대 3개.
export const getReminderTasks = (list: Task[]): Task[] => {
  return list
    .filter((t) => {
      if (t.completed || !t.lastNotifiedAt) return false;
      const notifiedAt = t.lastNotifiedAt.getTime();
      const studiedAfter = t.records.some((r) => r.endedAt.getTime() > notifiedAt);
      return !studiedAfter;
    })
    .sort((a, b) => b.lastNotifiedAt!.getTime() - a.lastNotifiedAt!.getTime())
    .slice(0, 3);
};

// 추천 순서 우선 + 그 외 순서로 taskId 배열을 만들고, 색상을 안정적으로 배정
export function buildTaskOrder(recommendedTasks: Task[], allTasks: Task[]): string[] {
  return [
    ...recommendedTasks.map((t) => t.id),
    ...allTasks.filter((t) => !recommendedTasks.some((r) => r.id === t.id)).map((t) => t.id),
  ];
}
export function colorForTask(taskId: string, order: string[]): string {
  const idx = order.indexOf(taskId);
  return TASK_PALETTE[(idx < 0 ? 0 : idx) % TASK_PALETTE.length];
}

// 진행률(%)을 "예상 진행률 대비 비율"로 5단계 속도로 환산.
// 세션 종료 리포트와 학습 기록 추가에서 공통으로 사용.
export function percentToLevel(pct: number, expected: number): 1 | 2 | 3 | 4 | 5 {
  if (expected <= 0) return 3;
  const ratio = pct / expected;
  if (ratio < 0.5) return 1;
  if (ratio < 0.85) return 2;
  if (ratio <= 1.15) return 3;
  if (ratio <= 1.5) return 4;
  return 5;
}
