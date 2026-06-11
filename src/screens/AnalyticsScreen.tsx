import { useState, useEffect } from "react";
import { Clock, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { Task, TaskTypeCode, Difficulty } from "../types";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { monoStack, tone } from "../theme/tokens";
import { TASK_TYPE_DESC, TASK_TYPE_LABELS, DIFFICULTY_LABELS } from "../types";
import { api } from "../api";
import type { TypeStat, FocusBucket, WeeklyStats, DailyStudyTime } from "../api/types";

export function AnalyticsScreen({ tasks }: { tasks: Task[] }) {
  const TYPES: TaskTypeCode[] = ["TIME_BASED", "QUANTITY_BASED", "SATISFACTION_BASED"];
  const DIFFICULTIES: Difficulty[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];

  // Analytics 데이터 (서버/mock 에서 로드)
  const [typeStats, setTypeStats] = useState<TypeStat[]>([]);
  const [focusByHour, setFocusByHour] = useState<FocusBucket[]>([]);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  // 평균 세션 계산용: 최근 4주 일별 학습시간 (총 학습분 합산).
  const [daily, setDaily] = useState<DailyStudyTime | null>(null);
  // 유형/난이도별 보정 배율은 백엔드 보정 통계(세션 오차비/평균제거 잔차)가 아니라,
  // 각 Task의 실제 적용 보정치(adjusted/original)를 프론트에서 집계해 보여준다. (아래 appliedCorrection)

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.fetchTypeStats(),
      api.fetchFocusByHour(),
      api.fetchWeeklyStats(),
      api.fetchDailyStudyTime(4),
    ])
      .then(([ts, fh, wk, dl]) => {
        if (!alive) return;
        setTypeStats(ts);
        setFocusByHour(fh);
        setWeekly(wk);
        setDaily(dl);
      })
      .catch((e) => console.error("Analytics 로드 실패:", e));
    return () => {
      alive = false;
    };
  }, []);

  // 유형 코드 → 통계 빠른 조회
  const statByType = (type: TaskTypeCode) => typeStats.find((t) => t.taskTypeCode === type);

  // 일일 평균 학습: 주간 총 학습시간 / 7
  const dailyAvgMin = weekly ? Math.round(weekly.totalMinutes.current / 7) : 0;
  // 평균 세션: 최근 4주 총 학습시간 / 총 세션 수. 수동 기록(MANUAL)·타이머 모두 ENDED 세션이라 함께 반영된다.
  const totalSessions = focusByHour.reduce((s, b) => s + b.sessionCount, 0);
  const totalMinutes4w = daily ? daily.days.reduce((s, d) => s + d.totalMinutes, 0) : 0;
  const avgSessionMin = totalSessions > 0 ? Math.round(totalMinutes4w / totalSessions) : 0;

  // 보정 배율에 따른 Pill 색상
  const coefVariant = (coef: number) => (coef >= 1.5 ? "warn" : coef > 1 ? "default" : "muted");

  // 시간대별 집중도 막대 색상: 버킷들을 평균 집중도 기준으로 정렬해 상위/중위/하위 1/3 로 3색 배정.
  // (12개 버킷 → 상위 4 진한 색, 중간 4 중간 색, 하위 4 연한 색)
  const FOCUS_BAR_HIGH = tone.accent;     // 진한 색
  const FOCUS_BAR_MID = "#6B8475";        // 중간 색 (세이지 그린)
  const FOCUS_BAR_LOW = tone.borderStrong; // 연한 색
  const focusRankOrder = [...focusByHour]
    .map((b, i) => ({ i, v: b.averageFocus }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);
  const focusBarColor = (i: number) => {
    const third = Math.ceil(focusByHour.length / 3) || 1;
    const rank = focusRankOrder.indexOf(i);
    if (rank < third) return FOCUS_BAR_HIGH;
    if (rank < third * 2) return FOCUS_BAR_MID;
    return FOCUS_BAR_LOW;
  };

  // 유형/난이도별 "실제 적용된 AI 보정 배율".
  // adjustedEstimatedMin(=finalEstimated)은 userGlobal·시스템 prior·잔차가 모두 반영된 최종 보정치라,
  // (adjusted / original) 가 그 Task에 실제 적용된 보정 배율이다. 그룹 내 평균을 보여준다.
  // (백엔드 type-stats.biasCorrectionFactor 는 "보정 후 실제/예상 오차비", difficulty-correction 의
  //  residual 은 userGlobal 이 빠진 평균제거 편차라 둘 다 실제 보정 배율이 아니다. → 여기서 직접 계산.)
  //
  // 보정 OFF(시간형 한정 토글) Task 는 finalEstimated=userEstimated 라 비율이 항상 1.0 이다.
  // 이를 평균에 넣으면 "ON 시 적용 보정률"이 1.0 쪽으로 희석되므로, correctionEnabled 인 Task만 집계한다.
  const appliedCorrection = (groupTasks: Task[]) => {
    const ratios = groupTasks
      .filter((t) => t.correctionEnabled && t.originalEstimatedMin > 0)
      .map((t) => t.adjustedEstimatedMin / t.originalEstimatedMin);
    if (ratios.length === 0) return { coef: 1, count: 0 };
    return { coef: ratios.reduce((s, r) => s + r, 0) / ratios.length, count: ratios.length };
  };
  // 배율 → "+12% / -5% / ±0%" 형태 (음수 보정도 부호 정확히 표기)
  const correctionPctLabel = (coef: number) => {
    const pct = Math.round((coef - 1) * 100);
    return pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "±0%";
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: "20px 16px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Analytics</div>
        <div style={{ fontSize: 12, color: tone.inkMuted }}>
          나의 학습 패턴과 계획 오류 보정률을 확인하세요
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Card style={{ padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <Clock size={11} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>일일 평균</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: monoStack }}>
              {dailyAvgMin}분
            </div>
          </Card>
          <Card style={{ padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <Zap size={11} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>평균 세션</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: monoStack }}>
              {avgSessionMin}분
            </div>
          </Card>
          <Card style={{ padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <TrendingUp size={11} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>완료율</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: monoStack }}>
              {tasks.length === 0 ? 0 : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100)}%
            </div>
          </Card>
        </div>

        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} color={tone.accent} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>유형별 계획 오류 보정</div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: tone.inkMuted,
              background: tone.accentSoft,
              padding: 9,
              borderRadius: 8,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            과거 데이터로 학습된 사용자의 계획 오류율입니다. AI가 자동으로 갱신하며, 직접 수정할 수 없습니다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TYPES.map((type) => {
              const typeTasks = tasks.filter((t) => t.type === type);
              // 실제 적용된 AI 보정 배율(adjusted/original 평균). 보정 ON 이면 1.00 이 아닌 실제 값이 잡힌다.
              const { coef, count } = appliedCorrection(typeTasks);
              return (
                <div
                  key={type}
                  style={{
                    background: tone.surfaceMuted,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 10,
                    padding: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        {TASK_TYPE_LABELS[type]}
                      </div>
                      <div style={{ fontSize: 10, color: tone.inkSubtle, lineHeight: 1.4 }}>
                        {TASK_TYPE_DESC[type]}
                      </div>
                    </div>
                    <Pill variant={coefVariant(coef)}>
                      ×{coef.toFixed(2)}
                    </Pill>
                  </div>
                  <div style={{ fontSize: 10, color: tone.inkSubtle }}>
                    {typeTasks.length}개 Task · 보정 적용 {count}개 · 평균 {correctionPctLabel(coef)} 보정
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 난이도별 계획 오류 보정 */}
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} color={tone.accent} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>난이도별 계획 오류 보정</div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: tone.inkMuted,
              background: tone.accentSoft,
              padding: 9,
              borderRadius: 8,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            난이도(상·중·하·모름)별로 학습된 계획 오류율입니다. AI가 자동으로 갱신하며, 직접 수정할 수 없습니다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DIFFICULTIES.map((d) => {
              const diffTasks = tasks.filter((t) => t.difficulty === d);
              // 실제 적용된 AI 보정 배율(adjusted/original 평균). residual(평균제거 편차)이 아니라
              // userGlobal·시스템효과까지 반영된 최종 보정치라 값/대소관계가 의미 있게 나온다.
              const { coef, count } = appliedCorrection(diffTasks);
              return (
                <div
                  key={d}
                  style={{
                    background: tone.surfaceMuted,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 10,
                    padding: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>난이도 {DIFFICULTY_LABELS[d]}</div>
                    <Pill variant={coefVariant(coef)}>×{coef.toFixed(2)}</Pill>
                  </div>
                  <div style={{ fontSize: 10, color: tone.inkSubtle }}>
                    {diffTasks.length}개 Task · 보정 적용 {count}개 · 평균 {correctionPctLabel(coef)} 보정
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>시간대별 평균 집중도</div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 12 }}>
            언제 가장 집중이 잘 되는지 확인하세요
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3 }}>
            {focusByHour.map((b, i) => {
              const v = b.averageFocus;
              const barH = v > 0 ? Math.max(2, (v / 4) * 80) : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: 80, display: "flex", alignItems: "flex-end" }}>
                    <div
                      style={{
                        width: "100%",
                        height: barH,
                        background: focusBarColor(i),
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 8, color: tone.inkSubtle, fontFamily: monoStack }}>{b.startHour}h</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>유형별 예상 vs 실제</div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 12 }}>
            예측한 시간과 실제 소요 시간을 비교합니다
          </div>
          {/* 범례 */}
          <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 10, color: tone.inkMuted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: tone.borderStrong }} /> 예측
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: tone.accent }} /> 실제
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TYPES.map((type) => {
              const stat = statByType(type);
              const planned = stat?.plannedMinutes ?? 0;
              const actual = stat?.actualMinutes ?? 0;
              const max = Math.max(planned, actual, 1);
              // 예측 대비 실제 비율(%). 100% 초과면 예측보다 오래 걸린 것.
              const ratioPct = planned > 0 ? Math.round((actual / planned) * 100) : null;
              const overrun = actual > planned;
              return (
                <div key={type}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{TASK_TYPE_LABELS[type]}</span>
                    <span style={{ color: tone.inkMuted, fontFamily: monoStack }}>
                      예측 {planned}분 · 실제 {actual}분
                      {ratioPct !== null && (
                        <span style={{ color: overrun ? tone.warn : tone.accent, fontWeight: 600 }}> ({ratioPct}%)</span>
                      )}
                    </span>
                  </div>
                  {/* 예측 막대 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: tone.inkSubtle, width: 24, flexShrink: 0 }}>예측</span>
                    <div style={{ flex: 1, height: 8, background: tone.surfaceMuted, borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${(planned / max) * 100}%`, background: tone.borderStrong, borderRadius: 4 }} />
                    </div>
                  </div>
                  {/* 실제 막대 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, color: tone.inkSubtle, width: 24, flexShrink: 0 }}>실제</span>
                    <div style={{ flex: 1, height: 8, background: tone.surfaceMuted, borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${(actual / max) * 100}%`, background: overrun ? tone.warn : tone.accent, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
