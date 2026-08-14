# 15. 배포 (Deploy)

> 데모/MVP: **Vercel(프론트) + Render(백엔드) + Supabase(DB)** — 전부 무료 티어.
> Release 이후 AWS 이관은 `21_ARCHITECTURE_DECISION_RECORD.md` 에서 결정한다.

```
GitHub 모노레포 1개
 ├ frontend/ ──▶ Vercel   (Root Directory = frontend)   사람이 보는 주소
 └ backend/  ──▶ Render   (Root Directory = backend)    프론트 코드가 부르는 주소
        └ ai/ 는 backend 런타임 안에서 사용
git push main → 두 플랫폼이 각자 자기 폴더만 보고 병렬 자동 배포
```

## 0. 지금 떠 있는 것 (2026-08-14 실측)

| | 주소 | 상태 |
|---|---|---|
| 백엔드 | `https://comein-aiservice.onrender.com` | ✅ Live (`/health` → `{"status":"ok","env":"production"}`) |
| 프론트 | `https://frontend-pied-one-74.vercel.app` | ✅ Live (프로덕션 별칭) |
| 프론트(브랜치) | `https://frontend-git-main-hoo743-uis-projects.vercel.app` | ✅ 같은 빌드 |
| LLM | Gemini (Render 환경변수에 키 등록) | ✅ 실제 호출 확인 |
| DB | 백엔드는 DB 에 붙지 않는다 | — 저장은 프론트가 Supabase 로 직행(§0-1) |

> Render 서비스 이름은 `comein-aiservice` 다 (`render.yaml` 의 `comein-api` 와 다름 —
> 대시보드에서 손으로 만들었기 때문). Blueprint 로 다시 만들면 이름이 갈리니 주의.

### 0-1. 배포가 둘로 갈리는 지점 — 무엇이 어디에 사는가

| | Vercel (프론트) | Render (백엔드) |
|---|---|---|
| 하는 일 | 화면, **그리고 데이터 전부** — Supabase 에 직접 붙는다(RLS + Realtime) | **AI 파싱만** — `/api/chat` · `/api/summary` |
| 상태 | Supabase 가 갖는다 | 없다. 요청 하나가 끝나면 아무것도 남지 않는다 |
| 비밀값 | `NEXT_PUBLIC_SUPABASE_*` (공개 anon 키 — 방어는 RLS 가 한다) | `GEMINI_API_KEY` · `GROQ_API_KEY` (브라우저에 둘 수 없는 것) |
| DB 접속 | — (클라이언트 SDK) | **없다** |

**나누는 기준은 "브라우저에 둘 수 있는가" 다.** LLM 키는 노출되면 남이 내 쿼터를 쓰므로
서버에 숨긴다. 데이터는 숨길 필요가 없다 — 사용자별 권한(RLS)으로 지킬 수 있기 때문이다.
그래서 백엔드에 DB 비밀번호가 없고, 백엔드가 죽어도 일정·대화는 계속 보인다.

2026-08-13 에 백엔드의 저장·조회 라우터(`/api/items` 등)와 `models/`·`alembic/`·
`core/database.py` 를 걷어내면서 이 그림이 코드와 일치하게 됐다 — `docs/24` §16.

---

## 1. Render 초기 세팅 (백엔드)

레포 루트의 [`render.yaml`](../render.yaml) 이 서비스 정의를 갖고 있다. **Blueprint 방식이 기본**이다.

### 1-1. 서비스 생성 (Blueprint)

1. https://dashboard.render.com → **New → Blueprint**
2. GitHub 계정 연결 → `hoo743-ui/Comein_AIservice` 선택 → Branch `main`
3. Render 가 `render.yaml` 을 읽어 `comein-api` 웹 서비스를 제안 → **Apply**
4. `sync: false` 로 표시된 환경변수는 이때 값을 물어본다 (아래 1-3 표). 아직 없는 값은 **빈 칸으로 두고 나중에 채워도 배포는 성공한다.**

