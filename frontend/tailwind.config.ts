import type { Config } from "tailwindcss";

/**
 * Comein 디자인 시스템 — 연보라·화이트 미니멀 (브랜드 포스터 기준)
 * 모든 색은 globals.css 의 HSL CSS 변수(:root / .dark)를 참조한다.
 * 따라서 토큰을 바꾸면 라이트/다크가 동시에 반영된다.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        // 레이어드 소프트 섀도우 — 뉴트럴 잉크(비-보라)로 정제
        soft: "0 1px 2px hsl(234 24% 16% / 0.05), 0 6px 20px -10px hsl(234 24% 16% / 0.12), 0 20px 44px -24px hsl(234 24% 16% / 0.16)",
        glow: "0 0 40px -10px hsl(var(--primary) / 0.4)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // 바람/공기 느낌 — 켄번즈 드리프트
        kenburns: {
          "0%, 100%": { transform: "scale(1.06) translate3d(0, 0, 0)" },
          "50%": { transform: "scale(1.18) translate3d(-2.5%, -1.8%, 0)" },
        },
        // 빛이 스쳐 지나가는 스윕
        sheen: {
          "0%": { transform: "translateX(-65%)", opacity: "0" },
          "40%": { opacity: "0.55" },
          "60%": { opacity: "0.55" },
          "100%": { transform: "translateX(65%)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.4s ease-out both",
        kenburns: "kenburns 18s ease-in-out infinite",
        sheen: "sheen 7s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
