# Comein Frontend

Next.js (React 19, TypeScript, Tailwind CSS, shadcn/ui) 기반 프론트엔드.
자세한 규칙은 [`../docs/05_FRONTEND.md`](../docs/05_FRONTEND.md) 참고.

## 구조

```
frontend/
├── src/
│   ├── app/              # App Router (페이지, 레이아웃)
│   ├── components/       # UI 컴포넌트 (shadcn/ui, 채팅/카드/사이드바)
│   ├── lib/              # API 클라이언트, 유틸
│   └── store/            # Zustand 전역 상태
├── package.json
└── tsconfig.json
```

## 기본 레이아웃 (3분할)

`사이드바` | `Chat (중앙, 홈)` | `컨텍스트 패널` — 자세한 내용은 `../docs/04_GUI_UX.md`.

## 개발

```bash
npm install
npm run dev   # http://localhost:3000
```

> shadcn/ui 초기화: `npx shadcn@latest init` 후 필요한 컴포넌트만 `add`.
