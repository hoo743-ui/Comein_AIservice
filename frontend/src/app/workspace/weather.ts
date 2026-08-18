/**
 * Comein · 하늘과 시각 — 인사말이 쓰는 것들.
 *
 * 오늘 화면의 첫 줄은 데이터가 아니라 한 문장이어야 한다(§0 — Invisible AI).
 * 그 문장을 만드는 재료가 여기 있다: 지금이 하루의 어디쯤인지, 밖이 어떤지.
 *
 * open-meteo 의 weather_code 를 우리 낱말로 옮기는 표도 여기 둔다 — 숫자를 화면에서
 * 해석하면 그 뜻이 화면마다 갈린다.
 */

import { Cloud, CloudRain, CloudSnow, Sun } from "lucide-react";

export function partOfDay(h: number) {
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

export const WCODE: Record<number, string> = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개",
  51: "이슬비", 53: "이슬비", 55: "이슬비", 61: "비", 63: "비", 65: "강한 비",
  71: "눈", 73: "눈", 75: "많은 눈", 80: "소나기", 81: "소나기", 82: "강한 소나기", 95: "뇌우",
};

export function weatherIconOf(c: string) {
  if (/맑/.test(c)) return Sun;
  if (/비|소나기|이슬/.test(c)) return CloudRain;
  if (/눈/.test(c)) return CloudSnow;
  return Cloud;
}

export function moodEn(h: number, c: string | null) {
  const adj = !c ? "calm" : /맑/.test(c) ? "clear" : /비|소나기|뇌우/.test(c) ? "rainy" : /눈/.test(c) ? "quiet" : "calm";
  return `A ${adj} ${partOfDay(h)}.`;
}

export function weatherWord(c: string | null, en: boolean) {
  if (!c) return en ? "Calm" : "잔잔함";
  if (/맑/.test(c)) return en ? "Clear" : "맑음";
  if (/비|소나기|이슬|뇌우/.test(c)) return en ? "Rainy" : "비";
  if (/눈/.test(c)) return en ? "Snow" : "눈";
  return en ? "Cloudy" : "흐림";
}

export function reflection(c: string | null) {
  if (!c) return "오늘 하루도 차근히 정리해 둘게요.";
  if (/맑/.test(c)) return "집중하기 좋은 하루예요. 중요한 일에 먼저 몰입해보세요.";
  if (/비|소나기|뇌우/.test(c)) return "차분히 몰입하기 좋은 날이에요. 하나씩 정리해 둘게요.";
  if (/눈/.test(c)) return "고요한 하루예요. 마음이 흩어지지 않게 곁에서 정리할게요.";
  return "잔잔한 하루예요. 흐름이 끊기지 않게 정리해 둘게요.";
}

export function reflectEn(c: string | null) {
  if (!c) return "I'll tidy today, step by step.";
  if (/맑/.test(c)) return "A good day to focus. Dive into what matters first.";
  if (/비|소나기|뇌우/.test(c)) return "A calm day for deep focus. I'll sort things one by one.";
  if (/눈/.test(c)) return "A quiet day. I'll keep things from scattering.";
  return "A gentle day. I'll keep the flow unbroken.";
}
