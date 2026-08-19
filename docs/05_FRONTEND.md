# 05. Frontend

Next.js 15(App Router)·React 19·TypeScript(strict)·Tailwind 기반. 관련 결정은 [`21_ARCHITECTURE_DECISION_RECORD.md`](./21_ARCHITECTURE_DECISION_RECORD.md). 시각 규격은 [`22_DESIGN_LANGUAGE.md`](./22_DESIGN_LANGUAGE.md), 화면 여정은 [`23_USER_JOURNEY.md`](./23_USER_JOURNEY.md).

## 실행

```powershell
cd frontend
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드(타입·린트 검증)
npm test        # 순수 로직 시험 78개 — 러너를 따로 깔지 않는다(node --test)
```

`.env.local` 이 없으면 앱은 **로컬 전용으로 조용히 돈다** — 저장도 로그인도 없이 화면만 멀쩡하다.
그래서 원인을 찾기 어렵다. 필요한 값은 [`frontend/.env.example`](../frontend/.env.example) 에 적혀 있다.

## 라우트 (세 개의 순간)

| 경로 | 화면 |
|------|------|
| `/` | **Landing** — 갤러리형 정체성(철학). 기능 설명 없음 |
| `/experience` | **Experience** — Co·me·in 시네마틱 리빌 + 로그인 → Workspace. 세션이 이미 있으면 인트로를 건너뛰고 바로 들여보낸다. `?auth=1` 은 인트로를 생략하고 로그인 칸부터(계정을 바꾸러 온 사람의 길) |
| `/workspace` | **Workspace** — 슬림 레일 + 단일 캔버스(Today·Calendar·People), 캡처 바 |

> 각 페이지는 루트 레이아웃 아래에서 **자체 완결형**으로 렌더된다(중간 레이아웃·전역 사이드바 없음).
> 뷰 전환은 라우트 이동 없이 캔버스 크로스페이드 — "페이지 이동" 이 아니라 "한 공간의 재구성".
>
> 예전 이 표에 있던 `/enter` · `/lab` 은 없다. 걷혔거나 만든 적이 없다.

## 디렉터리

```
src/
├── app/
│   ├── page.tsx                  # Landing
│   ├── experience/page.tsx       # Experience(시네마틱 + 로그인)
│   ├── layout.tsx                # 루트(폰트 + ThemeProvider)
│   ├── template.tsx              # 라우트 전환 전역 페이드
│   ├── globals.css               # 전역 토큰/베이스
│   └── workspace/
│       ├── page.tsx              # 조립 — 레일·캔버스·패널 배치와 상태 (1,900줄)
│       ├── styles.ts             # 시각 언어 한 덩어리 (1,880줄)
│       ├── nav.ts                # 뷰 셋(Today·Calendar·People) · 갈래 둘 · 영수증 타입
│       ├── i18n.ts               # ko/en 문안 — L(lang)
│       ├── weather.ts            # 인사말의 재료(하루의 어디쯤 · 밖이 어떤지)
│       ├── capture.ts            # AI 가 읽어 온 것을 화면이 쓸 수 있게 다듬는다
│       ├── chatTime.ts           # 대화의 시간을 사람의 말로(뭉치·날짜 구분)
│       ├── calendarDate.ts       # "다음 학기" 를 하루로 옮긴다
│       ├── spans.ts              # 하루 위의 구간 — 원과 시간표가 함께 쓴다
│       ├── datetime.ts           # dayKey·hhmm·pad
│       ├── hooks.ts              # useKeyHint · useCoarsePointer · useStickToBottom
│       └── parts/
│           ├── Environment.tsx   # 문(AiDoor) · 입자 — 화면의 재질
│           ├── CaptureBar.tsx    # 모든 기능의 입구
│           ├── MonthCalendar.tsx # 달 하나 + 날짜를 말로 찾기
│           ├── DayViews.tsx      # 24시간 지도(모양) · 세로 시간표(순서)
│           ├── Chat.tsx          # 말풍선 없는 대화 · 요약 블록
│           ├── EventPanel.tsx    # 일정 하나 = 하나의 맥락 + 제안/동의
│           ├── People.tsx        # 사람 목록 · 사람 패널 · 새 자리
│           ├── Guide.tsx         # 진짜 화면을 짚는 사용 가이드
│           └── Settings.tsx      # 설정 · 계정 · 핸들
├── components/
│   └── theme-provider.tsx        # next-themes 래퍼
└── lib/
    ├── store.ts                  # Zustand 도메인 스토어
    ├── remote.ts                 # Supabase 접근 — 인증·일정·참여자·대화·연결·제안
    ├── sync.ts                   # 서버와 화면을 맞춰 두는 순서(engine)
    ├── useRemoteSync.ts          # 그 engine 을 화면 수명에 매다는 얇은 훅
    ├── supabase.ts               # 클라이언트. 키가 없으면 null
    ├── entry.ts                  # 문턱 판정 — 들어온 사람과 처음 온 사람을 가른다
    ├── awaiting.ts               # 답을 기다리는 것(초대·제안)
    ├── roomName.ts               # 자리의 첫 이름 — 겹치지 않게
    ├── mode.ts                   # 사용자 모드(student·professional·personal)와 일정 분류
    ├── api.ts · format.ts · types.ts
    ├── fakeSupabase.ts           # 시험용 가짜 서버(realtime-js 동작을 옮겨 놓았다)
    └── conversation/             # 대화 해석 — intent·temporal·availability·state·summary
```

