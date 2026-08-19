"use client";

/**
 * Comein · 맡기는 정도를 사람이 정하는 자리.
 *
 * 테마·언어·글자 크기, 그리고 얼마나 맡길지. '자동 확정' 이 기본으로 꺼져 있는 것이
 * 이 화면의 태도다 — AI 가 읽은 것은 사람의 확인을 기다린다.
 *
 * 계정도 여기 있다. 로그인해야 이 워크스페이스가 이 브라우저 밖으로 나간다.
 * 핸들은 남에게 알려 줄 이름이자 초대코드라, 바꾸는 자리도 함께 둔다(30일에 한 번 — 0014).
 */

import * as React from "react";

import { MODE_CONFIG, USER_MODES, normalizeMode } from "@/lib/mode";
import { signInWithEmail, signInWithPassword, signInWithProvider, signOutRemote, signUpWithPassword } from "@/lib/remote";
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN, type Settings } from "@/lib/store";
import type { RemoteState } from "@/lib/useRemoteSync";
import { L, type Lang } from "../i18n";

function AccountRow({ lang, remote }: { lang: Lang; remote: RemoteState }) {
  const en = lang === "en";
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message ?? "실패했어요."); } finally { setBusy(false); }
  };

  return (
    <div className="rmg-set-row">
      <div className="rmg-set-label">
        <p className="rmg-set-k">{en ? "Account" : "계정"}</p>
        <p className="rmg-set-d">
          {!remote.configured
            ? (en ? "Not connected — everything stays in this browser." : "연결되지 않았어요 — 지금 만든 것은 이 브라우저에만 있습니다.")
            : remote.signedIn
              // 실시간이 붙어 있는지도 여기서 말한다 — 끊긴 줄 모르는 것이 가장 나쁜 상태다.
              ? remote.live
                ? (en ? "Connected. Your workspace follows you." : "연결됐어요. 워크스페이스가 기기를 따라옵니다.")
                : (en ? "Signed in — reconnecting live updates…" : "로그인됐어요 — 실시간 연결을 다시 잇는 중이에요.")
              : (en ? "Sign in to keep your workspace." : "로그인하면 워크스페이스가 저장됩니다.")}
          {remote.error ? ` · ${remote.error}` : ""}
          {err ? ` · ${err}` : ""}
        </p>
      </div>

      {!remote.configured ? (
        <span className="rmg-acct-off">{en ? "Local" : "로컬"}</span>
      ) : remote.signedIn ? (
        <button type="button" className="rmg-ppl-act" disabled={busy} onClick={() => go(signOutRemote)}>
          {en ? "Sign out" : "로그아웃"}
        </button>
      ) : sent ? (
        <span className="rmg-acct-off">{en ? "Check your email" : "메일함을 확인하세요"}</span>
      ) : (
        <div className="rmg-acct">
          <input
            className="rmg-set-input rmg-acct-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={en ? "email" : "이메일"}
            autoComplete="username"
            aria-label={en ? "Email" : "이메일"}
          />
          <input
            className="rmg-set-input rmg-acct-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={en ? "password" : "비밀번호"}
            autoComplete="current-password"
            aria-label={en ? "Password" : "비밀번호"}
          />
          <button
            type="button"
            className="rmg-ppl-act primary"
            disabled={busy || !email.includes("@") || pw.length < 6}
            onClick={() => go(() => signInWithPassword(email, pw))}
          >
            {en ? "Sign in" : "로그인"}
          </button>
          <button
            type="button"
            className="rmg-ppl-act"
            disabled={busy || !email.includes("@") || pw.length < 6}
            onClick={() => go(() => signUpWithPassword(email, pw))}
          >
            {en ? "Sign up" : "가입"}
          </button>
          {/* 비밀번호 없이 들어오는 길도 남겨 둔다 */}
          <button
            type="button"
            className="rmg-ppl-act"
            disabled={busy || !email.includes("@")}
            onClick={() => go(async () => { await signInWithEmail(email); setSent(true); })}
          >
            {en ? "Link" : "링크"}
          </button>
          <button type="button" className="rmg-ppl-act" disabled={busy} onClick={() => go(() => signInWithProvider("github"))}>
            GitHub
          </button>
        </div>
      )}
    </div>
  );
}

