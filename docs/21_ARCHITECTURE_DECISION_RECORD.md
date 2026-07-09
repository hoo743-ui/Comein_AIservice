# 21. Architecture Decision Record (ADR)

> 프론트엔드 진행 중 내린 주요 결정을 기록한다. 이 문서가 기준(source of truth)이며, CLAUDE.md와 상충하면 여기 기록된 최신 결정을 따른다.
>
> ⚠️ **ADR-010(디자인 랭귀지 전환 · 슬림 레일 채택)이 다음을 대체한다:** ADR-001(shadcn/ui 스타일)·ADR-003(연보라 액센트 톤)·ADR-004(입체 `.elevated` 시스템)·ADR-005(마크 스플래시/EnterReveal 진입 연출)·ADR-007(Fraunces 세리프)·ADR-009(전역 i18n `useT`). 아래 옛 항목은 **이력 보존용**이며, 현재 기준은 `22_DESIGN_LANGUAGE.md`와 ADR-010이다.

---

## ADR-001 · 스택 채택 및 일부 대체

- **결정**: Next.js 15(App Router)·React 19·TypeScript(strict)·Tailwind v3·shadcn/ui 스타일·Framer Motion·**Zustand**.
- **CLAUDE.md와 차이**:
  - 캘린더를 **FullCalendar 대신 자체 월간 그리드**로 구현.
  - Todo 보드를 **dnd-kit 대신 버튼 기반 상태 이동**으로 구현.
  - Recharts·React Query는 아직 미도입(필요 시점에 추가).
- **이유**: 백엔드 연동 전 단계에서 의존성·번들 최소화, 디자인 토큰/입체 시스템과 완전히 일치하는 UI 확보. 드래그·차트는 실데이터 연동 시 재검토.
- **결과**: 번들 경량, 톤 일관. 추후 dnd-kit/FullCalendar 전환 가능(컴포넌트 경계 유지).

## ADR-002 · 상태관리: 세션 인메모리 Zustand

- **결정**: `src/lib/store.ts` Zustand 스토어 하나로 도메인(Conversation/Message·Schedule·Todo·Memo·Meeting·Settings) 관리. **persist 없이 세션 인메모리**.
- **이유**: 백엔드/DB 연동 전 데모. 새로고침 시 초기화되나 클라이언트 내비게이션 간 상태 유지. 시드는 고정 ISO로 SSR 하이드레이션 이슈 회피.
- **결과**: 버튼·CRUD 실제 동작. 추후 persist 또는 API 연동으로 교체.

## ADR-003 · 브랜드 톤: 뉴트럴 표면 + 연보라 액센트 (탈-AI)

- **문제**: 초기 "연보라·화이트"(CLAUDE.md §6)를 그대로 구현하니 *연보라 그라디언트 + 글래스 + 과한 라운드*라는 전형적 **AI-생성 클리셰**로 보였다.
- **결정**: 표면은 **차분한 뉴트럴**로 탈-채도, 액센트는 **연보라/페리윙클(딥 인디고 계열) 절제 사용**. 그림자는 보라 틴트 → **뉴트럴 잉크**. radius 축소, 보더 크리스프.
- **CLAUDE.md와 차이**: §6 "연보라·화이트 그대로" → **"뉴트럴 + 연보라 액센트"**(중간길). 브랜드 정체성(연보라)은 액센트로 존중.
- **결과**: "회사원·비서(assistant)" 무드의 정제된 프리미엄. 토큰은 `globals.css` `:root`/`.dark`.

## ADR-004 · 입체(depth) 디자인 시스템

- **결정**: `globals.css`에 `.elevated`(상단 inset 하이라이트 + 레이어드 섀도우 + 카드색 그라디언트), `.orb-3d`(광택 구체), `bg-app`(중앙 글로우+비네트) 유틸 도입. 카드는 `.elevated`로 "떠 있는" 느낌.
- **이유**: 플랫한 워크스페이스가 단조롭다는 피드백 → 프리미엄·입체감.
- **결과**: 전 페이지 일관된 깊이감. 색은 전부 토큰 기반이라 다크모드 자동.

## ADR-005 · 진입 연출: 크로스 디졸브 + 마크 스플래시

