import { useState } from "react";
import * as React from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { Btn } from "../components/Btn";
import { tone } from "../theme/tokens";

export function AuthScreen({
  onLogin,
  onSignup,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setName("");
    setError(null);
  };

  const switchMode = (m: "LOGIN" | "SIGNUP") => {
    reset();
    setMode(m);
  };

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async () => {
    setError(null);
    if (mode === "SIGNUP") {
      if (!name.trim()) return setError("이름을 입력해주세요.");
      if (!validEmail(email)) return setError("올바른 이메일 형식이 아닙니다.");
      if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
      if (password !== passwordConfirm) return setError("비밀번호가 일치하지 않습니다.");
      try {
        setSubmitting(true);
        await onSignup(name.trim(), email.trim(), password);
      } catch (e: any) {
        setError(e?.message ?? "회원가입에 실패했습니다.");
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!validEmail(email)) return setError("올바른 이메일 형식이 아닙니다.");
      if (password.length === 0) return setError("비밀번호를 입력해주세요.");
      try {
        setSubmitting(true);
        await onLogin(email.trim(), password);
      } catch (e: any) {
        setError(e?.message ?? "로그인에 실패했습니다.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontSize: 13,
    background: tone.surface,
    border: `1px solid ${tone.border}`,
    borderRadius: 10,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: tone.inkMuted,
    marginBottom: 5,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
      }}
    >
      {/* Brand */}
      <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: tone.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Sparkles size={28} color={tone.surface} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>RealPlan</div>
        <div style={{ fontSize: 12, color: tone.inkMuted, marginTop: 6, lineHeight: 1.5 }}>
          계획 오류를 데이터로 보정하는<br />현실적인 스터디 플래너
        </div>
      </div>

      {/* Tab switch */}
      <div
        style={{
          display: "flex",
          background: tone.surfaceMuted,
          border: `1px solid ${tone.border}`,
          borderRadius: 12,
          padding: 4,
          marginBottom: 20,
        }}
      >
        {(["LOGIN", "SIGNUP"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                background: active ? tone.surface : "transparent",
                color: active ? tone.ink : tone.inkMuted,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              {m === "LOGIN" ? "로그인" : "회원가입"}
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mode === "SIGNUP" && (
          <div>
            <div style={labelStyle}>이름</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              style={inputStyle}
            />
          </div>
        )}
        <div>
          <div style={labelStyle}>이메일</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@domain.com"
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>비밀번호</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "SIGNUP" ? "8자 이상" : "비밀번호"}
            style={inputStyle}
          />
        </div>
        {mode === "SIGNUP" && (
          <div>
            <div style={labelStyle}>비밀번호 확인</div>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              style={inputStyle}
            />
          </div>
        )}

        {error && (
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
            {error}
          </div>
        )}

        <Btn variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={submitting}>
          {submitting ? "처리 중..." : mode === "LOGIN" ? "로그인" : "회원가입"}
        </Btn>
      </div>

      <div style={{ flex: 1 }} />
      {mode === "SIGNUP" && (
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: tone.inkSubtle,
            padding: "20px 0",
            lineHeight: 1.6,
          }}
        >
          가입 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
        </div>
      )}
    </div>
  );
}
