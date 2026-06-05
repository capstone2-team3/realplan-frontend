// ───────────────────────── Mock 데이터 ─────────────────────────
// 백엔드 연동 전까지 사용하는 가짜 초기 데이터.
// 합치는 단계에서 이 파일 대신 src/api/realApi.ts 의 서버 호출로 대체된다.
import type { Folder, Task } from "../types";
import { inDays, daysAgo, hoursAgo } from "../lib/time";

export const initialFolders: Folder[] = [
  { id: "default", name: "기본 폴더", isDefault: true },
  { id: "f1", name: "캡스톤", isDefault: false },
  { id: "f2", name: "운영체제", isDefault: false },
];

export const initialTasks: Task[] = [
  {
    id: "t1",
    folderId: "f1",
    name: "캡스톤 발표 자료 수정",
    type: "SATISFACTION_BASED",
    correctionEnabled: true,
    importance: "HIGH",
    difficulty: "HIGH",
    notes: "데모 영상 포함하기",
    originalEstimatedMin: 120,
    adjustedEstimatedMin: 180,
    remainingMin: 135,
    deadline: inDays(3),
    completed: false,
    createdAt: daysAgo(5),
    lastNotifiedAt: daysAgo(2), // 알림(2일 전) 이후 1일 전에 수행 → 리마인더에서 제외됨
    records: [
      {
        id: "r1",
        startedAt: daysAgo(1),
        endedAt: new Date(daysAgo(1).getTime() + 45 * 60000),
        durationMin: 45,
        progressLevel: 3,
        progressPercent: 25,
        focusLevel: 3,
        source: "TIMER",
      },
    ],
  },
  {
    id: "t2",
    folderId: "f2",
    name: "OS 챕터 7 문제 30개 풀기",
    type: "QUANTITY_BASED",
    correctionEnabled: true,
    importance: "HIGH",
    difficulty: "MEDIUM",
    originalEstimatedMin: 90,
    adjustedEstimatedMin: 117,
    remainingMin: 117,
    deadline: inDays(2),
    completed: false,
    createdAt: daysAgo(2),
    lastNotifiedAt: hoursAgo(5), // 5시간 전 알림 + 이후 수행 없음 → 리마인더 최상단
    records: [],
  },
  {
    id: "t3",
    folderId: "f2",
    name: "OS 강의 영상 시청",
    type: "TIME_BASED",
    correctionEnabled: false,
    importance: "MEDIUM",
    difficulty: "LOW",
    originalEstimatedMin: 60,
    adjustedEstimatedMin: 60,
    remainingMin: 60,
    deadline: inDays(5),
    completed: false,
    createdAt: daysAgo(1),
    records: [],
  },
  {
    id: "t4",
    folderId: "default",
    name: "논문 3편 읽고 요약",
    type: "SATISFACTION_BASED",
    correctionEnabled: true,
    importance: "LOW",
    difficulty: "UNKNOWN",
    originalEstimatedMin: 90,
    adjustedEstimatedMin: 144,
    remainingMin: 144,
    deadline: inDays(7),
    completed: false,
    createdAt: daysAgo(3),
    lastNotifiedAt: hoursAgo(30), // 30시간 전 알림 + 이후 수행 없음 → 리마인더 노출
    records: [],
  },
];