/** 핸들 한 줄 — 평소엔 읽기만 하고, 눌러야 고칠 수 있다.
 *  늘 입력칸으로 열어 두면 실수로 바꾸기 쉬운데, 이건 30일에 한 번뿐인 일이다. */
function HandleRow({ lang, handle, at, onChange }: {
  lang: Lang; handle: string; at: string | null;
  onChange: (next: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const en = lang === "en";
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(handle);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (editing) { setDraft(handle); setErr(null); ref.current?.focus(); } }, [editing, handle]);

  const locked = !!at && +new Date(at) > Date.now();
  const daysLeft = locked ? Math.ceil((+new Date(at!) - Date.now()) / 86_400_000) : 0;

  const save = async () => {
    const next = draft.trim().toLowerCase().replace(/^@+/, "");
    if (!next || next === handle) { setEditing(false); return; }
    setBusy(true); setErr(null);
    const r = await onChange(next);
    setBusy(false);
    if (r.ok) setEditing(false);
    else setErr(r.message ?? (en ? "Couldn't change it." : "바꾸지 못했어요."));
  };

  return (
    <div className="rmg-set-row">
      <div className="rmg-set-label">
        <p className="rmg-set-k">{en ? "Handle" : "핸들"}</p>
        <p className="rmg-set-d">
          {err
            ? err
            : locked
              ? (en ? `Others find you by this. Changeable again in ${daysLeft} day(s).` : `남이 나를 찾는 이름이에요. ${daysLeft}일 뒤에 다시 바꿀 수 있어요.`)
              : (en ? "Others find you by this — it's your invite code." : "남이 나를 찾는 이름이에요 — 이게 곧 초대코드입니다.")}
        </p>
      </div>
      {editing ? (
        <div className="rmg-handle">
          <input
            ref={ref}
            className="rmg-set-input rmg-handle-in"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
            placeholder="handle"
            aria-label={en ? "Handle" : "핸들"}
          />
          <button type="button" className="rmg-ppl-act" onClick={() => setEditing(false)}>{en ? "Cancel" : "취소"}</button>
          <button type="button" className="rmg-ppl-act primary" disabled={busy} onClick={() => void save()}>
            {busy ? "…" : (en ? "Save" : "저장")}
          </button>
        </div>
      ) : (
        <div className="rmg-handle">
          <span className="rmg-handle-v">@{handle}</span>
          <button type="button" className="rmg-ppl-act" disabled={locked} onClick={() => setEditing(true)}>
            {en ? "Change" : "바꾸기"}
          </button>
        </div>
      )}
    </div>
  );
}

