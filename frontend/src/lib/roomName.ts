/**
 * Comein · 자리의 첫 이름.
 *
 * 왜 이 파일이 있는가 —
 *   같은 사람들이 다시 모인다. 그게 사람이 일하는 방식이다. 그런데 이름을 "새 일정" 이나
 *   "김서준님과의 자리" 로 고정해 붙이면, 세 번째 모임쯤부터 목록에 **똑같은 줄이 여러 개**
 *   서게 된다. 어느 것이 지난주 회의고 어느 것이 내일 저녁인지 열어 봐야 안다.
 *
 * 그래서 이름은 '무엇에 대한 자리인가' 가 아니라 **'다른 것과 어떻게 다른가'** 로 짓는다.
 *   처음 만나는 사람과는 사람 이름으로 (그게 그 자리의 전부다)
 *   두 번째부터는 시간으로  (사람은 이미 같으니 사람 이름은 아무것도 구별해 주지 않는다)
 *
 * 그리고 그 시간 이름조차 이미 쓰이고 있으면 한 겹 더 좁힌다 —
 *   "수요일 저녁" → "8월 20일 저녁" → "8월 20일 19:00"
 *
 * 이건 **첫 이름**일 뿐이다. 이야기가 쌓이면 AI 가 그 자리를 뭐라고 부를지 알게 되고,
 * 그때 사람에게 권한다(EventPanel 의 rename). 몰래 갈아 끼우지 않는다.
 */

export type Lang = "ko" | "en";

/** 하루를 다섯으로 — 사람이 시각을 부르는 방식. "14시" 보다 "점심" 이 먼저 떠오른다. */
function partOfDay(h: number, en: boolean): string {
  if (h >= 5 && h < 11) return en ? "morning" : "아침";
  if (h >= 11 && h < 14) return en ? "lunch" : "점심";
  if (h >= 14 && h < 18) return en ? "afternoon" : "오후";
  if (h >= 18 && h < 22) return en ? "evening" : "저녁";
  return en ? "night" : "밤";
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const weekday = (d: Date, en: boolean) => (en ? WEEKDAY_EN[d.getDay()] : `${WEEKDAY_KO[d.getDay()]}요일`);
const monthDay = (d: Date, en: boolean) =>
  en ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getDate()}`
     : `${d.getMonth() + 1}월 ${d.getDate()}일`;
const clock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** 비교는 공백과 대소문자를 무시한다 — "수요일 저녁" 과 "수요일  저녁" 이 다른 이름일 이유가 없다. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function suggestEventTitle(input: {
  /** 나를 뺀 사람들의 이름. 빈 배열이면 혼자 두는 자리다. */
  peerNames: string[];
  start: Date;
  /** 같은 사람들과 이미 있는 자리들의 제목. 여기 있는 이름은 다시 쓰지 않는다. */
  existing: string[];
  lang: Lang;
}): string {
  const { peerNames, start, existing, lang } = input;
  const en = lang === "en";
  const taken = new Set(existing.map(norm));
  const free = (s: string) => !taken.has(norm(s));

  const when = partOfDay(start.getHours(), en);
  const names = peerNames.filter(Boolean);

  // 사람 이름으로 부르는 길 — 처음 만나는 자리에서만. 두 번째부터는 아무것도 구별해 주지 않는다.
  const byPeople = names.length === 0 ? null
    : names.length === 1 ? (en ? `With ${names[0]}` : `${names[0]}님과의 자리`)
    : (en ? `With ${names[0]} +${names.length - 1}` : `${names[0]}님 외 ${names.length - 1}명과의 자리`);

  // 좁혀 가는 사다리. 위에서부터 아직 쓰이지 않은 첫 이름을 쓴다.
  const ladder = [
    ...(byPeople ? [byPeople] : []),
    en ? `${weekday(start, true)} ${when}` : `${weekday(start, false)} ${when}`,
    `${monthDay(start, en)} ${when}`,
    `${monthDay(start, en)} ${clock(start)}`,
  ];

  for (const name of ladder) if (free(name)) return name;

  // 여기까지 다 쓰였다 — 같은 사람들과 같은 날 같은 시각에 자리가 또 생겼다는 뜻이다.
  // 숫자를 붙이는 건 마지막 수단이고, 그래서 마지막에만 한다.
  const base = `${monthDay(start, en)} ${clock(start)}`;
  for (let n = 2; n < 50; n++) {
    const candidate = en ? `${base} (${n})` : `${base} (${n})`;
    if (free(candidate)) return candidate;
  }
  return base;
}
