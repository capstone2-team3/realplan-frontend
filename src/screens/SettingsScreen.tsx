import { useState, useEffect } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Edit2, Info, Trash2 } from "lucide-react";
import type { Task, User } from "../types";
import { api } from "../api";
import type { WeeklyStats, DailyStudyTime } from "../api/types";
import { Btn } from "../components/Btn";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { SectionLabel } from "../components/SectionLabel";
import { today } from "../lib/time";
import { monoStack, tone } from "../theme/tokens";

export function SettingsScreen({
  initialName,
  initialEmail,
  onLogout,
  onUpdateProfile,
  onResetData,
  onWithdraw,
}: {
  initialName: string;
  initialEmail: string;
  onLogout: () => void;
  onUpdateProfile: (nickname: string, password?: string) => Promise<void>;
  onResetData: () => Promise<void>;
  onWithdraw: () => Promise<void>;
}) {
  // 사용자 정보 (편집 가능)
  const [name, setName] = useState(initialName);
  const [email] = useState(initialEmail); // 이메일은 수정 불가
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftPassword, setDraftPassword] = useState("");
  const [draftPasswordConfirm, setDraftPasswordConfirm] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 주간 통계 + 일별 학습시간 (서버/mock 에서 로드)
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [daily, setDaily] = useState<DailyStudyTime | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.fetchWeeklyStats(), api.fetchDailyStudyTime(1)])
      .then(([wk, dl]) => {
        if (!alive) return;
        setWeekly(wk);
        setDaily(dl);
      })
      .catch((e) => console.error("주간 통계 로드 실패:", e));
    return () => {
      alive = false;
    };
  }, []);

  // 주간 지표 (avgFocus 는 1~4 스케일, 데이터 없으면 0)
  const thisWeek = {
    studyMin: weekly?.totalMinutes.current ?? 0,
    avgFocus: weekly?.averageFocus.current ?? 0,
    completedTasks: weekly?.completedTasks.current ?? 0,
  };
  const lastWeek = {
    studyMin: weekly?.totalMinutes.previous ?? 0,
    avgFocus: weekly?.averageFocus.previous ?? 0,
    completedTasks: weekly?.completedTasks.previous ?? 0,
  };

  const fmtHM = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  };

  const renderDelta = (cur: number, prev: number, unit: string = "", isPercent = false) => {
    const delta = cur - prev;
    if (delta === 0) {
      return (
        <span style={{ fontSize: 11, color: tone.inkSubtle }}>지난 주와 동일</span>
      );
    }
    const up = delta > 0;
    return (
      <span
        style={{
          fontSize: 11,
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          color: up ? tone.accent : tone.danger,
          fontWeight: 600,
        }}
      >
        {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {isPercent ? `${Math.abs(delta).toFixed(1)}` : Math.abs(delta).toString()}
        {unit}
      </span>
    );
  };

  // 주간 일별 학습시간 (최근 7일). 날짜에서 요일 라벨을 계산한다.
  const recentDays = (daily?.days ?? []).slice(-7);
  const dailyMinutes = recentDays.map((d) => d.totalMinutes);
  const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
  const dayLabels = recentDays.map((d) => {
    const [y, m, day] = d.date.split("-").map(Number);
    return WEEKDAY[new Date(y, m - 1, day).getDay()];
  });
  const maxDaily = Math.max(...dailyMinutes, 1);

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: "20px 16px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 12, color: tone.inkMuted }}>계정과 앱 환경을 관리하세요</div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* User Info */}
        <Card style={{ marginBottom: 14, padding: 16 }}>
          <SectionLabel>사용자 정보</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 4 }}>이름</div>
              <div
                style={{
                  padding: "10px 12px",
                  background: tone.surfaceMuted,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {name}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 4 }}>이메일</div>
              <div
                style={{
                  padding: "10px 12px",
                  background: tone.surfaceMuted,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: tone.inkSubtle,
                }}
              >
                {email}
              </div>
            </div>
            <Btn
              variant="outline"
              icon={<Edit2 size={13} />}
              onClick={() => {
                setDraftName(name);
                setDraftPassword("");
                setDraftPasswordConfirm("");
                setEditError(null);
                setEditOpen(true);
              }}
            >
              정보 수정
            </Btn>
          </div>
        </Card>

        {/* Weekly Statistics */}
        <Card style={{ marginBottom: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <SectionLabel>주간 학습 통계</SectionLabel>
            <div style={{ fontSize: 10, color: tone.inkSubtle, fontFamily: monoStack }}>
              {(() => {
                const monday = new Date(today);
                const day = monday.getDay() || 7;
                monday.setDate(monday.getDate() - day + 1);
                const sunday = new Date(monday);
                sunday.setDate(sunday.getDate() + 6);
                return `${monday.getMonth() + 1}/${monday.getDate()} – ${sunday.getMonth() + 1}/${sunday.getDate()}`;
              })()}
            </div>
          </div>

          {/* Daily bar chart */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80, paddingTop: 5 }}>
              {dailyMinutes.map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${(m / maxDaily) * 100}%`,
                      background: m >= 120 ? tone.accent : tone.borderStrong,
                      borderRadius: 4,
                      minHeight: 2,
                    }}
                  />
                  <div style={{ fontSize: 10, color: tone.inkMuted, fontWeight: 500 }}>
                    {dayLabels[i]}
                  </div>
                  <div style={{ fontSize: 9, color: tone.inkSubtle, fontFamily: monoStack }}>
                    {m}분
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stat rows with comparison */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                label: "총 학습 시간",
                value: fmtHM(thisWeek.studyMin),
                delta: renderDelta(
                  Math.round(thisWeek.studyMin / 60),
                  Math.round(lastWeek.studyMin / 60),
                  "h",
                ),
              },
              {
                label: "평균 집중도",
                value: `${thisWeek.avgFocus.toFixed(1)} / 4.0`,
                delta: renderDelta(thisWeek.avgFocus, lastWeek.avgFocus, "", true),
              },
              {
                label: "완료한 Task",
                value: `${thisWeek.completedTasks}개`,
                delta: renderDelta(thisWeek.completedTasks, lastWeek.completedTasks, "개"),
              },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: `1px solid ${tone.border}`,
                }}
              >
                <div style={{ fontSize: 12, color: tone.inkMuted }}>{row.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: monoStack }}>{row.value}</div>
                  {row.delta}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 10,
              color: tone.inkSubtle,
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px solid ${tone.border}`,
            }}
          >
            지난 주 동기간 대비 증감
          </div>
        </Card>

        <Card style={{ borderColor: tone.dangerSoft, padding: 16 }}>
          <SectionLabel>데이터 관리</SectionLabel>
          <div style={{ fontSize: 12, color: tone.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
            모든 Task, 폴더, 학습 기록, 분석 데이터가 영구 삭제됩니다.
          </div>
          <Btn variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => setResetOpen(true)}>
            모든 데이터 초기화
          </Btn>
          <div style={{ fontSize: 12, color: tone.inkMuted, margin: "14px 0 12px", lineHeight: 1.5 }}>
            회원탈퇴 시 데이터와 계정이 모두 삭제됩니다.
          </div>
          <Btn variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => setWithdrawOpen(true)}>
            회원탈퇴
          </Btn>
        </Card>

        <button
          onClick={() => setLogoutOpen(true)}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px 0",
            background: "transparent",
            border: `1px solid ${tone.border}`,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            color: tone.inkMuted,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </div>

      {/* Edit profile modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="사용자 정보 수정"
        footer={
          <>
            <Btn variant="outline" fullWidth onClick={() => setEditOpen(false)}>취소</Btn>
            <Btn
              fullWidth
              disabled={!draftName.trim() || saving}
              onClick={async () => {
                setEditError(null);
                // 비밀번호는 입력했을 때만 변경 (둘 다 비어있으면 비밀번호 변경 안 함)
                if (draftPassword || draftPasswordConfirm) {
                  if (draftPassword.length < 8) {
                    setEditError("비밀번호는 8자 이상이어야 합니다.");
                    return;
                  }
                  if (draftPassword !== draftPasswordConfirm) {
                    setEditError("비밀번호가 일치하지 않습니다.");
                    return;
                  }
                }
                setSaving(true);
                try {
                  await onUpdateProfile(draftName.trim(), draftPassword || undefined);
                  setName(draftName.trim());
                  setEditOpen(false);
                } catch {
                  setEditError("프로필 저장에 실패했습니다. 다시 시도해주세요.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "저장 중…" : "저장"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>이름</div>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="이름"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
              이메일
            </div>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surfaceMuted,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                color: tone.inkSubtle,
                cursor: "not-allowed",
              }}
            />
            <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 4 }}>
              이메일은 변경할 수 없습니다
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
              새 비밀번호
            </div>
            <input
              type="password"
              value={draftPassword}
              onChange={(e) => setDraftPassword(e.target.value)}
              placeholder="변경 시에만 입력 (8자 이상)"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
              새 비밀번호 확인
            </div>
            <input
              type="password"
              value={draftPasswordConfirm}
              onChange={(e) => setDraftPasswordConfirm(e.target.value)}
              placeholder="새 비밀번호 재입력"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: tone.surface,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {editError && (
            <div
              style={{
                fontSize: 11,
                color: tone.danger,
                background: tone.dangerSoft,
                padding: "9px 12px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={12} />
              {editError}
            </div>
          )}
        </div>
      </Modal>

      {/* Reset confirm modal */}
      <ConfirmDialog
        open={resetOpen}
        title="모든 데이터 초기화"
        message="정말로 초기화하시겠습니까? 모든 Task, 폴더, 학습 기록, 분석 데이터가 영구 삭제되며 되돌릴 수 없습니다."
        confirmLabel="초기화"
        variant="danger"
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          setResetOpen(false);
          await onResetData();
        }}
      />

      {/* Withdraw confirm modal */}
      <ConfirmDialog
        open={withdrawOpen}
        title="회원탈퇴"
        message="정말로 탈퇴하시겠습니까? 모든 데이터와 계정이 영구 삭제되며 되돌릴 수 없습니다."
        confirmLabel="회원탈퇴"
        variant="danger"
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={async () => {
          setWithdrawOpen(false);
          await onWithdraw();
        }}
      />

      {/* Logout confirm modal */}
      <ConfirmDialog
        open={logoutOpen}
        title="로그아웃"
        message="로그아웃하시겠습니까?"
        confirmLabel="로그아웃"
        variant="primary"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}
