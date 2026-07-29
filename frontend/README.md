# Comein Frontend

Next.js (React 19, TypeScript, Tailwind CSS) 기반 프론트엔드 — **슬림 레일 + 단일 캔버스**.
자세한 규칙은 [`../docs/05_FRONTEND.md`](../docs/05_FRONTEND.md), 시각 규격은 [`../docs/22_DESIGN_LANGUAGE.md`](../docs/22_DESIGN_LANGUAGE.md), 화면 여정은 [`../docs/23_USER_JOURNEY.md`](../docs/23_USER_JOURNEY.md) 참고.

## 구조

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing (정체성·철학)
│   │   ├── experience/page.tsx # Experience — 시네마틱 리빌 + 로그인
│   │   ├── enter/page.tsx      # Enter — 간편 소셜 로그인
│   │   ├── workspace/page.tsx  # Workspace — 슬림 레일 + 단일 캔버스(6뷰)
│   │   ├── lab/page.tsx        # Living Intelligence 시그니처 비주얼
│   │   ├── layout.tsx          # 루트: 폰트 + ThemeProvider + Pretendard CDN
│   │   └── globals.css         # 전역 토큰/베이스
│   ├── components/
│   │   ├── theme-provider.tsx  # next-themes 래퍼
│   │   └── workspace/kakao-map.tsx  # 카카오맵(연동 — 향후 이식용 보존)
│   └── lib/                    # store·types·format·auth·utils / google·geo(연동 보존)
├── tailwind.config.ts
└── package.json
```

> 각 화면은 컴포넌트 로컬 `<style>` + CSS 토큰으로 자체 완결. 외부 UI 라이브러리(shadcn/FullCalendar/dnd-kit 등) 미사용 — 절제가 곧 럭셔리.

## 라우트

| 경로 | 화면 |
|------|------|
| `/` | **Landing** — 갤러리형 정체성(철학) |
| `/experience` | **Experience** — Co·me·in 시네마틱 리빌 + 로그인 → Workspace |
| `/enter` | **Enter** — 간편 소셜 로그인("바로 입장") → Workspace |
| `/workspace` | **Workspace** — 슬림 레일 + 단일 캔버스(Today·Calendar·Tasks·Notes·Meetings·People) |
| `/lab` | 시그니처 비주얼 데모 |

## 사전 요구사항 — Node.js

Node.js **20 이상** 필요 (현재 프로젝트 권장: **24 LTS**). 버전은 `.nvmrc`(`24`)에 고정.

```powershell
# Windows — winget 으로 설치 (관리자 권한 UAC 승인 필요)
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
# 설치 후 새 터미널에서 확인
node -v   # v20.x 이상
```

nvm-windows 사용 시: `nvm install 20 && nvm use 20`.

## 개발

```powershell
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드(타입·린트 검증)
```

> 라우트 삭제·이동 후 스테일 타입 오류가 나면 `.next` 삭제 후 재빌드.
