/**
 * Comein · 워크스페이스의 시각 언어 — 한 덩어리의 CSS.
 *
 * 왜 파일 하나에 몰아 두는가. 이 화면은 컴포넌트마다 스타일을 들고 다니지 않는다
 * (§6 — 무거운 UI 프레임워크를 쓰지 않는다). 토큰과 규격이 한자리에 있어야
 * "이 여백이 왜 16인가" 를 옆줄에서 답할 수 있다.
 *
 * 왜 page.tsx 에서 꺼냈는가. 1,861줄이었다. 컴포넌트 서른 개와 함께 한 파일에 있는 동안
 * 무엇을 고치려 해도 먼저 이걸 지나가야 했다. 붙어 있어야 할 이유가 없는 것이 붙어 있으면
 * 그게 곧 '중구난방' 이다.
 *
 * 화면은 이것을 뿌리에서 한 번만 심는다: <style>{CSS}</style>
 */

export const CSS = `
.rmg {
  --paper: #141210; --surface: #1B1813; --ink: #F2F0EC; --muted: #98938A; --faint: #5E574C; --hair: #262019; --accent: #9B8E86; --glow: rgba(155,142,134,0.16);
  --ask-surface: color-mix(in srgb, #FFFFFF 9%, var(--surface));  /* 입력창 전용 면 — 표면보다 반 톤 밝게 */
  --rail-w: 64px;  /* 레일 폭 — fixed 로 떠 있는 캡처바가 캔버스 기준으로 가운데를 잡는 데 쓴다 */

  /* ── 간격 체계 — 8px 배수 하나로 통일. 임의값을 쓰지 않는다. ── */
  --sp-1: 8px; --sp-2: 16px; --sp-3: 24px; --sp-4: 32px; --sp-5: 40px; --sp-6: 48px;
  /* 모서리도 토큰으로 — 컴포넌트마다 다른 반경을 쓰지 않는다. */
  --r-sm: 8px; --r: 12px; --r-lg: 16px;
  /* --nav-row / --nav-gap (레일 한 줄의 규격) 은 NAV_ROW·NAV_GAP 에서 주입된다.
     인디케이터 이동 거리를 같은 숫자에서 파생시키기 위해 출처를 JS 한 곳으로 모았다.
     행 높이는 기기를 탄다(손가락이면 44) — 그래서 이 값만은 CSS 가 아니라 JS 가 정한다. */
  /* 화면 가장자리 여백 — 넓어질수록 함께 자라되 88px 에서 멈춘다. */
  --gutter: clamp(32px, 4vw, 88px);
  /* ── 하나의 작업면(Workspace) ──
     세 화면이 공유하는 단 하나의 기준 폭. 화면을 따라 넓어지되 1440px 에서 멈춘다
     (그 이상은 눈이 한 줄을 따라가기 어렵다). 뷰마다 폭을 달리 두지 않는다 —
     그렇게 하면 시계·상단 문구·캡처바·배경 문양이 탭을 옮길 때마다 같이 움직인다. */
  --workspace: min(1440px, calc(100% - 2 * var(--gutter)));
  /* 캡처바·스침·되묻기가 쓰는 폭. fixed 로 떠 있는 줄이라 100% 는 화면 전체를 뜻한다 —
     --workspace 를 그대로 쓰면 레일 폭을 빼지 않아, 좁은 화면에서 줄이 오른쪽 끝에
     딱 붙고 왼쪽은 레일에 닿아 여백이 사라졌다. 레일과 좌우 여백을 먼저 떼고 남는 만큼 쓴다. */
  /* 곁말(결과·제안)의 폭. */
  --bar-w: min(520px, max(240px, calc(100% - var(--rail-w) - 2 * var(--gutter))));
  /* 입력창의 폭 — 곁말보다 한 뼘 넓다. 같은 축에 놓이되 주인공이 조금 더 자리를 차지한다.
     크기 자체가 위계다: 테두리를 굵히지 않고도 무엇이 먼저인지 눈이 안다. */
  --bar-w-lg: min(640px, max(240px, calc(100% - var(--rail-w) - 2 * var(--gutter))));
  /* 캔버스 오른쪽 끝에서 작업면 오른쪽 끝까지의 거리 — 시계·상단바가 이 선에 맞춰 선다. */
  --edge: max(var(--gutter), calc((100% - var(--workspace)) / 2));
  --ctx-w: 288px;                       /* Context Rail — Today·People 이 같은 규격으로 쓴다 */
  --reading: 640px;                     /* 글·목록이 읽히는 한 칸의 최대 폭 */
  --ring-gap: clamp(32px, 3vw, 72px);   /* 달력과 링 사이 */
  --dial-w: clamp(320px, 26vw, 460px);  /* 원의 최대 지름 — 컬럼이 넓어져도 여기서 멈추고 가운데 선다 */
  /* 위 여백 — 예전 88px 은 상단을 과하게 비웠다. 세 화면이 함께 올라오므로 기준선은 그대로. */
  --flow-top: clamp(36px, 4.5vh, 56px);
  /* 캡처바(높이 61 + bottom 32)가 콘텐츠를 가리지 않을 만큼만. 예전 160px 은 하단을 과하게 비웠다. */
  --flow-bottom: 128px;
  /* 섹션 사이 — 화면이 높아지면 조금 벌어지되 72px 에서 멈춘다(무한정 늘어나지 않게). */
  --flow-gap: clamp(48px, 5vh, 72px);
  --heart-w: clamp(112px, 12vw, 176px);

  position: relative; display: grid; grid-template-columns: 64px minmax(0, 1fr);
  height: 100vh; height: 100dvh; color: var(--ink);
  background:
    radial-gradient(120% 120% at 18% -6%, rgba(88,76,58,0.5) 0%, rgba(88,76,58,0) 52%),
    radial-gradient(100% 80% at 50% 34%, rgba(64,56,44,0.28) 0%, transparent 62%),
    linear-gradient(108deg, transparent 44%, rgba(0,0,0,0.2) 60%, transparent 76%),
    radial-gradient(120% 90% at 96% 112%, rgba(0,0,0,0.32) 0%, transparent 50%),
    radial-gradient(110% 84% at 2% 110%, rgba(0,0,0,0.18) 0%, transparent 48%),
    var(--paper);
  background-attachment: fixed;
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  /* 레일 확장은 첫 컬럼 트랙만 넓혀 콘텐츠를 함께 밀어낸다(오버레이 아님·reflow). 사이드바+콘텐츠가 하나의 모션. */
  transition: grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
/* 그리드 값은 리터럴로 둔다 — custom property 는 보간되지 않아 레일 확장 모션이 끊긴다. */
.rmg.rail-open { --rail-w: 216px; grid-template-columns: 216px minmax(0, 1fr); }
/* 좁은 화면에서는 Context Rail 이 물러나고 본문이 작업면을 다 쓴다. */
@media (max-width: 1239px) { .rmg { --ctx-w: 0px; } }
@media (prefers-reduced-motion: reduce) { .rmg { transition: none; } }
:root:not(.dark) .rmg { --ask-surface: #FFFFFF; --paper: #F7F6F3; --surface: #FCFBF9; --ink: #26221D; --muted: #6E675C; --faint: #A9A294; --hair: #E7E2D8; --accent: #8C7E6E; --glow: rgba(140,126,110,0.16); }
/* 배경 — flat white 금지. 웜 오프화이트 위에 대형 확산광 + 은은한 건축 그림자(창빛·커튼). 느끼되 알아채지 못하게.
   명도 대비 강화판: 하이라이트는 더 밝게, 코너 그림자는 한 단계 더 깊게 — 채도/색상은 유지, 중앙은 밝게 남겨 가독성 확보(돔형 입체감). */
:root:not(.dark) .rmg {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.66) 0%, transparent 26%),
    radial-gradient(125% 120% at 16% -10%, rgba(255,255,252,1) 0%, rgba(255,255,252,0) 50%),
    radial-gradient(100% 78% at 50% 36%, rgba(255,254,250,0.5) 0%, transparent 60%),
    linear-gradient(106deg, transparent 40%, rgba(58,43,28,0.092) 56%, transparent 70%),
    linear-gradient(106deg, transparent 60%, rgba(58,43,28,0.072) 72%, transparent 85%),
    radial-gradient(120% 86% at 94% 110%, rgba(52,38,23,0.17) 0%, transparent 50%),
    radial-gradient(110% 82% at 2% 110%, rgba(58,43,28,0.08) 0%, transparent 46%),
    var(--paper);
  background-attachment: fixed;
}
/* 기준 글자 — 워크스페이스에서만 한 눈금 키운다(16 → 17px).
   부제·날짜처럼 되풀이하던 줄을 걷어내면서 여백이 늘었고, 그만큼 본문이 작아 보였다.
   이 값은 rem 을 쓰는 모든 크기에 함께 걸리므로 화면 전체가 같은 비율로 커진다.
   (개인 설정 --rmg-fs 는 그 위에 곱해진다 — 두 값이 싸우지 않게 층을 나눠 둔다.) */
html { font-size: 17px; }

/* 글자 크기 설정 — 주요 텍스트 영역을 배율로 확대 (보통 · 크게 · 더 크게) */
/* 글자 크기 — zoom 은 레이아웃을 통째로 다시 재는 값이라 뻑뻑하게 툭툭 걸린다.
   대신 font-size 를 키운다. 본문이 rem/em 기반이라 같은 결과를 내면서 부드럽게 흐른다. */
.rmg-flow {
  font-size: calc(1rem * var(--rmg-fs, 1));
  transition: font-size 160ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .rmg-flow { transition: none; }
}

/* opening → 워크스페이스 도착 — opening 다크 톤에서 서서히 밝아오며 나타난다 (확 넘어가지 않게) */
.rmg-arrive { position: fixed; inset: 0; z-index: 100; pointer-events: none;
  background: radial-gradient(circle at 50% 46%, rgba(232,216,196,0.22) 0%, transparent 55%), #0E0D12;
  animation: rmg-arrive-out 1.3s cubic-bezier(0.4,0,0.2,1) both; }
@keyframes rmg-arrive-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rmg-arrive { display: none; } }
/* ══ 손이 닿는 것들의 공통 규격 ═══════════════════════════════════════
   버튼이 55가지 이름으로 흩어져 있어, 어떤 것은 키보드 초점을 말하고 어떤 것은
   말하지 않았다. 주 액션인 .rmg-ppl-act(동의·수락·참석·요청·만들기·로그인…)조차
   초점 표시가 없었다 — 마우스로만 쓸 수 있는 버튼이었던 셈이다.

   클래스마다 규칙을 서른 번 적는 대신 여기 한 번 적는다. 더 아래의 클래스 규칙이
   필요하면 덮는다(구체성이 높으므로). 규격은 CLAUDE.md §6 이 정한 그대로:
   호버는 살짝 밝아지고, 누름은 scale(0.97) 미세 반응, 초점은 액센트 1겹. */
.rmg button,
.rmg [role="button"],
.rmg [role="menuitem"],
.rmg [role="tab"] { -webkit-tap-highlight-color: transparent; }

.rmg button:focus-visible,
.rmg [role="button"]:focus-visible,
.rmg [role="menuitem"]:focus-visible,
.rmg [role="tab"]:focus-visible,
.rmg input:focus-visible,
.rmg textarea:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}
/* border-radius 를 여기서 주지 않는다 — 이 선택자(0,2,1)가 클래스 규칙(0,1,0)을 이겨서
   초점이 닿는 순간 동그란 것이 각지게 변한다(투어의 점이 그랬다).
   요즘 브라우저의 outline 은 그 요소의 border-radius 를 알아서 따라간다. */

/* 누름 — 손끝에 닿았다는 것만 말한다(리플 X).
   목록의 한 줄이나 달력 칸처럼 넓은 표면은 줄어들면 오히려 어색하므로 비켜선다. */
.rmg button:not(:disabled):active { transform: scale(0.97); }
/* 비켜서는 것들. 위 선택자가 (0,3,1) 이라 클래스 하나(0,2,0)로는 못 이긴다 —
   같은 모양으로 한 겹 더 쌓아 (0,4,0) 으로 맞춘다. 명시도를 눈대중하면 조용히 안 먹는다. */
.rmg .rmg-ppl-head:not(:disabled):active,
.rmg .rmg-mc-cell:not(:disabled):active,
.rmg .rmg-tt-block:not(:disabled):active,
.rmg .rmg-tl-slot:not(:disabled):active,
.rmg .rmg-await-row:not(:disabled):active,
.rmg .rmg-doorway:not(:disabled):active,
.rmg .rmg-railbtn:not(:disabled):active,
.rmg .rmg-evwho-faces:not(:disabled):active,
.rmg .rmg-dial-keyrow:not(:disabled):active { transform: none; }

/* 여기에 transition 을 걸지 않는다.
   ".rmg button"(0,1,1)은 ".rmg-evback"·".rmg-ppl-act" 같은 클래스 규칙(0,1,0)을 이긴다.
   transition 은 이어 붙지 않고 통째로 갈아치우므로, 한 줄 편하자고 여기 적으면
   자기 transition 을 가진 버튼 46개의 색·배경 전환이 전부 죽는다. 눌림은 즉각 반응해도
   어색하지 않고, 이미 transform 을 전환하는 것들(.rmg-await-row 등)은 자기 것으로 부드럽다. */
@media (prefers-reduced-motion: reduce) { .rmg button:not(:disabled):active { transform: none; } }

/* 잠긴 버튼은 어디서나 같은 얼굴을 한다 — 눌러도 되는지가 클래스마다 달라 보이면 안 된다. */
.rmg button:disabled { opacity: 0.45; cursor: default; }

.rmg-eyebrow { margin: 0 0 var(--sp-3); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }

/* ══ 화면 아래의 세 겹 ══════════════════════════════════════════════
   같은 자리에 서지만 같은 무게로 서지 않는다. 역할이 다르면 재질도 달라야 한다.

     ① 입력창(.rmg-ask)   — 주인공. 면이 있고, 넓고, 조용하다.
     ② 처리 중(.rmg-working) — 기척. 면도 테두리도 없는 한 줄.
     ③ 결과·제안(.rmg-flash / .rmg-note) — 곁말. 면은 있되 입력창보다 한 겹 옅다.

   예전엔 셋이 같은 테두리·같은 그림자·같은 폭의 카드였다. 그래서 무엇이 '지금 할 일'
   인지 눈이 고르지 못했다 — 화면을 처음 본 사람이 입력창을 알아보는 데 시간이 걸렸다. */

/* ② 처리 중 — 카드가 아니다. 입력창 위에 뜬 한 줄의 기척.
   AI 가 뒤에서 일하고 있다는 것만 말하고, 읽는 눈을 붙잡지 않는다. */
.rmg-working { position: fixed; bottom: 110px; left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 18;
  width: var(--bar-w); display: flex; align-items: center; justify-content: center; gap: var(--sp-1);
  pointer-events: none;
  animation: rmg-fade 260ms ease both;
  transition: left 280ms cubic-bezier(0.22,1,0.36,1); }
.rmg-working-mark { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  animation: rmg-working-pulse 1.5s ease-in-out infinite; }
/* AI 가 일하고 있다는 것을 말하는 유일한 글자 — 이것도 잠깐만 뜨는 요소라 §18 이 못 봤다. */
.rmg-working-t { font-size: 0.8rem; font-weight: 400; letter-spacing: -0.005em; color: var(--muted); }
/* 말줄임은 글자로 찍지 않고 자라나게 둔다 — 세 점이 한 칸씩 켜지며 시간이 흐르는 것만 알린다. */
.rmg-working-t::after { content: ""; animation: rmg-working-dots 1.6s steps(4, end) infinite; }
@keyframes rmg-working-pulse { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
@keyframes rmg-working-dots { 0% { content: ""; } 25% { content: "·"; } 50% { content: "··"; } 75% { content: "···"; } }
@media (prefers-reduced-motion: reduce) {
  .rmg-working { animation: none; }
  .rmg-working-mark { animation: none; opacity: 0.7; }
  .rmg-working-t::after { content: "···"; animation: none; }
}

/* ③-a 결과(스침) — 방금 무엇이 어디로 갔는가. 6초 뒤 스스로 옅어진다.
   입력창보다 한 겹 옅고 한 겹 낮다: 테두리는 헤어라인 하나, 그림자는 거의 없다. */
.rmg-flash { position: fixed; bottom: 110px; left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 19;
  display: flex; align-items: center; gap: var(--sp-1);
  width: var(--bar-w); padding: 9px var(--sp-1) 9px var(--sp-2); border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 5%, transparent);
  backdrop-filter: blur(14px); box-shadow: 0 8px 24px -22px rgba(0,0,0,0.4);
  animation: rmg-rise 0.34s cubic-bezier(0.22,1,0.36,1) both;
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1), left 280ms cubic-bezier(0.22,1,0.36,1); }
/* 답을 기다리는 결과(확정 전)는 한 눈금만 또렷하게 — 스스로 사라지지 않는 줄이므로. */
.rmg-flash.hold { background: color-mix(in srgb, var(--surface) 90%, transparent);
  border-color: color-mix(in srgb, var(--ink) 9%, transparent); }
.rmg-flash.out { opacity: 0; transform: translateY(4px); }
.rmg-flash-text { flex: 1; min-width: 0; font-size: 0.88rem; font-weight: 400; letter-spacing: -0.01em;
  color: color-mix(in srgb, var(--ink) 78%, transparent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 누를 수 있는 글자다 — --faint(라이트 2.35:1)로는 읽히지 않는다.
   이 줄은 캡처 직후 6초만 떠서 §18 의 정적 대비 검사가 통째로 놓쳤다. 하필 "무엇이
   어디로 갔는지" 를 말하는 자리라, 화면에서 가장 오래 쳐다보는 한 줄이다. */
.rmg-flash-act { border: 0; background: none; font-family: inherit; font-size: 0.8rem; font-weight: 500;
  color: var(--muted); padding: 4px 9px; border-radius: 8px; cursor: pointer; flex-shrink: 0;
  transition: color 0.2s, background 0.2s; }
.rmg-flash-act:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
/* 확정 — 이 줄에서 할 일이 하나뿐임을 말한다. 색으로 소리치지 않고 잉크 한 겹으로만. */
.rmg-flash-act.primary { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
.rmg-flash-act.primary:hover { background: color-mix(in srgb, var(--ink) 14%, transparent); }
.rmg-flash-act:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .rmg-flash { animation: none; transition: opacity 0.5s ease; } }

/* ③-b 알아챈 것 — AI 가 읽은 것을 말하고 한 번의 행동을 권한다.
   경고창이 아니다: 붉은 테두리도 느낌표도 없고, 사실 한 줄과 권유 한 줄로만 선다.
   답을 기다리므로 스스로 사라지지 않되, 입력창을 이기지는 않는다. */
.rmg-note { position: fixed; bottom: 174px; left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 19;
  display: flex; align-items: flex-start; gap: var(--sp-2);
  width: var(--bar-w); padding: 11px var(--sp-1) 11px var(--sp-2); border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 7%, transparent);
  backdrop-filter: blur(14px); box-shadow: 0 10px 28px -24px rgba(0,0,0,0.45);
  animation: rmg-rise 0.34s cubic-bezier(0.22,1,0.36,1) both;
  transition: left 280ms cubic-bezier(0.22,1,0.36,1); }
.rmg-note-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
/* 알아챈 사실이 먼저, 권유가 그 아래 한 톤 옅게 — 읽는 순서가 곧 이해의 순서다. */
.rmg-note-t { font-size: 0.88rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); line-height: 1.4; }
.rmg-note-q { font-size: 0.82rem; font-weight: 400; color: var(--muted); line-height: 1.4; }
.rmg-note-act { flex-shrink: 0; align-self: center; border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  background: none; font: inherit; font-size: 0.8rem; font-weight: 500; color: var(--ink);
  padding: 6px 13px; border-radius: 999px; cursor: pointer;
  transition: background 0.2s, border-color 0.2s; }
.rmg-note-act:hover { background: color-mix(in srgb, var(--ink) 7%, transparent);
  border-color: color-mix(in srgb, var(--ink) 22%, transparent); }
.rmg-note-act:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-note-x { display: grid; place-items: center; width: 24px; height: 24px; align-self: center; border: 0; background: none;
  color: var(--faint); cursor: pointer; border-radius: 7px; flex-shrink: 0; transition: color 0.2s, background 0.2s; }
.rmg-note-x:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-note-xic { width: 13px; height: 13px; stroke-width: 2; }
@media (prefers-reduced-motion: reduce) { .rmg-note { animation: none; } }

/* AiDoor */
.aidoor { position: relative; display: inline-grid; place-items: center; }
.aidoor-svg { width: 100%; height: 100%; display: block; overflow: visible; animation: aidoor-breathe 6.5s ease-in-out infinite; }
.aidoor-frame { stroke: var(--muted); opacity: 0.5; transition: stroke 0.8s, opacity 0.8s; }
.aidoor-panel { stroke: var(--muted); fill: var(--accent); fill-opacity: 0; opacity: 0.62; transform-origin: 20px 26px; transition: all 0.8s cubic-bezier(0.22,1,0.36,1); }
.aidoor-handle { fill: var(--muted); transition: fill 0.8s; }
.aidoor.active .aidoor-frame { stroke: var(--accent); opacity: 0.9; }
.aidoor.active .aidoor-panel { stroke: var(--accent); fill-opacity: 0.16; opacity: 1; transform: scaleX(0.82); }
.aidoor.active .aidoor-handle { fill: var(--accent); }
.aidoor.active .aidoor-svg { filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 22px var(--glow)); }
@keyframes aidoor-breathe { 0%,100% { opacity: 0.9; } 50% { opacity: 1; } }

/* 문턱 */
.rmg-thr { position: fixed; inset: 0; z-index: 60; cursor: pointer; display: grid; place-items: center; background: var(--paper); animation: rmg-thr-in 1s ease both; }
.rmg-thr.leaving { animation: rmg-thr-out 0.9s cubic-bezier(0.4,0,0.2,1) both; }
.rmg-thr-in { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 24px; }
.rmg-thr-door { width: 42px; height: 55px; margin-bottom: 40px; }
.rmg-phil-1 { margin: 0; font-size: clamp(1.5rem, 4vw, 2.1rem); font-weight: 300; line-height: 1.28; letter-spacing: 0.01em; color: var(--faint); animation: rmg-rise 1s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
.rmg-phil-2 { margin: 0; font-size: clamp(1.5rem, 4vw, 2.1rem); font-weight: 600; line-height: 1.28; letter-spacing: -0.025em; color: var(--ink); animation: rmg-rise 1s cubic-bezier(0.22,1,0.36,1) 0.45s both; }
.rmg-thr-cta { margin-top: 40px; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); animation: rmg-fade 1.2s ease 1s both; }
@keyframes rmg-thr-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-thr-out { to { opacity: 0; transform: scale(1.015); } }
@keyframes rmg-fade { from { opacity: 0; } to { opacity: 1; } }

/* 레일 — 그리드 첫 컬럼(64→236px)이 커지며 콘텐츠를 함께 밀어낸다(오버레이 아님·reflow).
   레일은 컬럼을 가득 채우고, 라벨은 폭이 늘어난 만큼 조용히 드러난다. */
.rmg-rail { position: relative; z-index: 2; width: 100%; height: 100%; overflow: hidden; }
.rmg-rail-panel {
  width: 100%; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-3);
  padding: var(--sp-3) 12px; border-right: 1px solid var(--hair);
  transition: background 280ms ease, border-color 280ms ease;
}
/* 확장 시 표면이 아주 은은하게 올라오고, 문틈 같은 액센트 헤어라인(공간이 열리는 감각) */
.rmg.rail-open .rmg-rail-panel {
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-right-color: color-mix(in srgb, var(--accent) 18%, var(--hair));
}

/* 브랜드 마크(문) + Comein 워드마크 리빌 — 아주 은은한 글로우 */
/* 브랜드 마크 — 클릭 불가(가이드 제거). 레일 펼침 시 문에 은은한 숨결만. */
/* 마크와 메뉴가 같은 행 규격(높이 40 · 좌우 패딩 10 · 아이콘 폭 19)을 써야 아이콘·라벨이 한 줄에 선다. */
/* 문 — 마크이자 안내로 들어가는 입구. 다른 레일 항목과 같은 행 규격을 쓴다. */
.rmg-rail-mark { display: flex; align-items: center; gap: 12px; width: 100%; height: var(--nav-row); padding: 0 10px; border: 0; background: none; font: inherit; text-align: left; border-radius: var(--r); color: var(--ink); overflow: hidden; cursor: pointer; transition: background 170ms ease-out; }
.rmg-rail-mark:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.rmg-rail-mark.on { background: color-mix(in srgb, var(--ink) 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-rail-mark:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }

/* ── 오늘 화면 오른쪽의 문 ──
   장식이 아니라 입구다. 누르면 문짝이 안쪽으로 열리고, 그 자리에 안내가 펼쳐진다. */
/* 조용함은 그림(문)이 맡고, 글자는 읽히게 둔다.
   예전엔 버튼 전체에 opacity 를 걸어 두어 라벨까지 같이 흐려졌다 —
   덕분에 문은 차분했지만 '무엇을 누르는 것인지'가 안 읽혔다. 둘을 떼어 놓는다. */
.rmg-doorway { position: sticky; top: var(--flow-top); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
  width: 100%; padding: var(--sp-6) var(--sp-3); border: 0; background: none; font: inherit; cursor: pointer;
  color: var(--ink); }
.rmg-doorway:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 4px; border-radius: var(--r); }
/* 문은 자기 칸을 넘지 않는다 — 칸이 좁으면 그만큼 작아질 뿐이다.
   (vw 로만 잡아 두면 칸이 좁아진 것을 문이 모른 채 밖으로 삐져나간다.) */
.rmg-doorway-door { width: min(var(--door-w), 100%); aspect-ratio: 40/52; opacity: 0.58; transition: opacity 400ms ease; }
.rmg-doorway:hover .rmg-doorway-door, .rmg-doorway.opening .rmg-doorway-door { opacity: 0.88; }
.rmg-doorway-cta { font-size: 0.86rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: color-mix(in srgb, var(--ink) 64%, transparent); transition: color 400ms ease; }
.rmg-doorway:hover .rmg-doorway-cta { color: color-mix(in srgb, var(--ink) 90%, transparent); }
/* 문짝이 안쪽으로 열린다 — 경첩은 왼쪽 모서리. 빛이 문틈으로 번진다. */
.rmg-doorway.opening .aidoor-panel { transform-box: fill-box; transform-origin: left center; animation: rmg-door-swing 520ms cubic-bezier(0.22,1,0.36,1) both; }
.rmg-doorway.opening .aidoor-svg { animation: rmg-door-glow 520ms ease both; }
@keyframes rmg-door-swing { from { transform: rotateY(0deg) scaleX(1); } to { transform: scaleX(0.12); } }
@keyframes rmg-door-glow { from { filter: none; } to { filter: drop-shadow(0 0 18px var(--glow)); } }
@media (prefers-reduced-motion: reduce) {
  .rmg-doorway.opening .aidoor-panel, .rmg-doorway.opening .aidoor-svg { animation: none; }
}
/* hover 에서만 드러나는 것들 — 평소엔 문이 조용히 서 있기만 한다. */
.rmg-doorway-wrap { position: relative; --door-w: clamp(160px, 17vw, 224px); }
.rmg-doorway-hint { font-size: 0.82rem; color: color-mix(in srgb, var(--ink) 66%, transparent); opacity: 0; transform: translateY(-3px); transition: opacity 200ms ease-out, transform 200ms ease-out; }
.rmg-doorway-wrap:hover .rmg-doorway-hint { opacity: 1; transform: none; }
.rmg-doorway-wrap:hover .rmg-doorway { transform: scale(1.012); }
.rmg-doorway { transition: transform 200ms ease-out; }
/* 처음 온 사람에게만 — 점 하나. 배지도 숫자도 두지 않는다. */
/* 문이 칸에 맞춰 작아지면 이 표식도 따라와야 한다 — 문 밖으로 떨어져 잘리지 않게 가둔다. */
.rmg-doorway-new { position: absolute; top: calc(var(--sp-6) - 2px); right: max(var(--sp-1), calc(50% - var(--door-w) / 2 - 4px)); width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 75%, transparent); }
/* 미리보기 — 툴팁이 아니라 이 화면과 같은 재질의 작은 카드. */
.rmg-doorprev { position: absolute; left: 50%; transform: translate(-50%, 6px); top: calc(100% - var(--sp-4));
  width: min(260px, 100%); padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px -22px rgba(0,0,0,0.5);
  opacity: 0; pointer-events: none; transition: opacity 200ms ease-out, transform 200ms ease-out; }
/* 보일 때만 눌린다 — 안 보이는 카드가 클릭을 삼키면 뒤의 것이 안 눌린다. */
.rmg-doorway-wrap:hover .rmg-doorprev { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; cursor: pointer; }
.rmg-doorprev-t { margin: 0 0 6px; font-size: 0.88rem; font-weight: 500; color: var(--ink); }
.rmg-doorprev-b { margin: 0 0 var(--sp-1); font-size: 0.82rem; font-weight: 400; line-height: 1.6; color: color-mix(in srgb, var(--ink) 76%, transparent); }
.rmg-doorprev-meta { margin: 0 0 8px; font-size: 0.76rem; letter-spacing: 0.02em; color: var(--faint); }
.rmg-doorprev-cta { margin: 0; font-size: 0.8rem; font-weight: 500; color: color-mix(in srgb, var(--ink) 68%, transparent); }
.rmg-doorway-wrap:hover .rmg-doorprev:hover .rmg-doorprev-cta { color: var(--ink); }
@media (prefers-reduced-motion: reduce) {
  .rmg-doorway, .rmg-doorway-hint, .rmg-doorprev { transition: none; }
}

/* 처음 온 사람에게 한 번 — 문이 스스로 손을 든다.
   hover 로 드러나는 것들을 그대로 쓴다: 다른 모양을 새로 만들면 안내와 실제가 달라진다.
   그래서 여기서 배운 자리가 곧 다음에 손이 갈 자리다. */
.rmg-doorway-wrap.hint .rmg-doorprev { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; cursor: pointer; }
.rmg-doorway-wrap.hint .rmg-doorway-hint { opacity: 1; transform: none; }
.rmg-doorway-wrap.hint .rmg-doorway-door { opacity: 0.88; }
/* 표식은 한 번씩 번져 나간다 — 세 번이면 눈에 들어오고, 그 뒤로는 조용해진다. */
.rmg-doorway-wrap.hint .rmg-doorway-new::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  animation: rmg-hint-ping 1.6s cubic-bezier(0.22,1,0.36,1) 3; }
@keyframes rmg-hint-ping {
  0%   { transform: scale(0.6); opacity: 0.9; }
  100% { transform: scale(2.6); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .rmg-doorway-wrap.hint .rmg-doorway-new::after { animation: none; }
}

/* ── 사용 가이드 투어 ──
   화면을 덮는 모달이 아니다. 지금 설명하는 것만 남기고 나머지를 아주 옅게 눌러 둔다. */
.rmg-tour { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
.rmg-tour-ring { position: fixed; border-radius: var(--r); pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  /* 스포트라이트가 아니라 '나머지 UI 의 opacity 를 낮추는' 정도. */
  box-shadow: 0 0 0 9999px color-mix(in srgb, var(--paper) 62%, transparent);
  transition: left 220ms ease-out, top 220ms ease-out, width 220ms ease-out, height 220ms ease-out; }
/* 가이드 카드 — 여기서만은 절제가 곧 흐릿함이 되면 안 된다.
   차분함은 투명도로 만드는 게 아니다. 옅게 깔아 얻은 고요함은 그냥 안 읽히는 것이고,
   하필 이 화면은 Comein 을 처음 보는 사람이 읽는 화면이다.
   그래서 분위기(여백·무채색·낮은 채도)는 그대로 두고 위계는 크기와 무게로 세운다 —
   본문에 opacity 를 더 먹이는 대신 글자를 키우고 굵기를 준다. 카드 크기는 건드리지 않는다. */
.rmg-tour-card { position: fixed; width: min(380px, calc(100vw - 32px)); pointer-events: auto;
  display: flex; flex-direction: column; gap: 0;
  padding: var(--sp-3) var(--sp-3) var(--sp-2); border: 1px solid color-mix(in srgb, var(--ink) 11%, var(--hair)); border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--surface) 98%, transparent); backdrop-filter: blur(12px);
  box-shadow: 0 18px 44px -26px rgba(0,0,0,0.55);
  animation: rmg-tour-in 200ms ease-out both;
  transition: left 220ms ease-out, top 220ms ease-out; }
@keyframes rmg-tour-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-tour-card, .rmg-tour-ring { animation: none; transition: none; } }
/* 제목 — 카드에서 가장 먼저 읽히는 것. 흐리게 두지 않는다(불투명 100%). */
.rmg-tour-title { margin: 0 0 14px; font-size: 1.34rem; font-weight: 600; line-height: 1.32; letter-spacing: -0.022em; color: var(--ink); }
/* 본문 — 두 줄로 감겨도 답답하지 않게 행간을 넉넉히. */
.rmg-tour-body { margin: 0 0 22px; font-size: 0.98rem; font-weight: 400; line-height: 1.7; color: color-mix(in srgb, var(--ink) 82%, transparent); }
/* 예시 한 줄 — 아직 비어 있는 워크스페이스에서 '이렇게 된다' 를 보여 준다.
   보조 정보지만 읽으라고 놓은 것이므로, 읽히는 선까지는 올린다. */
.rmg-tour-eg { margin: 0 0 20px; padding: 10px 12px; border-left: 2px solid color-mix(in srgb, var(--ink) 24%, var(--hair)); border-radius: 0 var(--r-sm) var(--r-sm) 0;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.875rem; font-weight: 400; line-height: 1.62; color: color-mix(in srgb, var(--ink) 74%, transparent); }
.rmg-tour-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-1) var(--sp-2); flex-wrap: wrap; padding-top: 14px; border-top: 1px solid color-mix(in srgb, var(--ink) 10%, var(--hair)); }
.rmg-tour-acts { display: flex; gap: 8px; margin-left: auto; }
.rmg-tour-acts .rmg-ppl-act { font-size: 0.875rem; font-weight: 500; padding: 7px 16px; color: color-mix(in srgb, var(--ink) 70%, transparent); border-color: color-mix(in srgb, var(--ink) 15%, var(--hair)); }
.rmg-tour-acts .rmg-ppl-act:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 30%, var(--hair)); }
/* '다음' 은 이 카드에서 할 일이 하나뿐임을 말한다 — 채워서 분명히 하되,
   색으로 소리치지 않는다(무채색 잉크. 이 화면에 액센트 컬러를 들이지 않는다). */
.rmg-tour-acts .rmg-ppl-act.primary { background: color-mix(in srgb, var(--ink) 92%, transparent); border-color: transparent; color: var(--paper); }
.rmg-tour-acts .rmg-ppl-act.primary:hover { background: var(--ink); color: var(--paper); border-color: transparent; }
.rmg-tour-dots { display: flex; align-items: center; margin-left: -5px; flex: 0 1 auto; min-width: 0; }
/* 점은 6px 이지만 닿는 자리는 16×18 이다 — 손끝으로도 걸음을 되짚을 수 있어야 한다.
   (테두리로 넓히면 세로가 6px 그대로라 손가락이 빗나간다. 안쪽 여백으로 넓힌다.) */
.rmg-tour-dot { box-sizing: content-box; width: 6px; height: 6px; padding: 6px 5px; border: 0; border-radius: 50%;
  cursor: pointer; background: color-mix(in srgb, var(--ink) 20%, transparent); background-clip: content-box;
  transition: background 200ms ease-out, transform 200ms cubic-bezier(0.22,1,0.36,1); }
.rmg-tour-dot.past { background: color-mix(in srgb, var(--ink) 44%, transparent); }
.rmg-tour-dot.on { background: color-mix(in srgb, var(--ink) 88%, transparent); transform: scale(1.35); }
.rmg-tour-dot:hover { background: color-mix(in srgb, var(--ink) 66%, transparent); }
.rmg-tour-dot:active { transform: scale(1.15); }

/* 막 이름 + 걸음 수 — 제목 위 한 줄. 제목보다 작고 조용하게. */
.rmg-tour-act { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2);
  margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
.rmg-tour-actname { color: var(--muted); }
.rmg-tour-count { color: var(--faint); font-variant-numeric: tabular-nums; letter-spacing: 0.06em; }

/* 가리킬 것이 아직 없을 때 — 사과하지 않고, 언제 생기는지만 말한다. */
.rmg-tour-none { margin: 0 0 18px; padding: 10px 12px; border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  font-size: 0.88rem; line-height: 1.65; color: color-mix(in srgb, var(--ink) 66%, transparent); }

/* 키보드 안내 — 되던 일인데 아무도 몰랐다. 있는 줄만 알면 되므로 가장 옅게. */
.rmg-tour-keys { margin: 12px 0 0; font-size: 0.74rem; letter-spacing: 0.02em; color: var(--faint); }
/* 건너뛰기 — 강조하지 않되, 찾는 사람 눈에는 보여야 한다. */
.rmg-tour-skip { position: absolute; top: 10px; right: 12px; border: 0; background: none; font: inherit; font-size: 0.85rem; font-weight: 400; color: color-mix(in srgb, var(--ink) 70%, transparent); cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: color 170ms ease-out; }
.rmg-tour-skip:hover { color: var(--ink); }

/* 열린 뒤 — 문이 있던 자리에 안내가 그대로 선다(새 창이 아니라 이 화면의 한 칸). */

@keyframes rmg-guide-in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }

/* 안내 — 목록이 아니라 짧은 글. */

.rmg.rail-open .rmg-rail-mark .aidoor-svg { filter: drop-shadow(0 0 7px var(--glow)); }
.rmg-rail-door { width: 19px; height: 24px; flex: 0 0 19px; }
.rmg-rail-word { font-size: 0.98rem; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }

/* 오늘·캘린더·사람은 메뉴 셋이 아니라 하나의 navigation group — 같은 행 규격, 같은 간격으로 묶인다.
   (마크·foot 과는 --sp-3 만큼 떨어져 있어 '세 개가 한 덩어리'로 읽힌다.) */
.rmg-rail-nav { position: relative; display: flex; flex-direction: column; gap: var(--nav-gap); }
.rmg-rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: var(--nav-gap); }
/* 활성 인디케이터 — 선택 항목 사이를 미끄러지듯 이동(morph). 스텝은 행 높이+간격에서 파생된다. */
.rmg-rail-ind { position: absolute; left: 0; right: 0; top: 0; height: var(--nav-row); border-radius: var(--r); z-index: 0; pointer-events: none;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent);
  transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease;
  will-change: transform; }
/* 좌측 3px 표식 — 글로우 없이. 지금 어느 공간에 있는지만 조용히 말한다. */
.rmg-rail-ind::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
.rmg-rail-ind[data-hidden="true"] { opacity: 0; }
/* 레일은 이 앱을 돌아다니는 주 수단이다. 기본색이 --faint 였는데 흰 바탕에서 2.35:1 이라
   (AA 4.5:1) 펼쳐도 이름이 잘 읽히지 않았다 — 호버해야 비로소 보였다. 한 단계 올린다.
   지금·호버·선택의 층은 그대로다: --muted → --ink → --ink + 굵기 600. */
.rmg-railbtn { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; width: 100%; height: var(--nav-row); padding: 0 10px; box-sizing: border-box; border: 0; border-radius: var(--r); background: none; color: var(--muted); cursor: pointer; text-decoration: none;
  transition: background 170ms ease-out, color 170ms ease-out; }
.rmg-railbtn > .rmg-railicon { flex: 0 0 19px; }
/* Hover — 배경이 아주 조금 오르고 대비가 한 단계 오른다. 자리는 움직이지 않는다(마우스가 지나가도 흔들리지 않게). */
.rmg-railbtn:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); color: var(--ink); }
/* Click — 아주 약한 스케일(리플 없음) */
.rmg-railbtn:active { transform: scale(0.98); transition: transform 90ms ease-out; }
/* 선택 — 쉬는 상태(faint) → hover(muted) → 선택(ink). 세 단계가 분명해야 '지금 여기'가 읽힌다. */
.rmg-railbtn.on { color: var(--ink); }
.rmg-railbtn.on .rmg-railicon { color: var(--ink); }
.rmg-railbtn.on .rmg-raillabel { font-weight: 600; }
/* nav 항목의 활성 배경/바는 슬라이딩 인디케이터가 대신한다(중복 제거) */
.rmg-rail-nav .rmg-railbtn.on { background: none; }
.rmg-rail-nav .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
/* 손끝 — 행 높이는 JS 가 44 로 올린다(--nav-row). 폭은 여기서 맞춘다.
   접힌 레일은 64px 이고 그 안에서 버튼은 64 − 좌우 12 − 헤어라인 1 = 39px 이었다.
   레일을 넓히지 않고 패딩을 3px 씩 안으로 옮긴다: 패널 12 → 9, 버튼 10 → 13.
   두 값이 서로를 지우므로 아이콘과 글자는 제자리에 그대로 있고, 닿는 자리만 39 → 45 로 자란다
   (레일이 펼쳐진 216px 상태에서도 같은 상쇄가 성립한다 — 라벨이 흔들리지 않는다). */
@media (hover: none) and (pointer: coarse) {
  .rmg-rail-panel { padding-left: 9px; padding-right: 9px; }
  .rmg-railbtn, .rmg-rail-mark { padding-left: 13px; padding-right: 13px; }
}
/* foot(설정)은 nav 밖이지만 같은 언어를 쓴다 — 설정이 현재 워크스페이스보다 강조되면 안 된다. */
.rmg-rail-foot .rmg-railbtn.on { background: color-mix(in srgb, var(--ink) 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-rail-foot .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); }
.rmg-rail-foot .rmg-railbtn.on::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
.rmg-railbtn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }

/* 인라인 라벨 — 폭 확장에 맞춰 opacity + translateX 로 조용히 등장(ease-out), 미세한 순차 */
.rmg-rail-word, .rmg-raillabel { white-space: nowrap; overflow: hidden; opacity: 0; max-width: 0; transform: translateX(-8px); transition: opacity 260ms cubic-bezier(0.22,1,0.36,1), max-width 280ms cubic-bezier(0.22,1,0.36,1), transform 260ms cubic-bezier(0.22,1,0.36,1); }
.rmg-raillabel { font-size: 0.9rem; font-weight: 500; letter-spacing: -0.005em; color: inherit; }
.rmg.rail-open .rmg-rail-word, .rmg.rail-open .rmg-raillabel { opacity: 1; max-width: 160px; transform: none; }
.rmg.rail-open .rmg-rail-nav .rmg-raillabel { transition-delay: calc(var(--i, 0) * 26ms + 30ms); }

.rmg-railicon { width: 19px; height: 19px; stroke-width: 1.6; }

@media (prefers-reduced-motion: reduce) {
  .rmg-rail-word, .rmg-raillabel { transition: none; }
  .rmg.rail-open .rmg-rail-nav .rmg-raillabel { transition-delay: 0ms; }
}

/* 캔버스 · 환경 */
/* 스크롤바 자리를 양쪽에 늘 비워둔다 — 한쪽만 비우면 본문 중심선이 fixed 로 뜬 캡처바와 어긋나고,
   뷰마다 스크롤 유무가 달라 기준선 자체가 흔들린다. */
.rmg-canvas { position: relative; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable both-edges; display: flex; justify-content: center; background: transparent; }
.rmg-env { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.rmg-ambient-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.rmg-grain { position: absolute; inset: 0; opacity: 0.026; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
/* 문 문양 — 규칙은 하나다: 본문 컬럼 바깥 오른쪽 여백의 한가운데.
   가로는 그 여백의 중앙, 세로는 본문과 같은 중심선. 뷰마다 다른 오프셋을 주지 않는다
   (그렇게 땜질하면 화면을 옮길 때마다 문이 제 자리를 잃는다). */
.rmg-heart { position: absolute; right: calc((var(--edge) - var(--heart-w)) / 2); top: 50%; transform: translateY(-50%); width: var(--heart-w); aspect-ratio: 40/52; color: var(--ink); opacity: 0.12; transition: opacity 1.2s ease; }
/* 문양이 들어갈 바깥 여백이 없으면 아예 물러난다 — 장식이 본문 위로 올라오지 않는다.
   작업면이 1440px 까지 자라므로, 문이 설 자리는 아주 넓은 화면에서만 생긴다. */
.rmg-heart { display: none; }
@media (min-width: 2000px) { .rmg-heart { display: block; } }
.rmg-heart.on { opacity: 0.5; }
/* light 모드: --muted가 어두운 회색이라 흰 배경 위 실효 ~2% 불투명도로는 문이 사라져 보임 → 휴식 가시성 보강(다크는 유지). .on보다 특이성이 높아 조직화 글로우도 유지. */
/* 빈 상태 일러스트 — 링과 같은 뉴트럴 계열. 윤곽이 사라지지 않을 만큼만 올린다(튀지 않게). */
:root:not(.dark) .rmg-heart { opacity: 0.38; }
:root:not(.dark) .rmg-heart.on { opacity: 0.62; }
.rmg-heart-door { width: 100%; height: 100%; }

/* 최상단 옵션 바 + 알림 */
/* 패널 닫기 아이콘 규격 (알림 벨은 제거됐지만 이 크기는 설정·캘린더 패널이 함께 쓴다) */
.rmg-notif-ic { width: 18.5px; height: 18.5px; stroke-width: 1.7; }

/* Context Rail 안의 월간 달력 — 이제 캔버스에 떠 있는 오버레이가 아니라 작업면의 한 컬럼이다.
   (오버레이였을 때는 뷰마다 본문과 겹치는 정도가 달라 화면마다 다른 UI 처럼 보였다.) */
.rmg-mc { user-select: none; position: relative; }
/* 날짜 미리보기 — 칸 오른쪽에 붙어 그 날만 조용히 펼친다. */
.rmg-mc-peek { position: absolute; z-index: 12; width: 200px; pointer-events: none;
  padding: var(--sp-1) 10px; border: 1px solid var(--hair); border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px -20px rgba(0,0,0,0.55);
  animation: rmg-fade 140ms ease both; }
@media (prefers-reduced-motion: reduce) { .rmg-mc-peek { animation: none; } }
.rmg-mc-peek-d { margin: 0 0 5px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; color: var(--faint); }
.rmg-mc-peek-none { margin: 0; font-size: 0.76rem; font-weight: 300; color: var(--faint); }
.rmg-mc-peek-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.rmg-mc-peek-row { display: flex; gap: 8px; align-items: baseline; }
.rmg-mc-peek-t { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.rmg-mc-peek-x { font-size: 0.78rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-mc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.rmg-mc-title { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; font-family: inherit; font-size: 0.92rem; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); cursor: pointer; padding: 4px 6px; margin: -4px -6px; border-radius: 9px; transition: background 0.2s; }
.rmg-mc-title:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-mc-title-ic { width: 14px; height: 14px; stroke-width: 2; color: var(--faint); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
.rmg-mc-title.on .rmg-mc-title-ic { transform: rotate(180deg); }
.rmg-mc-nav { display: flex; align-items: center; gap: 2px; }
.rmg-mc-today { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font-family: inherit; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em; padding: 5px 11px; border-radius: 999px; cursor: pointer; margin-right: 4px; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-mc-today:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
/* 달을 넘기는 손잡이. --muted 로 두면 다크에서 이 패널 표면 위에 3.34:1 로 앉는다
   (패널이 --paper 보다 밝아 대비가 깎인다). 글리프 하나뿐이라 놓치면 길이 막히므로
   쉬는 상태부터 또렷하게 두고, 손이 닿았다는 신호는 배경으로 준다. */
.rmg-mc-arrow { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: none; color: var(--ink); font-size: 1.1rem; line-height: 1; cursor: pointer; border-radius: 8px; transition: background 0.2s, color 0.2s; }
.rmg-mc-arrow:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-search { display: inline-flex; align-items: center; gap: 6px; margin-left: 6px; padding: 5px 10px 5px 9px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); border-radius: 9px; cursor: pointer; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-mc-search:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-mc-search-ic { width: 15px; height: 15px; stroke-width: 1.8; }
/* 버튼 안의 글자가 버튼 자신(--muted)보다 옅으면 손잡이가 제 이름을 못 읽게 한다. */
.rmg-mc-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.02em; color: inherit; }

/* 월/연 피커 — 제목 클릭 시 */
.rmg-mc-picker { margin-bottom: 14px; padding: 12px; border: 1px solid var(--hair); border-radius: 14px; background: color-mix(in srgb, var(--surface) 60%, transparent); animation: rmg-cs-pop 0.18s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mc-yr { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 10px; }
.rmg-mc-yr-v { font-size: 0.95rem; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 3.4em; text-align: center; }
.rmg-mc-months { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.rmg-mc-mo { border: 0; background: none; font-family: inherit; font-size: 0.8rem; font-weight: 500; color: var(--muted); padding: 9px 0; border-radius: 9px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.rmg-mc-mo:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-mo.on { background: var(--accent); color: #141210; font-weight: 600; }

/* 요일 행과 날짜 그리드는 같은 컬럼 규격 + 같은 gap 이어야 한 격자 위에 선다. */
.rmg-mc-wd { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-bottom: 4px; }
/* 요일 머리글은 장식이 아니라 달력을 읽는 기준선이다 — 가장 옅은 톤(--faint)에 두면
   흰 바탕에서 2.35:1 로 읽기 어렵다(AA 4.5:1). 한 단계 올린다. */
.rmg-mc-wd span { text-align: center; font-size: 0.68rem; font-weight: 500; color: var(--muted); padding: 4px 0; }
.rmg-mc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; animation: rmg-mc-fade 0.19s ease both; }
.rmg-mc-grid.in-l { animation: rmg-mc-slide-l 0.2s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mc-grid.in-r { animation: rmg-mc-slide-r 0.2s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-mc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-mc-slide-l { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes rmg-mc-slide-r { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
/* color 에는 전환을 걸지 않는다 — 선택 카드는 즉시 깔리는데 글자색만 0.2s 뒤따라오면
   그 사이 어두운 카드 위에 어두운 글자가 겹쳐 숫자가 잠깐 사라져 보인다. */
.rmg-mc-cell { position: relative; isolation: isolate; aspect-ratio: 1; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-family: inherit; font-size: 0.8rem; font-weight: 400; border-radius: var(--r-sm); cursor: pointer; transition: background 0.2s; }
.rmg-mc-cell.empty { pointer-events: none; }
.rmg-mc-cell:not(.empty):hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
/* 오늘 — 강한 primary 대신 은은한 액센트 필드 서클 (팔레트 유지) */
.rmg-mc-cell.today { color: var(--accent); font-weight: 700; }
.rmg-mc-cell.today::before { content: ""; position: absolute; inset: 14%; border-radius: 50%; background: color-mix(in srgb, var(--accent) 16%, transparent); z-index: -1; }
/* 선택 표식은 셀 전체가 아니라 안쪽 사각형 — 칸이 커져도 카드 크기가 함께 부풀지 않고 숫자는 늘 가운데 있다. */
.rmg-mc-cell.sel { background: none; color: var(--paper); font-weight: 600; }
/* 고른 날 위에 손을 올려도 숫자는 그대로 — hover 규칙이 .sel 보다 특이성이 높아
   어두운 카드 위에 어두운 글자가 얹혀 숫자가 사라지던 것을 막는다. */
.rmg-mc-cell.sel:not(.empty):hover { background: none; color: var(--paper); }
/* 카드는 살짝 부풀며 자리를 잡는다(불투명도는 건드리지 않는다 — 옅어지면 글자가 또 묻힌다). */
.rmg-mc-cell.sel::after { content: ""; position: absolute; inset: 10%; border-radius: var(--r-sm); background: var(--ink); z-index: -1; animation: rmg-mc-pick 0.2s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-mc-pick { from { transform: scale(0.86); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .rmg-mc-cell.sel::after { animation: none; } }
.rmg-mc.big .rmg-mc-cell.sel::after { border-radius: var(--r); }
.rmg-mc-cell.sel.today { color: var(--paper); }
.rmg-mc-cell.sel.today::before { display: none; }
.rmg-mc-dot { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 3px; height: 3px; border-radius: 50%; background: var(--accent); z-index: 1; }
.rmg-mc-cell.sel .rmg-mc-dot { background: var(--paper); }
@media (prefers-reduced-motion: reduce) { .rmg-mc-grid, .rmg-mc-grid.in-l, .rmg-mc-grid.in-r, .rmg-mc-picker { animation: none; } }
.rmg-calday { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--hair); }

.rmg-calday-list { list-style: none; margin: 0; padding: 0; }
/* 이제 누를 수 있는 줄이다. 다만 버튼처럼 보이지 않는다 — 이 칸은 읽는 자리이고,
   테두리와 배경을 두르면 왼쪽이 손잡이 목록이 된다. 손이 닿을 때만 그렇다고 말한다. */
.rmg-calday-row { display: flex; width: 100%; align-items: baseline; gap: 10px; padding: 8px 0;
  border: 0; background: none; font: inherit; text-align: left; cursor: pointer;
  border-radius: 6px; transition: background 150ms ease-out; }
.rmg-calday-row:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-calday-row:hover .rmg-calday-time { color: var(--ink); }
.rmg-calday-row:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .rmg-calday-row { transition: none; } }
/* 시간 — 디지털 시계 느낌 제거. 본문과 동일한 sans + 비례숫자(proportional) + secondary 색으로 하나의 시스템처럼. */
.rmg-calday-time { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.82rem; font-weight: 450; letter-spacing: -0.01em; line-height: 1.4; color: var(--muted); min-width: 3.6em; }
.rmg-calday-title { font-size: 0.86rem; font-weight: 300; color: var(--ink); line-height: 1.4; }
.rmg-calday-empty { font-size: 0.82rem; color: var(--faint); padding: 4px 0; }

/* 전체 화면 란 — 가로 옵션에서 여는 캘린더/설정 (모달 아님, 캔버스를 채우는 큰 판) */
/* 패널 — Workspace 가 한 겹 확장되는 레이어. 좌측에서 슬라이드 + 은은한 깊이(블러·섀도우). transform/opacity 중심(60fps). */

@keyframes rmg-panel-in { from { opacity: 0; transform: translateX(-26px) scale(0.986); } to { opacity: 1; transform: translateX(0) scale(1); } }
/* 스태거 — 헤더 → 그리드 → 오늘 일정, 40~60ms 간격 Fade + Slide Up (content 220ms) */
@keyframes rmg-stag { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

.rmg-panel-close { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent); color: var(--muted); border-radius: 11px; cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s cubic-bezier(0.22,1,0.36,1); }
.rmg-panel-close:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); border-color: color-mix(in srgb, var(--ink) 14%, var(--hair)); transform: translateY(-1px); }
.rmg-panel-close:active { transform: scale(0.96); }
.rmg-panel-close:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }

/* 캘린더 내부 순차 — 그리드(120ms) → 오늘 일정(180ms) */

@media (prefers-reduced-motion: reduce) {

  .rmg-rail-ind, .rmg-railbtn { transition: none; }
}

/* 캘린더 전체 — 크게 띄운 월간 그리드 + 선택 날짜 아젠다 */

/* 캘린더 우측 — 다가오는 일정 (아젠다 흡수) */

.rmg-mc.big .rmg-mc-title { font-size: 1.25rem; }
.rmg-mc.big .rmg-mc-title-ic { width: 17px; height: 17px; }
.rmg-mc.big .rmg-mc-head { margin-bottom: var(--sp-2); }
/* 칸을 아주 살짝 가로로 눕힌다 — 넓힌 행 간격(8px)만큼 세로를 돌려주어
   달력이 길어져 '다가오는 순간'을 화면 밖으로 밀어내지 않게. 정사각과 구분되지 않을 정도. */
/* 칸이 가로로 넓어진 만큼 세로는 눕힌다 — 안 그러면 달력이 길어져 하단(다가오는 순간)이 캡처바에 잠긴다.
   숫자는 늘 칸 한가운데라 3:2 비율에서도 눌려 보이지 않는다. */
/* 작업면이 넓어져 칸도 넓어졌다 — 세로를 더 눕혀야 6주치가 한 화면에 들어오고
   그 아래 '다가오는 순간'이 캡처바에 잠기지 않는다. */
.rmg-mc.big .rmg-mc-cell { aspect-ratio: 1.75; font-size: 1.02rem; border-radius: var(--r); }
.rmg-mc.big .rmg-mc-wd span { font-size: 0.82rem; padding: var(--sp-1) 0; }
/* 열 간격은 요일 행과 같아야 격자가 맞고, 행 간격만 넓혀 날짜가 눌려 보이지 않게 한다. */
.rmg-mc.big .rmg-mc-wd { column-gap: 6px; }
.rmg-mc.big .rmg-mc-grid { column-gap: 6px; row-gap: var(--sp-1); }
.rmg-mc.big .rmg-mc-dot { width: 4px; height: 4px; bottom: 6px; }
.rmg-mc.big .rmg-mc-months { gap: 6px; }
.rmg-mc.big .rmg-mc-mo { font-size: 0.9rem; padding: 12px 0; }

/* AI Calendar Search — Apple Spotlight 스타일 (fade + scale) */
.rmg-cs-scrim { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-start; justify-content: center; padding-top: 15vh; background: color-mix(in srgb, #000 40%, transparent); backdrop-filter: blur(3px); animation: rmg-cs-fade 0.16s ease both; }
.rmg-cs { width: min(540px, 92vw); border: 1px solid var(--hair); border-radius: 18px; background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(20px); box-shadow: 0 40px 100px -40px rgba(0,0,0,0.7); overflow: hidden; animation: rmg-cs-pop 0.18s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-cs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-cs-pop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
.rmg-cs-bar { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--hair); }
.rmg-cs-ic { width: 19px; height: 19px; stroke-width: 1.8; color: var(--muted); flex-shrink: 0; }
.rmg-cs-input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; font-family: inherit; font-size: 1.02rem; font-weight: 400; color: var(--ink); caret-color: var(--accent); }
.rmg-cs-input::placeholder { color: var(--faint); }
.rmg-cs-esc { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.64rem; font-weight: 600; color: var(--faint); border: 1px solid var(--hair); border-radius: 6px; padding: 2px 6px; text-transform: uppercase; }
.rmg-cs-hit { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 15px 18px; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; transition: background 0.18s; }
.rmg-cs-hit:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.rmg-cs-hit-l { font-size: 0.98rem; font-weight: 500; color: var(--ink); }
.rmg-cs-hit-d { font-size: 0.85rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-cs-none { margin: 0; padding: 20px 18px; font-size: 0.9rem; font-weight: 300; color: var(--faint); text-align: center; }
.rmg-cs-sugg { padding: 14px 16px 16px; }
.rmg-cs-eye { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
.rmg-cs-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.rmg-cs-chip { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 400; padding: 7px 13px; border-radius: 999px; cursor: pointer; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-cs-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); background: color-mix(in srgb, var(--surface) 80%, transparent); }
@media (prefers-reduced-motion: reduce) { .rmg-cs-scrim, .rmg-cs { animation: none; } }

/* 설정 란 — 스토어 설정을 편집 (에디토리얼 행 · 세그먼트 · 스위치) */
.rmg-set { max-width: 620px; margin: 0 auto; }
.rmg-set-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 0; border-top: 1px solid var(--hair); }
.rmg-set-row:first-child { border-top: 0; }
.rmg-set-label { min-width: 0; }
.rmg-set-k { margin: 0; font-size: 1rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.rmg-set-d { margin: 4px 0 0; font-size: 0.84rem; font-weight: 300; line-height: 1.4; color: var(--muted); }
/* 설정이 오른쪽 칸에 들어오면 좁아진다 — 라벨과 조작을 위아래로 접는다. */
.rmg-setpanel-body { flex: 1; min-height: 0; overflow-y: auto; }
/* 설정은 곁들이는 칸이 아니라 하나의 화면이다 — 작업면을 그대로 쓴다.
   한 줄씩 세로로만 쌓이면 넓은 화면에서 가운데 가느다란 띠 하나만 남는다.
   폭이 되는 만큼 두 칸으로 흐르게 두되, 한 항목(라벨+조작)은 절대 쪼개지지 않는다. */
.rmg-setpanel .rmg-set {
  max-width: none;
  display: grid;
  /* 두 칸까지만. 세 칸이 되면 한 항목을 읽고 다음 항목으로 눈이 화면을 가로질러 건너간다
     — 넓다고 다 쓰는 게 아니라, 읽는 거리가 유지되는 만큼만 쓴다. */
  grid-template-columns: repeat(auto-fit, minmax(min(560px, 100%), 1fr));
  max-width: 1240px;
  column-gap: var(--sp-8, 64px);
  align-content: start;
}
/* 두 칸이 되면 각 칸의 첫 줄에도 윗선이 필요 없다 — 칸마다 위가 뚫려 있어야 나란히 읽힌다. */
.rmg-setpanel .rmg-set-row { border-top: 1px solid var(--hair); }
.rmg-setpanel .rmg-set-row:first-child { border-top: 1px solid var(--hair); }
/* 계정 줄은 폭을 넉넉히 쓴다(이메일·버튼이 함께 서는 자리라 좁으면 줄바꿈이 지저분하다). */
.rmg-setpanel .rmg-set-row:has(.rmg-acct) { grid-column: 1 / -1; }
@media (max-width: 1000px) {
  .rmg-setpanel .rmg-set { grid-template-columns: minmax(0, 1fr); }
}
/* 넉넉해졌으니 라벨과 조작을 다시 좌우로 편다 — 좁을 때만 접는다. */
.rmg-setpanel .rmg-set-row { padding: var(--sp-3) 0; }
.rmg-setpanel .rmg-acct { max-width: 62%; }
@media (max-width: 1100px) {
  .rmg-setpanel .rmg-set-row { flex-direction: column; align-items: stretch; gap: var(--sp-1); }
  .rmg-setpanel .rmg-set-input, .rmg-setpanel .rmg-acct-mail, .rmg-setpanel .rmg-acct-pw { width: 100%; }
  .rmg-setpanel .rmg-acct { max-width: none; justify-content: flex-start; }
  .rmg-setpanel .rmg-seg { align-self: flex-start; }
}

/* 글자 크기 — 칸이 아니라 바. 양 끝의 '가' 가 무엇을 조절하는지 말해 준다. */
.rmg-size { display: flex; align-items: center; gap: var(--sp-1); }
.rmg-size-a { font-size: 0.8rem; color: var(--muted); }
.rmg-size-b { font-size: 1.15rem; color: var(--muted); }
.rmg-size-v { font-size: 0.74rem; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 3em; text-align: right; }
.rmg-size-bar { flex: 1; min-width: 90px; height: 2px; appearance: none; -webkit-appearance: none; background: var(--hair); border-radius: 2px; outline: none; cursor: pointer; }
.rmg-size-bar::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--ink); border: 0; cursor: pointer; transition: transform 150ms ease-out; }
.rmg-size-bar::-webkit-slider-thumb:hover { transform: scale(1.15); }
.rmg-size-bar::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--ink); border: 0; cursor: pointer; }
.rmg-size-bar:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 4px; }

.rmg-acct { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 6px; flex-shrink: 0; max-width: 60%; }
.rmg-acct-mail { width: min(150px, 28vw); padding: 6px 10px; font-size: 0.84rem; }
.rmg-acct-pw { width: min(120px, 24vw); padding: 6px 10px; font-size: 0.84rem; }
/* 핸들 줄의 조작부 — 계정 줄(.rmg-acct)을 빌려 쓰면 설정 격자의
   :has(.rmg-acct) 규칙에 걸려 이 줄만 전체 폭을 혼자 차지한다.
   나머지 항목과 같은 칸에 서야 한 덩어리로 읽힌다. */
.rmg-handle { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 6px; flex-shrink: 0; }
.rmg-handle-v { font-size: 0.94rem; font-weight: 500; color: var(--ink); }
.rmg-handle-in { width: min(200px, 40vw); }
.rmg-acct-off { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); flex-shrink: 0; }
.rmg-set-input { width: min(240px, 46vw); padding: 10px 14px; border-radius: 11px; background: color-mix(in srgb, var(--surface) 60%, transparent); border: 1px solid var(--hair); font-family: inherit; font-size: 0.94rem; color: var(--ink); outline: none; transition: border-color 0.25s, box-shadow 0.25s; }
.rmg-set-input:focus { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); box-shadow: 0 0 0 3px var(--glow); }
.rmg-seg { display: inline-flex; padding: 3px; border-radius: 11px; background: color-mix(in srgb, var(--surface) 55%, transparent); border: 1px solid var(--hair); flex-shrink: 0; }
.rmg-seg-btn { border: 0; background: none; font-family: inherit; font-size: 0.84rem; font-weight: 500; color: var(--muted); padding: 7px 14px; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: background 0.2s, color 0.2s; }
.rmg-seg-btn:hover { color: var(--ink); }
.rmg-seg-btn.on { background: var(--ink); color: var(--paper); }
.rmg-seg-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-switch { position: relative; width: 46px; height: 27px; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--ink) 16%, var(--hair)); cursor: pointer; flex-shrink: 0; transition: background 0.25s; }
.rmg-switch.on { background: var(--accent); }
.rmg-switch:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-switch-dot { position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
.rmg-switch.on .rmg-switch-dot { transform: translateX(19px); }

/* ── 하나의 작업면 ──
   가로 패딩을 두지 않는다. 폭 자체가 기준선이라야 시계·캡처바·문양이 같은 선에 설 수 있다.
   세로로는 위에서부터 쌓는다 — 세 화면의 제목이 같은 높이에서 시작해야 하므로
   콘텐츠 양에 따라 오르내리는 세로 가운데 정렬은 쓰지 않는다. */
.rmg-flow { position: relative; z-index: 2; width: var(--workspace); min-height: 100%; display: flex; flex-direction: column; justify-content: flex-start; gap: var(--flow-gap); padding: var(--flow-top) 0 var(--flow-bottom);
  transition: opacity 170ms ease-out, transform 170ms ease-out; will-change: opacity, transform; }
/* 탭 전환: 이전 뷰가 6px 만큼 물러나며 사라지고(170ms), 새 뷰가 rmg-a* 로 떠오른다.
   교체 시점(JS 170ms)과 페이드 길이를 같게 둔다 — 어긋나면 다 사라지기 전에 툭 갈린다. */
.rmg-flow.flow-exit { opacity: 0; transform: translateY(-6px); }
/* 한 번이라도 탭을 옮긴 뒤엔 등장도 짧게. 첫 입장의 여유(0.62s)는 그때만의 것이다. */
.rmg-flow.switched .rmg-a1 { animation-duration: 200ms; animation-delay: 0ms; }
.rmg-flow.switched .rmg-a2 { animation-duration: 200ms; animation-delay: 25ms; }
.rmg-flow.switched .rmg-a3 { animation-duration: 200ms; animation-delay: 50ms; }

/* ── PAGE HEADER — 세 화면 공통 ──
   제목의 시작 X(작업면 왼쪽 끝)와 위 Y(--flow-top)가 같아야 탭을 옮겨도 '같은 공간'으로 읽힌다.
   Today 는 인사말이, Calendar·People 은 뷰 이름이 이 자리에 온다. */
.rmg-pagehead { display: flex; flex-direction: column; gap: var(--sp-1); }
/* 화면 이름(오늘·캘린더·사람) — SUIT Light. 여기만 본문 서체에서 떨어져 나온다.
   자간을 px 로 죈 값이라 크기와 함께 움직이지 않는다: 52px 기준으로 잡은 -2.2px 다. */
.rmg-pagetitle { margin: 0; font-family: "SUIT Variable", var(--font-sans), sans-serif;
  font-size: 52px; font-weight: 300; letter-spacing: -2.2px; line-height: 1.1; color: #2B2926; }
/* 어두운 화면에서는 같은 잉크로 — 위 색은 밝은 종이 위의 값이다. */
.dark .rmg-pagetitle { color: var(--ink); }
.rmg-pagesub { margin: 0; font-size: 0.92rem; font-weight: 500; letter-spacing: 0.01em; color: var(--muted); font-variant-numeric: tabular-nums; }

/* ── PAGE BODY — Context Rail + 본문 ──
   바깥 상자(작업면)는 세 화면이 공유하고, 안쪽 컬럼 구성만 뷰마다 다르다.
   Today 는 [맥락 달력 | 읽는 칸 | 여백], Calendar 는 큰 달력이 레일 자리를 대신해 한 컬럼,
   People 은 [목록 | 대화] — 대화가 주인공이라 오른쪽을 넓게 쓴다. */
.rmg-pagebody { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--sp-6); align-items: start; }
/* 세 번째 칸(문이 서는 자리)에 최소 폭을 준다.
   1fr 로만 두면 남는 만큼만 받아, 1280~1400px 대에서 90~170px 까지 줄어들고
   그 안에 서 있던 문(--door-w 최대 224px)이 칸을 넘쳐 캔버스 밖으로 잘려 나갔다.
   읽는 칸(--reading)은 상한만 있는 값이라, 여기서 먼저 자리를 떼어 줘도 탈이 없다. */
.rmg-pagebody[data-ctx="true"] { grid-template-columns: var(--ctx-w) minmax(0, var(--reading)) minmax(220px, 1fr); }
/* 캘린더에서 일정을 열면 본문 옆에 같은 칸이 생긴다(서랍으로 띄우지 않는다). */
.rmg-pagebody[data-ctx="false"][data-aside="true"] { grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); }
/* 사람 — 달력을 걷어낸 폭을 목록과 상세가 나눠 갖는다.
   목록은 이름과 마지막 말이 함께 읽힐 만큼(380–420px) 두고, 나머지는 전부 오른쪽에 준다.
   오른쪽에 빈 벌판을 남기지 않는다. */
.rmg-pagebody[data-view="people"][data-aside="true"]:not([data-settings="true"]) { grid-template-columns: minmax(380px, 420px) minmax(0, 1fr); }
/* 대화 칸이 화면 높이를 받아야 목록만 길고 오른쪽이 짧은 어긋남이 사라진다. */
.rmg-pagebody[data-view="people"] .rmg-pageaside { min-height: min(70vh, 680px); }
/* 아무도 고르지 않았을 때 — 목록이 가로로 늘어지지 않게 왼쪽 폭을 그대로 지킨다. */
.rmg-pagebody[data-view="people"][data-aside="false"] { grid-template-columns: minmax(380px, 420px) minmax(0, 1fr); }
/* 설정은 곁들이는 칸이 아니라 하나의 화면이다 — 작업면을 통째로 받는다.
   본문을 옆에 남겨 두면 '설정을 보는 중'인지 '오늘을 보는 중'인지 눈이 두 곳으로 갈린다. */
.rmg-pagebody[data-settings="true"] { grid-template-columns: minmax(0, 1fr) !important; }
.rmg-pagebody[data-settings="true"] .rmg-pagemain { display: none; }
/* 설정은 한 화면이다 — 작업면을 넉넉히 쓴다.
   780px 에 묶여 있어 좌우가 텅 빈 채 항목만 줄줄이 서 있었다. 다만 끝까지 늘리지는 않는다
   (한 행이 1440px 을 가로지르면 라벨과 값 사이를 눈이 멀리 건너간다). */
.rmg-pagebody[data-settings="true"] .rmg-pageaside { max-width: none; }
/* 레일이 물러난 폭에서는 빈 컬럼을 남기지 않는다. */
@media (max-width: 1239px) { .rmg-pagebody[data-ctx="true"] { grid-template-columns: minmax(0, var(--reading)) minmax(220px, 1fr); } }
@media (max-width: 880px) {
  .rmg-pagebody[data-ctx="true"], .rmg-pagebody[data-ctx="false"][data-aside="true"] { grid-template-columns: minmax(0, 1fr); }
  /* 좁은 화면에서 목록과 대화를 나란히 두면 둘 다 못 읽는다 — 목록 → 대화로 넘어간다.
     :not() 은 장식이 아니라 저울추다. 미디어 쿼리는 명시도를 얹어 주지 않으므로,
     위(§사람)의 규칙이 :not([data-settings]) 로 한 단계 무거워지면 이 규칙은 그대로 진다.
     같은 무게로 맞춰야 뒤에 선 이 규칙이 이긴다 — 실제로 졌었고, 목록이 380px 를 고집해
     좁은 폭에서 오른쪽이 잘렸다('새 그룹' 이 화면 밖으로 나가 눌리지 않았다). */
  .rmg-pagebody[data-view="people"][data-aside="true"]:not([data-settings="true"]),
  .rmg-pagebody[data-view="people"][data-aside="false"]:not([data-settings="true"]) { grid-template-columns: minmax(0, 1fr); }
  /* 한 칸짜리 화면 — 고른 뒤에는 상세만 남긴다. 위아래로 쌓아 두면 목록을 지나쳐야
     대화가 나오고, 스크롤 위치가 매번 어긋난다. 아직 아무도 안 골랐으면 목록만 둔다
     (빈 자리 안내는 이 폭에서 할 말이 없다). */
  /* 설정은 예외다. 설정은 '사람 화면의 오른쪽 칸' 이 아니라 하나의 화면이고,
     그것까지 이 규칙에 걸리면 좁은 폭에서 설정이 통째로 사라진다(실제로 그랬다). */
  .rmg-pagebody[data-view="people"][data-picked="true"]:not([data-settings="true"]) .rmg-pagemain { display: none; }
  .rmg-pagebody[data-view="people"][data-picked="false"]:not([data-settings="true"]) .rmg-pageaside { display: none; }
}
/* 안쪽이 접힐지는 '화면이 좁은가'가 아니라 '이 칸이 좁은가'로 정한다.
   오른쪽 칸이 열리면 본문 칸은 화면이 넓어도 좁아진다 — 뷰포트만 보고 판단하면
   그때 안쪽 격자가 그대로 남아 달력이 짜부라지고 대화가 30px 로 눌린다(실제로 그랬다). */
.rmg-pagemain { min-width: 0; display: flex; flex-direction: column; gap: var(--flow-gap); container: pagemain / inline-size; }
/* 세 번째 칸 — 사람의 맥락(일정 상세·대화)이 들어오는 자리. 행 높이를 다 받아야 sticky 가 붙는다. */
.rmg-pageaside { min-width: 0; align-self: stretch; container: evaside / inline-size; }
/* Context Rail — Today·People 이 완전히 같은 폭·타이포·간격을 쓴다(페이지마다 다른 UI 로 보이지 않게). */
.rmg-ctxrail { min-width: 0; }
@media (max-width: 1239px) { .rmg-ctxrail { display: none; } }
.rmg-feat { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }

/* HERO — 인사 한 줄이 왼쪽 끝에 바짝 붙어 있으면 제목과 같은 선에 걸려 딱딱해 보인다.
   한 칸만 안으로 들여, 페이지 제목보다 한 걸음 뒤에서 말하게 한다.
   (안의 세 줄 — 인사·날씨·숫자 — 은 서로의 정렬을 그대로 지킨다.) */
.rmg-hero { display: flex; flex-direction: column; padding-left: var(--sp-2); }
.rmg-mood { margin: 0; font-size: clamp(1.1rem, 2.6vw, 1.4rem); font-weight: 300; letter-spacing: -0.015em; color: var(--muted); }
.rmg-env-line { margin: var(--sp-3) 0 0; display: inline-flex; align-items: center; gap: var(--sp-1); font-size: 0.9rem; font-weight: 400; color: var(--muted); }
.rmg-env-icon { width: 15px; height: 15px; stroke-width: 1.7; }
.rmg-counts { margin-top: var(--sp-5); display: flex; gap: var(--sp-6); }
.rmg-count { display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-count-n { font-size: 1.75rem; font-weight: 300; color: var(--ink); letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
/* 숫자 밑의 이 한 마디가 그 숫자의 뜻이다 — 못 읽으면 "2" 가 무엇의 2인지 알 수 없다. */
.rmg-count-l { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }

/* CONTEXT (큐레이션) */
/* 세 줄이 하나의 정보 덩어리 — 줄 사이를 넓혀 숨 쉬게 하되 묶임은 유지한다. */
.rmg-ctx-line { display: grid; grid-template-columns: 6.5em 1fr; gap: var(--sp-3); align-items: baseline; padding: var(--sp-3) 0; border-top: 1px solid var(--hair); }
.rmg-ctx-line:first-of-type { border-top: 0; padding-top: var(--sp-1); }
/* 줄의 이름표(다가오는 순간·오늘의 흐름…) — 값보다 조용하되 읽히긴 해야 한다. */
.rmg-ctx-k { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.02em; color: var(--muted); }
.rmg-ctx-v { font-size: 1.06rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); line-height: 1.5; }
.rmg-ctx-v em { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-style: normal; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); }
/* 좁은 폭 — 라벨과 값을 나란히 두면 값 칸이 6.5em 남짓으로 짜부라져
   "예정된 / 일정이 / 없어요" 처럼 한두 글자씩 끊긴다. 그때는 위아래로 쌓는다. */
@media (max-width: 700px) {
  .rmg-ctx-line { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .rmg-ctx-v { font-size: 1rem; }
}
/* 달력 머리 — 좁아지면 "2026 / 년 8월", "오 / 늘" 처럼 낱말 안에서 줄이 갈렸다.
   글자를 쪼개서 폭을 맞추면 읽히지 않는다. 줄바꿈을 막고, 대신 머리 전체가 접히게 둔다. */
.rmg-mc-title, .rmg-mc-today { white-space: nowrap; }
@media (max-width: 700px) {
  .rmg-cv-head { flex-wrap: wrap; gap: var(--sp-1); }
  .rmg-mc-head { flex-wrap: wrap; row-gap: var(--sp-1); }
}
.rmg-ctx-reflect { color: var(--muted); }

/* Ask Comein · 항상 보이는 주 입력 (문 + 명확한 필드 + 회전 예시) */
/* 캡처바는 캔버스 스크롤과 무관하게 항상 같은 자리에 있어야 한다.
   (absolute 였을 때는 스크롤 컨테이너의 '콘텐츠 바닥'에 붙어 목록 위로 겹쳐 올라왔다.)
   fixed + 레일 폭만큼 left 를 밀어 캔버스 기준으로 가운데. 레일이 열리면 같이 미끄러진다. */
/* ① 입력창 — 이 화면에서 사용자가 할 일은 하나뿐이다: 여기에 아무거나 적는 것.
   그래서 아래 세 겹 중 유일하게 '면'을 제대로 가진다 — 넓은 안쪽 여백, 큰 모서리,
   거의 불투명한 표면. 대신 테두리와 그림자는 최소로 둔다: 무게는 크기와 여백에서 오지
   선(線)에서 오지 않는다(선으로 세우면 그 순간 검색창이 된다). */
.rmg-ask { position: fixed; bottom: var(--sp-4); left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 20;
  display: flex; align-items: center; gap: var(--sp-2);
  width: var(--bar-w-lg);
  padding: 14px var(--sp-2) 14px var(--sp-3); border-radius: 18px;
  /* 종이(--paper)와 표면(--surface)은 원래 거의 같은 색이다 — 차분함이 거기서 온다.
     그래서 표면만으로는 주인공이 배경에서 떠오르지 않는다. 이 하나에만 반 톤을 더 준다:
     테두리를 굵히거나 그림자를 키우는 대신, 면이 조금 더 밝아서 앞에 서게. */
  background: var(--ask-surface);
  border: 1px solid color-mix(in srgb, var(--ink) 6%, transparent);
  backdrop-filter: blur(16px);
  /* 카드를 띄우는 그림자가 아니라 바닥에 깔리는 옅은 그늘 — 있는지 모를 만큼만. */
  box-shadow: 0 20px 48px -34px rgba(0,0,0,0.5), 0 2px 6px -4px rgba(0,0,0,0.08);
  transition: border-color 0.3s, box-shadow 0.3s, left 280ms cubic-bezier(0.22, 1, 0.36, 1),
              width 240ms cubic-bezier(0.22, 1, 0.36, 1), margin 240ms cubic-bezier(0.22, 1, 0.36, 1),
              background 240ms ease-out; }

/* 접힌 상태 — 캘린더에서만. 오른쪽 끝으로 물러나 문 표식과 ⌘K 만 남는다.
   사라지지는 않는다: 없으면 '여기서도 말할 수 있다'는 사실까지 사라진다. */
.rmg-ask.tuck { width: fit-content; margin-right: var(--sp-4); margin-left: auto; cursor: text;
  padding: var(--sp-1) 12px; background: color-mix(in srgb, var(--surface) 62%, transparent);
  box-shadow: 0 6px 18px -16px rgba(0,0,0,0.5); }
.rmg-ask.tuck input { width: 0; padding: 0; opacity: 0; pointer-events: none; }
.rmg-ask.tuck .rmg-ask-send { display: none; }
/* 접혔을 때는 표식과 ⌘K 사이만 붙인다 */
.rmg-ask.tuck { gap: 8px; }
.rmg-ask.tuck:hover { background: color-mix(in srgb, var(--surface) 86%, transparent);
  border-color: color-mix(in srgb, var(--ink) 16%, var(--hair)); }
@media (prefers-reduced-motion: reduce) { .rmg-ask { transition: none; } }
/* 손이 닿으면 표면만 한 겹 올라온다 — 테두리를 굵히지 않는다. */
.rmg-ask:hover:not(.tuck) { background: var(--ask-surface);
  box-shadow: 0 22px 52px -32px rgba(0,0,0,0.55), 0 2px 6px -4px rgba(0,0,0,0.1); }
.rmg-ask.focus { border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: var(--ask-surface);
  box-shadow: 0 24px 56px -30px rgba(0,0,0,0.55), 0 0 0 4px var(--glow); }
.rmg-ask-door { display: grid; place-items: center; width: 22px; flex-shrink: 0; opacity: 0.75; }
.rmg-ask-doormark { width: 18px; height: 23px; }
/* 적는 자리는 넉넉하게. 글자를 한 눈금 키워 '메모 칸'이 아니라 '말을 건네는 자리'로 읽히게. */
.rmg-ask-input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; padding: 2px 0; font-family: inherit; font-size: 1.08rem; font-weight: 400; letter-spacing: -0.012em; line-height: 1.5; color: var(--ink); caret-color: var(--accent); }
/* placeholder 는 권유일 뿐 강조가 아니다 — 잉크보다 확실히 물러나 있게. */
.rmg-ask-input::placeholder { color: color-mix(in srgb, var(--ink) 38%, transparent); font-weight: 400; opacity: 1; }
/* ⌘K — 보조 표식. 테두리를 걷고 글자 하나로만 남긴다(작은 상자가 하나 더 늘지 않게). */
.rmg-ask-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: color-mix(in srgb, var(--ink) 28%, transparent); padding: 0 2px; flex-shrink: 0; }
/* 손가락만 있는 기기 — 키캡은 지킬 수 없는 약속이다. 누를 키가 없다.
   펼쳐진 바에서는 그냥 감춘다(placeholder 가 이미 무엇을 하는 자리인지 말한다).
   접힌 알약에서는 낱말이 대신 선다 — 감추기만 하면 빈 알약이 떠 있게 된다.
   (달력의 '찾기' 는 키캡이 아니라 낱말이라 여기서 건드리지 않는다 — 감추면 그냥 사라진다.) */
/* 터치 기기에서만 보이는 안내문이다 — 마우스 달린 데스크톱에서 돌린 §18 의 검사는
   이 글자를 그린 적이 없다. 폰에서 캡처바가 무엇인지 말하는 유일한 낱말이다. */
.rmg-ask-tap { display: none; font-size: 12px; font-weight: 500; letter-spacing: -0.01em; color: var(--muted); flex-shrink: 0; white-space: nowrap; }
@media (hover: none) and (pointer: coarse) {
  .rmg-ask-kbd { display: none; }
  .rmg-ask-tap { display: inline; }
}
/* 보내는 손잡이. 32px 는 커서에게는 넉넉하지만 손끝(~44)에는 모자란다.
   그렇다고 알약 안에서 이것만 키우면 균형이 깨진다 — 보이는 크기는 그대로 두고
   닿는 과녁만 넓힌다(32 + 6*2 = 44). 눈에는 안 보이고 손에만 있다. */
.rmg-ask-send { position: relative; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 10px; background: var(--accent); color: #141210; cursor: pointer; flex-shrink: 0; transition: transform 0.15s cubic-bezier(0.22,1,0.36,1); }
.rmg-ask-send::after { content: ""; position: absolute; inset: -6px; border-radius: 14px; }
.rmg-ask-send:hover { transform: translateY(-1px); }
.rmg-ask-send:active { transform: scale(0.95); }
.rmg-ask-send:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }

/* REVIEW · 영수증 (무엇 + 어디 + 열기/되돌리기) */
/* 타임라인 — 시간(좌) · 커넥터 · 동작 설명 · 액션(우) */

/* facet 리스트 + 컨텍스트 AI */

/* 공통 · AI 귀속 태그 */

/* Calendar 뷰 · 월(月) → 일(日) */
/* 달(月) ↔ 하루(시간표) 전환은 툭 갈아끼우지 않고 한 호흡으로 떠오른다. */
.rmg-cv { display: flex; flex-direction: column; gap: var(--sp-3); animation: rmg-cv-in 0.26s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-cv-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-cv { animation: none; } }
/* 달력 ‖ 24시간 원 — 링은 296px 고정, 남는 폭은 달력이 가진다.
   좁아지면 링이 아래로 내려가되 두 요소의 좌우 기준선은 그대로 유지된다. */
/* 달력 약 62% ‖ 24시간 원 약 38% — 작업면의 가로를 끝까지 쓴다. */
.rmg-cv-split { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr); gap: var(--ring-gap); align-items: start; }
/* 오른쪽 컬럼의 라벨은 왼쪽 '연·월' 헤더와 같은 높이의 칸을 차지한다 →
   두 라벨의 세로 중심이 맞고, 그 아래 요일 행과 링 상단도 같은 선에서 시작한다. */
.rmg-cv-col > .rmg-cv-eyebrow { display: flex; align-items: center; min-height: 30px; }
@media (max-width: 1000px) { .rmg-cv-split { grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); } }
/* 오른쪽 칸(일정 상세)이 열리면 본문 칸이 화면과 무관하게 좁아진다 — 1280px 화면에서
   645px 까지 내려가 달력이 286px 로 눌렸다. 기준은 화면이 아니라 이 칸의 폭이다.
   840px 은 위 뷰포트 규칙(1000px)이 뜻하던 것과 같은 폭이다 — 그때의 작업면이 840px 였다. */
@container pagemain (max-width: 840px) {
  .rmg-cv-split { grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); }
}
.rmg-cv-col { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
/* 지금 무엇을 보고 있는지 말하는 줄 — 작고 대문자라 더 읽기 어렵다. --faint 로는 부족하다. */
.rmg-cv-eyebrow { margin: 0; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
/* 일(日) 화면 — 달력 컬럼과 같은 폭을 쓴다. 월↔일을 오갈 때 좌우 기준선과 무게가 그대로다. */
/* 시간표 머리 — 본문과 같은 폭을 쓴다(880px 에 묶여 있어 표만 넓어지면 어깨가 어긋난다). */
.rmg-cv-head { max-width: min(1280px, 100%); display: flex; align-items: center; gap: var(--sp-2); }
.rmg-cv-daynav { flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--sp-1); }
.rmg-cv-daynav .rmg-tl-nav { width: 28px; height: 28px; font-size: 1.1rem; }
.rmg-cv-todaytag { margin-left: var(--sp-1); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--faint); vertical-align: 0.25em; }
.rmg-cv-back { display: inline-flex; align-items: center; gap: var(--sp-1); flex: 0 0 auto; height: 40px; padding: 0 var(--sp-2); border-radius: var(--r); border: 1px solid var(--hair); background: var(--surface); color: var(--muted); font: inherit; font-size: 0.84rem; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.rmg-cv-back:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-cv-title { margin: 0; font-weight: 300; font-size: 1.3rem; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; }
.rmg-cv-spacer { flex: 0 0 auto; width: 40px; }
/* 공유 상태는 색이 아니라 숫자 하나로 — 목록의 리듬을 깨지 않는다. */

/* 오른쪽 컬럼 머리 — 선택한 날짜 라벨 + 시간표 진입(명시적 액션) */
/* 오른쪽 컬럼이 넓어져도 라벨·원·범례는 한 폭(--dial-w)으로 묶여 컬럼 가운데에 선다. */
.rmg-cv-ringhead { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); min-height: 30px; width: 100%; max-width: var(--dial-w); margin: 0 auto; }
.rmg-cv-ringhead .rmg-cv-eyebrow { min-height: 0; }

/* 생활계획표 · 24시간 원 */
.rmg-dial { display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-2); width: 100%; max-width: var(--dial-w); margin: 0 auto; }
.rmg-dial-stage { position: relative; align-self: center; width: 100%; }
.rmg-dial-svg { display: block; width: 100%; overflow: visible; }
/* ── 24시간 타임라인 ──
   시선이 '시간축 → 일정 → 지금' 순으로 가도록 농도를 계단으로 둔다. */
.rmg-dial-ring { fill: none; stroke: color-mix(in srgb, var(--ink) 12%, var(--hair)); stroke-width: 1; }
/* 중앙 — 점 하나. 하루의 한가운데를 짚는 기준점일 뿐, 바늘이 꽂히는 축이 아니다. */
.rmg-dial-center { fill: color-mix(in srgb, var(--ink) 26%, transparent); }
/* 부채꼴 — 하루라는 면에서 이 일정이 차지한 몫. 아주 옅게만 둔다:
   진해지는 순간 화면이 차트가 되고, 겹친 일정끼리 서로를 가린다.
   여럿일 때는 굵기나 반지름이 아니라 색(h0~h3)으로 갈린다. */
.rmg-dial-wedge { --c0: 38 22% 58%; --c1: 205 16% 56%; --c2: 145 14% 52%; --c3: 18 24% 57%; --h: var(--c0);
  fill: hsl(var(--h) / 0.10); stroke: none; cursor: pointer;
  transition: fill 180ms ease-out, opacity 180ms ease-out; }
.rmg-dial-wedge.h1 { --h: var(--c1); }
.rmg-dial-wedge.h2 { --h: var(--c2); }
.rmg-dial-wedge.h3 { --h: var(--c3); }
.rmg-dial-wedge:hover { fill: hsl(var(--h) / 0.16); }
.rmg-dial-wedge.on { fill: hsl(var(--h) / 0.20); }
.rmg-dial-wedge.dim { opacity: 0.45; }
@media (prefers-reduced-motion: reduce) { .rmg-dial-wedge { transition: none; } }
/* 시각축 위의 시작·끝 표식 — 정시 눈금보다 또렷하되 arc 보다는 물러난다. */
.rmg-dial-edge { stroke: color-mix(in srgb, var(--ink) 28%, transparent); stroke-width: 1;
  transition: stroke 180ms ease-out, opacity 180ms ease-out; }
.rmg-dial-edge.on { stroke: color-mix(in srgb, var(--ink) 62%, transparent); stroke-width: 1.2; }
.rmg-dial-edge.dim { opacity: 0.35; }
@media (prefers-reduced-motion: reduce) { .rmg-dial-edge { transition: none; } }
/* 눈금은 읽히되 앞에 나서지 않는다 — 일정보다 진하면 배경이 정보를 이긴다. */
/* 눈금 — 있는지 없는지 모를 만큼 얇고 낮은 대비로. 주요 시간축만 조금 더 또렷하다. */
.rmg-dial-tick { stroke: color-mix(in srgb, var(--ink) 7%, transparent); stroke-width: 0.7; }
.rmg-dial-tick.major { stroke: color-mix(in srgb, var(--ink) 16%, var(--hair)); stroke-width: 1; }
.rmg-dial-num { fill: var(--faint); font-size: 9px; font-weight: 500; text-anchor: middle; dominant-baseline: middle; font-variant-numeric: tabular-nums; }

/* 일정 — 면적을 잘라내는 wedge 가 아니라 곡률을 따라가는 얇은 띠.
   저채도 네 가지를 돌려 쓴다(강한 색은 이 화면에 들이지 않는다). */
.rmg-dial-arc {
  --c0: 38 22% 58%;   /* amber  */
  --c1: 205 16% 56%;  /* blue   */
  --c2: 145 14% 52%;  /* sage   */
  --c3: 18 24% 57%;   /* terracotta */
  --h: var(--c0);
  /* 띠는 얇게 두되 농도는 읽히는 만큼 준다 — 0.42 에서는 옅은 배경 위에서
     '일정이 있다' 는 사실 자체가 잘 안 보였다. 굵기 대신 농도로 존재를 말한다. */
  fill: none; stroke: hsl(var(--h) / 0.62); stroke-linecap: round; cursor: pointer;
  transition: stroke 180ms ease-out, opacity 180ms ease-out;
}
/* 일정이 들어올 때만 한 번 — 사라질 때는 붙잡아 둘 곳이 없어 즉시 걷힌다. */
.rmg-dial-ev { animation: rmg-dial-ev-in 420ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-dial-ev-in { from { opacity: 0; } to { opacity: 1; } }
.rmg-dial-arc.h1 { --h: var(--c1); }
.rmg-dial-arc.h2 { --h: var(--c2); }
.rmg-dial-arc.h3 { --h: var(--c3); }
.rmg-dial-arc:hover { stroke: hsl(var(--h) / 0.68); }
.rmg-dial-arc.on { stroke: hsl(var(--h) / 0.82); }
/* 하나를 붙잡으면 나머지는 물러난다 — 지워지지는 않게. */
.rmg-dial-arc.dim { opacity: 0.4; }
/* 지금 지나는 중인 일정만 한 단계 진하게. glow 는 쓰지 않는다. */
.rmg-dial-arc.current { stroke: hsl(var(--h) / 0.6); }
.rmg-dial-arc.pending { stroke: hsl(var(--h) / 0.24); stroke-dasharray: 4 3; }
/* 끝 시각이 없는 건 — 없는 길이를 그리지 않고 점 하나로만 */
.rmg-dial-arc.point { fill: hsl(var(--h) / 0.6); stroke: var(--paper); stroke-width: 1; }
/* 시작·끝 표식 — 붙잡았을 때만 */
.rmg-dial-handle { fill: var(--paper); stroke: color-mix(in srgb, var(--ink) 45%, transparent); stroke-width: 1.2; }
/* 종일 — 시간대가 없으니 바깥을 한 바퀴 두른다. */
.rmg-dial-allday { fill: none; stroke: color-mix(in srgb, var(--accent) 38%, transparent); stroke-width: 2; cursor: pointer; transition: stroke 0.2s; }
.rmg-dial-allday:hover, .rmg-dial-allday.on { stroke: color-mix(in srgb, var(--accent) 70%, transparent); }
/* 지금 — 가장 또렷하되 가장 얇게. 일정 위를 지날 때 색을 덮지 않는다.
   축에서 나오는 안쪽 절반은 더 옅게 둔다: 바늘이 중심에 매여 있다는 것만 말하고,
   읽는 눈은 바깥 끝(지금 시각)에 남는다. */
/* 지금 — 축을 가로지르는 아주 얇은 한 줄. 굵어지면 그것만 보인다. */
.rmg-dial-now { stroke: color-mix(in srgb, var(--ink) 48%, transparent); stroke-width: 1; stroke-linecap: round; }
/* 중심으로 이어지는 안쪽 — 있는지 없는지 모를 만큼만. 이어져 있다는 사실만 남기고,
   읽는 눈은 바깥 끝(지금 시각)에 머문다. 진해지면 그 순간 시계 바늘이 된다. */
.rmg-dial-now-in { stroke: color-mix(in srgb, var(--ink) 12%, transparent); stroke-width: 1; }
/* 30초마다 갱신돼도 툭 옮겨지지 않게 — 그 사이를 회전으로 메운다. */
.rmg-dial-hand { transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .rmg-dial-hand { transition: none; }
  .rmg-dial-ev { animation: none; }
}
.rmg-dial-empty { margin: 0; font-size: 0.86rem; color: var(--faint); }

/* 툴팁 — 구간 한가운데에 붙는 한 줄. 클릭하면 붙잡힌다(popover). */
.rmg-dial-tip { position: absolute; z-index: 3; transform: translate(-50%, -50%); pointer-events: none;
  display: flex; flex-direction: column; gap: 2px; white-space: nowrap;
  padding: 6px var(--sp-1); border: 1px solid var(--hair); border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px -12px rgba(0,0,0,0.5); animation: rmg-fade 0.14s ease both; }
.rmg-dial-tip.pinned { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-dial-tip-t { font-size: 0.8rem; font-weight: 500; color: var(--ink); }
.rmg-dial-tip-r { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-dial-key { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-dial-keyrow { display: flex; align-items: baseline; gap: var(--sp-1); width: 100%; text-align: left;
  border: 0; background: none; font: inherit; cursor: pointer; border-radius: var(--r-sm);
  padding: 2px 4px; margin: 0 -4px; transition: background 0.15s; }
.rmg-dial-keyrow:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 1px; }
.rmg-dial-keyrow:hover, .rmg-dial-keyrow.on { background: color-mix(in srgb, var(--ink) 5%, transparent); }
/* 목록 표식 — 원의 띠와 같은 색·같은 모양(짧은 호처럼 둥근 막대). */
.rmg-dial-chip { --c0: 38 22% 58%; --c1: 205 16% 56%; --c2: 145 14% 52%; --c3: 18 24% 57%; --h: var(--c0);
  flex: 0 0 auto; width: 4px; height: 14px; border-radius: 999px; background: hsl(var(--h) / 0.55); border: 0; }
.rmg-dial-chip.h1 { --h: var(--c1); }
.rmg-dial-chip.h2 { --h: var(--c2); }
.rmg-dial-chip.h3 { --h: var(--c3); }
.rmg-dial-keyrow.on .rmg-dial-chip { background: hsl(var(--h) / 0.85); }
.rmg-dial-chip.pending { border-style: dashed; }
.rmg-dial-chip.allday { border-radius: 50%; background: none; border-width: 2px; }
.rmg-dial-keytime { font-variant-numeric: tabular-nums; font-size: 0.78rem; color: var(--muted); min-width: 3.4em; }
.rmg-dial-keytitle { font-size: 0.86rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── 타임테이블 — 왼쪽 시간축(Time Gutter) ‖ 오른쪽 일정판(Event Canvas) ──
   좌표는 timeToPosition() 하나에서 나온다. 어떤 카드도 top/height 를 손으로 갖지 않는다. */
/* 시간표는 이 화면의 주인공이다 — 작업면을 그대로 쓴다.
   예전엔 880px 에 묶여 있어 오른쪽에 빈 벌판이 남았다. 다만 끝까지 늘리지는 않는다:
   1280px 을 넘어가면 한 시간의 가로 폭이 의미 없이 길어지고 눈이 멀리 간다. */
.rmg-tt { --tt-gutter: 72px; position: relative; width: 100%; max-width: min(1280px, 100%); }
@media (max-width: 720px) { .rmg-tt { --tt-gutter: 52px; } }
/* 시간표만 스크롤한다 — 페이지 제목·레일·캡처바는 제자리에 머문다. */
/* 스크롤은 있되 보이지 않는다 — 막대가 UI 의 한 요소처럼 서 있으면 시간표가 상자에 갇힌 것처럼 읽힌다. */
/* 최소 높이가 최대 높이를 넘지 않게 — 낮은 화면(640px 미만)에서는 380px 이 상한을 이겨
   시간표가 캡처바 밑으로 흘러넘쳤다. 낮으면 낮은 대로 남는 만큼만 쓴다. */
/* 하루는 위아래로 흘러간다 — 막대가 아니라 흐름으로 보여 준다.
   막대를 지우고 위·아래 가장자리를 옅게 흐린다. 내용이 '끝난' 것이 아니라 '이어지는'
   것으로 읽히고, 하루의 끝에서 한 번 더 굴리면 실제로 다음 날로 이어진다(DayViews onWheel).
   위쪽 여백은 00:00 을 위한 자리다 — 시각 글자가 선 위에 반쯤 걸터앉는데(-0.5em),
   맨 위 눈금에는 걸터앉을 위가 없어 글자가 잘려 나갔다. */
.rmg-tt-scroll { max-height: calc(100dvh - 260px); min-height: min(380px, calc(100dvh - 260px));
  overflow-y: auto; overscroll-behavior: contain; padding-top: 0.62em;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%); }
.rmg-tt-scroll::-webkit-scrollbar { width: 0; height: 0; }
.rmg-tt-grid { position: relative; }
/* 시각은 시간축 안에 오른쪽 정렬 — 선 위에 걸터앉되 겹치지 않게 살짝 올려 둔다. */
/* 시각은 읽으라고 있는 글자다 — 선보다 또렷해야 한다(예전엔 둘 다 흐려 어느 쪽도 안 읽혔다). */
.rmg-tt-label { position: absolute; left: 0; width: calc(var(--tt-gutter) - 14px); transform: translateY(-0.5em); text-align: right;
  font-size: 0.8rem; font-weight: 450; font-variant-numeric: tabular-nums; color: var(--muted); user-select: none; pointer-events: none; }
/* 정오·자정은 하루의 마디 — 한 눈금만 더 또렷하게 */
.rmg-tt-label.mark { color: var(--ink); font-weight: 500; }
/* 격자선 — 아주 낮은 대비. 30분 선은 한 단계 더 옅게. */
/* 선은 시각보다 약하게 — 격자가 내용을 압도하면 표가 아니라 창살이 된다. */
.rmg-tt-line { position: absolute; left: var(--tt-gutter); right: 0; height: 1px;
  background: color-mix(in srgb, var(--hair) 72%, transparent); pointer-events: none; }
.rmg-tt-line.half { background: color-mix(in srgb, var(--hair) 32%, transparent); }
/* 시간축과 일정판을 가르는 세로 헤어라인 — 두 영역이 다른 일을 한다는 표시. */
.rmg-tt-canvas { position: absolute; left: var(--tt-gutter); top: 0; right: 0; bottom: 0; border-left: 1px solid var(--hair); }
.rmg-tt-slot { position: absolute; left: 0; right: 0; cursor: pointer; transition: background 150ms ease-out; }
.rmg-tt-slot:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.rmg-tt-input { width: calc(100% - var(--sp-2)); margin: 6px var(--sp-1) 0; border: 0; background: none; font: inherit; font-size: 0.86rem; color: var(--ink); outline: none; padding: 2px 0; border-bottom: 1px solid var(--accent); }
.rmg-tt-input::placeholder { color: var(--faint); }
/* 일정 카드 — 카드가 아니라 '시간이 차지한 자리'. 얇은 테두리와 옅은 면만. */
/* 겹치지 않는 일정이라고 판을 가로로 다 차지하지는 않는다 — 읽히는 폭에서 멈춘다. */
/* 일정은 자기 칸의 폭을 그대로 쓴다 — 480px 로 묶어 두면 넓힌 시간표에서 홀로 좁아진다. */
.rmg-tt-block { position: absolute; margin-left: 6px; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 3px 8px; border-radius: var(--r-sm); overflow: hidden; text-align: left; font: inherit; cursor: pointer;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  transition: background 170ms ease-out, border-color 170ms ease-out; }
.rmg-tt-block:hover { background: color-mix(in srgb, var(--accent) 24%, transparent); border-color: color-mix(in srgb, var(--accent) 52%, transparent); }
.rmg-tt-block.pending { background: color-mix(in srgb, var(--accent) 8%, transparent); border-style: dashed; }
.rmg-tt-block-title { font-size: 0.82rem; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.rmg-tt-block-meta { font-size: 0.7rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 낮은 카드는 제목 한 줄만 — 두 줄을 우겨넣으면 글자가 잘린다. */
.rmg-tt-block.tight { justify-content: center; padding: 0 8px; }
.rmg-tt-block.tight .rmg-tt-block-meta { display: none; }
/* 지금 — 빨간 줄이 아니라 잉크색 실선 한 줄. */
.rmg-tt-now { position: absolute; left: 0; right: 0; height: 1px; background: color-mix(in srgb, var(--ink) 55%, transparent); pointer-events: none; z-index: 2; }
.rmg-tt-now-dot { position: absolute; left: -3px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--ink) 70%, transparent); }
/* 마지막 시간대가 캡처바에 잠기지 않도록 비워 두는 자리 */
.rmg-tt-safe { height: var(--flow-bottom); }
/* 좁아지면 시각 칸을 줄이고 여백을 걷는다 — 시간표가 먼저 좁아지지 않게. */
@media (max-width: 900px) {
  .rmg-tt { --tt-gutter: 52px; }
  .rmg-tt-label { font-size: 0.74rem; }
  .rmg-tt-block { margin-left: 3px; padding: 3px 6px; }
}

/* Calendar · 아젠다 */

/* Tasks · 체크리스트 */

/* People · 연락처 — 목록은 읽는 폭에서 멈춘다. 오른쪽에 남는 자리는 낭비가 아니라
   앞으로 사람의 맥락(공유 일정 등)이 들어올 숨 쉬는 공간이다. */
.rmg-ppl-list { list-style: none; margin: 0; padding: 0; max-width: var(--reading); }
.rmg-ppl { position: relative; border-bottom: 1px solid var(--hair); }
.rmg-ppl:last-child { border-bottom: 0; }
/* 사람 행 자체가 버튼 — 누르면 그 사람과 함께 있는 일정이 아래로 펼쳐진다. */
.rmg-ppl-head { display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px 8px; margin: 0 -8px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; border-radius: var(--r); transition: background 170ms ease-out; }
.rmg-ppl-head:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.rmg-ppl-head:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-ppl-av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.9rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-ppl-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.rmg-ppl-name { font-size: 1rem; font-weight: 400; color: var(--ink); letter-spacing: -0.01em; }
.rmg-ppl.on .rmg-ppl-name { font-weight: 500; }
.rmg-ppl-org { font-size: 0.8rem; font-weight: 300; color: var(--faint); }

.rmg-ppl-none { margin: 0; font-size: 0.86rem; font-weight: 300; color: var(--faint); }
.rmg-ppl-act { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font: inherit; font-size: 0.76rem; font-weight: 500; padding: 4px 11px; border-radius: 999px; cursor: pointer; flex-shrink: 0; transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-ppl-act:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-ppl-act.primary { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 18%, var(--hair)); }
/* 알약은 알약으로 남는다 — 세로로 쌓이는 칸(그룹 화면·패널 본문)에 놓이면 flex 의 기본
   stretch 가 칸 폭만큼 늘려서 '알약'이 '띠'가 된다. 그룹 화면에서는 손잡이 셋이 나란히
   전면 띠로 서 있었다: 이 화면에서 가장 크고 눈에 띄는 것이 '그룹 없애기' 였다는 뜻이다. */
.rmg-evpanel > .rmg-ppl-act, .rmg-pwith > .rmg-ppl-act { align-self: flex-start; }
/* 같은 자리에서 설명 한 줄은 손잡이 옆에 붙는 **주석**이지 '비었다'는 안내가 아니다.
   가운데로 몰리면 왼쪽에 선 버튼과 축이 어긋나 두 개가 서로 다른 것에 대해 말하는 것처럼
   읽힌다(.rmg-drawer-empty 의 기본은 텅 빈 칸 한가운데 서는 쪽이라 그렇게 되어 있다). */
.rmg-pwith > .rmg-drawer-empty, .rmg-evdel > .rmg-drawer-empty { margin: 0; text-align: left; }

/* 내 핸들 — 한 줄. 라벨·값·복사가 한 덩어리로 붙는다. 검색창 위에 놓여
   '여기는 사람을 주고받는 자리' 라는 것을 조용히 말한다. */
.rmg-mine { display: flex; align-items: baseline; gap: var(--sp-1); margin: 0 0 var(--sp-1); padding: 0 8px; }
.rmg-mine-k { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.rmg-mine-v { font-size: 0.9rem; font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.rmg-mine-copy { border: 0; background: none; font: inherit; font-size: 0.76rem; color: var(--muted);
  cursor: pointer; padding: 2px 6px; border-radius: 6px; transition: color 160ms ease-out, background 160ms ease-out; }
.rmg-mine-copy:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-mine-copy:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .rmg-mine-copy { transition: none; } }

/* ── 받은 연결 요청 ──
   탭이 아니다. 온 것이 있을 때만 연락처 위에 얹혔다가, 답하면 사라진다.
   카드로 띄우지 않고 왼쪽 선 하나로만 '여기부터는 아직 내 사람이 아니다' 를 말한다. */
.rmg-req { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-1) 0 var(--sp-2) 10px;
  border-left: 2px solid color-mix(in srgb, var(--accent) 45%, var(--hair)); }
.rmg-req-eye { margin: 0 0 4px; }
.rmg-req-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rmg-req-row { display: flex; align-items: center; gap: var(--sp-1); padding: 5px 0; }
.rmg-req-who { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.rmg-req-name { font-size: 0.94rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-req-handle { font-size: 0.76rem; font-weight: 300; color: var(--faint); }
.rmg-req-err { color: color-mix(in srgb, var(--ink) 62%, transparent); margin-bottom: var(--sp-1); }
/* 연락처 줄 오른쪽 끝의 '요청' — 줄 위에 겹쳐 서되 줄을 누르는 것을 방해하지 않는다.
   평소엔 물러나 있다가 그 줄에 손이 닿으면 또렷해진다(늘 떠 있으면 목록이 버튼밭이 된다). */
.rmg-ppl-rowact { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); z-index: 1;
  opacity: 0; transition: opacity 160ms ease-out, color 170ms ease-out, border-color 170ms ease-out; }
.rmg-ppl:hover .rmg-ppl-rowact, .rmg-ppl-rowact:focus-visible { opacity: 1; }
@media (hover: none) { .rmg-ppl-rowact { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .rmg-ppl-rowact { transition: none; } }

/* 검색 한 줄이 '그쪽이 먼저 보냈다' 를 말할 때 — 상태와 손잡이가 한 덩어리로 붙는다. */
.rmg-ppl-req { display: inline-flex; align-items: center; gap: var(--sp-1); flex-shrink: 0; }
.rmg-ppl-reqt { font-size: 0.74rem; color: var(--faint); white-space: nowrap; }

/* 사람 찾기 — 검색창처럼 보이는 상자가 아니라 목록 위에 놓인 한 줄. */
.rmg-ppl-wrap { display: flex; flex-direction: column; gap: var(--sp-2); }
.rmg-ppl-search { display: flex; align-items: center; gap: var(--sp-1); padding: 0 8px var(--sp-1); border-bottom: 1px solid var(--hair); }
.rmg-ppl-searchic { width: 15px; height: 15px; stroke-width: 1.8; color: var(--faint); flex-shrink: 0; }
.rmg-ppl-searchin { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; font-size: 0.94rem; color: var(--ink); caret-color: var(--accent); padding: 6px 0; }
.rmg-ppl-searchin::placeholder { color: var(--faint); font-weight: 300; }
.rmg-ppl-searchx { display: grid; place-items: center; width: 20px; height: 20px; border: 0; background: none; color: var(--faint); cursor: pointer; border-radius: 6px; }
.rmg-ppl-searchx:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
/* Comein 에서 찾은 사람 — 아직 내 목록에 없는 자리. 내 사람들과 한 칸 띄워 구분한다. */
.rmg-ppl-find { margin-top: var(--sp-3); padding-top: var(--sp-2); border-top: 1px solid var(--hair); }
.rmg-ppl-findeye { margin: 0 8px var(--sp-1); }
/* 이 줄은 누르는 자리가 아니라 '연결' 하나만 누르는 자리다 — 손모양을 주지 않는다. */
.rmg-ppl-findrow { cursor: default; }
.rmg-ppl-findrow:hover { background: none; }
/* 아무도 없을 때 — 큰 그림 대신 다음 한 걸음만. */
.rmg-ppl-blank { padding: var(--sp-4) 8px; }
.rmg-ppl-blank-t { margin: 0 0 6px; font-size: 0.98rem; font-weight: 500; color: var(--ink); }
.rmg-ppl-blank-b { margin: 0; font-size: 0.88rem; font-weight: 400; line-height: 1.65; color: color-mix(in srgb, var(--ink) 66%, transparent); }

/* ── AI 대화 요약 ──
   대화를 밀어내지 않는 크기로. 카드처럼 띄우지 않고 한 겹 옅은 바탕만 깔아
   '이건 사람이 한 말이 아니다' 만 구분한다. */
.rmg-drawer-chathead { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.rmg-drawer-chathead .rmg-ppl-act { font-size: 0.76rem; padding: 4px 10px; }
/* 요약 — 갈래 이름과 내용이 두 칸으로. 카드가 아니라 얇은 구획 하나. */
.rmg-sum-row { display: grid; grid-template-columns: 5.2em minmax(0, 1fr); gap: var(--sp-2); align-items: baseline; padding: 3px 0; }
.rmg-sum-k { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.02em; color: var(--faint); white-space: nowrap; }
.rmg-sum-v { font-size: 0.84rem; font-weight: 300; line-height: 1.55; color: color-mix(in srgb, var(--ink) 82%, transparent); }
.rmg-sum-again { align-self: flex-end; margin-top: 2px; border: 0; background: none; font: inherit;
  font-size: 0.7rem; color: var(--faint); cursor: pointer; padding: 2px; }
.rmg-sum-again:hover { color: var(--ink); }
.rmg-sum-again:disabled { opacity: 0.5; cursor: default; }

.rmg-sum { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-1) 10px;
  border-left: 2px solid color-mix(in srgb, var(--ink) 18%, var(--hair));
  background: color-mix(in srgb, var(--ink) 3%, transparent); border-radius: 0 var(--r-sm) var(--r-sm) 0; }

/* ── 읽지 않은 말 ──
   배지도 숫자도 두지 않는다. 여기서 필요한 건 '무언가 와 있다' 하나뿐이고,
   몇 개인지는 들어가서 알면 된다. 숫자를 매달면 목록이 알림판이 된다. */
.rmg-raildot { position: absolute; top: 9px; right: 9px; width: 5px; height: 5px; border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 78%, transparent); }
.rmg-ppl-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 78%, transparent); }
/* 읽지 않은 사람의 이름만 한 단계 또렷하게 — 색을 더 쓰지 않고 무게로 말한다. */
.rmg-ppl-name.unread { font-weight: 600; color: var(--ink); }

/* 이름 제안 — 방 머리 아래 한 줄. 카드가 아니라 권하는 말이다.
   조용히 바꾸지 않는다: 방 이름은 곧 캘린더의 일정 제목이라, 몰래 갈아 끼우면
   어제 보던 일정이 오늘 다른 이름으로 서 있게 된다. */
.rmg-rename { display: flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap;
  padding: 9px var(--sp-2); border-radius: var(--r);
  background: color-mix(in srgb, var(--ink) 3%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-rename-t { flex: 1; min-width: 0; font-size: 0.86rem; font-weight: 300; color: var(--muted); }
.rmg-rename-em { font-style: normal; font-weight: 500; color: var(--ink); }
.rmg-rename .rmg-ppl-act { font-size: 0.8rem; padding: 5px 12px; }

/* ── AI 일정 제안 ──
   대화 위에 잠깐 놓이는 한 칸. 카드처럼 띄우지 않고 이 화면의 재질로 눕힌다
   — 여기만 다른 앱에서 온 위젯처럼 보이면 '조용히 돕는다'가 깨진다. */
/* AI 일정 제안 — 대화 위에 **끼어드는** 카드다. 그래서 나타나는 방식이 곧 이 카드의 예의다.
   갑자기 자리를 차지하면 읽던 사람의 눈이 밀린다("훅 내려간다"). 짧게 열리며 들어온다.
   모션을 줄여 달라고 한 사람에게는 그냥 서 있는다. */
.rmg-prop { display: flex; flex-direction: column; gap: var(--sp-1);
  padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r);
  background: color-mix(in srgb, var(--ink) 3%, transparent);
  animation: rmg-prop-in 320ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: top; }
@keyframes rmg-prop-in {
  from { opacity: 0; transform: translateY(-6px) scaleY(0.96); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) { .rmg-prop { animation: none; } }
.rmg-prop-eye { margin: 0; }
.rmg-prop-when { margin: 0; font-size: 1.02rem; font-weight: 500; letter-spacing: -0.015em; color: var(--ink); font-variant-numeric: tabular-nums; }
.rmg-prop-why { margin: 0; font-size: 0.84rem; line-height: 1.6; color: color-mix(in srgb, var(--ink) 70%, transparent); }
.rmg-prop-people { list-style: none; margin: var(--sp-1) 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rmg-prop-p { display: flex; align-items: baseline; gap: var(--sp-1); font-size: 0.84rem; }
.rmg-prop-pname { color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* '되는가'와 '답했는가'는 다른 이야기라 색을 나눠 쓰지 않고 자리를 나눈다. */
.rmg-prop-pav { margin-left: auto; font-size: 0.78rem; color: color-mix(in srgb, var(--ink) 55%, transparent); }
.rmg-prop-pav.busy { color: color-mix(in srgb, 18 40% 46%, var(--ink) 40%); }
.rmg-prop-pav.unknown { color: var(--faint); }
.rmg-prop-pans { min-width: 2.6em; text-align: right; font-size: 0.78rem; color: var(--faint); }
.rmg-prop-pans.accepted { color: color-mix(in srgb, var(--ink) 78%, transparent); }
.rmg-prop-sum { margin: var(--sp-1) 0 0; font-size: 0.8rem; color: color-mix(in srgb, var(--ink) 62%, transparent); }
/* '누가?' — 요약 줄 끝에 붙는 낱말 하나. 버튼처럼 생기지 않는다(카드 안에 버튼이 셋이
   되면 무엇을 눌러야 할지가 흐려진다). 눌러야 할 것은 아래 동의·다른 시간 둘뿐이다. */
.rmg-prop-who { border: 0; background: none; font: inherit; font-size: 0.78rem; padding: 0 2px;
  color: var(--faint); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.rmg-prop-who:hover { color: var(--ink); }
.rmg-prop-acts { display: flex; gap: 6px; margin-top: 4px; }
.rmg-prop-acts .rmg-ppl-act { font-size: 0.84rem; padding: 6px 14px; }
/* 막힌 이유 — 붉게 소리치지 않는다. 다만 분명히 읽히게. */
.rmg-prop-err { margin: 6px 0 0; font-size: 0.8rem; line-height: 1.55;
  color: color-mix(in srgb, 18 42% 48%, var(--ink) 34%); }

/* ── 답을 기다리는 것 ──
   상대가 부르거나 시간을 내밀었는데 내가 아직 답하지 않은 자리. 배너가 아니라 한 줄이다:
   가로막지 않고, 화면 맨 위 기준선 위에 조용히 서 있다가 누르면 그 일정이 열린다. */
.rmg-await { display: flex; flex-direction: column; margin-top: var(--sp-2); }
.rmg-await-list { display: flex; flex-direction: column; gap: 1px; }
/* 접어 둔 나머지를 여는 손잡이 — 줄이 아니라 곁말이다. 줄들의 아래 선에 조용히 붙는다.
   초점·누름은 .rmg button 이 이미 맡고 있어 여기서 다시 적지 않는다. */
.rmg-await-more { align-self: flex-start; margin-top: 6px; padding: 2px 0; border: 0; background: transparent;
  font: inherit; font-size: 0.76rem; letter-spacing: 0.02em; color: var(--faint); cursor: pointer;
  transition: color 0.32s cubic-bezier(0.22,1,0.36,1); }
.rmg-await-more:hover { color: color-mix(in srgb, var(--ink) 70%, transparent); }
.rmg-await-row { display: flex; align-items: center; gap: var(--sp-1); width: 100%;
  padding: 10px var(--sp-1) 10px 0; border: 0; border-top: 1px solid var(--hair); background: transparent;
  font: inherit; font-size: 0.86rem; color: var(--ink); text-align: left; cursor: pointer;
  transition: color 0.32s cubic-bezier(0.22,1,0.36,1), transform 0.32s cubic-bezier(0.22,1,0.36,1); }
.rmg-await-row:last-child { border-bottom: 1px solid var(--hair); }
.rmg-await-row:hover { transform: translateX(2px); }
.rmg-await-row:active { transform: scale(0.995); }
.rmg-await-row:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
/* 점 하나 — 아직 답하지 않았다는 표시. 제안은 AI 가 낸 것이라 보라, 초대는 사람이 낸 것이라 잉크. */
.rmg-await-dot { flex: 0 0 auto; width: 5px; height: 5px; border-radius: 50%;
  background: color-mix(in srgb, var(--ink) 45%, transparent); }
.rmg-await-row.proposal .rmg-await-dot { background: var(--accent); }
.rmg-await-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: color-mix(in srgb, var(--ink) 82%, transparent); }
.rmg-await-go { flex: 0 0 auto; font-size: 0.76rem; letter-spacing: 0.02em; color: var(--faint);
  transition: color 0.32s cubic-bezier(0.22,1,0.36,1); }
.rmg-await-row:hover .rmg-await-text { color: var(--ink); }
.rmg-await-row:hover .rmg-await-go { color: color-mix(in srgb, var(--ink) 70%, transparent); }
/* ── 세 갈래 탭 ──
   버튼처럼 보이지 않는다. 밑줄 하나와 농도 차이만으로 지금 어디를 보는지 말한다. */
.rmg-lane { display: flex; align-items: center; gap: var(--sp-3); padding: 0 8px;
  border-bottom: 1px solid var(--hair); margin: 0 0 var(--sp-1); }
.rmg-lane-btn { position: relative; display: inline-flex; align-items: baseline; gap: 5px;
  border: 0; background: none; font: inherit; font-size: 0.84rem; font-weight: 400; color: var(--muted);
  padding: 0 0 9px; cursor: pointer; transition: color 160ms ease-out; }
.rmg-lane-btn:hover { color: var(--muted); }
.rmg-lane-btn.on { color: var(--ink); font-weight: 500; }
.rmg-lane-btn.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px;
  background: color-mix(in srgb, var(--ink) 65%, transparent); }
.rmg-lane-n { font-size: 0.7rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-lane-btn.on .rmg-lane-n { color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .rmg-lane-btn { transition: none; } }

/* 만들기 — 버튼이 아니라 한 줄의 말 */
.rmg-ppl-make { border: 0; background: none; font: inherit; font-size: 0.78rem; font-weight: 500;
  color: var(--muted); cursor: pointer; padding: 4px 2px; flex-shrink: 0; transition: color 160ms ease-out; }
.rmg-ppl-make:hover { color: var(--ink); }
.rmg-ppl-make:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; border-radius: 4px; }

/* 목록 한 줄 — 이름 위, 부연 아래. 갈래에 따라 아래가 소속이 되기도 마지막 말이 되기도 한다. */
.rmg-ppl-top { display: flex; align-items: baseline; gap: var(--sp-1); min-width: 0; }
.rmg-ppl-top .rmg-ppl-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-ppl-at { font-size: 0.7rem; color: var(--faint); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.rmg-ppl-bottom { display: flex; align-items: center; gap: var(--sp-1); min-width: 0; margin-top: 2px; }
.rmg-ppl-prev { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 0.8rem; font-weight: 300; color: var(--muted); }
.rmg-ppl-prev.faint { color: var(--muted); }
.rmg-ppl-av.grp { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-ppl-avic { width: 15px; height: 15px; stroke-width: 1.7; color: var(--muted); }

/* 함께하는 일정 수 — 이 사람과 나의 접점. 숫자 하나면 충분하다. */
.rmg-ppl-n { margin-left: auto; font-size: 0.74rem; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
/* 고른 사람 — 레일과 같은 언어(뉴트럴 면 + 좌측 3px). 목록이 출렁이지 않는다. */
.rmg-ppl.on .rmg-ppl-head { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-ppl.on .rmg-ppl-head::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
.rmg-ppl-head { position: relative; }

/* ── 사람 패널 — 요약 · 대화 · 함께하는 일정 ──
   카드도 배경도 없다. 머리 한 줄, 머리카락 같은 선 하나, 그리고 글줄. */
/* 머리·구분선·본문이 같은 폭 위에 선다 — 칸 끝까지 늘어나면 한 덩어리로 읽히지 않는다. */
.rmg-ppanel { gap: var(--sp-2); max-width: 720px; }
/* 돌아가는 길은 왼쪽 끝에 — button 의 기본 가운데 정렬 때문에 한복판으로 밀려난다. */
.rmg-ppanel > .rmg-evback { align-self: flex-start; }
/* 요약은 대화창이 아니다.
   대화창은 입력칸을 아래에 붙여 두려고 높이를 화면에 묶고 안쪽이 스크롤되는데,
   그 틀이 요약에도 걸리면 네 줄짜리 글이 갑갑한 상자 안에서 스크롤된다
   (짧은 화면에서 187px 안에 갇혀 있었다. 아래는 텅 비어 있는데도).
   요약은 그냥 흐르게 두고, 넘치면 화면이 스크롤하면 된다. */
/* 목록으로 돌아가는 길은 목록이 접혔을 때만 필요하다 — 넓은 화면에서는 왼쪽에 그대로 있다. */
.rmg-backlist { display: none; }
@media (max-width: 880px) { .rmg-backlist { display: inline-flex; } }
/* 아무도 고르지 않았을 때 — 표식 하나와 한 줄이 칸 한가운데 선다. */
.rmg-pnone { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--sp-2); min-height: min(52vh, 460px); padding: var(--sp-4) var(--sp-2); text-align: center; }
.rmg-pnone-mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--hair); color: var(--faint); }
.rmg-pnone-ic { width: 18px; height: 18px; stroke-width: 1.4; }
.rmg-pnone-t { margin: 0; font-size: 0.9rem; font-weight: 300; letter-spacing: -0.01em; color: var(--muted); }

/* 머리 — 얼굴·이름·핸들, 오른쪽 끝에 아주 작은 더보기 */
.rmg-phead { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.rmg-phead-av { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--muted);
  font-size: 0.86rem; font-weight: 500; }
.rmg-phead-id { display: flex; flex-direction: column; min-width: 0; }
.rmg-phead-name { font-size: 1.06rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-phead-handle { margin-top: 1px; font-size: 0.78rem; font-weight: 300; color: var(--faint); }
.rmg-phead-more { position: relative; margin-left: auto; flex-shrink: 0; }
.rmg-phead-morebtn { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: var(--r-sm);
  background: none; color: var(--faint); cursor: pointer; transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-phead-morebtn:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-phead-moreic { width: 15px; height: 15px; stroke-width: 1.6; }
.rmg-phead-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 5; display: flex; flex-direction: column;
  min-width: 148px; padding: 4px; border: 1px solid var(--hair); border-radius: var(--r);
  background: var(--surface); box-shadow: 0 6px 20px rgba(0,0,0,0.07); }
.rmg-phead-menu button { border: 0; background: none; font: inherit; font-size: 0.84rem; color: var(--muted);
  text-align: left; padding: 7px 10px; border-radius: var(--r-sm); cursor: pointer; transition: color 150ms ease-out, background 150ms ease-out; }
.rmg-phead-menu button:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent); }
/* 구분선 하나 — 머리와 몸을 가르는 유일한 선이다. */
.rmg-phair { height: 1px; background: var(--hair); margin: var(--sp-1) 0 var(--sp-2); }

/* 요약 — 네 갈래를 글줄로만. 없는 것은 흐린 한 줄로 말하고 지나간다. */

/* 유일한 CTA — 작고 조용하게. 면을 채우지 않고 선 하나로만 선다. */
.rmg-pov-cta { align-self: flex-start; margin-top: var(--sp-1); padding: 7px 16px; border: 1px solid var(--hair);
  border-radius: 999px; background: none; font: inherit; font-size: 0.84rem; color: var(--muted); cursor: pointer;
  transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-pov-cta:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 24%, var(--hair)); }

/* 대화에서 건져 올린 시간 — 말과 입력칸 사이의 얇은 한 줄. 카드가 아니다. */
.rmg-pctx { display: flex; align-items: center; gap: var(--sp-1); padding: 7px 10px; margin-bottom: 6px;
  border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 55%, transparent); }
.rmg-pctx-ic { width: 14px; height: 14px; stroke-width: 1.5; color: var(--faint); flex-shrink: 0; }
.rmg-pctx-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 0.82rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-pctx-em { font-style: normal; color: var(--ink); margin-left: 6px; }
.rmg-pctx-act { border: 0; background: none; font: inherit; font-size: 0.8rem; font-weight: 500; color: var(--muted);
  padding: 2px 6px; border-radius: var(--r-sm); cursor: pointer; flex-shrink: 0; transition: color 160ms ease-out; }
.rmg-pctx-act:hover { color: var(--ink); }
.rmg-pctx-x { display: grid; place-items: center; width: 20px; height: 20px; border: 0; background: none;
  color: var(--faint); cursor: pointer; flex-shrink: 0; transition: color 160ms ease-out; }
.rmg-pctx-x:hover { color: var(--ink); }
.rmg-pctx-xic { width: 12px; height: 12px; stroke-width: 1.6; }
/* 둘만의 대화 입력칸만 완전히 둥글게 — 방(여럿)의 컴포저와 달리 여긴 한 사람에게 건네는 말이다. */
.rmg-ppanel .rmg-drawer-chat-solo .rmg-drawer-compose { border-radius: 999px; padding-left: var(--sp-3); }
/* 머리 아래 선은 rmg-phair 하나뿐이다 — 대화 칸이 제 선을 또 그으면 두 줄이 겹친다. */
.rmg-ppanel .rmg-drawer-chat { border-top: 0; padding-top: 0; }

/* 함께하는 일정 — 대화 위에 눕는 한 줄. 목록이 아니라 칩이다:
   목록으로 세우면 그것만으로 화면 절반을 먹고, 그러면 다시 탭이 필요해진다. */
.rmg-pwith { display: flex; flex-direction: column; gap: 6px; }
.rmg-pwith-k { margin: 0; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
.rmg-pwith-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.rmg-pwith-chip { display: inline-flex; align-items: baseline; gap: var(--sp-1); max-width: 100%;
  border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent);
  font: inherit; font-size: 0.82rem; color: var(--ink); padding: 5px 11px; border-radius: 999px; cursor: pointer;
  transition: border-color 170ms ease-out, background 170ms ease-out; }
.rmg-pwith-chip:hover { border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); background: color-mix(in srgb, var(--surface) 95%, transparent); }
.rmg-pwith-chip:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
/* 지난 자리는 뒤로 물러난다. 지우지 않는 이유는 지난 약속도 기록이기 때문이고,
   그렇다고 앞으로의 것과 같은 얼굴로 서 있으면 어느 쪽을 봐야 하는지 매번 읽어야 한다. */
.rmg-pwith-chip.past { border-color: color-mix(in srgb, var(--hair) 60%, transparent);
  background: none; color: var(--muted); }
.rmg-pwith-chip.past .rmg-pwith-at { color: color-mix(in srgb, var(--faint) 80%, transparent); }
.rmg-pwith-chip.past:hover { color: var(--ink); border-color: var(--hair); }
.rmg-pwith-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-pwith-at { flex-shrink: 0; font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.rmg-pwith-more, .rmg-pwith-new { border: 0; background: none; font: inherit; font-size: 0.78rem; color: var(--faint);
  padding: 5px 6px; border-radius: 8px; cursor: pointer; flex-shrink: 0; transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-pwith-more:hover, .rmg-pwith-new:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
/* 아직 아무 자리도 없을 때 — 빈 목록 대신 권하는 한 줄. */
.rmg-pwith-empty { align-self: flex-start; border: 1px dashed var(--hair); background: none; font: inherit;
  font-size: 0.82rem; color: var(--muted); padding: 6px 12px; border-radius: 999px; cursor: pointer;
  transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-pwith-empty:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
@media (prefers-reduced-motion: reduce) { .rmg-pwith-chip, .rmg-pwith-more, .rmg-pwith-new, .rmg-pwith-empty { transition: none; } }

/* 펼쳐 둔 자리 — 칩은 '눌린 채로' 남아 있어야 아래 칸이 어디서 나왔는지 읽힌다. */
.rmg-pwith-chip.on { border-color: color-mix(in srgb, var(--ink) 30%, var(--hair));
  background: color-mix(in srgb, var(--surface) 98%, transparent); color: var(--ink); }
.rmg-pwith-chip.on.past { color: var(--ink); }

/* 대화 위에 얹히는 자리 한 칸.
   카드가 아니라 **한 칸**이다 — 그림자도 큰 모서리도 두지 않는다. 대화와 같은 평면 위에
   얹혀 있어야 '다른 화면으로 넘어온 것' 이 아니라 '이 대화에 딸린 것' 으로 읽힌다(§6). */
.rmg-pev { display: flex; flex-direction: column; gap: var(--sp-1);
  margin-top: var(--sp-1); padding: var(--sp-2);
  border: 1px solid var(--hair); border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  animation: rmg-prop-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .rmg-pev { animation: none; } }
.rmg-pev-head { display: flex; align-items: flex-start; gap: var(--sp-1); }
.rmg-pev-when { flex: 1; min-width: 0; margin: 0; font-size: 0.88rem; color: var(--ink); }
.rmg-pev-who { margin: 0; font-size: 0.8rem; color: var(--muted); }
/* 접기 — 칩을 다시 눌러도 접히지만, 칸 안에서 눈에 보이는 길이 하나 있어야 한다. */
.rmg-pev-x { flex-shrink: 0; border: 0; background: none; color: var(--faint); padding: 2px;
  border-radius: 6px; cursor: pointer; line-height: 0; transition: color 160ms ease-out, background 160ms ease-out; }
.rmg-pev-x:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
/* 그 방으로 가는 한 줄 — 버튼처럼 생기지 않는다. 건너가는 것은 드문 일이어야 한다. */
.rmg-pev-go { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
  border: 0; background: none; font: inherit; font-size: 0.82rem; color: var(--muted);
  padding: 3px 0; cursor: pointer; transition: color 160ms ease-out; }
.rmg-pev-go:hover { color: var(--ink); }
.rmg-pev-go:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 3px; border-radius: 4px; }
.rmg-pev-goic { color: var(--faint); transition: transform 160ms ease-out; }
.rmg-pev-go:hover .rmg-pev-goic { transform: translateX(2px); }
@media (prefers-reduced-motion: reduce) { .rmg-pev-goic { transition: none; } }

/* 사람 패널 — 대화가 남는 자리를 다 갖는다(위의 칩 줄과 정리 한 겹을 뺀 나머지). */
.rmg-ppanel .rmg-drawer-chat-solo { flex: 1; min-height: 0; }
/* 사람 패널 — 둘만의 대화 / 함께하는 일정 */

/* 새 자리 만들기 — 목록 끝에 놓인 조용한 한 줄. 버튼처럼 튀지 않는다. */

.rmg-newev { display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 55%, transparent); }
.rmg-newev-title { border: 0; border-bottom: 1px solid var(--hair); background: none; outline: none; font: inherit; font-size: 0.98rem; color: var(--ink); caret-color: var(--accent); padding: 4px 0 8px; }
.rmg-newev-title::placeholder { color: var(--faint); font-weight: 300; }
.rmg-newev-when { display: flex; gap: var(--sp-1); }
.rmg-newev-in { flex: 1; min-width: 0; border: 1px solid var(--hair); border-radius: var(--r-sm); background: color-mix(in srgb, var(--surface) 70%, transparent); font: inherit; font-size: 0.84rem; color: var(--ink); padding: 6px 8px; outline: none; }
.rmg-newev-in:focus { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-newev-who { margin: 0; font-size: 0.76rem; font-weight: 300; line-height: 1.5; color: var(--faint); }
.rmg-newev-acts { display: flex; justify-content: flex-end; gap: 6px; }
/* 여러 명과 함께할 자리 만들기 */
.rmg-newroom { display: flex; flex-direction: column; gap: var(--sp-2); min-height: 0; }
.rmg-newroom-search { padding-bottom: 4px; }
.rmg-newroom-picks { display: flex; flex-wrap: wrap; gap: 6px; overflow-y: auto; max-height: 34vh; }
.rmg-newroom-chip { border: 1px solid var(--hair); background: none; color: var(--muted); font: inherit; font-size: 0.8rem; padding: 5px 12px; border-radius: 999px; cursor: pointer; transition: color 170ms ease-out, border-color 170ms ease-out, background 170ms ease-out; }
.rmg-newroom-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
/* 고른 사람 — 색이 아니라 면과 굵기로. */
.rmg-newroom-chip.on { color: var(--ink); font-weight: 600; background: color-mix(in srgb, var(--ink) 8%, transparent); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-ppl-act:disabled { opacity: 0.45; cursor: default; }
/* 어디서 들어왔는지 — 방만 덜렁 바뀌면 길을 잃는다. */
/* 돌아가는 길 — 글씨는 작아도 손이 닿는 자리는 작지 않아야 한다(24px 미만이었다). */
.rmg-evback { display: inline-flex; align-items: center; min-height: 26px; margin: 0 -6px 4px; padding: 0 6px; border: 0; background: none; font: inherit; font-size: 0.78rem; color: var(--muted); cursor: pointer; border-radius: var(--r-sm); transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-evback:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-evback:hover { color: var(--ink); }
/* 페이지 헤더는 flex column 이라 버튼이 한 줄을 다 차지한다 — 그러면 button 의 기본
   가운데 정렬 때문에 '‹ 오늘' 이 화면 한가운데로 밀려난다. 내용만큼만 폭을 준다. */
.rmg-pageback { align-self: start; font-size: 0.82rem; color: color-mix(in srgb, var(--ink) 58%, transparent); }

/* ── 일정 상세 + 대화 (Drawer) ──
   오른쪽에서 한 겹. 화면을 덮는 모달이 아니라 워크스페이스가 잠깐 넓어지는 감각. */
/* inline — 사람 탭의 남는 칸. 목록과 나란히 서고, 스크롤해도 제자리에 머문다.
   떠 있는 판이 아니므로 배경·그림자를 두지 않는다(§12 minimal shadow). */
/* 높이는 100dvh 로 잰다 — 모바일 브라우저에서 100vh 는 주소창에 가린 부분까지 세어
   패널 아래가 화면 밖으로 밀린다(바깥 틀 .rmg 도 dvh 를 쓴다). */
.rmg-evpanel { position: sticky; top: var(--flow-top); display: flex; flex-direction: column; gap: var(--sp-3);
  max-height: calc(100dvh - var(--flow-top) - var(--flow-bottom));
  padding-left: var(--sp-4); border-left: 1px solid var(--hair);
  animation: rmg-rise 200ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .rmg-evpanel { animation: none; } }
/* 아직 아무 일정도 고르지 않았을 때 — 빈 칸이 '고장'처럼 보이지 않을 만큼만. */
/* ── 대화 ‖ 함께 보는 하루 ──
   여럿이 모인 자리에서만 둘로 나뉜다. 대화가 주인공이고 하루는 곁에 선다. */
.rmg-evsplit { display: flex; flex-direction: column; flex: 1; min-height: 0; }
/* 대화 | 손잡이 | 일정. 가운데가 먼저 줄고, 오른쪽은 읽을 수 있는 최소 폭을 지킨다.

   행에 minmax(0, 1fr) 을 두는 이유 — 이게 없으면 암묵적 행이 auto(=max-content)라
   안의 말이 길어질수록 칸이 함께 자란다. 패널은 max-height 로 잘려 있고 overflow 는
   visible 이라, 넘친 만큼이 **아래에서 조용히 사라졌다** — 그 사라진 자리에 있던 것이
   메시지 입력칸이었다. 창이 낮으면(≈950px 이하) 일정 대화에서 말을 칠 수가 없었다.
   말 칸이 스크롤되게 하려면 그 조상 어디에도 '내용만큼 자라는 칸'이 없어야 한다. */
.rmg-evsplit[data-split="true"] { display: grid; grid-template-columns: minmax(0, 1fr) 9px var(--tl-w, 380px);
  grid-template-rows: minmax(0, 1fr); gap: 0; }
.rmg-evsplit[data-split="true"][data-tlopen="false"] { grid-template-columns: minmax(0, 1fr) auto; }
.rmg-evsplit[data-split="true"] .rmg-drawer-chat { min-width: 0; padding-right: var(--sp-2); }
/* 자리가 모자라면 이 칸이 통째로 스크롤한다 — 안의 격자를 0 에 수렴하게 눌러 버리는
   것보다 낫다. 눌린 격자는 있으나 마나이고, 사람은 그걸 '깨졌다' 로 읽는다. */
.rmg-evtl { position: relative; min-width: 0; min-height: 0; padding-left: var(--sp-4);
  display: flex; flex-direction: column; overflow-y: auto; overscroll-behavior: contain; }

/* 사이의 선 — 평소엔 선, 손이 닿으면 손잡이. */
.rmg-evgrip { position: relative; cursor: col-resize; touch-action: none; }
.rmg-evgrip::before { content: ""; position: absolute; left: 4px; top: 0; bottom: 0; width: 1px;
  background: var(--hair); transition: background 160ms ease-out; }
.rmg-evgrip:hover::before, .rmg-evgrip:focus-visible::before { background: color-mix(in srgb, var(--ink) 26%, transparent); }
.rmg-evgrip:focus-visible { outline: none; }

/* 접기 — X 가 아니라 방향을 가리키는 홑화살괄호 하나. */
.rmg-evtl-fold, .rmg-evtl-unfold { border: 0; background: none; color: var(--faint); font: inherit;
  font-size: 0.95rem; line-height: 1; cursor: pointer; padding: 3px 6px; border-radius: 6px;
  transition: color 160ms ease-out, background 160ms ease-out; }
.rmg-evtl-fold { position: absolute; right: 0; top: -2px; z-index: 2; }
.rmg-evtl-fold:hover, .rmg-evtl-unfold:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
.rmg-evtl-unfold { align-self: flex-start; margin-left: var(--sp-1); border-left: 1px solid var(--hair);
  border-radius: 0; padding-left: var(--sp-2); }

/* 대화 ‖ 하루가 나란히 설 수 있는지는 화면이 아니라 이 칸의 폭이 정한다.
   캘린더에서 일정을 열면 이 칸은 420px 로 고정된다 — 화면이 아무리 넓어도
   그 안에서 하루(최소 340px)를 옆에 세우면 대화에 30px 밖에 남지 않았다. */
/* 나란히 설 때는 이 칸의 머리를 접는다.
   '함께하는 일정 · 캡스톤 회의 · 8월 12일 14:00 · 참여자 2명' — 이 네 줄은 바로 위
   패널 머리가 이미 하고 있는 말이다. 그 자리에서는 90px 을 같은 말에 쓰고, 그만큼
   하루가 눌린다. 위아래로 쌓일 때는 머리가 멀어지므로 그때만 남긴다. */
@container evaside (min-width: 761px) {
  .rmg-tl-ctx { display: none; }
}
@container evaside (max-width: 760px) {
  .rmg-evsplit[data-split="true"] { grid-template-columns: minmax(0, 1fr); }
  .rmg-evgrip { display: none; }
  .rmg-evtl { padding-left: 0; border-top: 1px solid var(--hair); padding-top: var(--sp-2); margin-top: var(--sp-2); }
  .rmg-evsplit[data-split="true"] .rmg-drawer-chat { padding-right: 0; min-height: 220px; }
  .rmg-evsplit[data-split="true"] .rmg-drawer-msgs,
  .rmg-evsplit[data-split="true"] .rmg-msgwrap { max-height: 44vh; }
}
/* 위아래로 쌓인 뒤에는 높이의 틀도 풀어야 한다.
   이 칸은 화면 높이에 묶여 있다(대화 옆에 하루를 세워 두고 각자 자기 안에서만 스크롤하게 하려고).
   둘이 쌓이면 그 틀이 남는 높이를 나눠 갖게 되고, 짧은 화면에서는 대화 칸이 17px 까지
   짓눌려 입력칸이 아래 일정 위로 흘러넘쳤다. 쌓인 뒤에는 각자 제 높이대로 선다.
   컨테이너 쿼리는 자기 컨테이너 자신을 고칠 수 없어, 쌓이는 경우를 여기서 짚는다:
   캘린더의 오른쪽 칸은 420px, 오늘의 오른쪽 칸도 416px 라 **화면이 아무리 넓어도 언제나**
   쌓이고, 사람 화면은 1420px 아래에서 쌓인다.

   '오늘' 이 이 목록에서 빠져 있었다. 그래서 알림 줄의 '열어 보기' 로 일정을 열면 —
   그 길로만 오늘 화면에 이 패널이 선다 — 대화 칸(1fr)이 0px 로 짓눌리고, min-height 220px
   가 그 0px 밖으로 흘러 아래의 하루 위에 그대로 겹쳐 그려졌다. 화면 폭이 1420px 을 넘으면
   아래 미디어 쿼리도 비켜 가서, 넓은 화면일수록 더 확실히 겹쳤다. */
.rmg-pagebody[data-view="calendar"][data-aside="true"] .rmg-evpanel,
.rmg-pagebody[data-view="today"][data-aside="true"] .rmg-evpanel { position: static; max-height: none; }
@media (max-width: 1420px) {
  .rmg-evpanel:has(.rmg-evsplit[data-split="true"]) { position: static; max-height: none; }
}

@media (max-width: 1180px) {
  /* 이 폭에서는 오른쪽 칸 자체가 한 화면이 된다 — 어떤 패널이든 높이의 틀을 풀어 둔다. */
  .rmg-evpanel { position: static; max-height: none; }
}
@media (prefers-reduced-motion: reduce) { .rmg-evgrip::before, .rmg-evtl-fold { transition: none; } }

/* 하루는 자기 칸 안에서만 스크롤한다 — 페이지를 늘리면 대화와 하루의 바닥이 어긋난다. */
/* 이 칸이 무엇의 시간인지 — 달력 위에 한 덩어리. 카드로 감싸지 않는다. */
.rmg-tl-ctx { padding-bottom: var(--sp-2); margin-bottom: var(--sp-1); border-bottom: 1px solid var(--hair); }
.rmg-tl-ctxeye { margin: 0 0 6px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--faint); }
.rmg-tl-ctxt { margin: 0; font-size: 1rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); }
.rmg-tl-ctxm { margin: 3px 0 0; font-size: 0.8rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }

/* 칸이 넓어진 만큼 하루도 길게 — 62vh 로 눌러 두면 넓힌 의미가 없다.
   다만 **제 칸 안에서** 길어야 한다. max-height 만으로는 부족했다: 옆 칸(대화)이 정해 준
   높이보다 이 칸이 커지면 넘친 만큼이 패널 밖으로 흘러 나가고, 그 밖에 있던 것이
   범례와 '빈 칸은 모두 가능' 안내였다 — 화면을 읽는 열쇠가 화면 밖에 있었던 셈이다.
   flex 로 제 칸을 채우고, 남는 것은 아래 스크롤 상자가 흡수한다(§27.2 와 같은 종류). */
.rmg-tl { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-1); max-height: min(72vh, 760px); }
/* 위쪽 여백은 첫 눈금(07)을 위한 자리다 — 시각 글자가 선 위에 반쯤 걸터앉는데(top: -6px)
   맨 위에는 걸터앉을 위가 없어 잘려 나갔다. §26.4 에서 큰 시간표에 한 것과 같은 이유. */
/* 하루는 적어도 이만큼은 보여야 한다 — 다섯 시간치. 그 아래로 눌리면 시간표가 아니라
   띠가 되고, 시간표가 아닌 시간표는 화면에 있을 이유가 없다. */
.rmg-tl-scroll { flex: 1; min-height: 150px; overflow-y: auto; overscroll-behavior: contain; padding-top: 7px; }
.rmg-tl-scroll::-webkit-scrollbar { width: 6px; }
.rmg-tl-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ink) 14%, transparent); border-radius: 3px; }
.rmg-tl-head { display: flex; align-items: center; gap: var(--sp-1); }
.rmg-tl-day { flex: 1; margin: 0; font-size: 0.86rem; font-weight: 500; color: var(--ink); text-align: center; }
.rmg-tl-nav { width: 22px; height: 22px; display: grid; place-items: center; border: 0; background: none;
  color: var(--faint); font-size: 1rem; cursor: pointer; border-radius: 6px; }
.rmg-tl-nav:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
/* 날을 넘기는 화살표도 손끝을 받아야 한다 — 글자 크기는 그대로, 닿는 자리만 넓힌다. */
/* 손끝 크기(36 → 44)는 파일 끝의 '손끝' 블록이 한자리에서 맡는다 — 두 군데에서
   같은 것을 말하면 나중에 한쪽만 고쳐진다. */
.rmg-tl-note { margin: 0 0 2px; font-size: 0.7rem; font-weight: 300; color: var(--faint); line-height: 1.4; }

/* 하루 — 눈금 위에 세 겹이 겹친다: 가능 농도 · 내 일정 · 제안 */
.rmg-tl-grid { position: relative; margin-left: 26px; border-top: 1px solid var(--hair); }
.rmg-tl-hour { position: absolute; left: 0; right: 0; border-top: 1px solid color-mix(in srgb, var(--hair) 60%, transparent); }
.rmg-tl-hour:first-child { border-top: 0; }
/* 시각은 읽으라고 있는 글자다 — --faint 로는 아래 면 위에서 사라진다. */
.rmg-tl-hourl { position: absolute; left: -26px; top: -6px; font-size: 0.66rem; color: var(--muted);
  font-variant-numeric: tabular-nums; }
.rmg-tl-slots { position: absolute; inset: 0; }

/* 칠하는 것을 뒤집었다 — 예전에는 **가능한 사람 수**만큼 진하게 칠했다.
   그런데 가장 흔한 경우가 '모두 가능' 이라, 좋은 소식이 하루 전체를 회색으로 덮었다.
   덮인 화면에서는 시각 눈금도 내 일정도 읽히지 않았고, 무엇보다 그 회색이 '막혀 있다'
   로 읽혔다 — 뜻과 정반대다.

   이제 **모자란 쪽**을 칠한다: 못 오는 사람이 있을 때만 그만큼 흐려진다.
   다 되는 시간은 비어 있고, 사람이 찾는 것이 바로 그 빈 자리다.
   (드러나는 정보는 같다 — 못 오는 n 명 = 전체 − 가능한 n 명. 남의 일정 내용은 여전히 안 온다.) */
.rmg-tl-slot { position: absolute; left: 0; right: 0; border: 0; padding: 0; cursor: pointer;
  background: color-mix(in srgb, var(--ink) calc(var(--busy, 0) * 14%), transparent);
  transition: background 140ms ease-out, box-shadow 140ms ease-out; }
.rmg-tl-slot:hover { background: color-mix(in srgb, var(--ink) calc(var(--busy, 0) * 14% + 6%), transparent); }
/* 고른 칸 — 예전에는 15px 짜리 칸에 1px 안쪽 테두리 하나였다. 아무도 못 봤다.
   면으로 칠하고 왼쪽에 굵은 표식을 세운다. z-index 로 일정 블록 위에 올린다 —
   고른 자리가 무언가에 가려지면 '눌리지 않았다' 로 읽힌다. */
.rmg-tl-slot.on { z-index: 3;
  background: color-mix(in srgb, var(--accent) 26%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 80%, transparent),
              inset 4px 0 0 0 var(--accent); }
.rmg-tl-slot:focus-visible { z-index: 3; outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: -2px; }

/* 내 일정 — 잉크 면. 제목까지 보인다(내 것이므로).
   칸이 넓어졌으니 블록도 제 폭을 쓴다(예전엔 오른쪽 34% 를 비워 두느라 제목이 잘렸다). */
.rmg-tl-ev { position: absolute; left: 2px; right: 12%; border-radius: var(--r-sm); overflow: hidden;
  background: color-mix(in srgb, var(--ink) 78%, transparent); color: var(--bg);
  padding: 2px 7px; pointer-events: none; }
/* 이 방의 일정 자신 — 예전에는 잉크 32% 면 위에 잉크 글자였다(어두운 데 어두운 글자).
   '내 다른 일정' 과 구별은 되어야 하지만, 구별하느라 안 읽히면 아무 소용이 없다.
   그래서 면을 비우고 테두리로 말한다: 여기가 지금 이야기하는 그 자리다. */
.rmg-tl-ev.self { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 34%, transparent); }
.rmg-tl-evt { font-size: 0.62rem; line-height: 1.25; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* AI 제안 — 보라. 이 화면에서 보라는 오직 AI 가 한 일의 언어다. */
.rmg-tl-prop { position: absolute; left: 0; right: 0; border-radius: var(--r-sm); pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--accent) 62%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent); }
.rmg-tl-propl { position: absolute; right: 4px; top: 1px; font-size: 0.6rem; font-weight: 500;
  color: color-mix(in srgb, var(--accent) 88%, var(--ink)); }

.rmg-tl-pick { display: flex; align-items: center; gap: var(--sp-1); padding-top: var(--sp-1); }
.rmg-tl-pickt { flex: 1; min-width: 0; font-size: 0.76rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-tl-legend { display: flex; align-items: center; gap: 5px; margin: var(--sp-1) 0 0; font-size: 0.64rem; color: var(--faint); flex-wrap: wrap; }
.rmg-tl-key { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.rmg-tl-key:not(:first-child) { margin-left: 6px; }
.rmg-tl-key.ev { background: color-mix(in srgb, var(--ink) 78%, transparent); }
.rmg-tl-key.av { background: color-mix(in srgb, var(--ink) 14%, transparent); }
/* 빈 칸이 곧 답이라는 것 — 다섯 마디로 가르친다. 이 줄이 없으면 뒤집은 뜻이 안 읽힌다. */
.rmg-tl-open { margin: 4px 0 0; font-size: 0.68rem; color: var(--faint); }

/* 다 되는 시각 — '다른 시간' 을 눌렀을 때 사람이 정말로 알고 싶은 것. */
.rmg-tl-free { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: var(--sp-1); }
.rmg-tl-freek { font-size: 0.7rem; color: var(--faint); flex-shrink: 0; }
.rmg-tl-freeb { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent);
  font: inherit; font-size: 0.76rem; font-variant-numeric: tabular-nums; color: var(--ink);
  padding: 3px 10px; border-radius: 999px; cursor: pointer;
  transition: border-color 160ms ease-out, background 160ms ease-out; }
.rmg-tl-freeb:hover { border-color: color-mix(in srgb, var(--ink) 26%, var(--hair));
  background: color-mix(in srgb, var(--surface) 95%, transparent); }
.rmg-tl-freeb:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-tl-key.pr { background: color-mix(in srgb, var(--accent) 30%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 62%, transparent); }

@media (max-width: 1239px) { .rmg-evpanel{ padding-left: 0; border-left: 0; } }

.rmg-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2); }
.rmg-drawer-title { margin: 0; font-size: 1.24rem; font-weight: 400; letter-spacing: -0.02em; color: var(--ink); }
.rmg-drawer-time { margin: 6px 0 0; font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-drawer-eye { margin: 0 0 var(--sp-1); }
/* 결과 정리 — 카드도 색도 없다. 결론 한 줄이 조금 크고, 사실은 흐리게 받친다. */
.rmg-sum { display: flex; flex-direction: column; gap: 3px; padding: 0 0 var(--sp-2);
  border-bottom: 1px solid var(--hair); }
.rmg-sum-h { margin: 0 0 2px; font-size: 1rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); }
.rmg-sum-l { margin: 0; font-size: 0.84rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-sum-cta { margin-top: var(--sp-1); }
/* 갈래 이름표 — 시각 줄 끝에 조용히. 색을 쓰지 않는다(색은 원이 쓰고 있다). */
.rmg-drawer-cat { margin-left: var(--sp-1); padding: 2px 8px; border: 1px solid var(--hair); border-radius: 999px;
/* 중요도 — 갈래 이름표와 같은 모양을 쓴다. 새 배지를 만들지 않는다(배지가 둘이 되면
   그 순간 일정 머리가 표가 된다). 색이 아니라 **잉크의 농도**로 무게를 말한다 —
   보라는 AI 의 언어이므로 여기 쓰지 않는다(§0). */
.rmg-drawer-cat.pr-high { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 30%, var(--hair)); }
.rmg-drawer-cat.pr-low { color: var(--faint); border-style: dashed; }
  font-size: 0.7rem; font-weight: 500; color: var(--faint); white-space: nowrap; }
/* 접힌 한 줄 — 라벨 · 요약 · 갈매기. 카드도 테두리도 없다. */
.rmg-evdisc { display: flex; align-items: baseline; gap: var(--sp-2); width: 100%; padding: 6px 8px; margin: 0 -8px;
  border: 0; background: none; font: inherit; text-align: left; border-radius: var(--r-sm); cursor: pointer;
  transition: background 170ms ease-out; }
.rmg-evdisc:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-evdisc-k { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
.rmg-evdisc-v { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 0.86rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-evdisc-ic { width: 13px; height: 13px; stroke-width: 1.6; color: var(--faint); flex-shrink: 0; align-self: center;
  transition: transform 220ms cubic-bezier(0.22,1,0.36,1); }
.rmg-evdisc-ic.on { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .rmg-evdisc, .rmg-evdisc-ic { transition: none; } }
/* 늘 보이는 참여자 줄 — 얼굴만 눕힌다. 접힌 줄이 차지하던 자리를 그대로 쓴다. */
.rmg-evwho { display: flex; align-items: center; gap: var(--sp-1); padding: 6px 0; }
.rmg-evwho-faces { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; font: inherit;
  padding: 4px; margin: 0 -4px; border-radius: 999px; cursor: pointer; transition: background 170ms ease-out; }
.rmg-evwho-faces:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-evwho-faces:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
/* 겹쳐 눕히지 않는다 — 다른 제품의 얼굴 더미(face pile)는 원끼리 겹치고 테두리로 갈라내지만,
   그건 테두리가 바탕과 뚜렷이 다를 때만 성립한다. 여기 팔레트는 대비를 일부러 죽여서
   --hair 가 --surface 와 거의 같은 값이다(다크 #262019 : #1B1813 · 라이트 #E7E2D8 : #FCFBF9).
   겹치면 갈라 줄 힘이 없어 이니셜이 뭉개진 얼룩으로 읽힌다 — 양쪽 테마에서 확인했다.
   4px 씩 띄운다. 구획은 대비가 아니라 여백이 한다(§6). */
.rmg-evwho-av { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: var(--surface); border: 1px solid var(--hair); font-size: 0.72rem; font-weight: 600;
  color: var(--muted); flex-shrink: 0; }
/* 참석 여부는 색이 아니라 테두리·농도로만 말한다(§17 강한 accent 금지).
   아직 답이 없으면 테두리를 끊어 두고, 못 온다고 답했으면 옅게 — 지우지는 않는다. */
.rmg-evwho-av.invited { border-style: dashed; color: var(--faint); }
.rmg-evwho-av.declined { opacity: 0.4; }
.rmg-evwho-more { margin-left: 2px; font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.rmg-evwho-going { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.rmg-evwho-add { border: 0; background: none; font: inherit; font-size: 0.78rem; color: var(--faint);
  padding: 5px 6px; border-radius: 8px; cursor: pointer; flex-shrink: 0;
  transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-evwho-add:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
@media (prefers-reduced-motion: reduce) { .rmg-evwho-faces, .rmg-evwho-add { transition: none; } }
/* 참석 여부 — 색이 아니라 굵기·농도로만 구분한다(§17 강한 accent 금지). */
.rmg-drawer-prole.accepted { color: var(--muted); }
.rmg-drawer-prole.declined { color: var(--faint); text-decoration: line-through; }
/* 내 답을 묻는 한 줄 — 방 맨 위, 참여자 목록 앞. */
.rmg-rsvp { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-1) var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 55%, transparent); }
.rmg-rsvp-q { margin: 0; font-size: 0.84rem; font-weight: 400; color: var(--ink); }
.rmg-rsvp-acts { display: flex; gap: 6px; flex-shrink: 0; }

/* 1:1 방은 참여자 목록이 없으니 대화가 위에서부터 자리를 다 갖는다. */
.rmg-drawer-chat-solo { border-top: 0; padding-top: 0; }
.rmg-drawer-px { display: grid; place-items: center; width: 20px; height: 20px; margin-left: auto; border: 0; background: none; color: var(--faint); cursor: pointer; border-radius: 6px; transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-drawer-px:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
.rmg-drawer-pxic { width: 13px; height: 13px; stroke-width: 2; }
.rmg-drawer-add { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--sp-1); }
.rmg-drawer-addbtn { border: 1px dashed var(--hair); background: none; color: var(--muted); font: inherit; font-size: 0.78rem; padding: 5px 11px; border-radius: 999px; cursor: pointer; transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-drawer-addbtn:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
.rmg-drawer-plist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rmg-drawer-p { display: flex; align-items: center; gap: var(--sp-1); font-size: 0.88rem; color: var(--ink); }
.rmg-drawer-p.pending { color: var(--muted); }
.rmg-drawer-pav { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.72rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-drawer-pname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-drawer-prole { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
/* 대화가 남는 자리를 다 갖는다 — 참여자는 머리말, 대화가 본문이다. */
.rmg-drawer-chat { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-top: var(--sp-2); border-top: 1px solid var(--hair); }
.rmg-drawer-msgs { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-1) 0 var(--sp-2); }
.rmg-drawer-empty { margin: auto 0; font-size: 0.86rem; font-weight: 300; color: var(--faint); text-align: center; }
/* 말 칸과 그 위에 뜨는 한 점 — 점이 말을 따라 스크롤되면 안 되므로 한 겹 감싼다. */
.rmg-msgwrap { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* 최근으로 — 위를 읽는 동안에만. 대화 한가운데 아래, 마지막 줄을 살짝 덮는 높이에. */
.rmg-tolast { position: absolute; left: 50%; bottom: 6px; z-index: 3;
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 94%, transparent);
  color: var(--muted); cursor: pointer; box-shadow: 0 6px 16px -12px rgba(0,0,0,0.5);
  transform: translateX(-50%); opacity: 1;
  transition: opacity 180ms ease-out, transform 180ms cubic-bezier(0.22,1,0.36,1), color 170ms ease-out, border-color 170ms ease-out; }
.rmg-tolast[data-show="false"] { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(5px); }
.rmg-tolast:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); transform: translateX(-50%) translateY(-1px); }
.rmg-tolast:active { transform: translateX(-50%) scale(0.97); }
.rmg-tolast-ic { width: 15px; height: 15px; stroke-width: 1.6; }
@media (prefers-reduced-motion: reduce) { .rmg-tolast { transition: opacity 180ms ease-out; } }
/* 말풍선을 쓰지 않는다 — 이름 · 말 · 시각 세 줄이 조용히 쌓인다. */
/* ── 말 한 뭉치 ──
   말풍선을 만들지 않는다. 종이 위에 적힌 대화처럼, 이름 한 줄 뒤에 그 사람의 말이 이어진다.
   내 말도 오른쪽으로 보내지 않는다 — 좌우로 갈라 놓으면 그 순간 메신저가 되고,
   읽는 눈이 한 축을 잃는다. 누가 말했는지는 이름과 농도가 이미 말한다. */
.rmg-mg { display: flex; flex-direction: column; gap: 3px; }
/* 다른 사람으로 넘어가는 자리에만 숨을 넣는다(같은 사람의 연속은 이미 한 뭉치다). */
.rmg-drawer-msgs > .rmg-mg + .rmg-mg { margin-top: var(--sp-2); }
.rmg-mg-head { display: flex; align-items: baseline; gap: var(--sp-1); margin: 0; }
.rmg-mg-who { font-size: 0.78rem; font-weight: 500; letter-spacing: -0.005em; color: var(--muted); }
.rmg-mg.mine .rmg-mg-who { color: var(--ink); }
/* 내 말과 남의 말 — 말풍선을 그리지 않기로 한 화면이라(§chatTime) 구별이 이름 색 하나뿐이었고,
   같은 사람이 이어 말하면 이름조차 다시 적지 않으므로 그 단서마저 사라졌다.
   왼쪽에 1px 세로 선을 하나 세운다. 보라를 쓰지 않는다 — 이 화면에서 보라는 오직 AI 의
   언어다(§0). 잉크를 옅게 쓴 선이면 '내가 한 말' 이라는 표시로 충분하다. */
.rmg-mg { padding-left: 9px; border-left: 1px solid transparent; }
.rmg-mg.mine { border-left-color: color-mix(in srgb, var(--ink) 20%, transparent); }
/* 시각은 이름 옆에 한 번만 — 뭉치의 시작에만 적는다.
   0.68rem 에 --faint 는 '있다' 는 표시였을 뿐 읽으라고 둔 글자가 아니었다.
   말이 언제 왔는지는 대화에서 자주 되짚는 것이라, 눈에 힘을 주지 않고도 읽혀야 한다. */
.rmg-mg-at { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-mg-line { margin: 0; font-size: 0.95rem; font-weight: 300; line-height: 1.6; color: var(--ink); overflow-wrap: anywhere; }
/* 한 줄과 그 손잡이 — 손잡이는 줄 밖(오른쪽)에 서서 글을 밀지 않는다. */
.rmg-mg-row { position: relative; display: flex; align-items: flex-start; gap: var(--sp-1); }
.rmg-mg-row .rmg-mg-line { flex: 1; min-width: 0; }
.rmg-mg-edited { margin-left: 6px; font-size: 0.68rem; color: var(--faint); white-space: nowrap; }
/* 평소엔 없다. 그 줄에 손이 닿을 때만 떠오른다(150ms). */
.rmg-mg-act { position: relative; flex-shrink: 0; opacity: 0; transition: opacity 160ms ease-out; }
.rmg-mg-row:hover .rmg-mg-act, .rmg-mg-act:focus-within { opacity: 1; }
.rmg-mg-more { border: 0; background: none; color: var(--faint); font: inherit; font-size: 0.82rem; line-height: 1;
  padding: 2px 5px; border-radius: 5px; cursor: pointer; letter-spacing: 0.06em; }
.rmg-mg-more:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
.rmg-mg-menu { position: absolute; right: 0; top: 100%; z-index: 5; display: flex; flex-direction: column;
  min-width: 92px; padding: 4px; border-radius: var(--r-sm); border: 1px solid var(--hair);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: 0 8px 20px -14px rgba(0,0,0,0.45); animation: rmg-pop 140ms cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mg-menu button { border: 0; background: none; font: inherit; font-size: 0.82rem; color: var(--muted);
  text-align: left; padding: 6px 8px; border-radius: 4px; cursor: pointer; }
.rmg-mg-menu button:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
@keyframes rmg-pop { from { opacity: 0; transform: scale(0.98) translateY(-2px); } to { opacity: 1; transform: none; } }

/* 지울까요 — 그 줄 옆에서 한 번만 묻는다. 화면을 덮지 않는다. */
.rmg-mg-ask { display: inline-flex; align-items: center; gap: var(--sp-1); flex-shrink: 0; }
.rmg-mg-askq { font-size: 0.76rem; color: var(--muted); white-space: nowrap; }
.rmg-mg-del { border: 1px solid color-mix(in srgb, var(--ink) 18%, var(--hair)); background: none; font: inherit;
  font-size: 0.76rem; font-weight: 500; color: var(--ink); padding: 3px 10px; border-radius: 999px; cursor: pointer; }
.rmg-mg-del:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); }

/* 없애기 줄 — 패널의 맨 아래, 위와 선 하나로 갈라 둔다.
   물러나 있어야 하는 손잡이다: 평소엔 다른 작은 버튼들과 같은 무게로 서 있고,
   위험은 색이 아니라 **한 번 더 묻는 것**으로 말한다(빨간 버튼을 두지 않는 이유). */
.rmg-evdel { display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  padding-top: var(--sp-2); border-top: 1px solid var(--hair); }
/* 물음이 길어 한 줄에 안 들어가면 접히게 둔다 — 잘려 나가는 것보다 낫다. */
.rmg-evdel .rmg-mg-ask { flex-wrap: wrap; }
.rmg-evdel .rmg-mg-askq { white-space: normal; }

/* 인라인 수정 — 자리를 옮기지 않는다. 그 줄이 그대로 입력칸이 된다. */
.rmg-mg-edit { display: flex; flex-direction: column; gap: 6px; }
.rmg-mg-editin { width: 100%; resize: none; border: 1px solid color-mix(in srgb, var(--ink) 16%, var(--hair));
  border-radius: var(--r-sm); background: color-mix(in srgb, var(--surface) 80%, transparent);
  font: inherit; font-size: 0.95rem; font-weight: 300; line-height: 1.6; color: var(--ink);
  padding: 6px 9px; outline: none; caret-color: var(--accent); }
.rmg-mg-editacts { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-1); }
@media (prefers-reduced-motion: reduce) { .rmg-mg-act, .rmg-mg-menu { transition: none; animation: none; } }
.rmg-mg-line.pending { opacity: 0.5; }
/* 날짜가 바뀌는 자리 — 선을 긋지 않고 글자 하나로만. 다만 읽히기는 해야 한다.
   --faint 는 라이트에서 2.35:1 이라, 하루가 바뀌었다는 **유일한 표시**가 거의 보이지 않았다.
   그리고 긴 하루를 스크롤할 때는 그 표시가 위로 사라져 지금 어느 날을 읽는지 알 수 없었다 —
   그래서 붙어 있게(sticky) 두었다. 글자 뒤에 면을 한 겹 깔아 두는 이유는 그것뿐이다
   (붙어 있는 글자가 아래 말과 겹쳐 읽히면 그게 더 나쁘다). */
/* 날이 바뀌는 자리 — 낱말 하나만 떠 있으면 '어디서부터 어제인지' 가 눈에 안 잡힌다.
   양쪽으로 선을 그어 **경계**로 만든다. 점선이 아니라 직선인 이유: 점선은 이 화면에서
   '아직 정해지지 않은 것'을 뜻한다(제안 일정·초대 대기). 지나간 날은 확정된 사실이다. */
.rmg-msg-day { position: sticky; top: 0; z-index: 2;
  display: flex; align-items: center; gap: var(--sp-2);
  margin: var(--sp-3) 0 var(--sp-1); padding: 0;
  font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted); }
.rmg-msg-day::before, .rmg-msg-day::after { content: ""; flex: 1; height: 1px; background: var(--hair); }
/* 낱말은 선 위에 앉되 배경을 깔아 선이 글자를 지나가지 않게 — 스크롤로 겹쳐도 읽힌다. */
.rmg-msg-day > span { flex-shrink: 0; padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(6px); }

/* 사람 위에서 오른쪽 클릭했을 때 뜨는 작은 메뉴.
   뷰포트에 고정한다(position: fixed) — 목록 안에 두면 그 줄의 overflow 에 잘린다.
   그래서 스크롤이 나면 컴포넌트가 스스로 닫는다: 고정된 메뉴가 움직인 목록 위에 남으면
   어느 사람의 메뉴인지가 거짓말이 된다. */
.rmg-pmenu { position: fixed; z-index: 60; min-width: 208px; max-width: 280px;
  display: flex; flex-direction: column;
  border: 1px solid var(--hair); border-radius: var(--r); overflow: hidden;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 24px color-mix(in srgb, var(--ink) 10%, transparent);
  animation: rmg-prop-in 150ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .rmg-pmenu { animation: none; } }
.rmg-pmenu-row { border: 0; background: none; font: inherit; font-size: 0.84rem; color: var(--ink);
  text-align: left; padding: 9px var(--sp-2); cursor: pointer; transition: background 140ms ease-out; }
.rmg-pmenu-row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-pmenu-row + .rmg-pmenu-row { border-top: 1px solid color-mix(in srgb, var(--hair) 60%, transparent); }
.rmg-pmenu-name { display: flex; flex-direction: column; gap: 4px; padding: 9px var(--sp-2); }
.rmg-pmenu-in { border: 1px solid var(--hair); border-radius: 8px; background: color-mix(in srgb, var(--paper) 70%, transparent);
  font: inherit; font-size: 0.86rem; color: var(--ink); padding: 5px 8px; outline: none; }
.rmg-pmenu-in:focus { border-color: color-mix(in srgb, var(--ink) 24%, var(--hair)); }
/* '나만 보여요' — 이 한 줄이 없으면 아무도 이름을 안 붙인다(상대에게 보일까 봐). */
.rmg-pmenu-note { margin: 0; padding: 0 var(--sp-2) 8px; font-size: 0.72rem; color: var(--faint); line-height: 1.45; }
.rmg-pmenu-row + .rmg-pmenu-note { padding-top: 6px; }
.rmg-pmenu-ask { display: flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap;
  padding: 8px var(--sp-2); border-top: 1px solid color-mix(in srgb, var(--hair) 60%, transparent); }
.rmg-pmenu-askq { font-size: 0.78rem; color: var(--muted); }

/* 빗금 목록 — 입력칸 바로 위. 화면을 덮지 않는다: 대화가 계속 보여야
   무엇에 대고 명령하는지가 안 흐려진다. 그래서 팝업이 아니라 한 칸이다. */
.rmg-slash { display: flex; flex-direction: column; margin-bottom: 6px;
  border: 1px solid var(--hair); border-radius: var(--r); overflow: hidden;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  animation: rmg-prop-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .rmg-slash { animation: none; } }
.rmg-slash-row { display: flex; align-items: baseline; gap: var(--sp-2); text-align: left;
  border: 0; background: none; font: inherit; padding: 7px var(--sp-2); cursor: pointer;
  transition: background 140ms ease-out; }
.rmg-slash-row + .rmg-slash-row { border-top: 1px solid color-mix(in srgb, var(--hair) 60%, transparent); }
/* 고른 줄은 배경으로 말한다 — 보라는 AI 의 언어라 여기 쓰지 않는다(§0). */
.rmg-slash-row.on { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-slash-name { flex-shrink: 0; font-size: 0.84rem; font-weight: 500; color: var(--ink);
  font-variant-numeric: tabular-nums; }
.rmg-slash-hint { min-width: 0; font-size: 0.78rem; color: var(--muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 접어 둔 이전 대화 — 말 목록의 맨 위. 지운 것이 아니므로 되돌리는 길이 곧 이 줄이다.
   점선인 이유: 이 화면에서 점선은 '아직 정해지지 않은 것' 이고, 접기는 언제든 풀 수 있다. */
.rmg-cleared { align-self: center; border: 1px dashed var(--hair); background: none; font: inherit;
  font-size: 0.76rem; color: var(--faint); padding: 4px 12px; border-radius: 999px; cursor: pointer;
  transition: color 160ms ease-out, border-color 160ms ease-out; }
.rmg-cleared:hover { color: var(--muted); border-color: color-mix(in srgb, var(--ink) 20%, var(--hair)); }
@media (prefers-reduced-motion: reduce) { .rmg-cleared { transition: none; } }

/* 컴포저 — 큰 둥근 상자가 아니라 얇은 선 하나. 쓰기 시작하면 그때만 아주 미세하게 떠오른다. */
.rmg-drawer-compose { display: flex; align-items: center; gap: var(--sp-1); padding: 9px var(--sp-1) 9px var(--sp-2);
  border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 62%, transparent);
  transition: border-color 180ms ease-out, background 180ms ease-out, box-shadow 180ms ease-out; }
.rmg-drawer-compose:focus-within { border-color: color-mix(in srgb, var(--ink) 20%, var(--hair));
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 5%, transparent); }
@media (prefers-reduced-motion: reduce) { .rmg-drawer-compose { transition: none; } }
.rmg-drawer-input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; font-size: 0.94rem; color: var(--ink); caret-color: var(--accent); }
.rmg-drawer-input::placeholder { color: var(--faint); font-weight: 300; }
.rmg-drawer-compose .rmg-ask-send { width: 30px; height: 30px; }

/* Workspace Status — 우상단 세로 스택(시간 · 알림 · 문 · 상태문구). 시스템 시계가 아니라 '오늘의 상태' 공간. */
/* 시계·알림 — 본문 컬럼의 오른쪽 기준선에 맞춰 선다(캔버스 가장자리가 아니라). */

@keyframes rmg-status-fade { from { opacity: 0; } to { opacity: 1; } }

/* 헤더 중앙 — Workspace Context (탭별로 오늘의 상태 한 줄) */

@keyframes rmg-ctx-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 4px)); } to { opacity: 1; transform: translate(-50%, -50%); } }

/* 등장 */
.rmg-a1 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.04s both; }
.rmg-a2 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
.rmg-a3 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.16s both; }

@keyframes rmg-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  .rmg-a1,.rmg-a2,.rmg-a3,.rmg-thr,.rmg-thr.leaving,.rmg-phil-1,.rmg-phil-2,.rmg-thr-cta,.aidoor-svg { animation: none; }
  .rmg-flow { transition: none; }
  .rmg-flow.flow-exit { opacity: 1; transform: none; }
}

/* ────────────────────────────────────────────────────────────────
   손끝 — 커서에게 넉넉한 것이 손에게는 아니다

   §19 가 캡처 바에서 찾은 것과 같은 자리들이다. 규칙은 그때 정한 것을 그대로 쓴다:
   **보이는 크기는 건드리지 않고 닿는 과녁만 넓힌다**('::after'). 이 작은 손잡이들을
   실제로 44 로 키우면 그것이 든 줄의 높이가 함께 자라 화면이 어그러진다.

   'position: relative' 도 이 블록 안에서만 준다 — 데스크톱 규칙은 한 줄도 바뀌지 않는다.
   '.rmg-evtl-fold' 는 이미 absolute 라 그대로 두면 된다(자기 자신이 컨테이닝 블록이다).

   확인은 눈으로 해야 한다. 'elementFromPoint' 는 의사요소를 보고하지 않아 늘 실패로
   나온다 — §19.3 에서 한 번 속았다.
   ──────────────────────────────────────────────────────────────── */
@media (hover: none) and (pointer: coarse) {
  .rmg-mc-arrow, .rmg-note-x, .rmg-ppl-searchx, .rmg-pctx-x, .rmg-drawer-px,
  .rmg-phead-morebtn, .rmg-mg-more, .rmg-tl-nav, .rmg-flash-act { position: relative; }

  .rmg-mc-arrow::after,       /* 26 → 44 · 달을 넘기는 유일한 손잡이 */
  .rmg-phead-morebtn::after   /* 26 → 44 */
    { content: ""; position: absolute; inset: -9px; }

  .rmg-note-x::after          /* 24 → 44 · 되묻기 닫기 */
    { content: ""; position: absolute; inset: -10px; }

  /* 일정판 접기 — 글리프 하나라 21×22 밖에 안 된다. -10 으로는 41×42 였다(재 봤다). */
  .rmg-evtl-fold::after { content: ""; position: absolute; inset: -12px; }

  .rmg-ppl-searchx::after,    /* 20 → 44 */
  .rmg-pctx-x::after,         /* 20 → 44 */
  .rmg-drawer-px::after       /* 20 → 44 · 참석자 빼기 */
    { content: ""; position: absolute; inset: -12px; }

  /* 메시지 '⋯' 는 16×18 이라 가장 모자랐다. 말풍선 쪽으로 번지지 않도록 위아래만 넉넉히. */
  .rmg-mg-more::after { content: ""; position: absolute; inset: -13px -12px; }

  /* 영수증의 '열기'·'확정' — 26px 이었다. 이 줄에서 실제로 하는 일이 여기 있다. */
  .rmg-flash-act::after { content: ""; position: absolute; inset: -9px -4px; }

  /* 36 까지 올려 뒀던 것을 마저 올린다(§19 에서 22 → 36).
     '.rmg-cv-daynav .rmg-tl-nav' 는 28px 로 따로 잡혀 있어 명시도가 더 높다 —
     같이 적지 않으면 캘린더 뷰의 날짜 화살표만 조용히 28 로 남는다. */
  .rmg-tl-nav, .rmg-cv-daynav .rmg-tl-nav { width: 44px; height: 44px; }

  /* 방 안 컴포저의 보내기는 30px 이라 기본 과녁(-6)으로는 42 였다. 2px 이 모자랐다. */
  .rmg-drawer-compose .rmg-ask-send::after { inset: -7px; }

  /* '최근 대화로' — 28px. 이미 absolute 라 relative 를 줄 필요가 없다.
     숨어 있을 때는 pointer-events:none 이라 넓힌 과녁이 헛되이 탭을 삼키지 않는다. */
  .rmg-tolast::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; }

  /* 손잡이가 호버로만 나타나면 터치에는 없는 것이다 — 폰에서는 보낸 말을 고치거나
     지울 길이 아예 없었다. 사람 목록은 이미 같은 방식으로 열어 두었다(.rmg-ppl-rowact). */
  .rmg-mg-act { opacity: 1; }
}

/* ────────────────────────────────────────────────────────────────
   좁은 폭에서는 레일을 펴지 않는다

   '.rail-open' 은 'railOpen || panel' 로 붙는다. 그래서 **패널(설정·캘린더)을 열면
   폭과 상관없이 216px 이 강제됐다** — 360px 폰에서 캔버스가 144px 로 눌리고, 좌우
   여백을 빼면 글이 설 자리가 80px 밖에 남지 않았다. 화면을 넓히려고 연 것이 화면을
   좁힌 셈이다.

   좁을 때는 기본 64px 로 되돌린다. 라벨도 함께 눌러야 한다 — 폭만 되돌리고 두면
   64px 안에서 글자가 넘친다. (레일 라벨은 어차피 마우스 호버로만 열리므로,
   터치에서 잃는 것은 없다.)
   ──────────────────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .rmg.rail-open { --rail-w: 64px; grid-template-columns: 64px minmax(0, 1fr); }
  .rmg.rail-open .rmg-rail-word, .rmg.rail-open .rmg-raillabel { opacity: 0; max-width: 0; transform: translateX(-8px); }
}
`;
