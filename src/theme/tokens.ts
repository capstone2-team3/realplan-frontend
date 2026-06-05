// ───────────────────────── Design Tokens ─────────────────────────
// 앱 전역에서 쓰는 색상 팔레트와 폰트 스택.
// 모든 컴포넌트가 이 토큰을 import 해서 색을 참조한다.

export const tone = {
  bg: "#F5F3EE",
  surface: "#FFFFFF",
  surfaceMuted: "#FAF8F3",
  ink: "#1C1B1A",
  inkMuted: "#6B6862",
  inkSubtle: "#A8A39A",
  border: "#E5E1D8",
  borderStrong: "#D4CFC2",
  accent: "#2D4A3E",
  accentSoft: "#D8E5DD",
  warn: "#9A6233",
  warnSoft: "#F4E8D8",
  danger: "#8B3A2E",
  dangerSoft: "#F2DDD8",
};

export const fontStack = `'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
export const monoStack = `'JetBrains Mono', 'SF Mono', monospace`;
