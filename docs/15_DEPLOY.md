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

## 0. 지금 떠 있는 것 (2026-08-02)

| | 주소 | 상태 |
|---|---|---|
| 백엔드 | `https://comein-aiservice.onrender.com` | ✅ Live (`/health` → `{"status":"ok","env":"production"}`) |
| 프론트 | `https://frontend-pied-one-74.vercel.app` | ✅ Live (프로덕션 별칭) |
| 프론트(브랜치) | `https://frontend-git-main-hoo743-uis-projects.vercel.app` | ✅ 같은 빌드 |
| LLM | Gemini (Render 환경변수에 키 등록) | ✅ 실제 호출 확인 |
| DB | Supabase 미연결 | ❌ `/health/db` → `db: down`, **저장 안 됨** |

> Render 서비스 이름은 `comein-aiservice` 다 (`render.yaml` 의 `comein-api` 와 다름 —
> 대시보드에서 손으로 만들었기 때문). Blueprint 로 다시 만들면 이름이 갈리니 주의.

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
https://<서비스명>.onrender.com/docs        → Swagger UI
https://<서비스명>.onrender.com/health/db   → {"status":"ok","db":"ok"}  (DB 연결 후)
```

`/health` 는 DB를 건드리지 않는다 → Render 헬스체크가 DB 상태에 끌려가지 않는다.
`/health/db` 는 `SELECT 1` 까지 왕복한다 → keep-alive·DB 점검용.

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
| `DATABASE_URL` | Supabase Connection string | 아래 2절 |
| `REDIS_URL` | Upstash URL | 아직 미사용 — 비워도 됨 |
| `JWT_SECRET` | Render 자동 생성 | 직접 넣지 말 것 |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | LLM 키 | AI 확정 후 |

- **비밀값은 Render 에만 둔다.** 프론트(`NEXT_PUBLIC_*`)는 브라우저에 노출되므로 절대 금지.
- 환경변수를 바꾸면 Render 가 자동 재배포한다.

---

## 2. Supabase(DB) 연결

1. Supabase 프로젝트 → **Project Settings → Database → Connection string → URI** 복사
2. 그대로 Render `DATABASE_URL` 에 붙여넣는다.
   `postgresql://...?sslmode=require` 형태여도 된다 — 백엔드가 기동 시
   `postgresql+asyncpg://` 로 바꾸고 `sslmode` 는 드라이버 옵션으로 옮긴다
   (`app/core/config.py`). 손으로 고칠 필요 없음.
3. **마이그레이션은 로컬에서 1회 적용한다** (Render 무료 플랜은 셸이 없다):

```bash
cd backend
# .env 의 DATABASE_URL 을 잠시 Supabase 주소로 바꾼 뒤
alembic upgrade head
```

> 매 배포마다 자동 적용하고 싶으면 Start Command 를
> `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` 로 바꾼다.
> 단 DB가 잠들어 있으면 기동 자체가 실패하므로, DB 연결이 안정된 뒤에 적용할 것.

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
| 첫 요청 30초~1분 | Render 무료: 15분 무요청 시 슬립 | 외부 cron 으로 `/health` 10분마다 GET (UptimeRobot·cron-job.org). self-ping 은 안 됨 |
| DB 첫 쿼리 지연 | 커넥션 풀 미생성 | 기동 시 `SELECT 1` 워밍업 (`app/main.py` lifespan) — 적용됨 |
| 1주 뒤 DB 정지 | Supabase 무료: 무활동 시 일시정지 | keep-alive 를 `/health/db` 로 걸어 DB까지 깨움 |
| 커넥션 끊김 오류 | 풀러가 유휴 커넥션 종료 | `pool_pre_ping` + `pool_recycle=1800` (`app/core/database.py`) — 적용됨 |

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
- [ ] Supabase 프로젝트 생성 → `DATABASE_URL` 입력 → `alembic upgrade head`
- [ ] `/health/db` 가 `db: ok`
- [ ] `/api/chat` 결과를 `POST /api/items` 로 저장 연결 (지금은 화면 상태에만 존재)
- [ ] keep-alive cron 등록 (`/health/db`, 10분)
