// ───────────────────────── 도메인 타입 & 라벨 상수 ─────────────────────────
// 앱 전체가 공유하는 데이터 타입 정의.
// 백엔드 API와 맞닿는 부분이므로, 합치는 단계에서 이 파일이 "프론트가 기대하는 데이터 모양"의 기준이 된다.
// (백엔드 snake_case ↔ 프론트 camelCase 변환은 src/api/mappers.ts 에서 담당)

// 태스크 유형 (백엔드 task_type.code 와 매핑)
export type TaskTypeCode = "TIME_BASED" | "QUANTITY_BASED" | "SATISFACTION_BASED";
// 중요도 (백엔드 task.priority 와 매핑: HIGH/MEDIUM/LOW)
export type Importance = "HIGH" | "MEDIUM" | "LOW";
// 난이도 (백엔드 task.difficulty 와 매핑)
export type Difficulty = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export const TASK_TYPE_LABELS: Record<TaskTypeCode, string> = {
  TIME_BASED: "시간형",
  QUANTITY_BASED: "분량형",
  SATISFACTION_BASED: "만족형",
};

export const TASK_TYPE_DESC: Record<TaskTypeCode, string> = {
  TIME_BASED: "완료 시점이 명확한 작업 (예: 강의 1시간 시청)",
  QUANTITY_BASED: "완료 시점은 불명확하지만 완료 기준은 명확 (예: 문제 30개 풀기)",
  SATISFACTION_BASED: "완료 시점·완료 기준 모두 불명확 (예: 보고서 초안 작성)",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  HIGH: "상",
  MEDIUM: "중",
  LOW: "하",
  UNKNOWN: "모름",
};

export const IMPORTANCE_RANK: Record<Importance, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// 학습 기록 한 건 (백엔드 focus_session + session_feedback 와 매핑)
export type StudyRecord = {
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  progressLevel: 1 | 2 | 3 | 4 | 5;
  progressPercent: number; // 사용자가 슬라이더로 조정한 실제 % (역행 가능)
  focusLevel: 1 | 2 | 3 | 4;
  notes?: string;
  source: "TIMER" | "MANUAL";
};

// 태스크 (백엔드 task 테이블과 매핑)
export type Task = {
  id: string;
  folderId: string;
  name: string;
  type: TaskTypeCode;
  correctionEnabled: boolean;
  importance: Importance;
  difficulty: Difficulty;
  notes?: string;
  originalEstimatedMin: number;   // 내 예측 (userEstimated)
  adjustedEstimatedMin: number;   // AI 보정 적용된 최종 예상시간 (finalEstimated; 보정 없으면 == originalEstimatedMin)
  remainingMin: number;
  deadline: Date;
  completed: boolean;
  createdAt: Date;
  // 최근 Push 알림을 받은 시각 (없으면 알림 받은 적 없음).
  // 이 시각 이후의 수행 기록이 없으면 Task 리마인더에 노출됨.
  lastNotifiedAt?: Date;
  records: StudyRecord[];
};

// 폴더 (백엔드 folder 테이블과 매핑)
export type Folder = {
  id: string;
  name: string;
  isDefault: boolean;
};

// 하루 플랜 (백엔드 daily_plan 과 매핑)
export type DailyPlanStatus = "RECOMMENDED" | "CONFIRMED" | "ENDED" | "REJECTED";
export type PlanSourceType = "AI" | "USER" | "BOTH";

export type DailyPlanSlot = {
  slotId: string;
  slotIndex: number;
  timeLabel: string;
  dailyPlanTaskId?: string;
  taskId?: string;
  taskName?: string;
};

export type DailyPlanTask = {
  dailyPlanTaskId: string;
  taskId: string;
  taskName: string;
  taskTypeCode: TaskTypeCode;
  importance: Importance;
  displayOrder: number;
  sourceType: PlanSourceType;
  plannedMinutes: number;
  selected: boolean;
};

