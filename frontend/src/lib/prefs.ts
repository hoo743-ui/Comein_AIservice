/**
 * Comein · 설정은 이 기기에 남는다.
 *
 * 왜 필요했나 —
 *   설정(사용 유형·언어·글자 크기·주 시작·자동 확정)은 스토어의 기본값으로만 있었다.
 *   그래서 '직장인'을 고르고 새로고침하면 조용히 '학생'으로 돌아왔다. 화면은 아무 말도
 *   하지 않았고, 되돌아온 것을 알아차리려면 Today 의 흐름 문구를 기억하고 있어야 했다.
 *   고른 것이 남지 않으면, 고르게 하는 것 자체가 거짓말이 된다.
 *
 * 왜 서버가 아니라 이 기기인가 —
 *   지금 저장에 쓰는 표는 `supabase/migrations/0001~0019` 뿐이고, 사용자 설정을 담을
 *   자리는 거기 없다. 표 없이 저장하는 척하지 않는다(CLAUDE.md §1 — 만들지 않은 것을
 *   있다고 말하지 않는다). 설정이 기기마다 다른 것은 대부분 자연스럽고, 정말로 계정을
 *   따라다녀야 한다고 판단되면 그때 표를 세우고 이 파일이 그쪽을 보게 하면 된다.
 *
 * `name` 은 함께 저장하지 않는다 —
 *   표시 이름은 사람의 것이지 이 브라우저의 것이 아니다. 계정에 붙어야 할 값을 기기에
 *   묶어 두면, 다른 기기로 옮겼을 때 왜 이름이 안 따라오는지 설명할 길이 없다.
 *   지금은 서버에 둘 자리가 없으므로 세션 안에서만 산다 — 없는 것을 있다고 하지 않는다.
 */

import {
  TEXT_SCALE_MAX, TEXT_SCALE_MIN,
  type Settings,
} from "./store";
import { normalizeMode, USER_MODES } from "./mode";

const KEY = "comein:prefs";

/** 이 기기에 남기는 것들. `name` 은 빠져 있다(위 주석). */
export type Prefs = Omit<Settings, "name">;

const LANGS = ["ko", "en"] as const;
const WEEK_STARTS = ["sun", "mon"] as const;

const oneOf = <T extends readonly string[]>(list: T, v: unknown): T[number] | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;

/**
 * 읽어 온다. 값이 하나라도 이상하면 **그 값만** 버리고 나머지는 살린다.
 *
 * 통째로 버리지 않는 이유 — clearmark 은 방↔시각 쌍이라 반쯤 맞으면 위험하지만, 여기는
 * 서로 독립적인 값들이다. 글자 크기 하나가 깨졌다고 사용 유형까지 되돌리면, 고쳐 준 바로
 * 그 증상이 다시 난다.
 */
export function loadPrefs(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};

    const out: Partial<Prefs> = {};
    const lang = oneOf(LANGS, v.language);
    if (lang) out.language = lang;
    // 예전 값(office·general)도, 모르는 값도 normalizeMode 가 이미 흡수한다 —
    // 여기서 한 번 더 거르면 같은 규칙이 두 곳에 생기고, 둘은 반드시 어긋난다.
    if (typeof v.mode === "string") out.mode = normalizeMode(v.mode);
    const ws = oneOf(WEEK_STARTS, v.weekStart);
    if (ws) out.weekStart = ws;
    if (typeof v.notifications === "boolean") out.notifications = v.notifications;
    if (typeof v.autoConfirm === "boolean") out.autoConfirm = v.autoConfirm;
    if (typeof v.textScale === "number" && Number.isFinite(v.textScale)) {
      // 범위 밖은 버리지 말고 죈다 — 손으로 고쳐 넣은 값이라도 화면은 읽을 수 있어야 한다.
      out.textScale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, v.textScale));
    }
    return out;
  } catch {
    return {};                                  // 사생활 모드 — 기억이 안 될 뿐이다
  }
}

/** 남긴다. 저장이 막혀 있어도 이번 세션의 화면은 그대로 돈다. */
export function savePrefs(s: Settings): void {
  try {
    const { name: _name, ...rest } = s;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch { /* 저장 못 해도 고른 것은 이번 세션 동안 살아 있다 */ }
}
