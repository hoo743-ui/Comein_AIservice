"use client";

/**
 * Google 실연동 — 브라우저 OAuth(Google Identity Services). 백엔드/시크릿 불필요, 무료.
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID 가 있어야 활성화(없으면 데모로 폴백).
 *
 * 준비(무료, 약 5분):
 * 1) https://console.cloud.google.com → 프로젝트 생성
 * 2) API 및 서비스 → 라이브러리에서 "Google Calendar API", "People API" 사용 설정
 * 3) OAuth 동의 화면 구성(외부, 테스트 사용자에 본인 계정 추가)
 * 4) 사용자 인증 정보 → OAuth 클라이언트 ID(웹) 생성 →
 *    승인된 자바스크립트 원본에 http://localhost:3000 추가
 * 5) 발급된 클라이언트 ID를 .env.local 의 NEXT_PUBLIC_GOOGLE_CLIENT_ID 에 저장
 */

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
export const googleConfigured = Boolean(googleClientId);

export const GOOGLE_SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  // 저장된 연락처 + 기타(자동수집) 연락처 모두
  contacts:
    "https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly",
} as const;

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** GIS 스크립트를 미리 로드(마운트 시 호출) — 클릭 시 팝업이 제스처 안에서 열리도록. */
export function preloadGoogle() {
  if (googleClientId) void loadGis();
}

/**
 * OAuth 토큰 발급(팝업). 팝업 차단을 피하려면 클릭 핸들러에서 동기적으로 호출해야 하므로
 * 여기서는 await 없이 즉시 requestAccessToken 을 부른다(스크립트는 preloadGoogle 로 선로딩).
 */
export function getGoogleToken(scope: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!googleClientId) {
      reject(new Error("Google Client ID 미설정"));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      void loadGis(); // 다음 클릭을 위해 로드 시작
      reject(new Error("구글 로그인 준비 중이에요. 잠깐 뒤 다시 눌러주세요."));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (resp: any) => {
        if (resp?.error) reject(new Error(resp.error));
        else resolve(resp.access_token as string);
      },
    });
    client.requestAccessToken();
  });
}

export interface ImportedEvent {
  title: string;
  start: string;
  end?: string;
  location?: string;
}
export interface ImportedContact {
  name: string;
  email?: string;
  phone?: string;
  org?: string;
}

/** 다가오는 캘린더 일정 가져오기(primary). */
export async function fetchGoogleEvents(token: string): Promise<ImportedEvent[]> {
  const timeMin = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(timeMin)}&maxResults=20&singleEvents=true&orderBy=startTime`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`캘린더 조회 실패(${r.status})`);
  const data = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((e: any) => ({
    title: e.summary ?? "(제목 없음)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
  }));
}

/** 저장된 연락처 가져오기(People API connections). */
export async function fetchGoogleContacts(token: string): Promise<ImportedContact[]> {
  const url =
    "https://people.googleapis.com/v1/people/me/connections" +
    "?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=200";
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`연락처 조회 실패(${r.status})`);
  const data = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.connections ?? []).map((p: any) => ({
    name: p.names?.[0]?.displayName ?? "이름 없음",
    email: p.emailAddresses?.[0]?.value,
    phone: p.phoneNumbers?.[0]?.value,
    org: p.organizations?.[0]?.name,
  }));
}

/** 기타(자동수집) 연락처 — 메일 주고받은 사람 등. connections 가 비었을 때 보완. */
export async function fetchGoogleOtherContacts(token: string): Promise<ImportedContact[]> {
  const url =
    "https://people.googleapis.com/v1/otherContacts" +
    "?readMask=names,emailAddresses,phoneNumbers&pageSize=200";
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`기타 연락처 조회 실패(${r.status})`);
  const data = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.otherContacts ?? []).map((p: any) => ({
    name: p.names?.[0]?.displayName ?? p.emailAddresses?.[0]?.value ?? "이름 없음",
    email: p.emailAddresses?.[0]?.value,
    phone: p.phoneNumbers?.[0]?.value,
  }));
}
