"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { THRESHOLD_KEY } from "@/lib/entry";
import { refreshSession, signInWithPassword, signInWithProvider, signUpWithPassword } from "@/lib/remote";
import { wakeAi } from "@/lib/api";

/**
 * Comein · Opening — 로그인이 아니라 '들어서는 경험'.
 * 로고 페이드 → (호흡) → 문 등장 → (호흡) → 문이 천천히 열리며 보라 빛이 번짐
 *  → 빛에서 인증 카드가 태어남 → 로그인 → 문이 다시 열리며 워크스페이스로.
 * 문(Door)이 시그니처. 보라 = 지능. 모든 움직임은 느리고 차분하고 의도적으로.
 *
 * 누가 이 인트로를 보는가 — 이 주소를 '처음 여는' 사람 전부다. 로그인 여부로 가르지 않는다.
 * 건너뛰는 길은 둘뿐이다: ?auth=1(계정을 바꾸러 온 사람)과, 이 탭이 이미 문을 지나온 경우
 * (워크스페이스에서 뒤로가기·새로고침으로 되돌아온 사람). 로그인해 있는 사람에게는
 * 인트로 끝에서 로그인 카드 대신 문이 열린다.
 */

type Phase = "logo" | "door" | "open" | "reveal" | "auth" | "entering";
type Provider = "github" | "kakao";
const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "github", label: "GitHub" },
  { key: "kakao", label: "카카오" },
];

// Comein = Co(ntext) · Me(mory) · In(sight) — 앞글자를 강조하면 곧 브랜드가 된다.
const TRIAD = [
  { frag: "Co", rest: "ntext", desc: "흩어진 맥락을 읽고," },
  { frag: "Me", rest: "mory", desc: "중요한 것을 기억하고," },
  { frag: "In", rest: "sight", desc: "정리된 통찰로 돌려드려요." },
];

/** 변환 — 말 한 줄이 자리를 얻기까지의 세 걸음.
 *
 *  이 화면은 오랫동안 "여기는 어떤 곳인가" 에만 답했다(로고·문·Co·Me·In). 정작
 *  "무엇을 해 주는가" 는 들어와 봐야 알 수 있었다. 그 한 칸을 여기서 채운다.
 *
 *  **지금 실제로 되는 것만 적는다.** 한때 §0 은 여기에 `생각 → AI 이해 → 회의 →
 *  캘린더 → Todo → 메모` 를 약속했는데, 메모는 걷혔고 할 일은 담을 곳이 없다 —
 *  없는 것을 시연하면 이 화면이 곧 첫 번째 거짓말이 된다.
 *
 *  세 줄 모두 코드로 확인한 동작이다: 끝 시각을 말하지 않으면 한 시간으로 두고
 *  (`workspace/page.tsx` 의 `p.end ?? +1h`), 자동 확정이 꺼져 있으면 제안으로 앉는다
 *  (`asProposal = !settings.autoConfirm`, 기본값 꺼짐). */
const FLOW = [
  { eye: "말 한 줄", body: "“내일 3시에 교수님 미팅 잡아줘”", said: true },
  { eye: "AI 가 읽는다", body: "내일 · 15:00 – 16:00 · 교수님 미팅", said: false },
  { eye: "자리에 앉는다", body: "캘린더에 제안으로 — 확정은 당신이", said: false },
];

/** 세 걸음이 차례로 선다. 한 번만 — 로그인 칸 옆에서 무언가 계속 움직이면 그건 안내가
 *  아니라 방해다. 선 다음에는 그대로 머물러 읽히기만 한다. */
function Flow() {
  return (
    <ol className="opn-flow">
      {FLOW.map((f, i) => (
        <li key={f.eye} className={`opn-flow-step opn-f${i}`}>
          <span className="opn-flow-dot" aria-hidden />
          <span className="opn-flow-eye">{f.eye}</span>
          <span className={`opn-flow-body ${f.said ? "said" : ""}`}>{f.body}</span>
        </li>
      ))}
    </ol>
  );
}

/** 주소가 로그인 칸을 직접 청했는가(?auth=1) — 계정을 바꾸러 온 사람.
 *  useSearchParams 대신 직접 읽는다: 그쪽은 Suspense 경계를 요구해 정적 렌더가 풀린다. */
const wantsAuthCard = () => new URLSearchParams(window.location.search).get("auth") === "1";

/** 이 '탭' 이 이미 문을 지나왔는가.
 *
 *  sessionStorage 라서 탭 하나의 기억이다 — 그게 정확히 우리가 묻고 싶은 것이다.
 *  뒤로가기·새로고침으로 워크스페이스에서 되돌아온 사람에게는 남아 있고,
 *  새 탭·북마크·주소 직접 입력·랜딩의 '들어가기' 로 처음 들어서는 사람에게는 비어 있다.
 *  (워크스페이스의 markEntered 와 아래 cross() 가 함께 세우고, '나가기' 가 지운다.) */
const cameFromWorkspace = () => {
  try { return sessionStorage.getItem(THRESHOLD_KEY) === "1"; } catch { return false; }
};