- **결정**: 입장하기/로그인/회원가입 → `sessionStorage("comein:entering")` 플래그 → 워크스페이스 `EnterReveal`이 **마크 스플래시가 투명해지며** 드러남. 랜딩은 동시에 페이드아웃(크로스 디졸브).
- **세부**: 로고 자산(`brand-splash.webp`)이 다크 배경 baked → 배경을 **딥 인디고 라디얼**로 깔아 이음새 제거. `prefers-reduced-motion`에 게이팅하지 않고 항상 재생(브랜드 모먼트).
- **결과**: 브랜드 리추얼("문을 열고 들어오는") 구현. `MarkSplash`/`EnterReveal`.

## ADR-006 · AI ↔ 프론트 경계 (역할 분리)

- **맥락**: AI 에이전트 로직은 AI 엔지니어 파트. 프론트는 **결과(JSON) 렌더·조작**만.
- **현재**: 채팅 인텐트가 `store.ts`의 `interpret()` **목업**(임시). 실제 LLM 없이 데모 동작.
- **결정(예정)**: `lib/ai-client.ts` 단일 seam(`parseMessage(text): Promise<AiResult>`)으로 분리, `AiResult` 계약 타입 정의(→ `docs/10_API.md`). 실제 API가 나오면 seam 내부 `fetch` 한 줄만 교체.
- **상태**: seam 리팩터 보류(요청 순서상). 목업임을 코드 주석에 명시.

## ADR-007 · 폰트

- **결정**: 디스플레이=**Fraunces**(세리프, next/font), 한글/본문=**Pretendard**(CDN), 라틴 본문=Inter. 숫자+한글 혼합 라벨엔 세리프 금지(폴백 불일치) → 본문 폰트 + `tabular-nums`.
- **결과**: 에디토리얼 프리미엄. `tailwind.config` `fontFamily.display/sans`.

## ADR-008 · .gitignore 예외 (버그 수정)

- **문제**: 파이썬 패키징용 `lib/` 규칙이 `frontend/src/lib/` 전체를 무시 → utils(cn) 등 미커밋.
- **결정**: `.gitignore`에 `!frontend/src/lib/` 예외 추가.

## ADR-009 · 국제화(i18n) — *(ADR-010에서 대체)*

- **결정**: 경량 사전 방식(`src/lib/i18n.ts` `useT`) + `settings.language`(ko/en). 무거운 라이브러리 미도입.
- **범위**: 현재 사이드바·랜딩·채팅·설정 등 크롬 위주. 기능 페이지 본문은 점진 확장.
- **대체**: 3분할 셸 폐기와 함께 전역 `useT`/`i18n.ts` 제거. 워크스페이스는 **화면 로컬 언어 맵**(`L(lang)`)으로 ko/en 처리.

## ADR-010 · reimagine 정식 채택 — 슬림 레일 + 단일 캔버스, 디자인 랭귀지 전환

- **결정**: 프로토타입 `reimagine`을 **정식 틀로 채택**하고 최상위 라우트로 승격. 구 3분할 셸(사이드바·컨텍스트 패널·Chat 홈)과 그 크롬(shadcn 스타일 `ui/*`·`config/nav`·`layout/*`·`enter-transition`·`feature-mindmap`·`brand/*`·`theme-toggle`·전역 `i18n`)을 **삭제**.
- **라우트**: `/`(Landing) · `/experience`(시네마틱 리빌 + 로그인) · `/enter`(간편 소셜 로그인) · `/workspace`(슬림 레일 + 단일 캔버스, 6뷰) · `/lab`(시그니처 비주얼).
- **디자인 랭귀지**: 카드/글래스/입체 그림자/세리프를 버리고 **모노크롬 + 브랜드 퍼플 액센트 한 지점 · 블록 + 1px 헤어라인 · 세리프 없는 그로테스크**로 전환. 규격은 `22_DESIGN_LANGUAGE.md`, 여정은 `23_USER_JOURNEY.md`.
- **UI 프레임워크**: shadcn/FullCalendar/dnd-kit/Recharts/Framer Motion/React Query **미사용**. 각 화면은 컴포넌트 로컬 `<style>` + CSS 토큰으로 자체 완결(lucide·next-themes·zustand만).
- **연동 보존**: 구글 캘린더/연락처(`lib/google.ts`)·좌표/경로(`lib/geo.ts`)·카카오맵(`components/workspace/kakao-map.tsx`)은 **삭제하지 않고 보존** — 향후 워크스페이스에 이식.
- **대체 대상**: ADR-001·003·004·005·007·009.
- **이유**: 제품 북극성(§0)에 코드를 수렴. "일이 스스로 정리되게" — 대화가 아니라 워크플로우 중심.
