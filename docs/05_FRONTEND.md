# 05. Frontend

Next.js 15(App Router)·React 19·TypeScript(strict)·Tailwind v3 기반. 관련 결정은 [`21_ARCHITECTURE_DECISION_RECORD.md`](./21_ARCHITECTURE_DECISION_RECORD.md).

## 실행

```powershell
# Node 20+ (권장 24 LTS). frontend/.nvmrc 참고
cd frontend
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드(타입·린트 검증)
```

## 라우트

| 경로 | 화면 |
|------|------|
| `/` | 랜딩 — 히어로 + 입장하기(크로스 디졸브 진입) |
| `/login`, `/signup` | 인증(데모: 실제 인증 없이 진입 연출 후 워크스페이스) |
| `/workspace` | 채팅 홈(3분할 셸) |
| `/workspace/calendar` | 월간 캘린더 + 일정 CRUD + 충돌 감지 |
| `/workspace/todo` | 칸반(할 일·진행·완료) |
| `/workspace/memo` | 메모 그리드(태그·검색) |
| `/workspace/meeting` | 회의 마스터-디테일(요약·액션→할 일) |
| `/workspace/settings` | 설정(이름·언어·테마·주 시작·알림·AI) |

## 디렉터리

```
src/
├── app/
│   ├── page.tsx               # 랜딩
│   ├── layout.tsx             # 루트(폰트 + ThemeProvider + Pretendard CDN)
│   ├── globals.css            # 토큰 + 유틸(.elevated/.orb-3d/bg-app/glass/그레인/바람)
│   ├── (auth)/                # 로그인·회원가입(전용 레이아웃)
│   └── workspace/             # 워크스페이스 셸 + 기능 페이지
├── components/
│   ├── ui/                    # button, badge, modal(+Field/inputClass)
│   ├── layout/                # sidebar, context-panel
│   ├── workspace/             # page-shell, settings 관련
│   └── brand/                 # logo(도어 마크), mark-splash
├── config/nav.ts              # 사이드바 네비 정의
└── lib/
    ├── store.ts               # Zustand 도메인 스토어(시드·CRUD·간이 인텐트·충돌감지)
    ├── types.ts               # 도메인 타입(§7 데이터 모델)
    ├── i18n.ts                # useT + ko/en 사전
    ├── format.ts              # 날짜/시간 포맷(ko-KR)
    ├── use-hydrated.ts        # 마운트 훅(SSR 불일치 방지)
    └── utils.ts               # cn()
```

## 상태(Zustand)

- `useWorkspace((s) => …)` 로 슬라이스 선택. 액션도 동일하게 선택해서 호출.
- 엔티티: `schedules·todos·memos·meetings·conversations`, 설정 `settings`, `commandOpen`.
- 대표 액션: `sendMessage`, `addSchedule/updateSchedule/removeSchedule/confirmSchedule/conflictsFor`, `addTodo/moveTodo/…`, `addMemo/…`, `addMeeting/removeMeeting`, `togglePin`, `updateSettings`.
- 인메모리(persist 없음) — ADR-002.

## 디자인 규칙(요약, 상세는 04_GUI_UX)

- 색은 **CSS 변수 토큰**만 사용(`bg-card/border-border/text-foreground/bg-primary…`). 하드코딩 hex 금지 → 다크모드 자동.
- 카드 = `.elevated` + `border border-border`(입체). 트레이/컬럼은 `bg-muted/40`로 recessed.
- 타이포: 헤드라인 `font-display`(Fraunces), 본문 Pretendard, 숫자정렬 `tabular-nums`.
- 기능 페이지는 `PageShell`(세리프 타이틀 + 액션)로 통일.

## i18n

`const t = useT();` → `t("키")`. 사전은 `lib/i18n.ts`. 언어는 설정에서 전환(`settings.language`).

## 빌드 주의

- 개발 서버(`next dev`)와 `next build`를 **동시에** 돌리면 `.next` 충돌로 `PageNotFoundError`가 날 수 있음 → 빌드 전 dev 종료.
