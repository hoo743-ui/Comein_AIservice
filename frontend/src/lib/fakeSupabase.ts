/**
 * Comein · 시험용 가짜 Supabase.
 *
 * 이 파일의 값어치는 **realtime-js 를 정직하게 흉내 내는 데** 있다. 편한 대로 만들면
 * 통과하는 시험은 아무것도 증명하지 못한다. 그래서 아래 두 가지는 설치된
 * @supabase/realtime-js 2.112 의 소스를 그대로 옮겨 왔다.
 *
 *   1) RealtimeClient.channel(topic) — 같은 topic 이 이미 있으면 **그 인스턴스를 그대로 돌려준다.**
 *        const exists = this.getChannels().find((c) => c.topic === realtimeTopic)
 *        if (!exists) { …새로 만들어 push… } else { return exists }
 *   2) RealtimeChannel.subscribe() — 이미 join 된 채널이면 **아무 일도 하지 않는다**(던지지도 않는다).
 *        if (this.channelAdapter.isClosed()) { …join… }
 *   3) removeChannel 은 **비동기**다 — 떠나는 중인 채널이 목록에 잠깐 남아 있다.
 *      이 틈이 바로 "상대의 말이 새로고침해야 보이던" 버그가 살던 자리다.
 *
 * 시험에서만 쓴다. 앱 번들에는 들어가지 않는다(아무도 import 하지 않는다).
 */

type Row = Record<string, any>;
type Bind = { table: string; event: string; cb: (payload: any) => void };

export type FakeChannel = {
  topic: string;
  /** "closed" | "joined" | "leaving" — realtime-js 의 상태를 줄여 옮긴 것. */
  state: string;
  binds: Bind[];
  on: (type: string, filter: any, cb: (p: any) => void) => FakeChannel;
  subscribe: (cb?: (status: string, err?: Error) => void) => FakeChannel;
  /** 시험이 서버인 척 한 줄을 밀어 넣는다. */
  emit: (table: string, event: "INSERT" | "UPDATE" | "DELETE", row: Row) => void;
  /** 시험이 소켓을 끊는다. */
  fail: (reason: string) => void;
};

export type FakeDb = {
  uid: string;
  tables: Record<string, Row[]>;
  rpc?: Record<string, (args: any) => any>;
};

export function makeFakeSupabase(db: FakeDb) {
  const channels: FakeChannel[] = [];
  const authListeners: ((event: string) => void)[] = [];
  let session: any = { user: { id: db.uid }, access_token: "test-token" };
  /** getSession 이 즉시 답하지 않게 — 진짜는 네트워크다. 그 틈에서 경합이 난다. */
  let sessionDelay = 0;

  const makeChannel = (topic: string): FakeChannel => {
    let statusCb: ((s: string, e?: Error) => void) | undefined;
    const ch: FakeChannel = {
      topic: `realtime:${topic}`,
      state: "closed",
      binds: [],
      on(_type, filter, cb) {
        ch.binds.push({ table: filter.table, event: filter.event, cb });
        return ch;
      },
      subscribe(cb) {
        // ★ 이미 join 된 채널이면 조용한 no-op. 던지지 않는다.
        if (ch.state !== "closed") return ch;
        ch.state = "joined";
        statusCb = cb;
        queueMicrotask(() => { if (ch.state === "joined") cb?.("SUBSCRIBED"); });
        return ch;
      },
      emit(table, event, row) {
        if (ch.state !== "joined") return;   // 떠난 채널은 아무것도 받지 못한다
        for (const b of ch.binds) {
          if (b.table !== table) continue;
          if (b.event !== "*" && b.event !== event) continue;
          b.cb({ eventType: event, new: row, old: row });
        }
      },
      fail(reason) {
        if (ch.state !== "joined") return;
        ch.state = "closed";
        statusCb?.("CHANNEL_ERROR", new Error(reason));
      },
    };
    return ch;
  };

  /** PostgREST 질의 흉내 — 필요한 만큼만. thenable 이라 await 이 그대로 통한다. */
  const query = (table: string) => {
    let rows = () => (db.tables[table] ?? []).slice();
    const filters: ((r: Row) => boolean)[] = [];
    const builder: any = {
      select: () => builder,
      order: () => builder,
      eq: (col: string, v: any) => { filters.push((r) => r[col] === v); return builder; },
      in: (col: string, vs: any[]) => { filters.push((r) => vs.includes(r[col])); return builder; },
      maybeSingle: async () => {
        const out = rows().filter((r) => filters.every((f) => f(r)));
        return { data: out[0] ?? null, error: null };
      },
      then: (res: any, rej: any) => {
        const out = rows().filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: out, error: null }).then(res, rej);
      },
    };
    return builder;
  };

  const client: any = {
    auth: {
      getSession: async () => {
        if (sessionDelay) await new Promise((r) => setTimeout(r, sessionDelay));
        return { data: { session } };
      },
      onAuthStateChange: (cb: (event: string) => void) => {
        authListeners.push(cb);
        // supabase-js 는 구독을 거는 순간 INITIAL_SESSION 으로 반드시 한 번 운다.
        queueMicrotask(() => cb("INITIAL_SESSION"));
        return { data: { subscription: { unsubscribe: () => {
          const i = authListeners.indexOf(cb);   // 내 것만 뗀다 — 남의 귀까지 막지 않는다
          if (i >= 0) authListeners.splice(i, 1);
        } } } };
      },
    },
    from: (table: string) => query(table),
    rpc: async (name: string, args: any) => {
      const fn = db.rpc?.[name];
      return fn ? { data: fn(args), error: null } : { data: [], error: null };
    },
    channel: (topic: string) => {
      const t = `realtime:${topic}`;
      const exists = channels.find((c) => c.topic === t);   // ★ 같은 이름이면 있던 것
      if (exists) return exists;
      const ch = makeChannel(topic);
      channels.push(ch);
      return ch;
    },
    getChannels: () => channels.slice(),
    removeChannel: async (ch: FakeChannel) => {
      ch.state = "leaving";                                  // ★ 떠나는 중 — 목록엔 아직 있다
      await Promise.resolve();
      ch.state = "closed";
      const i = channels.indexOf(ch);
      if (i >= 0) channels.splice(i, 1);
    },
  };

  return {
    client,
    /** 시험이 서버인 척 표를 직접 고친다. */
    tables: db.tables,
    /** 서버 함수의 답을 시험이 정한다 — 막히는 경우도 실제로 겪어 봐야 한다. */
    rpc: (db.rpc ??= {}),
    /** 지금 살아 있는(join 된) 채널들. */
    live: () => channels.filter((c) => c.state === "joined"),
    /** 이름이 tag 를 품은 살아 있는 채널 하나. */
    liveWith: (tag: string) => channels.find((c) => c.state === "joined" && c.topic.includes(tag)),
    /** 서버가 한 줄을 밀어 넣는다 — 살아 있는 채널 전부에게. */
    push: (table: string, event: "INSERT" | "UPDATE" | "DELETE", row: Row) => {
      for (const c of channels.filter((x) => x.state === "joined")) c.emit(table, event, row);
    },
    fireAuth: (event: string) => { for (const cb of [...authListeners]) cb(event); },
    setSession: (s: any) => { session = s; },
    setSessionDelay: (ms: number) => { sessionDelay = ms; },
  };
}
