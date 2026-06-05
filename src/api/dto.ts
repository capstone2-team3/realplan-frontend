// ───────────────────────── 서버 DTO 타입 ─────────────────────────
// 통합 설계서(RealPlan_통합_설계서.pdf) §2 DB 스키마 / §4 REST API 기준.
//
// ⚠️ DB 컬럼은 snake_case 지만, REST 응답 JSON 직렬화 키는 백엔드 합의가 필요하다.
//    Spring 기본 Jackson 설정은 camelCase 이므로, 여기서는 camelCase 응답을 가정한다.
//    실제 응답이 snake_case 라면 이 파일의 키만 바꾸면 된다. (변환은 mappers.ts)
//
// enum 값은 설계서 기준 소문자: priority low/medium/high, difficulty low/medium/high/unknown,
// status pending/in_progress/completed, focusLevel low/medium/high/very_high.

// Task (설계서 §2-4)
export type TaskDTO = {
  taskId: number;
  userId: number;
  folderId: number;
  taskTypeId: number;
  taskTypeCode?: string;      // TIME_BASED / QUANTITY_BASED / SATISFACTION_BASED (join 시)
  title: string;
  description: string | null;
  dueDate: string | null;     // ISO
  priority: string;           // low / medium / high
  status: string;             // pending / in_progress / completed
  difficulty: string;         // low / medium / high / unknown
  userEstimated: number | null;
  aiEstimated: number | null;
  finalEstimated: number | null;
  progressPercent: number;    // 0-100
  totalTime: number;          // 누적 실제 소요(분)
  completedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Folder (설계서 §2-2)
export type FolderDTO = {
  folderId: number;
  userId: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// FocusSession + SessionFeedback 조합 (학습 기록 1건; 설계서 §2-8, §2-9)
export type StudyRecordDTO = {
  sessionId: number;
  taskId: number;
  source: string;             // session / manual
  sessionStatus: string;      // active / paused / ended / abandoned
  startedAt: string;
  endedAt: string | null;
  actualMinutes: number | null;
  // feedback
  progressLevel: number | null;     // 1-5
  progressPercentAfter: number | null;
  focusLevel: string | null;        // low / medium / high / very_high
  note: string | null;
};

// Users (설계서 §2-1)
export type UserDTO = {
  userId: number;
  email: string;
  nickname: string;
};

// 로그인 응답 (설계서 §4-1: Access + Refresh Token)
export type AuthResultDTO = {
  user: UserDTO;
  accessToken: string;
  refreshToken?: string;
};
