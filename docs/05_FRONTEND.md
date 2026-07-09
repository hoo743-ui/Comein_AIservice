# 05. Frontend

Next.js 15(App Router)·React 19·TypeScript(strict)·Tailwind 기반. 관련 결정은 [`21_ARCHITECTURE_DECISION_RECORD.md`](./21_ARCHITECTURE_DECISION_RECORD.md). 시각 규격은 [`22_DESIGN_LANGUAGE.md`](./22_DESIGN_LANGUAGE.md), 화면 여정은 [`23_USER_JOURNEY.md`](./23_USER_JOURNEY.md).

## 실행

```powershell
# Node 20+ (권장 24 LTS). frontend/.nvmrc 참고
cd frontend
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드(타입·린트 검증)
```

## 라우트 (최상위 4개 순간 + lab)

| 경로 | 화면 |
|------|------|
| `/` | **Landing** — 갤러리형 정체성(철학). 들어가기→Experience, 바로입장→Enter |
| `/experience` | **Experience** — Co·me·in 시네마틱 리빌 + 로그인(소셜/이메일) → Workspace |
| `/enter` | **Enter** — 간편 소셜 로그인("바로 입장") → Workspace |
| `/workspace` | **Workspace** — 슬림 레일 + 단일 캔버스(6뷰: Today·Calendar·Tasks·Notes·Meetings·People), 캡처 바 |
| `/lab` | Living Intelligence 시그니처 비주얼(canvas 데모) |

> 각 페이지는 루트 레이아웃 아래에서 **자체 완결형**으로 렌더된다(중간 레이아웃·전역 사이드바 없음). 뷰 전환은 라우트 이동 없이 캔버스 크로스페이드.

## 디렉터리

```
src/
├── app/
│   ├── page.tsx               # Landing
│   ├── experience/page.tsx    # Experience(시네마틱 + 로그인)
│   ├── enter/page.tsx         # Enter(간편 로그인)
│   ├── workspace/page.tsx     # Workspace(슬림 레일 + 단일 캔버스)
│   ├── lab/page.tsx           # 시그니처 비주얼
│   ├── layout.tsx             # 루트(폰트 + ThemeProvider + Pretendard CDN)
│   └── globals.css            # 전역 토큰/베이스
├── components/
│   ├── theme-provider.tsx     # next-themes 래퍼
│   └── workspace/kakao-map.tsx  # 카카오맵(연동 — 향후 워크스페이스에 이식)
└── lib/
    ├── store.ts               # Zustand 도메인 스토어(시드·CRUD·간이 인텐트·충돌감지)
    ├── types.ts               # 도메인 타입(§7 데이터 모델)
    ├── format.ts              # 날짜/시간 포맷(ko-KR)
    ├── auth.ts                # 로그인/회원가입/소셜(데모 스텁)
    ├── use-hydrated.ts        # 마운트 훅(SSR 불일치 방지)
    ├── utils.ts               # cn()
    ├── google.ts              # 구글 캘린더/연락처 연동(향후 이식용 보존)
    └── geo.ts                 # 좌표/경로(캠퍼스 — 향후 이식용 보존)
```

> 각 화면 스타일은 **컴포넌트 로컬 `<style>` + CSS 토큰**으로 자체 완결(무거운 UI 프레임워크 비의존). 외부 UI 라이브러리(shadcn/FullCalendar/dnd-kit 등)는 사용하지 않는다 — 절제가 곧 럭셔리(`22_DESIGN_LANGUAGE.md`).

## 상태(Zustand)

- `useWorkspace((s) => …)` 로 슬라이스 선택. 액션도 동일하게 선택해서 호출.
- 엔티티: `schedules·todos·memos·meetings·conversations`, 설정 `settings`, `commandOpen`.
- 대표 액션: `sendMessage`, `addSchedule/updateSchedule/removeSchedule/confirmSchedule/conflictsFor`, `addTodo/moveTodo/…`, `addMemo/…`, `addMeeting/removeMeeting`, `togglePin`, `updateSettings`.
- 인메모리(persist 없음) — ADR-002.

## 디자인 규칙 (요약, 상세는 `22_DESIGN_LANGUAGE.md`)

- 색은 **CSS 변수 토큰**만. 대부분 모노크롬(차가운 블루-그레이) + 브랜드 퍼플 액센트 한 지점. 하드코딩 hex 최소, 라이트/다크 동등 설계.
- **카드 대신 블록** — 배경 채움·큰 그림자 없이 여백 + 1px 헤어라인으로 구획. 그림자는 접근성 포커스 링만.
- 타이포: **세리프 없음**, 그로테스크(Inter/Pretendard)의 굵기 대비로 위계. 데이터는 Mono, 숫자정렬 `tabular-nums`.
- 모션: 등장 `700–900ms` + `cubic-bezier(0.22,1,0.36,1)`, `prefers-reduced-motion` 존중.

## 다국어(ko/en)

전역 i18n 사전 대신, 워크스페이스는 **화면 로컬 언어 맵**(`L(lang)`)으로 ko/en을 처리한다. 언어는 설정(`settings.language`)에서 전환.

## 빌드 주의

- 개발 서버(`next dev`)와 `next build`를 **동시에** 돌리면 `.next` 충돌로 `PageNotFoundError`가 날 수 있음 → 빌드 전 dev 종료. 라우트 삭제·이동 후 스테일 타입 오류가 나면 `.next` 삭제 후 재빌드.
