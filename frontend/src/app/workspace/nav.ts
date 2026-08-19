/**
 * Comein · 워크스페이스의 골격 어휘.
 *
 * 뷰가 셋이고(오늘·캘린더·사람), AI 가 나누는 갈래가 둘이다(시간 위의 일·시간 밖의 일).
 * 이 둘이 이 화면의 좌표계다 — 그래서 화면 코드보다 먼저, 한자리에 둔다.
 */

import { CalendarDays, Sparkles, Users } from "lucide-react";
import type * as React from "react";
import type { TodoPriority } from "@/lib/types";

export type View = "today" | "calendar" | "people";

export const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "today", label: "Today", icon: Sparkles },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "people", label: "People", icon: Users },
];

// AI는 두 갈래로만 정리한다 — 시간 위의 일(일정) · 시간 밖의 일(할 일).
// 회의는 일정으로 접히고, 메모는 아예 없앴다(백엔드 계약에서도 걷었다 — docs/24 §25).
// 갈래가 적을수록 사용자가 분류를 의식하지 않는다.
export type Kind = "일정" | "할 일";

// 영수증 — AI가 한 모든 일: 무엇 + 어디(목적지) + 언제. 즉시 실행하되 자취를 남긴다.
// 목적지가 없는 갈래도 있다(할 일). 그때 destView·destLabel 은 비고, 화면은 '어디로 갔다'고
// 말하지 않는다 — 없는 목적지를 적는 것이 곧 거짓말이었다.
export type Receipt = { id: number; at: number; title: string; kind: Kind; destView?: View; destLabel?: string; time: string | null; date?: Date; note?: string; priority?: TodoPriority };

// AI가 이해한 한 건. 확인 단계 없이 그대로 목적지로 배정된다(= 영수증이 된다).
// `end` 는 사용자가 끝 시각을 말했을 때만 있다 — 없으면 화면이 한 시간으로 둔다.
export type Parsed = { title: string; kind: Kind; time: string | null; date?: Date; end?: Date; note: string; priority?: TodoPriority; participants?: string[] };

// 갈 곳이 있는 갈래는 하나뿐이다.
//
// 할 일은 담을 표가 없다(supabase/migrations 에 todos 가 없다). 예전에는 여기서 '오늘'을
// 가리켜, 캡처가 "오늘로 정리했어요" 라고 말한 뒤 아무 데도 남지 않았다 — 화면이 하지 않은
// 일을 했다고 말한 셈이다. 갈 곳이 없으면 없다고 적는다(docs/24 §25).
export const DEST: Record<Kind, { view: View; label: string } | null> = {
  일정: { view: "calendar", label: "캘린더" },
  "할 일": null,
};

export const VIEW_LABEL: Record<View, string> = { today: "오늘", calendar: "캘린더", people: "사람" };

/** 레일 한 줄의 규격 — 행 높이와 행 사이 간격. CSS 토큰(--nav-row/--nav-gap)과
 *  활성 인디케이터의 이동 거리가 모두 이 두 숫자에서 나온다(어긋날 수 없게).
 *  인디케이터 위치를 px 로 직접 계산하는 이유: transform 값이 var() 안에서만 바뀌면
 *  브라우저가 재계산을 건너뛰어 표식이 이전 칸에 남는다. */
export const NAV_ROW = 40;

/** 손끝 기준의 한 줄. 40 은 커서에게는 넉넉하지만 손끝(~44)에는 한 뼘 모자란다.
 *  레일은 이 화면에서 유일한 길이라, 여기서 빗나가면 다른 데로 갈 방법이 없다.
 *  폭도 함께 자라야 한다 — 높이만 키우면 44×39 짜리 납작한 과녁이 된다(CSS 쪽 §레일 참고). */
export const NAV_ROW_TOUCH = 44;

export const NAV_GAP = 4;
