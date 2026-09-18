/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BLACKRAIL material palette (design.md §2)
        coal: {
          950: "#100D0B",
          900: "#171310",
          800: "#211C17",
          700: "#2C251D",
        },
        brass: {
          // platform "Club Industriel" additions (design.md §2.2) — additive:
          // 400/500/700 below keep their legacy values (game shell depends on them);
          // the platform's "laiton principal" (#C9A24B) maps to brass-500 (#C9A45C).
          // 300 + hairlines are platform-only and theme-driven (CSS vars scoped
          // to .platform-root in index.css; fallbacks = dark theme values).
          300: "rgb(var(--brass-300, 231 201 126) / <alpha-value>)",
          400: "#DDBE7E",
          500: "#C9A45C",
          600: "#8F6B23",
          700: "#8A6B33",
          hairline: "var(--brass-hairline, rgba(201,162,75,.14))",
          "hairline-strong": "var(--brass-hairline-strong, rgba(201,162,75,.32))",
        },
        copper: {
          500: "#A6562B",
          700: "#7C3E1F",
        },
        bottle: {
          // platform additions (design.md §2.3): 400/500/700 (theme-driven);
          // 600/800 legacy, untouched
          400: "rgb(var(--bottle-400, 62 138 102) / <alpha-value>)",
          500: "rgb(var(--bottle-500, 46 107 79) / <alpha-value>)",
          600: "#2E5540",
          700: "rgb(var(--bottle-700, 30 77 59) / <alpha-value>)",
          800: "#1E3A2A",
        },
        cream: {
          100: "#F2EAD6",
          300: "#E3D4B4",
        },
        rust: {
          // platform additions (design.md §2.3): 400/600/700 (theme-driven);
          // 500 legacy (#8E3B2F, game), untouched.
          // design's "accent classé" #C05B3C lands on 600 so legacy rust-500 stays put.
          400: "rgb(var(--rust-400, 208 112 78) / <alpha-value>)",
          500: "#8E3B2F",
          600: "rgb(var(--rust-600, 192 91 60) / <alpha-value>)",
          700: "rgb(var(--rust-700, 143 63 39) / <alpha-value>)",
        },
        // platform "Club Industriel" tokens (design.md §2) — new names, no conflicts.
        // All theme-driven: channel triplets live in CSS vars scoped to
        // .platform-root (index.css); fallbacks below = exact dark values.
        lacquer: {
          950: "rgb(var(--lacquer-950, 10 14 12) / <alpha-value>)",
          900: "rgb(var(--lacquer-900, 14 19 16) / <alpha-value>)",
        },
        enamel: {
          850: "rgb(var(--enamel-850, 19 25 21) / <alpha-value>)",
          800: "rgb(var(--enamel-800, 24 32 27) / <alpha-value>)",
          700: "rgb(var(--enamel-700, 32 42 36) / <alpha-value>)",
          line: "rgb(var(--enamel-line, 38 49 42) / <alpha-value>)",
        },
        signal: {
          400: "rgb(var(--signal-400, 240 169 46) / <alpha-value>)",
          glow: "var(--signal-glow, rgba(240,169,46,.35))",
        },
        paper: {
          100: "rgb(var(--paper-100, 237 230 214) / <alpha-value>)",
          300: "rgb(var(--paper-300, 200 191 172) / <alpha-value>)",
        },
        iron: {
          400: "rgb(var(--iron-400, 139 148 140) / <alpha-value>)",
          600: "rgb(var(--iron-600, 90 99 92) / <alpha-value>)",
        },
        ink: {
          900: "#241D14",
        },
        player: {
          brass: "#C9A45C",
          oxblood: "#9E3B30",
          verdigris: "#3F7A55",
          steel: "#4E6E8E",
        },
        // shadcn token aliases (kept for ui/ primitives)
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
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
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
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // platform families (design.md §3) — additive; legacy `display`/`sans` untouched
        // (the game shell still speaks Playfair/Archivo).
        fraunces: ['Fraunces', '"Playfair Display"', 'Georgia', 'serif'],
        ui: ['Inter', 'Archivo', 'system-ui', 'sans-serif'],
        fell: ['"IM Fell English SC"', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['Spectral', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        // Elevation / relief system (design.md §4)
        e1: "0 30px 80px rgba(0,0,0,.55), 0 4px 16px rgba(0,0,0,.4)",
        e2: "0 3px 6px rgba(0,0,0,.45), 0 10px 24px rgba(0,0,0,.25), inset 0 1px 0 rgba(242,234,214,.18)",
        e3: "0 6px 14px rgba(0,0,0,.5)",
        "e3-hover": "0 18px 34px rgba(0,0,0,.55)",
        e4: "0 40px 100px rgba(0,0,0,.7)",
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
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "sheen-sweep": {
          "0%": { transform: "translateX(-130%) skewX(-18deg)" },
          "100%": { transform: "translateX(230%) skewX(-18deg)" },
        },
        "bob-soft": {
          "0%,100%": { transform: "translateY(-2px)" },
          "50%": { transform: "translateY(2px)" },
        },
        "pulse-glow": {
          "0%,100%": {
            boxShadow:
              "inset 0 1px 0 rgba(242,234,214,.55), inset 0 -1px 0 rgba(0,0,0,.3), 0 3px 6px rgba(0,0,0,.45), 0 0 0 0 rgba(201,164,92,0)",
          },
          "50%": {
            boxShadow:
              "inset 0 1px 0 rgba(242,234,214,.55), inset 0 -1px 0 rgba(0,0,0,.3), 0 3px 6px rgba(0,0,0,.45), 0 0 18px 4px rgba(201,164,92,.4)",
          },
        },
        "chevron-drift": {
          "0%,100%": { transform: "translateY(0)", opacity: ".55" },
          "50%": { transform: "translateY(5px)", opacity: "1" },
        },
        "trace-link": {
          "0%": { strokeDashoffset: "var(--trace-len, 120)" },
          "60%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        "smoke-drift-a": {
          "0%,100%": { transform: "translate(-4%, 2%) scale(1)" },
          "50%": { transform: "translate(5%, -3%) scale(1.08)" },
        },
        "smoke-drift-b": {
          "0%,100%": { transform: "translate(4%, -2%) scale(1.05)" },
          "50%": { transform: "translate(-5%, 3%) scale(0.97)" },
        },
        /* --- platform motion (design.md §5) --- */
        "pulse-signal": {
          "0%,100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        "presence-dot": {
          // platform-only animation: var() resolves per-element (theme-aware)
          "0%,100%": { transform: "scale(1)", boxShadow: "0 0 0 0 var(--signal-glow, rgba(240,169,46,.35))" },
          "50%": { transform: "scale(1.35)", boxShadow: "0 0 10px 2px var(--signal-glow, rgba(240,169,46,.35))" },
        },
        ticker: {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-50%)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        forge: {
          "0%": { transform: "translateX(-110%)" },
          "50%": { transform: "translateX(10%)" },
          "100%": { transform: "translateX(110%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "spin-slow": "spin-slow 24s linear infinite",
        "bob-soft": "bob-soft 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        "chevron-drift": "chevron-drift 1.8s ease-in-out infinite",
        "trace-link": "trace-link 3.6s ease-in-out infinite",
        "smoke-drift-a": "smoke-drift-a 20s ease-in-out infinite alternate",
        "smoke-drift-b": "smoke-drift-b 20s ease-in-out infinite alternate",
        /* --- platform motion (design.md §5) --- */
        "pulse-signal": "pulse-signal 2s ease-in-out infinite",
        "presence-dot": "presence-dot 1.6s ease-in-out infinite",
        ticker: "ticker 24s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
        forge: "forge 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
