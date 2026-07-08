# Comein Frontend

Next.js (React 19, TypeScript, Tailwind CSS, shadcn/ui) 기반 프론트엔드.
자세한 규칙은 [`../docs/05_FRONTEND.md`](../docs/05_FRONTEND.md) 참고.

## 구조

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx            # 랜딩(메인) — "입장하기" 진입 연출
│   │   ├── layout.tsx          # 루트: 폰트 + ThemeProvider
│   │   ├── globals.css         # 디자인 토큰(연보라·화이트) + 글래스 유틸
│   │   └── workspace/          # 3분할 워크스페이스 셸 (/workspace)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 컴포넌트 (button 등)
│   │   ├── layout/             # sidebar, context-panel
│   │   ├── brand/              # logo (열린 문 마크)
│   │   ├── theme-provider.tsx  # next-themes 래퍼
│   │   └── theme-toggle.tsx    # 라이트/다크 토글
│   ├── config/                 # nav 등 정적 설정
│   └── lib/                    # utils(cn) 등
├── components.json             # shadcn/ui 설정 (baseColor: violet)
├── tailwind.config.ts
└── package.json
```

## 라우트

| 경로 | 화면 |
|------|------|
| `/` | 랜딩(메인) — 브랜드 히어로 + **입장하기** 연출 |
| `/workspace` | 워크스페이스 홈(Chat) — 3분할 셸 |
| `/workspace/{calendar,memo,todo,meeting}` | 기능 페이지 (예정) |

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
npm run dev   # http://localhost:3000
```

> shadcn/ui 컴포넌트 추가: `npx shadcn@latest add <component>` — `components.json`의 violet 토큰이 자동 적용됩니다.
