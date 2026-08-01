// Comein · 백엔드 HTTP 클라이언트 (transport 레이어)
// 계약: docs/10_API.md (AI↔프론트 JSON Schema). 도메인 타입: ./types.
//
// 경로 현황(2026-07): 백엔드(backend/app)에 실제로 존재하는 건 `/health`, `/api/chat`.
// 마크다운이 그리는 목표 계약(`/api/ai/parse` → AiResult, `/api/auth/*`)은 아직 미구현이라
// 아래에 타입·함수 자리만 두고 TODO로 표시한다. 백엔드가 해당 경로를 만들면 이 파일만 교체.

/** 백엔드 베이스 URL. Vercel/로컬 모두 환경변수로 주입한다.
 *  - 로컬:  .env.local → NEXT_PUBLIC_API_BASE=http://localhost:8000
 *  - 배포:  Vercel 환경변수 → https://<render-service>.onrender.com
 *  미설정 시 상대경로("")로 폴백 → 목업/동일 오리진에서도 안전. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 공통 fetch 래퍼 — JSON 직렬화/역직렬화 + 에러 정규화. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    throw new ApiError(res.status, `API ${res.status} ${res.statusText} · ${path}`, body);
  }

  // 204 No Content 등 본문 없는 응답 방어
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ────────────────────────────────────────────────────────────
// 살아있는 엔드포인트 (지금 테스트 가능)
// ────────────────────────────────────────────────────────────

/** 헬스 체크 — 연결 배선 스모크 테스트용. GET /health → {"status":"ok"} */
export function health(): Promise<{ status: string }> {
  return request("/health");
}

/** 채팅 요청 — backend/app/api/endpoints/chat.py 계약과 1:1 대응. */
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

/** 채팅 응답 — 현재 백엔드가 반환하는 형태(ChatResponse). */
export interface ChatResponse {
  reply: string;
  intent?: string | null;
  cards?: Record<string, unknown>[];
}

/** POST /api/chat — 모든 기능의 입구(자연어 → 자연어 응답 + 카드). */
export function chat(req: ChatRequest): Promise<ChatResponse> {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ────────────────────────────────────────────────────────────
// 목표 계약 (docs/10_API.md) — 백엔드 미구현. 경로 생기면 TODO 해제.
// ────────────────────────────────────────────────────────────

export type Intent = "schedule" | "todo" | "memo" | "meeting" | "chat";

/** docs/10_API.md의 AiResult 계약. `parseMessage`가 최종적으로 이 형태를 반환한다. */
export interface AiResult {
  reply: string;
  intent: Intent;
  confidence?: number; // 0..1
  entity?: {
    op: "create" | "update";
    type: Exclude<Intent, "chat">;
    data: Record<string, unknown>; // intent별 부분 필드 (docs/10_API.md 표 참고)
  };
  suggestions?: { kind: string; message: string; actions?: string[] }[];
}

/**
 * 자연어 파싱 seam — 프론트는 이 함수만 알면 된다(docs/10_API.md §목표 seam).
 * TODO(backend): `POST /api/ai/parse`가 생기면 아래 주석을 실제 호출로 교체.
 *   return request<AiResult>("/api/ai/parse", { method: "POST", body: JSON.stringify({ text }) });
 * 그 전까지는 살아있는 `/api/chat`으로 대체해 최소 계약(reply/intent)을 채워 반환한다.
 */
export async function parseMessage(text: string, conversationId?: string): Promise<AiResult> {
  const r = await chat({ message: text, conversation_id: conversationId });
  return {
    reply: r.reply,
    intent: (r.intent as Intent) ?? "chat",
    // entity/suggestions는 /api/chat이 아직 제공하지 않음 → /api/ai/parse 구현 후 채움.
  };
}
