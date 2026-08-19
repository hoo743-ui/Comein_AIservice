"use client";

/**
 * Comein · 그룹 — 같은 사람들이 다시 모인다.
 *
 * 이 화면이 왜 있는가 —
 *   지금까지 '여럿'은 일정 하나에 매인 것이었다. 자리를 만들 때마다 같은 사람들을 다시
 *   골랐고, 그 자리가 끝나면 그 묶음도 함께 사라졌다. 그런데 사람은 같은 사람들과 계속
 *   모인다(팀·스터디·동아리). 그래서 **사람의 묶음**을 일정보다 오래 사는 것으로 세웠다(0017).
 *
 * 여기서 지키는 셋 —
 *   · 레일에 네 번째 탭을 만들지 않는다. 그룹은 '사람' 안에 산다. 갈래마다 방을 하나씩
 *     주면 사용자가 분류를 의식하게 되고, 이 제품은 그러지 않기로 했다(§0 · §9 · §10.1).
 *   · **동기화는 손잡이다.** 자동으로 돌지 않는다 — 이미 지나간 자리에 사람을 소급해
 *     앉히는 것은 조용히 할 일이 아니다.
 *   · 새 시각 언어를 만들지 않는다. 여기 쓰인 클래스는 전부 사람·일정 패널이 이미 쓰던
 *     것이다. 조각마다 제 모양을 지어내면 그 순간부터 화면이 여러 앱처럼 보인다.
 */

import * as React from "react";
import { Users, X } from "lucide-react";

import { fmtDate, fmtTime } from "@/lib/format";
import { eventStamp } from "../datetime";
import { ME_ID, type Contact, type Group, type GroupMember, type Schedule } from "@/lib/types";
import type { Lang } from "../i18n";

// ── 갈래 안의 목록 ────────────────────────────────────

