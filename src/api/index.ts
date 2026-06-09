// ───────────────────────── API 진입점 (mock ↔ real 스위치) ─────────────────────────
// 화면들은 항상 여기서 `api` 를 import 한다.
//
// ▶ 지금 (백엔드 없이 개발): mockApi 사용
// ▶ 합치는 날: 아래 한 줄을 realApi 로 바꾸고, .env 에 VITE_API_BASE_URL 지정
//
//   import { realApi as api } ...  →  실제 서버 호출
//
// 또는 환경변수로 자동 전환하려면 USE_REAL 분기를 사용.

import { mockApi } from "./mockApi";
import { realApi } from "./realApi";

const USE_REAL = import.meta.env.VITE_USE_REAL_API === "true";

export const api = USE_REAL ? realApi : mockApi;

export type { RealPlanApi, CreateTaskInput, SessionFeedbackInput, ManualRecordInput } from "./types";
