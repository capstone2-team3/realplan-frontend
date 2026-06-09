// ───────────────────────── HTTP 클라이언트 (공통) ─────────────────────────
// 백엔드(Spring)와 통신하는 공통 fetch 래퍼.
// 통합 설계서 §5 공통 응답 구조를 따른다:
//   성공: { "success": true,  "data": {...}, "meta": {...} }
//   실패: { "success": false, "error": { "code", "message" } }
//
// 인증: Authorization: Bearer {accessToken}
// 토큰 재발급: accessToken 만료(401) 시 refreshToken 으로 /auth/refresh 자동 호출.

// Swagger 엔드포인트가 /api/auth/... 형태이므로 base 는 /api.
// .env 에 VITE_API_BASE_URL=http://{host}/api 지정.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

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

// ── 토큰 보관 (메모리 + localStorage) ──
const ACCESS_KEY = "realplan_token";
const REFRESH_KEY = "realplan_refresh_token";
const ls = typeof localStorage !== "undefined" ? localStorage : null;

let accessToken: string | null = ls?.getItem(ACCESS_KEY) ?? null;
let refreshToken: string | null = ls?.getItem(REFRESH_KEY) ?? null;

export function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (ls) access ? ls.setItem(ACCESS_KEY, access) : ls.removeItem(ACCESS_KEY);
  if (refresh !== undefined) {
    refreshToken = refresh;
    if (ls) refresh ? ls.setItem(REFRESH_KEY, refresh) : ls.removeItem(REFRESH_KEY);
  }
}
export function clearTokens() {
  setTokens(null, null);
}
export function getToken() {
  return accessToken;
}
export function getRefreshToken() {
  return refreshToken;
}

// accessToken 만료 시 refreshToken 으로 새 토큰을 받아온다.
// /auth/refresh 자체는 envelope 로 토큰을 돌려준다고 가정.
//
// 동시에 여러 요청이 401 을 받으면 각자 재발급을 호출하게 되는데, 백엔드가 refresh 토큰을
// 회전(rotation)시키면 두 번째 재발급은 이미 무효화된 토큰을 보내 실패(500)하고 세션이 깨진다.
// 따라서 진행 중인 재발급이 있으면 그 Promise 를 공유해 재발급을 단 한 번만 수행한다.
let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
    }>;
    if (!res.ok || !json.success || !json.data) return false;
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // accessToken 만료: 한 번만 재발급 후 재시도. /auth/* 호출은 재발급 대상에서 제외.
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await tryRefresh()) return request<T>(method, path, body, false);
    clearTokens();
  }

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
