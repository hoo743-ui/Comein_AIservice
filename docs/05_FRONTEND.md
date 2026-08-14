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
| ~~`/enter`~~ | 걷어냈다(2026-08-13) — `/experience` 의 부분집합이었다. 빠른 로그인은 `/experience?auth=1` |
| `/workspace` | **Workspace** — 슬림 레일 + 단일 캔버스(Today·Calendar·People), 캡처 바 |
| ~~`/lab`~~ | 없다. 만든 적이 있었으나 걷혔다 |

> 각 페이지는 루트 레이아웃 아래에서 **자체 완결형**으로 렌더된다(중간 레이아웃·전역 사이드바 없음). 뷰 전환은 라우트 이동 없이 캔버스 크로스페이드.

## 디렉터리

```
src/
├── app/
│   ├── page.tsx               # Landing
│   ├── experience/page.tsx    # Experience(시네마틱 + 로그인)
│   ├── workspace/page.tsx     # Workspace(슬림 레일 + 단일 캔버스) — 화면 전체가 여기 있다
│   ├── layout.tsx             # 루트(폰트 + ThemeProvider)
│   ├── template.tsx           # 라우트 전환 전역 페이드
│   └── globals.css            # 전역 토큰/베이스
├── components/
│   └── theme-provider.tsx     # next-themes 래퍼
└── lib/
    ├── store.ts               # Zustand 도메인 스토어(CRUD → Supabase push)
    ├── remote.ts              # Supabase 접근 — 인증·일정·참여자·대화·연결
    ├── useRemoteSync.ts       # Realtime 구독(한 번만 건다)
    ├── supabase.ts            # 클라이언트. 키가 없으면 null → 앱은 로컬 전용으로 조용히 돈다
    ├── api.ts                 # 백엔드 베이스 URL 한 줄(API_BASE)
    ├── types.ts               # 도메인 타입
    ├── format.ts              # 날짜/시간 포맷
    ├── mode.ts                # 사람 분류표(peopleCategories)
    └── conversation/          # 대화 해석 — intent·temporal·availability·summary + 테스트
```

> **`workspace/page.tsx` 는 6700줄이 넘는다.** 화면 하나가 파일 하나인 것이 이 프로젝트의
> 선택이었고(컴포넌트 로컬 `<style>` 과 짝이 맞는다), 그 대가로 이 파일은 크다.
> 순수 로직은 `lib/conversation/` 으로 빼내 테스트가 붙어 있다.
>
> 예전 이 표에 있던 `enter/page.tsx` · `lab/page.tsx` · `components/workspace/kakao-map.tsx` ·
> `lib/{auth,use-hydrated,utils,google,geo}.ts` 는 **전부 없다.** 걷혔거나 만든 적이 없다.

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