/** Context·Memory·Insight — Comein 아래로 뻗는 세 가지. 부모 클래스로 크기·모션을 다르게 준다. */
function Triad() {
  return (
    <ul className="opn-tree-list">
      {TRIAD.map((t, i) => (
        <li key={t.frag} className={`opn-tree-item opn-t${i}`}>
          <span className="opn-tree-word"><span className="opn-frag">{t.frag}</span>{t.rest}</span>
          <span className="opn-tree-desc">{t.desc}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Opening() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("logo");
  const [busy, setBusy] = React.useState<Provider | null>(null);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  // 인트로를 걷어내는 중 — 로고·문이 옅어지는 짧은 한 순간.
  const [skipping, setSkipping] = React.useState(false);
  // 세션이 살아 있는가. null 은 '아직 모른다' — 인트로가 끝나는 자리에서 쓰인다.
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);

  // 인트로의 네 걸음(문·열림·리빌·인증)을 세워 둔 타이머. 건너갈 때 함께 끈다.
  const intro = React.useRef<number[]>([]);
  const stopIntro = React.useCallback(() => {
    intro.current.forEach(clearTimeout);
    intro.current = [];
  }, []);

  React.useEffect(() => {
    // 여기서도 한 번 더 두드린다 — 랜딩을 건너뛰고 바로 들어온 사람(재방문 · 링크)에게는
    // 이 화면이 첫 화면이다. 노크는 값이 싸고, 두 번 해도 해롭지 않다.
    wakeAi();
    // 곧바로 로그인 칸을 여는 길. 워크스페이스에서 '나가기' 로 온 사람은 인트로를 보러
    // 온 것이 아니다 — 계정을 바꾸거나 다시 들어오려는 것이다.
    if (wantsAuthCard()) {
      setPhase("auth");
      return;
    }

    // 리빌(Context·Memory·Insight → Comein)은 이 경험의 핵심이라 항상 거친다.
    // reduced-motion에선 CSS 모션만 죽이고(정적 표시) 흐름은 유지 — 대신 대기를 짧게.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const t = reduce
      ? { door: 200, open: 500, reveal: 900, auth: 3200 }
      : { door: 2000, open: 3800, reveal: 5000, auth: 8200 };
    intro.current = [
      window.setTimeout(() => setPhase("door"), t.door),
      window.setTimeout(() => setPhase("open"), t.open),
      window.setTimeout(() => setPhase("reveal"), t.reveal),
      window.setTimeout(() => setPhase("auth"), t.auth),
    ];
    return stopIntro;
  }, [stopIntro]);

  // 문은 한 번만 열린다 — 아래 두 훅과 skip() 이 같은 순간에 겹쳐 부를 수 있어서,
  // 막아 두지 않으면 워크스페이스로 두 번 밀린다.
  const crossed = React.useRef(false);
  const cross = React.useCallback(() => {
    if (crossed.current) return;
    crossed.current = true;
    // 인트로 타이머를 먼저 끈다. 남겨 두면 건너가는 중에 그 타이머들이 깨어나 phase 를
    // 도로 door·open·reveal 로 덮어써, 빛이 앞으로 나오다 말고 로고가 다시 떠오른다
    // (reduced-motion 에선 타이머가 200·500·900ms 라 1300ms 의 건넘 안에서 반드시 그랬다).
    stopIntro();
    // 문이 다시 열리고 빛이 앞으로 — 워크스페이스로 건너간다(문턱은 이 순간이 대신함).
    setPhase("entering");
    try { sessionStorage.setItem(THRESHOLD_KEY, "1"); sessionStorage.setItem("comein:justEntered", "1"); } catch {}
    setTimeout(() => router.push("/workspace"), 1300);
  }, [router, stopIntro]);

  /** 이미 들어와 있는 사람 — 다만 '어디서 왔는가' 를 함께 묻는다.
   *
   *  세션만 보고 곧바로 건너뛰면, 이 주소를 처음 연 사람에게서도 인트로를 통째로 뺏는다.
   *  실제로 그랬다: 로고·문·리빌이 한 프레임도 뜨지 않고 플래시 한 번 뒤 워크스페이스로
   *  넘어갔다 — 만드는 사람은 늘 로그인해 있어서 그게 사라진 줄도 몰랐다.
   *
   *  그래서 이 탭이 문을 지나온 적이 있는지를 함께 본다. 뒤로가기·새로고침으로 되돌아온
   *  사람만 그냥 통과시킨다(그 사람에게 인트로는 되감기이지 첫인상이 아니다).
   *  처음 들어서는 사람은 인트로를 다 본다 — 그 끝을 아래 훅이 맡는다.
   *  ?auth=1 은 예외: 계정을 바꾸러 온 사람에게서 로그인 칸을 뺏지 않는다. */
  React.useEffect(() => {
    if (wantsAuthCard()) return;
    let gone = false;
    void refreshSession().then((uid) => {
      if (gone) return;
      setSignedIn(!!uid);
      if (uid && cameFromWorkspace()) cross();
    }).catch(() => {});
    return () => { gone = true; };
  }, [cross]);

  /** 인트로가 끝나는 자리 — 이미 로그인해 있는 사람에게 로그인 칸을 다시 내밀지 않는다.
   *  보여 줄 것(인트로)은 다 보여 주고, 마지막에 카드 대신 문이 열린다. */
  React.useEffect(() => {
    if (phase === "auth" && signedIn && !wantsAuthCard()) cross();
  }, [phase, signedIn, cross]);

  /** 건너뛰기 — 인트로만 넘긴다. 다른 페이지로 내보내지 않고, 이 화면의 로그인 카드로 바로 간다.
   *  이미 들어와 있으면 그대로 통과. */
  const skip = React.useCallback(() => {
    if (phase === "auth" || phase === "entering") return;
    // 인트로를 통째로 걷어내되 툭 끊지는 않는다. 예전엔 누르는 순간 로고·문이
    // display:none 으로 사라지고 카드가 그 자리에 나타나 한 프레임에 화면이 갈렸다.
    // 먼저 옅어지게 두고(340ms) 그 다음 카드로 넘긴다 — 넘기는 것도 하나의 장면이다.
    setSkipping(true);
    window.setTimeout(() => setPhase("auth"), 360);
    // 먼저 반응하고 나서 확인한다 — 세션 조회(네트워크)를 기다리면 누른 게 씹힌 것처럼 느껴진다.
    void refreshSession().then((uid) => { if (uid) cross(); });
  }, [cross, phase]);

  const social = async (p: Provider) => {
    if (busy || phase === "entering") return;
    setBusy(p);
    setErr(null);
    try {
      // 이 순간이 곧 '문턱' — 제공자를 거쳐 돌아온 워크스페이스가 우리를 다시 문 앞에
      // 세우지 않게(플래그가 없으면 /workspace 는 /experience 로 되돌린다).
      try { sessionStorage.setItem(THRESHOLD_KEY, "1"); sessionStorage.setItem("comein:justEntered", "1"); } catch {}
      const { error } = await signInWithProvider(p, `${window.location.origin}/workspace`);
      if (error) throw error;
    } catch (e: any) {
      // 나가지 못했으면 문턱도 되돌린다 — 아직 들어온 게 아니다.
      try { sessionStorage.removeItem(THRESHOLD_KEY); sessionStorage.removeItem("comein:justEntered"); } catch {}
      setErr(e?.message ?? "연결에 문제가 생겼어요."); setBusy(null);
    }
  };
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (mode === "signup") await signUpWithPassword(email, pw, name);
      else await signInWithPassword(email, pw);
      cross();
    } catch (e: any) { setErr(e?.message ?? "로그인에 실패했어요."); }
  };

  const doorOpen = phase === "open" || phase === "reveal" || phase === "auth" || phase === "entering";

  return (
    <div className={`opn phase-${phase} ${skipping ? "skipping" : ""}`}>
      <style>{CSS}</style>
      <div className="opn-bg" aria-hidden />
      <div className="opn-light" aria-hidden />
      <div className="opn-flash" aria-hidden />

      {/* 넘길 인트로가 있을 때만 그린다. 카드가 선 뒤에는 이 단추가 할 일이 없다 —
          skip() 도 그 단계에서는 바로 돌아섰으니, 화면에는 눌러도 아무 일이 없는 단추만 남아 있었다.
          숨기지 않고 걷어내는 이유: opacity 로만 감추면 눈에는 없는데 Tab 으로는 잡힌다. */}
      {phase !== "auth" && phase !== "entering" && (
        <button type="button" className="opn-skip" onClick={skip} aria-label="인트로 건너뛰기">
          건너뛰기
          <span className="opn-skip-ar" aria-hidden>→</span>
        </button>
      )}

      <div className="opn-stage">
        <p className="opn-logo">Comein</p>
        <p className="opn-tag">Scattered thoughts become structured flow.</p>

        <div className={`opn-door ${doorOpen ? "open" : ""}`} aria-hidden>
          <svg viewBox="0 0 40 52" fill="none" className="opn-door-svg">
            <rect x="3" y="3" width="34" height="46" rx="2.5" className="opn-door-frame" strokeWidth="1.6" />
            <path d="M20 7 L31 10 V42 L20 45 Z" className="opn-door-panel" strokeWidth="1.6" />
            <circle cx="23.5" cy="26" r="1.1" className="opn-door-handle" />
          </svg>
        </div>

        {phase === "reveal" && (
          <div className="opn-reveal" aria-hidden>
            <Triad />
          </div>
        )}

        {(phase === "auth" || phase === "entering") && (
          <div className="opn-authwrap">
            {/* 왼쪽 칸 — 여기에는 Co·Me·In 이 한 번 더 서 있었다. 리빌에서 방금 크게 지나간
                것을 작게 되풀이하는 자리였고, 그동안 "무엇을 해 주는가" 는 아무도 말하지
                않았다. 되풀이를 걷고 그 자리를 변환에 준다 — 문 앞에서 기다리게 하지 않고,
                로그인 칸을 읽는 그 시간에 함께 읽히게. */}
            <aside className="opn-brand" aria-hidden>
              <p className="opn-brand-logo">Comein</p>
              <p className="opn-brand-tag">Scattered thoughts become structured flow.</p>
              <Flow />
            </aside>

            <div className="opn-card">
            <p className="opn-card-hi">{mode === "login" ? "Welcome back." : "Welcome."}</p>

            {/* 이메일·비밀번호가 위에 온다 — 실제로 열려 있는 길이 먼저 보여야 한다.
                소셜은 아래로. 아직 provider 가 꺼져 있는 동안에도 화면이 정직해진다. */}
            <form className="opn-form" onSubmit={submitAuth}>
              {mode === "signup" && (
                <input className="opn-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" aria-label="이름" autoComplete="name" />
              )}
              <input className="opn-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" aria-label="이메일" autoComplete="email" />
              <input className="opn-field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" aria-label="비밀번호" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {err && <p className="opn-err">{err}</p>}
              <button type="submit" className="opn-submit" disabled={phase === "entering"}>{mode === "login" ? "Enter Comein" : "Create your space"}</button>
            </form>

            <div className="opn-div"><span>or continue with</span></div>

            <div className="opn-providers">
              {PROVIDERS.map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => social(p.key)}
                  className="opn-provider"
                  disabled={busy !== null || phase === "entering"}
                  data-busy={busy === p.key}
                  style={{ animationDelay: `${0.25 + i * 0.08}s` }}
                >
                  <Glyph provider={p.key} />
                  <span>{busy === p.key ? "들어가는 중…" : `Continue with ${p.label}`}</span>
                </button>
              ))}
            </div>

            <p className="opn-switch">
              {mode === "login" ? "처음이신가요? " : "이미 계정이 있나요? "}
              <button type="button" onClick={() => { setErr(null); setMode(mode === "login" ? "signup" : "login"); }}>
                {mode === "login" ? "회원가입" : "로그인"}
              </button>
            </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Glyph({ provider }: { provider: Provider }) {
  // 말풍선 — 카카오의 형태만 단색으로. 브랜드 노랑을 이 화면에 들이지 않는다.
  if (provider === "kakao") return (
    <svg className="opn-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1.1 4c-.1.3.3.6.6.4l4.7-3.1c.2 0 .5.1.7.1 5.1 0 9.2-3.3 9.2-7.6S17.1 3 12 3z" /></svg>
  );
  return (
    <svg className="opn-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.77c-2.92.64-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.2 0-1.15.41-2.09 1.09-2.83-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.26 0c2-1.36 2.89-1.08 2.89-1.08.57 1.45.21 2.52.1 2.79.68.74 1.09 1.68 1.09 2.83 0 4.04-2.46 4.93-4.8 5.19.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5z" /></svg>
  );
}

const CSS = `
.opn {
  /* 워크스페이스와 같은 어둠을 쓴다(workspace/page.tsx 의 .rmg 토큰과 동일한 값).
     글자·선·액센트는 원래 같았고, 바탕 셋만 갈려 있었다 — 그런데 그 셋이 온도를 정한다:
     #0E0D12 는 파랑 쪽(R14 G13 B18), #141210 은 따뜻한 쪽(R20 G18 B16)이라
     문을 열고 들어오면 색이 한 번 식었다. 들어오는 길과 머무는 곳은 같은 온도여야 한다. */
  --paper: #141210; --ink: #F2F0EC; --muted: #98938A; --faint: #5E574C;
  --accent: #9B8E86; --glow: rgba(155,142,134,0.16); --surface: #1B1813; --hair: #262019;
  position: fixed; inset: 0; z-index: 1;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; overflow-y: auto; overflow-x: hidden;
}

/* 문에서 번지는 보라 빛 — 지능. 느리게 확장. */
/* 배경 — 사무실 무드 사진을 흐릿하게, 아주 옅게. 어둠 위 은은한 온기. (public/comein-opening.png) */
.opn-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/comein-opening.png') center/cover no-repeat;
  filter: blur(9px) saturate(0.92) brightness(0.9); transform: scale(1.06); opacity: 0.16; }
.opn-bg::after { content: ""; position: absolute; inset: 0;
  /* 아래로 깔리는 장막도 같은 검정이어야 한다 — 여기만 쿨 톤이면 사진 위에서 색이 갈린다.
     (rgba(20,18,16) = #141210. var() 를 alpha 와 섞어 쓸 수 없어 값을 풀어 쓴다.) */
  background: radial-gradient(120% 90% at 50% 42%, transparent 0%, var(--paper) 78%), linear-gradient(180deg, rgba(20,18,16,0.35), rgba(20,18,16,0.68)); }
:root:not(.dark) .opn-bg { opacity: 0.3; filter: blur(9px) saturate(0.98) brightness(1.03); }
:root:not(.dark) .opn-bg::after { background: radial-gradient(120% 90% at 50% 42%, transparent 0%, var(--paper) 80%), linear-gradient(180deg, rgba(246,247,249,0.3), rgba(246,247,249,0.62)); }

.opn-light { position: fixed; left: 50%; top: 52%; width: 60vmax; height: 60vmax; transform: translate(-50%, -50%) scale(0.3);
  border-radius: 50%; pointer-events: none; opacity: 0;
  background: radial-gradient(circle, var(--glow) 0%, rgba(155,142,134,0.05) 34%, transparent 62%);
  transition: opacity 2.4s ease, transform 2.6s cubic-bezier(0.22,1,0.36,1); }
.opn.phase-open .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.opn.phase-auth .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
.opn.phase-entering .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(3.4); transition: opacity 1.3s ease, transform 1.4s cubic-bezier(0.4,0,0.2,1); }

/* 건너뛰기 — 인트로는 8초가 넘는다. 처음부터 '누를 수 있는 것'으로 보여야 기다릴지 넘길지 고를 수 있다.
   (예전엔 앞 3.8초 동안 숨어 있었고, 테두리도 배경도 없어 버튼으로 읽히지 않았다.) */
.opn-skip { position: fixed; top: 24px; right: 32px; z-index: 6;
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;
  border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent); border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 7%, transparent); backdrop-filter: blur(10px);
  cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; letter-spacing: 0.02em;
  color: var(--ink); opacity: 0; animation: opn-skip-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.9s both;
  transition: color 0.25s, border-color 0.25s, background 0.25s; }
@keyframes opn-skip-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 0.72; transform: none; } }
.opn-skip:hover { opacity: 1; border-color: color-mix(in srgb, var(--ink) 38%, transparent); background: color-mix(in srgb, var(--ink) 13%, transparent); }
.opn-skip:focus-visible { opacity: 1; outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent); outline-offset: 3px; }
.opn-skip-ar { font-size: 14px; line-height: 1; color: var(--muted); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), color 0.25s; }
.opn-skip:hover .opn-skip-ar { transform: translateX(3px); color: var(--ink); }
/* 넘기는 340ms 동안만 흐려진다 — 그 뒤에는 아예 그려지지 않는다(위 JSX 참고).
   animation: none 이 필요하다: 등장 애니메이션이 both 로 끝값(0.72)을 붙들고 있어서
   opacity 만 0 으로 적으면 애니메이션이 이긴다. 전환 중에 물러나게 해 둔 예전 규칙도
   그래서 실제로는 흐려지지 않고 클릭만 막고 있었다.
   숨기는 데 visibility 는 쓰지 않는다 — 트랜지션이 걸리면 값이 넘어가지 않아
   눈에는 없는데 Tab 으로는 잡히는 단추가 남는다(실제로 그랬다). 그래서 걷어내는 쪽을 택했다. */
.opn.skipping .opn-skip {
  animation: none; opacity: 0; pointer-events: none; transition: opacity 0.34s ease; }
@media (prefers-reduced-motion: reduce) { .opn-skip { animation: none; opacity: 0.72; } }

.opn-stage { position: relative; z-index: 2; min-height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 64px 24px; gap: 0; transition: opacity 0.9s ease; }
.opn.phase-entering .opn-stage { opacity: 0; transform: scale(1.045); transition: opacity 1.1s ease 0.12s, transform 1.25s cubic-bezier(0.4,0,0.2,1); }
.opn.phase-entering .opn-authwrap { animation: opn-leave 1.15s cubic-bezier(0.4,0,0.2,1) both; }
@keyframes opn-leave { from { opacity: 1; transform: translateY(0); filter: blur(0); } to { opacity: 0; transform: translateY(-14px); filter: blur(2px); } }

/* 진입 플래시 — 로그인 순간 따뜻한 빛이 화면을 감싸며 워크스페이스로 건너간다 (컷 느낌 제거) */
.opn-flash { position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0;
  background: radial-gradient(circle at 50% 46%, rgba(232,216,196,0.5) 0%, rgba(200,186,168,0.26) 34%, rgba(155,142,134,0.1) 56%, transparent 74%); }
.opn.phase-entering .opn-flash { opacity: 1; transition: opacity 1.2s ease 0.1s; }

/* 로고 — 히어로. 천천히 페이드 인. */
.opn-logo { margin: 0; font-size: clamp(2.6rem, 7vw, 4.2rem); font-weight: 300; letter-spacing: -0.035em; color: var(--ink);
  opacity: 0; transform: translateY(6px); animation: opn-logo-in 1.6s cubic-bezier(0.22,1,0.36,1) 0.2s both; transition: opacity 0.9s ease; }
@keyframes opn-logo-in { to { opacity: 1; transform: translateY(0); } }

/* 브랜드 스테이트먼트 — 로고를 조용히 받쳐준다(문 등장과 함께). */
.opn-tag { margin: 18px 0 0; font-size: clamp(0.9rem, 2vw, 1.02rem); font-weight: 300; letter-spacing: 0.005em; color: var(--muted);
  opacity: 0; transition: opacity 1.4s ease; }
.opn.phase-door .opn-tag, .opn.phase-open .opn-tag, .opn.phase-auth .opn-tag, .opn.phase-entering .opn-tag { opacity: 1; }

/* 문 — 시그니처. 등장 후 천천히 열린다. */
.opn-door { width: 46px; height: 60px; margin-top: clamp(40px, 7vh, 72px);
  opacity: 0; transform: translateY(8px); transition: opacity 1.4s ease, transform 1.4s cubic-bezier(0.22,1,0.36,1); }
.opn.phase-door .opn-door, .opn.phase-open .opn-door, .opn.phase-auth .opn-door, .opn.phase-entering .opn-door { opacity: 1; transform: translateY(0); }
.opn-door-svg { width: 100%; height: 100%; overflow: visible; }
.opn-door-frame { stroke: var(--muted); opacity: 0.55; transition: stroke 1.4s ease, opacity 1.4s ease; }
.opn-door-panel { stroke: var(--muted); fill: var(--accent); fill-opacity: 0; opacity: 0.62; transform-origin: 20px 26px; transition: all 1.4s cubic-bezier(0.22,1,0.36,1); }
.opn-door-handle { fill: var(--muted); transition: fill 1.4s ease; }
.opn-door.open .opn-door-frame { stroke: var(--accent); opacity: 0.9; }
.opn-door.open .opn-door-panel { stroke: var(--accent); fill-opacity: 0.16; opacity: 1; transform: scaleX(0.78); }
.opn-door.open .opn-door-handle { fill: var(--accent); }
.opn-door.open .opn-door-svg { filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 26px var(--glow)); }

/* 인증 카드 — 빛에서 태어난다. 가볍게, 하나의 수직 리듬. */
.opn-card { width: min(392px, 92vw); margin-top: clamp(34px, 6vh, 56px);
  display: flex; flex-direction: column; align-items: stretch;
  padding: 30px 28px 26px; border-radius: 22px;
  /* 카드 면도 워크스페이스의 표면(#1B1813 = 27,24,19)과 같은 온도로. 투명도는 그대로 둔다 —
     배경 사진이 비쳐 보이는 정도가 이 화면의 깊이라, 값을 바꾸면 다른 이야기가 된다. */
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 46%), rgba(27,24,19,0.72);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 28px -20px rgba(0,0,0,0.4), 0 30px 70px -34px rgba(0,0,0,0.55), 0 0 64px -22px var(--glow);
  backdrop-filter: blur(10px);
  animation: opn-card-in 1.3s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
@keyframes opn-card-in { from { opacity: 0; transform: translateY(14px) scale(0.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
.opn-card-hi { margin: 0 0 20px; text-align: center; font-size: 1.02rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }

.opn-providers { display: flex; flex-direction: column; gap: 13px; }
.opn-provider { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 52px; padding: 0 16px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 13px;
  font-family: inherit; font-size: 0.94rem; font-weight: 500; color: var(--ink); cursor: pointer;
  transition: border-color 0.35s ease, background 0.35s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.3s;
  animation: opn-rise 0.9s cubic-bezier(0.22,1,0.36,1) both; }
.opn-provider:hover:not(:disabled) { background: rgba(255,255,255,0.045); border-color: color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08)); transform: translateY(-1px); }
.opn-provider:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.opn-provider:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }
.opn-provider:disabled { cursor: default; }
.opn-provider[data-busy="true"] { border-color: color-mix(in srgb, var(--accent) 45%, rgba(255,255,255,0.08)); }
.opn-provider:disabled:not([data-busy="true"]) { opacity: 0.45; }
.opn-glyph { width: 18px; height: 18px; flex-shrink: 0; }
@keyframes opn-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.opn-div { display: flex; align-items: center; gap: 12px; margin: 18px 0 14px; }
.opn-div::before, .opn-div::after { content: ""; height: 1px; flex: 1; background: rgba(255,255,255,0.07); }
/* 로그인 카드는 어두운 면(#1B1813) 위에 있어 --faint 가 2.2:1 로 앉는다.
   §18 의 대비 점검은 워크스페이스 4개 뷰와 랜딩만 훑었고 이 화면은 보지 않았다 —
   '무엇으로 들어갈지' 를 가르는 한 줄이라 읽히지 않으면 두 방식이 하나로 보인다. */
.opn-div span { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: var(--muted); }
.opn-form { display: flex; flex-direction: column; gap: 10px; }
/* 아이디·비밀번호 칸만 흰 종이로 — 어두운 문 앞에서 여기만 '적는 자리' 라는 걸
   색 하나로 말한다. 브라우저 자동완성이 제 파란 면을 칠하던 것도 같은 흰색으로 덮는다
   (그대로 두면 두 칸만 푸르게 떠서 화면이 어그러진다). */
.opn-field { width: 100%; min-height: 52px; padding: 0 15px; border-radius: 13px;
  background: #FFFFFF; border: 1px solid rgba(255,255,255,0.16);
  font-family: inherit; font-size: 0.94rem; font-weight: 400; color: #26221D; caret-color: #26221D; outline: none;
  transition: border-color 0.25s, box-shadow 0.25s; }
.opn-field::placeholder { color: #9A948B; font-weight: 300; }
.opn-field:focus { border-color: rgba(255,255,255,0.42); box-shadow: 0 0 0 3px rgba(255,255,255,0.10); }
.opn-field:-webkit-autofill,
.opn-field:-webkit-autofill:hover,
.opn-field:-webkit-autofill:focus {
  -webkit-text-fill-color: #26221D;
  -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset;
  caret-color: #26221D;
}
.opn-err { margin: 2px 0 0; font-size: 0.82rem; color: #E57373; text-align: left; }
.opn-submit { margin-top: 6px; width: 100%; min-height: 52px; border: 0; border-radius: 13px;
  /* 액센트 위에 얹히는 글자색 — 워크스페이스의 보내기 버튼과 같은 값(#141210). */
  background: var(--accent); color: #141210; font-family: inherit; font-size: 0.96rem; font-weight: 600; cursor: pointer;
  box-shadow: 0 6px 18px -10px rgba(0,0,0,0.5), 0 0 24px -8px var(--glow); transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s; }
.opn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -12px rgba(0,0,0,0.55), 0 0 36px -6px var(--glow); }
.opn-submit:active:not(:disabled) { transform: scale(0.98); box-shadow: 0 4px 14px -10px rgba(0,0,0,0.5), 0 0 22px -8px var(--glow); }
.opn-submit:disabled { opacity: 0.5; cursor: default; }
.opn-submit:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }
.opn-switch { margin: 18px 0 0; text-align: center; font-size: 0.84rem; font-weight: 300; color: var(--muted); }
.opn-switch button { background: none; border: 0; cursor: pointer; font-family: inherit; font-size: 0.84rem; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.opn-switch button:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; border-radius: 3px; }

/* 건너뛰기 — 인트로가 사라지는 한 순간. 지우기 전에 옅어질 시간을 준다. */
.opn.skipping .opn-logo, .opn.skipping .opn-tag, .opn.skipping .opn-door, .opn.skipping .opn-reveal {
  opacity: 0; transition: opacity 340ms ease; }
@media (prefers-reduced-motion: reduce) {
  .opn.skipping .opn-logo, .opn.skipping .opn-tag, .opn.skipping .opn-door, .opn.skipping .opn-reveal { transition: none; }
}

/* 리빌 — Comein(위 로고) 아래로 Context·Memory·Insight 세 단어가 가지처럼 강조되며 나타난다. (Comein 은 하나뿐) */
.opn.phase-reveal .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
.opn.phase-reveal .opn-tag, .opn.phase-reveal .opn-door { display: none; }
.opn.phase-auth .opn-logo, .opn.phase-auth .opn-tag, .opn.phase-auth .opn-door,
.opn.phase-entering .opn-logo, .opn.phase-entering .opn-tag, .opn.phase-entering .opn-door { display: none; }
.opn-reveal { position: relative; z-index: 2; margin-top: clamp(18px, 3.2vh, 34px); width: 100%; display: flex; justify-content: center; }

/* 세 가지 리스트 — 리빌에서만 쓴다(브랜드 칸은 변환이 가져갔다). */
.opn-tree-list { position: relative; list-style: none; margin: 0; padding: 0; display: inline-block; text-align: left; }
.opn-tree-item { position: relative; padding: clamp(6px, 1.2vh, 10px) 0 clamp(6px, 1.2vh, 10px) 30px; }
.opn-tree-item::before { content: ""; position: absolute; left: 9px; top: 0; bottom: 0; width: 1.5px; background: color-mix(in srgb, var(--accent) 45%, var(--hair)); }
.opn-tree-item:last-child::before { bottom: 50%; }
.opn-tree-item::after { content: ""; position: absolute; left: 9px; top: 50%; width: 16px; height: 1.5px; background: color-mix(in srgb, var(--accent) 45%, var(--hair)); }
/* Co·Me·In 이 밝고 나머지가 가라앉는다 — 눈이 먼저 앞글자를 줍고, 그 셋이 곧 Comein 이 된다.
   (반대로 두면 'ntext' 가 더 밝아 브랜드가 뒤에 숨는다.) */
.opn-tree-word { display: block; font-weight: 300; letter-spacing: -0.02em; line-height: 1.15;
  color: color-mix(in srgb, var(--accent) 72%, var(--paper)); }
.opn-tree-word .opn-frag { color: var(--ink); font-weight: 600; }
.opn-tree-desc { display: block; margin-top: 4px; font-weight: 300; color: var(--muted); line-height: 1.4; }

/* 리빌 변형 — 크게 + 순차 강조 */
.opn-reveal .opn-tree-word { font-size: clamp(1.5rem, 4.5vw, 2.2rem); }
.opn-reveal .opn-tree-desc { font-size: clamp(0.86rem, 2vw, 1rem); }
.opn-reveal .opn-tree-item { opacity: 0; animation: opn-branch-in 0.7s cubic-bezier(0.22,1,0.36,1) both; }
.opn-reveal .opn-t0 { animation-delay: 0.15s; }
.opn-reveal .opn-t1 { animation-delay: 0.5s; }
.opn-reveal .opn-t2 { animation-delay: 0.85s; }
@keyframes opn-word-in { from { opacity: 0; transform: translateY(12px); filter: blur(3px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
@keyframes opn-branch-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

/* ── 변환 — 말 한 줄이 자리를 얻기까지 ──
   Triad 와 같은 어휘를 쓴다(세로 실선 + 점). 새 조형을 하나 더 들이지 않는다. */
.opn-flow { list-style: none; margin: 0; padding: 0; }
.opn-flow-step { position: relative; padding: 0 0 clamp(15px, 2.6vh, 22px) 24px; }
.opn-flow-step:last-child { padding-bottom: 0; }
/* 걸음과 걸음을 잇는 선. 마지막 걸음 아래로는 이어지지 않는다 — 거기서 끝나니까. */
.opn-flow-step::before { content: ""; position: absolute; left: 5px; top: 14px; bottom: 0; width: 1.5px;
  background: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.opn-flow-step:last-child::before { display: none; }
.opn-flow-dot { position: absolute; left: 0; top: 4px; width: 11px; height: 11px; border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, var(--hair)); background: var(--paper); }
/* 마지막 점만 채운다 — 여기가 도착이라는 것을 색 하나로 말한다. */
.opn-flow-step:last-child .opn-flow-dot { background: color-mix(in srgb, var(--accent) 60%, var(--paper)); }
/* 걸음의 이름은 --muted 로. --faint 는 이 바탕(#141210) 위에서 2.62:1 이라 사실상 읽히지
   않는다 — 세 걸음의 이름이 안 읽히면 남는 건 예문 세 줄이고, 그건 변환이 아니라 나열이다.
   (같은 이유로 로그인 카드의 'or continue with' 도 --muted 로 옮긴 적이 있다.) */
.opn-flow-eye { display: block; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted); }
.opn-flow-body { display: block; margin-top: 5px; font-size: clamp(0.88rem, 1.6vw, 0.98rem);
  font-weight: 300; line-height: 1.45; color: color-mix(in srgb, var(--ink) 80%, transparent); }
/* 사람이 한 말만 또렷하게 — 나머지는 그 말이 어떻게 바뀌는지를 보여 주는 그림자다. */
.opn-flow-body.said { color: var(--ink); font-weight: 400; }
.opn-flow-step { opacity: 0; animation: opn-flow-in 0.8s cubic-bezier(0.22,1,0.36,1) both; }
.opn-f0 { animation-delay: 0.55s; }
.opn-f1 { animation-delay: 1.15s; }
.opn-f2 { animation-delay: 1.75s; }
@keyframes opn-flow-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

/* 인증 — 가로 2단: 브랜드(좌) + 로그인(우). 세로로 길지 않게 여백(가로)을 쓴다. */
/* 두 단은 가운데가 아니라 '윗줄'로 맞춘다 — Comein 이 카드의 첫 줄과 같은 높이에 서야
   두 덩어리가 나란히 놓인 하나로 읽힌다. 가운데 정렬은 카드 길이가 바뀔 때마다 로고가 떠다닌다. */
.opn-authwrap { position: relative; z-index: 2; display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: start; gap: clamp(32px, 6vw, 88px); width: min(940px, 92vw); animation: opn-card-in 1s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
.opn-authwrap .opn-card { margin: 0 auto; animation: none; }
/* 카드 안쪽 여백(30px)만큼 내려서, 큰 글자의 윗선이 카드 첫 줄과 만나게 한다. */
.opn-brand { text-align: left; padding-top: 26px; }
.opn-brand-logo { margin: 0; font-size: clamp(2.85rem, 6vw, 4.05rem); font-weight: 400; line-height: 1; letter-spacing: -0.038em; color: var(--ink); text-shadow: 0 0 56px var(--glow); }
.opn-brand-tag { margin: 20px 0 26px; font-size: clamp(0.86rem, 1.6vw, 0.98rem); font-weight: 300; color: var(--muted); }
/* 좁은 폭 — 예전에는 왼쪽 칸을 통째로 숨겼다. 그러면 이 화면에서 "무엇을 해 주는가" 를
   말하는 자리가 **모바일에만 없어진다** — 처음 보여 주는 자리가 대개 남의 폰인데.
   로고와 태그라인만 걷고(카드가 이미 브랜드를 이고 있다) 변환은 카드 아래로 내린다. */
@media (max-width: 800px) {
  .opn-authwrap { grid-template-columns: 1fr; gap: 0; width: min(360px, 90vw); }
  .opn-brand { order: 2; padding-top: clamp(26px, 4vh, 34px); }
  .opn-brand-logo, .opn-brand-tag { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .opn-logo, .opn-card, .opn-provider { animation: none; }
  .opn-light, .opn-tag, .opn-door, .opn-stage { transition: none; }
  .opn-logo { opacity: 1; transform: none; }
  /* 리빌 — 모션 없이도 세 단어가 정적으로 보인다 */
  .opn-reveal .opn-tree-item { animation: none; opacity: 1; transform: none; filter: none; }
  /* 변환도 같다 — 걸음이 서는 순서는 모션이 아니라 선과 점이 이미 말하고 있다. */
  .opn-flow-step { animation: none; opacity: 1; transform: none; }
  .opn-authwrap { animation: none; }
  .opn-flash { display: none; }
}
`;
