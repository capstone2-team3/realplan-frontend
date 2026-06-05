import * as React from "react";
import { fontStack, tone } from "../theme/tokens";

// 실제 앱처럼 화면(viewport) 전체를 채우는 컨테이너.
// 데스크톱 브라우저에서 너무 넓어지지 않도록 최대 폭만 제한한다.
// 상단에는 폰 상태바/노치를 고려한 안전 여백을 둔다.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 390,
        height: "100dvh",
        margin: "0 auto",
        background: tone.bg,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: fontStack,
        color: tone.ink,
        // 상단 여백: 노치 있는 기기는 safe-area, 그 외에도 최소 28px 확보
        paddingTop: "max(28px, env(safe-area-inset-top))",
      }}
    >
      {children}
    </div>
  );
}
