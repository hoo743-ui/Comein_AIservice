import type { Config } from "tailwindcss";

/**
 * Tailwind 는 여기서 **리셋과 기본값**까지만 맡는다.
 *
 * 화면의 시각 언어는 각 페이지가 컴포넌트 로컬 <style> 과 자체 토큰으로 갖는다
 * (CLAUDE.md §6 — 무거운 UI 프레임워크를 두지 않는다). 실제로 코드에서 쓰는
 * 유틸리티는 `font-sans` 하나와 globals.css 의 `@apply` 세 줄이 전부다.
 *
 * 예전에는 shadcn/ui 시절의 설정이 통째로 남아 있었다 — radix accordion 키프레임
 * (radix 는 설치조차 되어 있지 않다) · card/popover/sidebar 색 · shadow-soft/glow ·
 * kenburns/sheen 애니메이션 · 세리프 display 폰트. **하나도 쓰이지 않으면서**
 * 다음에 여는 사람에게 "이 프로젝트는 shadcn 을 쓴다" 고 말하고 있었다. 걷어냈다.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // globals.css 의 `@apply border-border` · `@apply bg-background text-foreground` 가 읽는다.
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      // layout.tsx 의 <body className="font-sans">. 한글은 Pretendard(CDN)가 먼저 잡는다.
      fontFamily: {
        sans: ['"Pretendard Variable"', "var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
