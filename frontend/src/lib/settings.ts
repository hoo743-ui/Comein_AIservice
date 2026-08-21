/**
 * Comein · 설정의 모양.
 *
 * 왜 store 에서 떼어 놓았나 —
 *   설정을 이 기기에 남기는 일(`lib/prefs.ts`)은 저장 함수 한 곳에서만 일어나야 한다.
 *   그래서 store 가 prefs 를 부르는데, prefs 도 설정의 모양(타입·글자 크기 한계)을
 *   알아야 하므로 둘이 서로를 가리키게 된다. 타입만 오가면 컴파일 뒤에 지워지지만
 *   **상수는 남아서 진짜 순환이 된다** — 모듈이 서로를 반쯤 초기화된 채로 보게 되고,
 *   그때 나는 오류는 원인과 한참 떨어진 곳에서 터진다.
 *
 *   그래서 둘 다 아무것도 되부르지 않는 이 잎사귀(leaf) 하나를 본다. store 는 여기 것을
 *   그대로 다시 내보내므로(`export type ... from`), 쓰던 쪽은 고칠 것이 없다.
 */

import type { UserMode } from "./mode";

export type Language = "ko" | "en";

/** 사용자 Context. 실제 값과 해석 규칙은 `lib/mode.ts` 가 쥔다 —
 *  화면은 그쪽 훅(useCurrentMode)으로만 읽고, 여기는 저장되는 자리일 뿐이다.
 *  (예전 값 office·general 은 normalizeMode 가 흡수한다.) */
export type Mode = UserMode;

/** 글자 크기 배율. 칸이 아니라 연속값 — 사람마다 편한 크기가 세 칸에 딱 떨어지지 않는다. */
export type TextScale = number;
export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.4;

export interface Settings {
  name: string;
  language: Language;
  /** 사용 유형 — 오늘의 흐름과 일정이 나뉘는 갈래 이름이 여기서 갈린다(`lib/mode.ts`). */
  mode: Mode;
  weekStart: "sun" | "mon";
  notifications: boolean;
  autoConfirm: boolean; // AI 제안 일정을 자동 확정할지
  textScale: TextScale; // 전체 글자 크기 배율
}