### 왜 이렇게 갈랐나

`workspace/page.tsx` 는 한때 **7,202줄**이었다. 컴포넌트 서른 개와 CSS 1,861줄과 루트 컴포넌트가
한 파일에 있었고, 무엇을 고치려 해도 관계없는 것들을 먼저 지나가야 했다.

경계는 **'무엇을 하는가'** 로 그었다 — 파일 크기로 자르면 다음에 또 아무 데나 붙는다.

- `parts/` = 화면의 **조각**. 자기 자리에서 자기 일만 한다.
- 그 옆의 `.ts` = 조각들이 **함께 쓰는 계산**. JSX 가 없다.
- `page.tsx` = **조립**. 무엇을 어디에 놓을지, 상태를 누가 쥘지만 정한다.

그래서 `Feature`(뷰 분기)는 `parts/` 로 꺼냈다가 되돌렸다. 그건 조각이 아니라 조립이다.

**스타일은 여전히 한 덩어리다**(`styles.ts`). 컴포넌트마다 스타일을 들고 다니지 않는다 —
토큰과 규격이 한자리에 있어야 "이 여백이 왜 16인가" 를 옆줄에서 답할 수 있다.
화면은 그것을 뿌리에서 한 번만 심는다: `<style>{CSS}</style>`

**순수 로직은 `lib/` 로 나가고 시험이 붙는다.** 이펙트 안에 있는 판단은 아무도 시험할 수 없다 —
실제로 실시간이 조용히 죽는 버그가 거기 있었고, 꺼내고 나서야 재현할 수 있었다
(`24_AI_PIPELINE_STATUS.md` §22).

## 상태 (Zustand · `lib/store.ts`)

`useWorkspace((s) => …)` 로 슬라이스를 고른다. 액션도 같은 방식으로 골라서 부른다.

| 엔티티 | 내용 |
|---|---|
| `schedules` · `eventParticipants` | 공유 일정과 그 사람들. **일정을 복제하지 않는다** — 하나의 event 를 여럿이 같은 id 로 본다 |
| `chatRooms` · `chatMessages` · `unread` | 일정 방(1:1 방 포함)과 그 안의 말, 방마다 읽지 않은 수 |
| `contacts` · `connectionRequests` · `outgoingRequests` · `myHandle` | 사람과 연결 |
| `proposals` · `justConfirmed` · `proposalConflict` · `proposalError` · `dayAvail` | 시간이 정해지는 길 |
| `settings` | 이름 · 언어 · 모드 · 주 시작 · 알림 · **자동 확정(기본 꺼짐)** · 글자 크기 |
| `remoteLive` · `seedsRebased` · `idAlias` | 서버에 붙었는가 · 시드를 옮겼는가 · 임시 id ↔ 진짜 id |