export type DailyPlan = {
  id: string;
  planDate: string;          // YYYY-MM-DD
  availableMinutes: number;
  totalMinutes: number;
  status: DailyPlanStatus;
  confirmedAt?: Date;
  slots: DailyPlanSlot[];
  tasks: DailyPlanTask[];
};

// AI 태스크 추천 (저장 없는 순위 목록)
export type PlanRecommendationItem = {
  rank: number;
  taskId: string;
  name: string;
  remainingMin: number;
  recommendScore: number;
  deadlineLabel: string;
  importanceLabel: string;
  recommendedTimeBandLabel: string;
  requiredFocusLevel: string;   // HIGH / MEDIUM / LOW / FLEXIBLE
  reason: string;
  dueToday: boolean;
};
export type PlanRecommendations = {
  targetDate: string;
  availableMinutes: number;
  items: PlanRecommendationItem[];
  message: string;
};

// 로그인 사용자 (백엔드 users 테이블과 매핑)
export type User = {
  name: string;
  email: string;
};

export type SortKey = "RECENT" | "DEADLINE" | "CREATED" | "IMPORTANCE";
export type FilterKey = "ALL" | "ACTIVE" | "COMPLETED";

export const SORT_LABELS: Record<SortKey, string> = {
  RECENT: "최신순",
  CREATED: "생성일순",
  DEADLINE: "마감 임박순",
  IMPORTANCE: "중요도순",
};

export const FILTER_LABELS: Record<FilterKey, string> = {
  ALL: "전체",
  ACTIVE: "미완료",
  COMPLETED: "완료",
};

export const FOCUS_LABELS = ["", "산만했어", "보통", "꽤 집중", "완전 몰입"];

// 집중 잘 되는 시간대 (4구간).
export type FocusBand = "DAWN" | "MORNING" | "AFTERNOON" | "EVENING";
export const FOCUS_BAND_LABELS: Record<FocusBand, string> = {
  MORNING: "06–12시",
  AFTERNOON: "12–18시",
  EVENING: "18–24시",
  DAWN: "00–06시",
};
// ⚠️ deprecated: Task 타입 → 고정 시간대 하드코딩(가짜 데이터). 실제 집중시간대는
// 추천 API의 recommendedTimeBandLabel(태스크별 AI 계산값)을 사용한다. (HomeRecommendation 참고)
export const TASK_FOCUS_BAND: Record<TaskTypeCode, FocusBand> = {
  TIME_BASED: "AFTERNOON",
  QUANTITY_BASED: "MORNING",
  SATISFACTION_BASED: "EVENING",
};

// 홈 화면 추천 상태. 추천된 Task 목록 + taskId별 추천 집중시간대 라벨(timeBandByTask).
// timeBandByTask 에 없는 taskId 는 집중시간대 데이터가 아직 없는 것(cold start)으로 처리한다.
export type HomeRecommendation = {
  items: Task[];
  total: number;
  timeBandByTask: Record<string, string>;
};

// 시간표 색상 팔레트 (task별 자동 배정)
export const TASK_PALETTE = [
  "#2D4A3E", // forest
  "#7A4A2E", // rust
  "#3E4A6B", // indigo
  "#6B3E5A", // plum
  "#4A6B3E", // moss
  "#6B5A2E", // ochre
];

// 화면 라우팅 상태
export type Screen =
  | { name: "home" }
  | { name: "tasks" }
  | { name: "taskDetail"; taskId: string }
  | { name: "studySession"; taskId?: string }
  | { name: "analytics" }
  | { name: "settings" };

// 진행도 5단계 → 대표 진행률% (UI 표시용. 실제 환산은 백엔드/AI가 함)
export const PROGRESS_LEVEL_TO_PCT: Record<number, number> = {
  1: 8, // 매우 더딤
  2: 14, // 약간 더딤
  3: 20, // 예상대로
  4: 28, // 약간 앞서감
  5: 40, // 매우 앞서감
};
export const PROGRESS_LABELS = ["", "매우 더딤", "약간 더딤", "예상대로", "약간 앞서감", "매우 앞서감"];
