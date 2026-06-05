# RealPlan Frontend

학생·수험생을 위한 현실적인 스터디 플래너 — 프론트엔드 (React + TypeScript + Vite)

## 실행 방법

```bash
npm install        # 최초 1회 (의존성 설치)
npm run dev        # 개발 서버 실행 → http://localhost:5173
npm run build      # 프로덕션 빌드 (dist/ 생성)
npm run preview    # 빌드 결과 미리보기
```

> Node.js LTS(18+ 권장) 설치 필요. 백엔드(Spring)와 무관하게 프론트 도구용으로만 쓰임.

## 폴더 구조

```
src/
├── main.tsx              앱 진입점
├── App.tsx               루트 컴포넌트 (상태 + 화면 라우팅)
├── types/index.ts        도메인 타입 & 라벨 상수 (Task, Folder, …)
├── theme/tokens.ts       색상·폰트 토큰
├── lib/                  순수 유틸 함수
│   ├── time.ts           날짜/시간 헬퍼
│   ├── format.ts         표시용 포맷 (분→"1시간 30분" 등)
│   ├── tasks.ts          Task 정렬/필터/리마인더/색상
│   └── schedule.ts       시간표 슬롯 계산 (06:00~27:00, 30분 단위)
├── api/                  ★ 백엔드 연동 계층
│   ├── index.ts          mock ↔ real 전환 스위치
│   ├── client.ts         HTTP 공통 래퍼 (JWT, 공통 응답 구조)
│   ├── types.ts          API 인터페이스 (화면은 이것만 의존)
│   ├── dto.ts            서버 DTO 타입 (통합 설계서 기준)
│   ├── mappers.ts        DTO ↔ 프론트 타입 변환 (enum 대/소문자 등)
│   ├── mockApi.ts        가짜 구현 (백엔드 없이 동작)
│   ├── realApi.ts        실제 백엔드 구현 (통합 설계서 §4 엔드포인트)
│   └── mockData.ts       초기 mock 데이터
├── components/           재사용 UI (Btn, Card, Modal, 시간표 등)
└── screens/              화면 (Home, Tasks, TaskDetail, StudySession,
                          Analytics, Settings, Auth)
```

## 백엔드 연동 방법 (합치는 날)

지금은 **mock 모드**로 동작합니다 (백엔드 없이 실행 가능).
실제 백엔드에 연결하려면:

1. 프로젝트 루트에 `.env` 파일 생성 (`.env.example` 복사):
   ```
   VITE_API_BASE_URL=http://localhost:8080/api
   VITE_USE_REAL_API=true
   ```
2. `npm run dev` 재시작.

`VITE_USE_REAL_API=true` 면 `src/api/realApi.ts`(실제 서버 호출)가,
아니면 `src/api/mockApi.ts`(가짜)가 사용됩니다.
전환 지점은 `src/api/index.ts` 한 곳입니다.

## 백엔드 팀과 맞춰야 할 것

`src/api/dto.ts` 와 `src/api/realApi.ts` 는 통합 설계서를 기준으로 작성했지만,
실제 응답 JSON 키 표기(camelCase vs snake_case)와 엔드포인트 세부는 합치는 날 확인 필요:

- 응답 JSON 키: 현재 **camelCase 가정** (Spring 기본 Jackson). 다르면 `dto.ts` 키 수정.
- enum 표기: 설계서 기준 **소문자**(low/medium/high 등) 가정. 변환은 `mappers.ts`.
- 학습 기록 저장 후 갱신된 Task 반환을 가정 (`addRecord`). 백엔드 응답 형태에 맞게 조정.