- **인메모리**(persist 없음) — ADR-002. 로그인하면 서버가 진실이 되고 시드는 물러난다.
- 화면이 먼저 바뀌고 서버가 뒤따른다(낙관적 반영). 서버가 거절하면 **되돌리고 이유를 말한다** —
  조용한 실패는 사용자에게 "내가 잘못 눌렀나" 로만 남는다.
- 임시 id 로 만든 일정이 서버 id 를 받으면 그것에 매달린 것들(참여자·방·말)도 함께 옮긴다(`idAlias`).

## 서버와 맞추기 (`lib/sync.ts`)

```
refreshSession() → fetchSnapshot() → hydrateRemote() → subscribeRemote()
                                                        ├ chat_messages        (낱개로 반영)
                                                        ├ events · participants(스냅샷 재요청)
                                                        ├ chat_rooms · members (모르는 방을 알게)
                                                        └ schedule_proposals   (별도 채널)
```

- **한 번에 하나만.** supabase-js 는 auth 구독을 거는 순간 `INITIAL_SESSION` 으로 반드시 한 번 운다.
  겹쳐 든 준비는 세대 번호로 버리고, 같은 신원이면 소켓을 다시 열지 않는다.
- **채널 이름을 매번 다르게 짓는다.** 같은 이름이면 realtime-js 가 있던 인스턴스를 그대로 돌려주고,
  이미 join 된 채널의 `subscribe()` 는 조용한 no-op 이다 — 그래서 실시간만 죽는다.
- **끊기면 스스로 다시 붙는다**(1s→2s→4s… 최대 30s). 붙는 순간 놓친 것을 한 번 맞춘다.
- 제안 구독을 **별도 채널**로 가른 이유: 0003 을 안 올린 프로젝트에서 한 채널에 묶으면
  그 채널이 통째로 오류가 되어 대화까지 같이 죽는다.

## 스타일 규칙 (요약, 상세는 `22_DESIGN_LANGUAGE.md`)

- 색은 **CSS 변수 토큰**만. 대부분 모노크롬 + 액센트 한 지점. 라이트/다크 동등 설계.
- **카드 대신 블록** — 배경 채움·큰 그림자 없이 여백 + 1px 헤어라인으로 구획.
- 타이포: 세리프 없음. 숫자는 `tabular-nums`.
- 모션: `cubic-bezier(0.22,1,0.36,1)`, transform/opacity 중심, `prefers-reduced-motion` 존중.
- 손이 닿는 것들의 공통 규격은 `styles.ts` 의 한 블록이 맡는다 — 초점 표시 · 누름 `scale(0.97)` ·
  잠긴 얼굴. **클래스마다 서른여섯 번 적지 않는다.**
  단, 거기에 `transition` 을 걸지 않는다: `.rmg button`(0,1,1)이 클래스 규칙(0,1,0)을 이겨서
  자기 transition 을 가진 버튼 46개의 색 전환이 전부 죽는다.
- 터치 과녁은 **보이는 크기를 건드리지 않고 `::after` 로만** 넓힌다. 실제로 키우면 그 줄의 높이가
  함께 자라 화면이 어그러진다.

## 다국어 (ko/en)

전역 i18n 사전 대신 **화면 로컬 언어 맵**(`i18n.ts` 의 `L(lang)`)으로 처리한다.
언어는 설정(`settings.language`)에서 전환하고, 컴포넌트는 `en = lang === "en"` 한 줄로 갈린다.

## 빌드 주의

- `next dev` 와 `next build` 를 **동시에** 돌리면 `.next` 충돌로 `PageNotFoundError` 가 날 수 있다 → 빌드 전 dev 종료.
- **OneDrive 아래에서는** `.next` 를 재사용할 때 `readlink EINVAL` 이 난다. `rm -rf .next` 후 빌드.
- 라우트를 지우거나 옮긴 뒤 스테일 타입 오류가 나면 역시 `.next` 삭제.