> 대시보드에서 손으로 만들고 싶다면 **New → Web Service** 로 만들고 아래를 그대로 입력한다.
> Root Directory `backend` · Runtime `Python 3` · Build `pip install -r requirements.txt` ·
> Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT` · Health Check Path `/health` ·
> 환경변수에 `PYTHON_VERSION=3.12.7` 추가(미지정 시 Render 기본 버전이 올라가 의존성이 깨질 수 있음).

### 1-2. 확인

```
https://<서비스명>.onrender.com/health      → {"status":"ok","env":"production"}
https://<서비스명>.onrender.com/docs        → Swagger UI (경로는 /api/chat · /api/summary 둘뿐)
```

`/health/db` 는 없다(2026-08-13 제거). DB 를 쓰던 라우터들이 사라지면서, 아무것도 지키지
않으면서 옛 DB 를 가리켜 `down` 을 띄우는 표시등만 남았기 때문이다 — §0-1.

### 1-3. 환경변수

| 키 | 값 | 비고 |
|---|---|---|
| `PYTHON_VERSION` | `3.12.7` | 런타임 고정 |
| `ENV` | `production` | |
| `CORS_ORIGINS` | `https://a.vercel.app,https://b.vercel.app` | **쉼표 구분**(JSON 배열도 허용) |
| `CORS_ORIGIN_REGEX` | `https://frontend-.*\.vercel\.app` | **실제로 쓰는 값.** 아래 주의 참고 |

> ⚠️ **Vercel 은 한 프로젝트에 주소를 여러 개 준다** — 프로덕션 별칭, 브랜치 별칭
> (`...-git-main-...`), 배포별 고유 URL. 하나만 `CORS_ORIGINS` 에 넣으면 나머지 주소로
> 접속했을 때 전부 차단되고, 프론트는 그걸 조용히 삼킨 뒤 로컬 규칙으로 폴백한다
> (= "AI 가 멍청해졌다"처럼 보인다). 정규식 하나로 프로젝트 주소를 통째로 여는 게 안전하다.
> 값에 따옴표·공백을 넣지 말 것. 확인은 아래 프리플라이트로.
>
> ```bash
> curl -i -X OPTIONS https://comein-aiservice.onrender.com/api/chat \
>   -H "Origin: https://<확인할-도메인>" -H "Access-Control-Request-Method: POST" \
>   | grep -i access-control-allow-origin      # 헤더가 나오면 허용된 것
> ```
| ~~`DATABASE_URL`~~ · ~~`REDIS_URL`~~ | — | **더 이상 없다.** 백엔드는 DB 에 붙지 않는다(§0-1). 대시보드에 옛 값이 남아 있어도 무해하지만 지우는 편이 오해를 줄인다 |
| `JWT_SECRET` | Render 자동 생성 | 직접 넣지 말 것 |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | LLM 키 | AI 확정 후 |

- **비밀값은 Render 에만 둔다.** 프론트(`NEXT_PUBLIC_*`)는 브라우저에 노출되므로 절대 금지.
- 환경변수를 바꾸면 Render 가 자동 재배포한다.

---

## 2. Supabase(DB) 연결 — 백엔드에는 없다

**Render 에 넣을 DB 값은 없다.** 백엔드는 DB 에 붙지 않는다(§0-1).

