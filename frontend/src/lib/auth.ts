"use client";

/**
 * Comein · 프로토타입 인증/DB 레이어 (클라이언트 localStorage).
 * CLAUDE.md §7 User 엔티티(id·email·name·created_at)를 그대로 따른다.
 * ⚠️ 프로토타입: 비밀번호를 평문에 준하는 형태로 로컬에 저장한다. 실서비스는 백엔드(Supabase Auth 등)로 교체.
 * 실 DB 전환 시 이 모듈의 인터페이스(signUp/signIn/currentUser/signOut)만 유지하면 화면은 그대로 동작한다.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO
}
type StoredUser = User & { pw: string };

const USERS_KEY = "comein:users";
const SESSION_KEY = "comein:session";

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}
function writeUsers(u: StoredUser[]) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch {}
}
function newId() {
  try { return crypto.randomUUID(); } catch { return `u_${Date.now()}_${Math.floor(Math.random() * 1e6)}`; }
}
const strip = (u: StoredUser): User => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

export function signUp(email: string, name: string, pw: string): AuthResult {
  const e = email.trim().toLowerCase();
  if (!e || !/.+@.+\..+/.test(e)) return { ok: false, error: "올바른 이메일을 입력해 주세요." };
  if (pw.length < 6) return { ok: false, error: "비밀번호는 6자 이상이어야 해요." };
  const users = readUsers();
  if (users.some((u) => u.email === e)) return { ok: false, error: "이미 가입된 이메일이에요." };
  const user: StoredUser = { id: newId(), email: e, name: name.trim() || e.split("@")[0], createdAt: new Date().toISOString(), pw };
  users.push(user);
  writeUsers(users);
  try { localStorage.setItem(SESSION_KEY, user.id); } catch {}
  return { ok: true, user: strip(user) };
}

export function signIn(email: string, pw: string): AuthResult {
  const e = email.trim().toLowerCase();
  const users = readUsers();
  const u = users.find((x) => x.email === e);
  if (!u) return { ok: false, error: "가입된 계정이 없어요. 회원가입해 주세요." };
  if (u.pw !== pw) return { ok: false, error: "비밀번호가 일치하지 않아요." };
  try { localStorage.setItem(SESSION_KEY, u.id); } catch {}
  return { ok: true, user: strip(u) };
}

/** 소셜 로그인(프로토타입) — 제공자 이메일로 계정을 만들거나 이어 로그인. */
export function signInSocial(provider: string): AuthResult {
  const e = `${provider.toLowerCase()}-user@comein.app`;
  const users = readUsers();
  let u = users.find((x) => x.email === e);
  if (!u) {
    u = { id: newId(), email: e, name: `${provider} 사용자`, createdAt: new Date().toISOString(), pw: "" };
    users.push(u);
    writeUsers(users);
  }
  try { localStorage.setItem(SESSION_KEY, u.id); } catch {}
  return { ok: true, user: strip(u) };
}

export function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  let id = "";
  try { id = localStorage.getItem(SESSION_KEY) || ""; } catch { return null; }
  if (!id) return null;
  const u = readUsers().find((x) => x.id === id);
  return u ? strip(u) : null;
}

export function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}
