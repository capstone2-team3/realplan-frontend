// ───────────────────────── HTTP 클라이언트 (공통) ─────────────────────────
// 백엔드(Spring)와 통신하는 공통 fetch 래퍼.
// 통합 설계서 §5 공통 응답 구조를 따른다:
//   성공: { "success": true,  "data": {...}, "meta": {...} }
//   실패: { "success": false, "error": { "code", "message" } }
//
// 인증: Authorization: Bearer {JWT} (통합 설계서 §4)

// 합치는 날: .env 에 VITE_API_BASE_URL=https://{host}/api/v1 지정
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

// 공통 응답 래퍼
export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page?: number; size?: number; totalElements?: number };
};

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

// JWT 토큰 보관 (메모리 + localStorage). 로그인 시 setToken 으로 저장.
let accessToken: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem("realplan_token") : null;

export function setToken(token: string | null) {
  accessToken = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem("realplan_token", token);
    else localStorage.removeItem("realplan_token");
  }
}
export function getToken() {
  return accessToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: ApiEnvelope<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("PARSE_ERROR", `응답을 해석할 수 없습니다 (HTTP ${res.status})`);
  }

  if (!json.success || json.error) {
    throw new ApiError(json.error?.code ?? "UNKNOWN", json.error?.message ?? "알 수 없는 오류");
  }
  return json.data as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