/** 설정 — 가로 옵션의 '설정 란'. 워크스페이스 스토어 설정을 그대로 편집(이름·언어·유형·주 시작·테마·알림). */
export function SettingsPanel({ settings, onChange, theme, onTheme, mounted, lang, onReplayGuide, remote, handle, handleAt, onHandle }: {
  onReplayGuide: () => void;
  remote: RemoteState;
  /** 내 핸들과, 언제 다시 바꿀 수 있는지. 로그인 전에는 null. */
  handle: string | null;
  handleAt: string | null;
  onHandle: (next: string) => Promise<{ ok: boolean; message?: string }>;
  settings: Settings;
  onChange: (patch: Partial<SettingsPanelProps>) => void;
  theme: string | undefined;
  onTheme: (t: "light" | "dark") => void;
  mounted: boolean;
  lang: Lang;
}) {
  const t = L(lang);
  return (
    <div className="rmg-set">
      <AccountRow lang={lang} remote={remote} />
      <div className="rmg-set-row">
        <div className="rmg-set-label">
          <p className="rmg-set-k">{lang === "en" ? "Guide" : "사용 가이드"}</p>
          {/* 길이를 먼저 말한다 — 얼마나 걸리는지 모르는 안내는 다시 보기 자체가 결심이 된다. */}
          <p className="rmg-set-d">
            {lang === "en"
              ? "Nine steps on the real screen. About 2 min — Esc leaves anytime."
              : "진짜 화면 위에서 아홉 걸음. 2분 남짓이고, Esc 로 언제든 나갈 수 있어요."}
          </p>
        </div>
        <button type="button" className="rmg-ppl-act" onClick={onReplayGuide}>
          {lang === "en" ? "Replay" : "다시 보기"}
        </button>
      </div>
      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setName}</p><p className="rmg-set-d">{t.setNameD}</p></div>
        <input
          className="rmg-set-input"
          value={settings.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t.setName}
          aria-label={t.setName}
        />
      </div>

      {/* 핸들 — 남이 나를 찾는 이름이자 초대코드.
          가입할 때 이메일 앞부분에서 기계가 뽑아 붙인 것이라(0004), 한 번은
          자기가 정할 수 있어야 남에게 알려 줄 이름이 된다. 다만 자주 바뀌면
          초대코드가 아니게 되므로 30일에 한 번이고, 놓아준 이름은 아무도 못 가져간다. */}
      {handle && <HandleRow lang={lang} handle={handle} at={handleAt} onChange={onHandle} />}


      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setLang}</p><p className="rmg-set-d">{t.setLangD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setLang}>
          {([["ko", "한국어"], ["en", "English"]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.language === v ? "on" : ""}`} onClick={() => onChange({ language: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setMode}</p><p className="rmg-set-d">{t.setModeD}</p></div>
        {/* Context 는 여기 한 곳에서만 고른다 — 최상위 탭은 늘 오늘·캘린더·사람 셋이다.
            이름표도 설정에서 지어내지 않고 MODE_CONFIG 에서 그대로 가져온다. */}
        <div className="rmg-seg" role="group" aria-label={t.setMode}>
          {USER_MODES.map((v) => (
            <button
              key={v}
              type="button"
              className={`rmg-seg-btn ${normalizeMode(settings.mode) === v ? "on" : ""}`}
              aria-pressed={normalizeMode(settings.mode) === v}
              onClick={() => onChange({ mode: v })}
            >
              {MODE_CONFIG[v].label[lang === "en" ? "en" : "ko"]}
            </button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setWeek}</p><p className="rmg-set-d">{t.setWeekD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setWeek}>
          {([["sun", t.segSun], ["mon", t.segMon]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.weekStart === v ? "on" : ""}`} onClick={() => onChange({ weekStart: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setTheme}</p><p className="rmg-set-d">{t.setThemeD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setTheme}>
          {([["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${mounted && theme === v ? "on" : ""}`} onClick={() => onTheme(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setSize}</p><p className="rmg-set-d">{t.setSizeD}</p></div>
        {/* 칸이 아니라 바 — 편한 크기는 사람마다 세 칸에 딱 떨어지지 않는다. */}
        <div className="rmg-size">
          <span className="rmg-size-a">가</span>
          <input
            type="range"
            className="rmg-size-bar"
            min={TEXT_SCALE_MIN}
            max={TEXT_SCALE_MAX}
            /* 0.01 — 손끝을 따라오게. 0.02 는 한 칸씩 툭툭 걸리는 느낌을 준다. */
            step={0.01}
            value={settings.textScale}
            onChange={(e) => onChange({ textScale: Number(e.target.value) })}
            aria-label={t.setSize}
          />
          <span className="rmg-size-b">가</span>
          <span className="rmg-size-v">{Math.round(settings.textScale * 100)}%</span>
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setNotif}</p><p className="rmg-set-d">{t.setNotifD}</p></div>
        <button type="button" role="switch" aria-checked={settings.notifications} className={`rmg-switch ${settings.notifications ? "on" : ""}`} onClick={() => onChange({ notifications: !settings.notifications })}><span className="rmg-switch-dot" /></button>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setAuto}</p><p className="rmg-set-d">{t.setAutoD}</p></div>
        <button type="button" role="switch" aria-checked={settings.autoConfirm} className={`rmg-switch ${settings.autoConfirm ? "on" : ""}`} onClick={() => onChange({ autoConfirm: !settings.autoConfirm })}><span className="rmg-switch-dot" /></button>
      </div>
    </div>
  );
}


/* 설정의 모양은 스토어가 쥔 Settings 하나뿐이다 — 여기서 같은 모양을 또 적으면
   필드가 늘 때마다 두 곳이 어긋난다(실제로 mode 가 그렇게 어긋나 있었다). */
type SettingsPanelProps = Settings;
