import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)'],
        serif: ['var(--font-playfair)'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        sidebar: "var(--sidebar)",
        card: "var(--card)",
        'warm-white': '#faf9f6',
        sage: {
          50: '#f2f6f3',
          100: '#e1ede3',
          200: '#c5dcc9',
          300: '#9cc3a4',
          400: '#70a47b',
          500: '#4f875c',
          600: '#3c6b47',
          700: '#32563a',
          800: '#2b4532',
          900: '#24392a',
        },
        'dusty-rose': {
          50: '#fdf5f5',
          100: '#fbe8e9',
          200: '#f6d5d7',
          300: '#efb8bc',
          400: '#e39097',
          500: '#d16771',
          600: '#b84c56',
          700: '#9a3c45',
          800: '#81353c',
          900: '#6e3037',
        },
        'soft-gold': {
          50: '#fbf9f2',
          100: '#f6f1df',
          200: '#efe0bd',
          300: '#e4c993',
          400: '#d8ae62',
          500: '#cd953d',
          600: '#ba7a31',
          700: '#9a5c2b',
          800: '#7e4b28',
          900: '#673e23',
        },
        'slate-blue': {
          50: '#f4f6f8',
          100: '#e4eaf1',
          200: '#cad5e3',
          300: '#a3b8cf',
          400: '#7594b5',
          500: '#53769c',
          600: '#415d7e',
          700: '#354b66',
          800: '#2e4055',
          900: '#293748',
        }
      },
    },
  },
  plugins: [],
} satisfies Config;
