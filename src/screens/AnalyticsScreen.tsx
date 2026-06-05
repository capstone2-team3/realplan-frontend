import { useState, useEffect } from "react";
import { Clock, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import type { Task, TaskTypeCode, Difficulty } from "../types";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { monoStack, tone } from "../theme/tokens";
import { TASK_TYPE_DESC, TASK_TYPE_LABELS, DIFFICULTY_LABELS } from "../types";
import { api } from "../api";
import type { TypeCorrections, DifficultyCorrections } from "../api/types";

export function AnalyticsScreen({ tasks }: { tasks: Task[] }) {
  const TYPES: TaskTypeCode[] = ["TIME_BASED", "QUANTITY_BASED", "SATISFACTION_BASED"];
  const DIFFICULTIES: Difficulty[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];

  // 개인화 보정 계수 (서버/mock 에서 로드)
  const [typeCorr, setTypeCorr] = useState<TypeCorrections | null>(null);
  const [diffCorr, setDiffCorr] = useState<DifficultyCorrections | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.fetchTypeCorrections(), api.fetchDifficultyCorrections()])
      .then(([tc, dc]) => {
        if (!alive) return;
        setTypeCorr(tc);
        setDiffCorr(dc);
      })
      .catch((e) => console.error("보정 계수 로드 실패:", e));
    return () => {
      alive = false;
    };
  }, []);

  const allRecords = tasks.flatMap((t) => t.records);
  const totalStudyMin = allRecords.reduce((s, r) => s + r.durationMin, 0);

  // 보정 배율에 따른 Pill 색상
  const coefVariant = (coef: number) => (coef >= 1.5 ? "warn" : coef > 1 ? "default" : "muted");

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: "20px 16px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Analytics</div>
        <div style={{ fontSize: 12, color: tone.inkMuted }}>
          나의 학습 패턴과 계획 정확도를 확인하세요
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Target size={12} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>나의 예측 정확도</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: monoStack }}>78%</div>
          </Card>
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Clock size={12} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>일일 평균 학습</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: monoStack }}>
              {Math.round(totalStudyMin / 7)}분
            </div>
          </Card>
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Zap size={12} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>평균 세션</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: monoStack }}>
              {allRecords.length === 0 ? 0 : Math.round(totalStudyMin / allRecords.length)}분
            </div>
          </Card>
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <TrendingUp size={12} color={tone.inkMuted} />
              <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>완료율</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: monoStack }}>
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
              const coef = typeCorr?.[type].coefficient ?? 1;
              const samples = typeCorr?.[type].sampleCount ?? 0;
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
                    {typeTasks.length}개 Task · {samples}개 세션 학습 · 평균 +{Math.round((coef - 1) * 100)}% 보정
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
              const coef = diffCorr?.[d].coefficient ?? 1;
              const samples = diffCorr?.[d].sampleCount ?? 0;
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
                    {diffTasks.length}개 Task · {samples}개 세션 학습 · 평균 +{Math.round((coef - 1) * 100)}% 보정
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
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, paddingTop: 10 }}>
            {[1.5, 2.1, 2.8, 3.4, 3.6, 3.2, 2.5, 2.0, 2.3, 3.0, 3.5, 2.9].map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: "100%",
                    height: `${(v / 4) * 100}%`,
                    background: v >= 3 ? tone.accent : tone.borderStrong,
                    borderRadius: 3,
                  }}
                />
                <div style={{ fontSize: 8, color: tone.inkSubtle, fontFamily: monoStack }}>{i * 2}h</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>유형별 예상 vs 실제</div>
          <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 12 }}>
            예측한 시간과 실제 소요 시간을 비교합니다
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TYPES.map((type, i) => {
              const planned = [120, 90, 180][i];
              const actual = [110, 130, 245][i];
              const max = Math.max(planned, actual);
              return (
                <div key={type}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span>{TASK_TYPE_LABELS[type]}</span>
                    <span style={{ color: tone.inkMuted, fontFamily: monoStack }}>
                      {planned}분 / {actual}분
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 6, background: tone.surfaceMuted, borderRadius: 3 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${(planned / max) * 100}%`,
                        background: tone.borderStrong,
                        borderRadius: 3,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${(actual / max) * 100}%`,
                        background: actual > planned ? tone.warn : tone.accent,
                        borderRadius: 3,
                        opacity: 0.8,
                      }}
                    />
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
