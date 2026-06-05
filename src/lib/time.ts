// ───────────────────────── 시간/날짜 유틸 ─────────────────────────
// 앱 전역에서 공유하는 "현재 시각" 기준값과 날짜 헬퍼.

export const today = new Date();
export const inDays = (d: number) => new Date(today.getTime() + d * 86400000);
export const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000);
export const hoursAgo = (h: number) => new Date(today.getTime() - h * 3600000);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfToday = startOfDay(today);

// 날짜 키: YYYY-MM-DD (시간표/가용시간 저장 키)
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayKey = dateKey(startOfToday);

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const fmtMonthDay = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
export const fmtMonthDayWeekday = (d: Date) =>
  `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`;
export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