DB 는 프론트가 직접 쓴다. 그래서 Supabase 관련 값은 전부 **Vercel** 쪽에 있다 —
`NEXT_PUBLIC_SUPABASE_URL` 과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`(3절).

> anon key 를 프론트에 두는 것은 실수가 아니다. 이 키는 **브라우저에 나가라고 만든 공개
> 키**이고, 실제 방어선은 키가 아니라 행 단위 권한(RLS)이다 — `supabase/migrations/*.sql`
> 의 정책이 `auth.uid()` 로 누가 무엇을 볼 수 있는지 정한다. 반대로 `service_role` 키는
> RLS 를 통째로 무시하므로 **프론트에 절대 두지 않는다.**

**스키마를 새 프로젝트에 세울 때**는 `supabase/migrations/` 의 `.sql` 을 번호순으로
대시보드 SQL Editor 에 붙여 실행한다(0001~). alembic 은 더 이상 쓰지 않는다 —
백엔드가 갖고 있던 5개 테이블과 함께 걷어냈다.

---

## 3. Vercel 연결 (프론트)

1. Vercel 프로젝트 → **Settings → Environment Variables**
2. `NEXT_PUBLIC_API_BASE = https://<서비스명>.onrender.com` (Production/Preview 모두)
3. Redeploy
4. 브라우저 콘솔에서 `health()` 성공 → 배선 완료. CORS 에러가 나면 Render `CORS_ORIGINS` 에 그 도메인이 있는지 확인.

---

## 4. 무료 티어 콜드스타트 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| 첫 요청 20~30초 | Render 무료: 15분 무요청 시 슬립 | 외부 cron 으로 `/health` 10분마다 GET (UptimeRobot·cron-job.org). self-ping 은 안 됨 |
| 1주 뒤 DB 정지 | Supabase 무료: 무활동 시 일시정지 | 프론트가 직접 붙으므로 **사람이 쓰면 안 잔다.** 백엔드로는 깨울 수 없다(붙지 않으므로) |

**실측 (2026-08-14):** 자고 있던 `/health` 첫 응답 **22.5초**. 깨어난 뒤 `/api/chat` 은
1.8~3.3초. 화면이 멈추지는 않는다 — 캡처 바는 응답이 올 때까지 '정리 중' 을 유지하고,
일정·대화는 Supabase 직행이라 그대로 그려진다. 느려지는 것은 **첫 한 줄의 파싱뿐**이다.

> 예전에는 이 표에 "DB 첫 쿼리 지연 → lifespan 워밍업 적용됨", "커넥션 끊김 → `pool_pre_ping`
> 적용됨" 두 줄이 더 있었다. **두 코드 모두 §16(백엔드에서 DB 를 걷어낸 정리)에서 사라졌다.**
> 없는 대응을 있다고 적어 두면, 다음에 느려졌을 때 엉뚱한 곳을 먼저 뒤진다.

- 무료 750시간/월 = 서비스 1개 24/7 가능. keep-alive 를 켜도 한도 안.
- 근본 해결: Render Starter $7/월(슬립 없음) 또는 Fly.io / Cloud Run.

---

## 5. 로컬 실행 (배포 전 확인)

```bash
# 터미널 1 — 백엔드
cd backend
python -m venv .venv && .venv\Scripts\activate     # Windows
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload                       # http://localhost:8000
pytest -q

# 터미널 2 — 프론트
cd frontend
copy .env.example .env.local                        # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev
```

---

## 6. 체크리스트

- [x] Render 서비스 생성 → `/health` 200
- [x] Vercel `NEXT_PUBLIC_API_BASE` 설정 → 재배포
- [x] Render `CORS_ORIGIN_REGEX` 로 Vercel 도메인 허용 (프리플라이트로 확인)
- [x] LLM 키 입력 → `/api/chat` 실제 파싱 확인
- [x] ~~Supabase `DATABASE_URL` → `alembic upgrade head` → `/health/db` 가 `ok`~~
      → **없어진 일이다.** 저장은 프론트가 Supabase 로 직행하고 백엔드는 DB 에 붙지 않는다(§0-1).
- [ ] keep-alive cron 등록 (`/health`, 10분) — 백엔드 슬립만 막으면 된다. 깨울 DB 가 없다
      → **아직 안 했다.** 자고 있던 첫 응답을 재 봤더니 **22.5초**다(2026-08-14).
      대시보드 작업이라 코드로 닫을 수 없다. 미루면 심사자의 첫 한 줄이 거기 걸린다.
