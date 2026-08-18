/**
 * Comein · 문턱 판정 — 들어온 사람과 처음 온 사람을 가른다.
 *
 * 예전에는 워크스페이스가 마운트 직후 sessionStorage 하나만 보고, 없으면 곧바로
 * `/experience` 로 되돌렸다. 그건 **탭 하나의 기억**이라 새 탭·북마크·복구된 세션에서는
 * 늘 비어 있다. 그래서 이미 로그인해 있는 사람도 새로고침 한 번에 인트로 앞에 다시 섰다.
 * 들어온 사람을 문 앞에 다시 세우는 것은 환대가 아니라 검문이다.
 *
 * 판단을 화면 밖으로 꺼내 둔다 — 이 표는 눈으로 좇기보다 시험으로 못 박는 편이 맞다.
 */

export const ENTERED_KEY = "comein:entered";
/** 문턱 '연출' 을 한 세션에 한 번만 재생하기 위한 기억. 들어왔는지 여부와는 뜻이 다르다. */
export const THRESHOLD_KEY = "comein:reimagine";

export type EntrySignals = {
  /** 이미 문이 열려 있는가(화면 상태). */
  entered: boolean;
  /** 이 브라우저가 기억하는가 — 상태보다 이쪽이 먼저다(아래 주석 참고). */
  remembered: boolean;
  /** 인트로로 옮기는 중. */
  leaving: boolean;
  /** 나가는 중 — 로그아웃과 문턱 판정이 서로를 밀지 않게. */
  exiting: boolean;
  /** Supabase 연결 정보가 있는가. 없으면 이 앱은 혼자 도는 로컬 앱이다. */
  configured: boolean;
  /** 세션을 한 번이라도 확인했는가. */
  ready: boolean;
  signedIn: boolean;
};

export type EntryVerdict =
  /** 아무것도 하지 않는다 — 이미 안에 있거나, 아직 판단할 때가 아니다. */
  | "hold"
  /** 문을 연다. 이 사람은 이미 들어온 사람이다. */
  | "enter"
  /** 인트로로 보낸다. 처음 온 사람이다. */
  | "intro";

export function entryVerdict(s: EntrySignals): EntryVerdict {
  if (s.leaving || s.exiting) return "hold";

  // 상태(entered)가 아니라 기억을 먼저 묻는다.
  // 같은 커밋 안에서 setEntered(true) 는 아직 반영되지 않았고, 그 한 프레임에 이 판정이
  // '처음 온 사람' 으로 잘못 읽으면 이미 들어와 있던 사람을 인트로로 내보낸다.
  if (s.entered || s.remembered) return "hold";

  // 연결이 있는 앱이라면, 로그인 여부를 알기 전에는 아무 쪽으로도 밀지 않는다.
  if (s.configured && !s.ready) return "hold";
  if (s.configured && s.signedIn) return "enter";

  return "intro";
}
