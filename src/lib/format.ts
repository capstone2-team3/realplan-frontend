// ───────────────────────── 포맷 유틸 ─────────────────────────
import { today } from "./time";

// 분 → "1시간 30분"
export const fmtMin = (m: number) => {
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}시간` : `${h}시간 ${mm}분`;
};

// 마감일 → D-day / D-3 / D+2
export const fmtDday = (d: Date) => {
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "D-day";
  if (diff > 0) return `D-${diff}`;
  return `D+${-diff}`;
};

// 초 → HH:MM:SS (타이머 표시)
export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// 과거 시각 → "n분 전" / "n시간 전" / "n일 전"
export const fmtAgo = (d: Date) => {
  const diffMin = Math.round((today.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}일 전`;
};
