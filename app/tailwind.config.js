/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BRASSWORKS material palette (design.md §2)
        coal: {
          950: "#100D0B",
          900: "#171310",
          800: "#211C17",
          700: "#2C251D",
        },
        brass: {
          400: "#DDBE7E",
          500: "#C9A45C",
          700: "#8A6B33",
        },
        copper: {
          500: "#A6562B",
          700: "#7C3E1F",
        },
        bottle: {
          600: "#2E5540",
          800: "#1E3A2A",
        },
        cream: {
          100: "#F2EAD6",
          300: "#E3D4B4",
        },
        rust: {
          500: "#8E3B2F",
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
        fell: ['"IM Fell English SC"', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
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
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
