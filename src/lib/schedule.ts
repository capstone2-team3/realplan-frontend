// ───────────────────────── 시간표 슬롯 유틸 ─────────────────────────
// 시간 범위: 06:00 ~ 익일 03:00 (=27:00 표기), 30분 단위 = 총 42슬롯

export const HOUR_START = 6;
export const HOUR_END = 27; // 익일 03:00을 27:00으로 표기
export const SLOTS_PER_HOUR = 2; // 30분 단위
export const TOTAL_SLOTS = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;

export const slotIndexToLabel = (idx: number) => {
  const totalMin = HOUR_START * 60 + idx * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// 연속된 선택 슬롯을 [{start, end}] 구간 배열로 압축
export function compressSlots(selected: Set<number>): { start: number; end: number }[] {
  const sorted = Array.from(selected).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  let s = sorted[0];
  let p = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === p + 1) {
      p = sorted[i];
    } else {
      ranges.push({ start: s, end: p + 1 });
      s = sorted[i];
      p = sorted[i];
    }
  }
  ranges.push({ start: s, end: p + 1 });
  return ranges;
}