export function GroupLane({ teams, memberCountOf, openGroupId, q, lang, onOpenGroup, onNewGroup }: {
  teams: Group[];
  memberCountOf: (groupId: string) => number;
  openGroupId: string | null;
  /** 위 검색칸에 친 말. 그룹도 같은 칸으로 찾는다 — 찾는 자리를 늘리지 않는다. */
  q: string;
  lang: Lang;
  onOpenGroup?: (groupId: string) => void;
  onNewGroup?: () => void;
}) {
  const en = lang === "en";
  const shown = q ? teams.filter((g) => g.name.toLowerCase().includes(q)) : teams;

  if (teams.length === 0) {
    return (
      <div className="rmg-ppl-blank">
        <p className="rmg-ppl-blank-t">{en ? "No groups yet." : "아직 그룹이 없어요."}</p>
        <p className="rmg-ppl-blank-b">
          {en
            ? "Make one, and every event you create for it seats everyone."
            : "그룹을 만들면, 그 그룹으로 잡는 일정에 사람들이 저절로 앉아요."}
        </p>
      </div>
    );
  }

  return (
    <ul className="rmg-ppl-list">
      {shown.map((g) => {
        const on = openGroupId === g.id;
        const n = memberCountOf(g.id);
        return (
          <li key={g.id} className={`rmg-ppl ${on ? "on" : ""}`}>
            <button type="button" className="rmg-ppl-head" aria-current={on} onClick={() => onOpenGroup?.(g.id)}>
              <span className="rmg-ppl-av grp"><Users className="rmg-ppl-avic" /></span>
              <span className="rmg-ppl-txt">
                <span className="rmg-ppl-top">
                  <span className="rmg-ppl-name">{g.name}</span>
                </span>
                <span className="rmg-ppl-bottom">
                  <span className="rmg-ppl-prev faint">
                    {en ? `${n} people` : `${n}명`}
                    {g.ownerId === ME_ID ? (en ? " · yours" : " · 내가 만든") : ""}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── 그룹 만들기 ───────────────────────────────────────
// 새 자리 폼(NewRoomPanel)과 같은 뼈대를 쓴다. 만드는 일이 둘인데 모양이 둘이면
// 사용자는 그 둘이 다른 종류의 일이라고 배운다.

export function NewGroupPanel({ contacts, lang, onClose, onCreate }: {
  contacts: Contact[];
  lang: Lang;
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}) {
  const en = lang === "en";
  const [name, setName] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = name.trim();
    if (!label || busy) return;
    setBusy(true);
    onCreate(label, picked);
  };

  return (
    <aside className="rmg-evpanel" role="region" aria-label={en ? "New group" : "새 그룹"}>
      <div className="rmg-drawer-head">
        <div>
          <p className="rmg-drawer-title">{en ? "New group" : "새 그룹"}</p>
          {/* 사람은 나중에도 부를 수 있다 — 처음부터 다 고르게 하면 '그룹을 만든다' 가 결심이 된다. */}
          <p className="rmg-drawer-time">
            {en ? "People can join later. A name is enough." : "사람은 나중에 불러도 돼요. 이름만 있으면 됩니다"}
          </p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      <form className="rmg-newroom" onSubmit={submit}>
        <input
          className="rmg-newev-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={en ? "Group name — e.g. Capstone team" : "그룹 이름 — 예: 캡스톤 팀"}
          aria-label={en ? "Group name" : "그룹 이름"}
          autoFocus
        />

        <p className="rmg-eyebrow rmg-drawer-eye">
          {en ? `With ${picked.length}` : `함께할 사람 ${picked.length}명`}
        </p>
        {contacts.length === 0 ? (
          <p className="rmg-drawer-empty">
            {en ? "No one to add yet — connect with someone first." : "아직 부를 사람이 없어요 — 먼저 누군가와 이어 보세요."}
          </p>
        ) : (
          <div className="rmg-newroom-picks">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rmg-newroom-chip ${picked.includes(c.id) ? "on" : ""}`}
                aria-pressed={picked.includes(c.id)}
                onClick={() => toggle(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="rmg-newev-acts">
          <button type="button" className="rmg-ppl-act" onClick={onClose}>{en ? "Cancel" : "취소"}</button>
          <button type="submit" className="rmg-ppl-act primary" disabled={!name.trim() || busy}>
            {busy ? (en ? "Making…" : "만드는 중…") : (en ? "Create" : "만들기")}
          </button>
        </div>
      </form>
    </aside>
  );
}

// ── 그룹 하나 ─────────────────────────────────────────

export function GroupPanel({
  group, members, events, contacts, lang, isOwner,
  onClose, onRename, onRemove, onAddMember, onRemoveMember, onSync, onOpenEvent, onNewEvent,
}: {
  group: Group;
  members: GroupMember[];
  /** 이 그룹으로 잡힌 일정들(시간 순). */
  events: Schedule[];
  contacts: Contact[];
  lang: Lang;
  isOwner: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onSync: () => Promise<{ events: number; members: number } | null>;
  onOpenEvent: (eventId: string) => void;
  onNewEvent: () => void;
}) {
  const en = lang === "en";
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(group.name);
  const [adding, setAdding] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  /** 방금 맞춘 결과 한 줄. 스스로 사라지지 않는다 — 눌렀으면 무슨 일이 있었는지는 남아야 한다. */
  const [synced, setSynced] = React.useState<string | null>(null);

  React.useEffect(() => { setDraft(group.name); setEditing(false); setSynced(null); setAdding(false); }, [group.id, group.name]);

  const nameOf = (uid: string) =>
    uid === ME_ID ? (en ? "You" : "나") : (contacts.find((c) => c.id === uid)?.name ?? (en ? "Someone" : "누군가"));

  const already = new Set(members.map((m) => m.userId));
  const addable = contacts.filter((c) => !already.has(c.id));

  // 다가오는 것이 앞(가까운 것부터), 지난 것은 뒤(최근 것부터).
  // 사람 패널의 '함께하는 일정' 과 같은 규칙을 쓴다 — 같은 종류의 목록이 두 화면에서
  // 다른 순서로 서면, 사용자는 그 둘이 다른 것이라고 배운다.
  const now = Date.now();
  const ordered = React.useMemo(() => {
    const next = events.filter((e) => +new Date(e.start) >= Date.now())
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const past = events.filter((e) => +new Date(e.start) < Date.now())
      .sort((a, b) => +new Date(b.start) - +new Date(a.start));
    return [...next, ...past];
  }, [events]);

  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== group.name) onRename(draft); };

  const sync = async () => {
    if (syncing) return;
    setSyncing(true); setSynced(null);
    const r = await onSync();
    setSyncing(false);
    if (!r) return;                       // 실패는 스토어가 화면 위 한 줄로 말한다(writeError)
    setSynced(
      r.members === 0
        ? (en ? "Already in sync." : "이미 맞아 있었어요.")
        : (en ? `Seated ${r.members} across ${r.events} events.` : `일정 ${r.events}개에 ${r.members}명을 채웠어요.`),
    );
  };

  return (
    <aside className="rmg-evpanel" role="region" aria-label={group.name}>
      <div className="rmg-drawer-head">
        <div>
          {editing && isOwner ? (
            <input
              className="rmg-newev-title"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setDraft(group.name); setEditing(false); }
              }}
              aria-label={en ? "Group name" : "그룹 이름"}
              autoFocus
            />
          ) : (
            // 주인이 아니면 누를 것이 없다 — 서버도 주인만 받는다(0017 groups_update).
            // 안 되는 것을 눌리게 두면, 눌러 본 사람은 자기가 뭘 잘못했는지 묻게 된다.
            <p
              className="rmg-drawer-title"
              onClick={() => isOwner && setEditing(true)}
              role={isOwner ? "button" : undefined}
              tabIndex={isOwner ? 0 : undefined}
              onKeyDown={(e) => { if (isOwner && (e.key === "Enter" || e.key === " ")) setEditing(true); }}
              title={isOwner ? (en ? "Rename" : "이름 바꾸기") : undefined}
            >
              {group.name}
            </p>
          )}
          <p className="rmg-drawer-time">
            {en ? `${members.length} people · ${events.length} events` : `${members.length}명 · 일정 ${events.length}개`}
          </p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      {/* ── 사람 ── */}
      <p className="rmg-eyebrow rmg-drawer-eye">{en ? "People" : "사람"}</p>
      <ul className="rmg-drawer-plist">
        {members.map((m) => (
          <li key={m.userId} className="rmg-drawer-p">
            <span className="rmg-drawer-pav">{nameOf(m.userId).slice(0, 1)}</span>
            <span className="rmg-drawer-pname">{nameOf(m.userId)}</span>
            {m.role === "owner" && <span className="rmg-drawer-prole">{en ? "Owner" : "만든 사람"}</span>}
            {/* 스스로 나가는 것은 누구나, 남을 빼는 것은 주인만 — 서버가 그렇게 받는다.
                만든 사람은 뺄 수 없다(일정의 주최자를 못 빼는 것과 같은 이유다). */}
            {m.role !== "owner" && (isOwner || m.userId === ME_ID) && (
              <button
                type="button"
                className="rmg-drawer-px"
                onClick={() => onRemoveMember(m.userId)}
                aria-label={m.userId === ME_ID ? (en ? "Leave" : "나가기") : (en ? "Remove" : "제외")}
              >
                <X className="rmg-drawer-pxic" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (adding ? (
        <div className="rmg-drawer-add">
          {addable.length === 0 ? (
            <p className="rmg-drawer-empty">{en ? "Everyone is already in." : "이을 사람이 더 없어요."}</p>
          ) : (
            addable.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rmg-drawer-addbtn"
                onClick={() => { onAddMember(c.id); setAdding(false); }}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <button type="button" className="rmg-ppl-act" onClick={() => setAdding(true)}>
          {en ? "Add someone" : "사람 부르기"}
        </button>
      ))}

      {/* ── 그룹의 일정 ── */}
      <div className="rmg-pwith">
        <p className="rmg-pwith-k">{en ? "Calendar" : "그룹 일정"}</p>
        <div className="rmg-pwith-row">
          {ordered.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`rmg-pwith-chip ${+new Date(e.start) < now ? "past" : ""}`}
              onClick={() => onOpenEvent(e.id)}
              title={`${fmtDate(new Date(e.start))} · ${fmtTime(new Date(e.start))}`}
            >
              <span className="rmg-pwith-t">{e.title}</span>
              <span className="rmg-pwith-at">{eventStamp(new Date(e.start), en)} {fmtTime(new Date(e.start))}</span>
            </button>
          ))}
          <button type="button" className="rmg-pwith-new" onClick={onNewEvent}>
            {en ? "New" : "자리 만들기"}
          </button>
        </div>
        {events.length === 0 && (
          <p className="rmg-drawer-empty">
            {en
              ? "Nothing yet. Anything you make here seats everyone."
              : "아직 없어요. 여기서 만드는 자리에는 사람들이 저절로 앉아요."}
          </p>
        )}
      </div>

      {/* ── 맞추기 ──
          자동으로 돌지 않는 이유는 서버 쪽에 적혀 있다(0017 규칙 ②) — 이미 지나간 자리에
          사람을 소급해 앉히는 것은 조용히 할 일이 아니다. 그래서 손잡이가 여기 있다. */}
      <div className="rmg-pwith">
        <p className="rmg-pwith-k">{en ? "Sync" : "일정 맞추기"}</p>
        <p className="rmg-drawer-empty">
          {en
            ? "New members are not seated in earlier events on their own."
            : "나중에 들어온 사람은 지난 자리에 저절로 앉지 않아요."}
        </p>
        <button type="button" className="rmg-ppl-act" disabled={syncing || events.length === 0} onClick={() => void sync()}>
          {syncing ? (en ? "Syncing…" : "맞추는 중…") : (en ? "Sync now" : "지금 맞추기")}
        </button>
        {synced && <p className="rmg-prop-err" role="status">{synced}</p>}
      </div>

      {isOwner && (
        <div className="rmg-pwith">
          {/* 없애도 일정은 남는다 — 그 말을 버튼 옆에 적어 둔다. 지우기 전에 알아야 하는 것이다. */}
          <button type="button" className="rmg-ppl-act" onClick={onRemove}>
            {en ? "Delete group" : "그룹 없애기"}
          </button>
          <p className="rmg-drawer-empty">
            {en ? "The events stay — only the grouping goes." : "일정은 남아요. 묶음만 사라집니다."}
          </p>
        </div>
      )}
    </aside>
  );
}
