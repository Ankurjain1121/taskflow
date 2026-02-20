#!/usr/bin/env npx ts-node
/**
 * Theme SQL Seed Generator
 *
 * Generates SQL INSERT statements for the themes table.
 * Uses culori for color math and WCAG contrast validation.
 *
 * Run: npx ts-node scripts/generate-theme-sql.ts > backend/crates/db/src/migrations/20260221000002_themes_seed.sql
 */

import * as fs from "fs";
import * as path from "path";

// Minimal culori-like color manipulation (inline to avoid dependency)
function hexToOklch(hex: string): [number, number, number] {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // RGB to OKLCH (simplified)
  const [l, c, h] = rgbToOklch(r, g, b);
  return [l, c, h];
}

function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  // Simplified - just return basic values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1));
  const h =
    max === min
      ? 0
      : max === r
        ? ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6
        : max === g
          ? ((b - r) / (max - min) + 2) / 6
          : ((r - g) / (max - min) + 4) / 6;
  return [l * 0.3 + 0.5, s * 0.15, h * 360];
}

function oklchToHex(l: number, c: number, h: number): string {
  // OKLCH to RGB (simplified)
  const hNorm = h / 360;
  const r = Math.abs(hNorm * 6 - 3) - 1;
  const g = 2 - Math.abs(hNorm * 6 - 2);
  const b = 2 - Math.abs(hNorm * 6 - 4);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const rgb = [clamp(r * l * 2.5), clamp(g * l * 2.5), clamp(b * l * 2.5)];
  return `#${rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function lighten(hex: string, amount: number): string {
  const [l, c, h] = hexToOklch(hex);
  return oklchToHex(Math.min(1, l + amount), c, h);
}

function darken(hex: string, amount: number): string {
  const [l, c, h] = hexToOklch(hex);
  return oklchToHex(Math.max(0, l - amount), c, h);
}

function mixColors(hex1: string, hex2: string, weight: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const w = weight;
  const rw = Math.round(r1 * (1 - w) + r2 * w);
  const gw = Math.round(g1 * (1 - w) + g2 * w);
  const bw = Math.round(b1 * (1 - w) + b2 * w);
  return `#${rw.toString(16).padStart(2, "0")}${gw.toString(16).padStart(2, "0")}${bw.toString(16).padStart(2, "0")}`;
}

// WCAG contrast calculation (simplified)
function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string) => {
    const rgb = [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    ].map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Generate PrimeNG ramp (11 shades: 50-950)
function generatePrimengRamp(primary: string): Record<string, string> {
  const [l, c, h] = hexToOklch(primary);
  const ramp: Record<string, string> = {};
  for (let i = 0; i <= 9; i++) {
    const shade = i * 100 + 50;
    const newL = 0.95 - i * 0.09;
    ramp[shade.toString()] = oklchToHex(newL, c * (1 - i * 0.08), h);
  }
  ramp["950"] = oklchToHex(0.05, c * 0.3, h);
  return ramp;
}

// Theme definitions with seed values
interface ThemeDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  isDark: boolean;
  background: string;
  foreground: string;
  card: string;
  primary: string;
  border: string;
  sidebarBg: string;
  sidebarText: string;
}

const themeDefinitions: ThemeDefinition[] = [
  // Clean Light Themes
  {
    slug: "default",
    name: "Default",
    category: "clean",
    description: "Clean, modern light theme",
    isDark: false,
    background: "#F6F7FB",
    foreground: "#0f172a",
    card: "#ffffff",
    primary: "#6366f1",
    border: "#e2e8f0",
    sidebarBg: "#F0F1F5",
    sidebarText: "#0f172a",
  },
  {
    slug: "paper",
    name: "Paper",
    category: "clean",
    description: "Soft off-white paper aesthetic",
    isDark: false,
    background: "#FAFAF9",
    foreground: "#1c1917",
    card: "#ffffff",
    primary: "#0d9488",
    border: "#e7e5e4",
    sidebarBg: "#F5F5F4",
    sidebarText: "#1c1917",
  },
  {
    slug: "snow",
    name: "Snow",
    category: "clean",
    description: "Cool blue-white winter feel",
    isDark: false,
    background: "#F8FAFC",
    foreground: "#0f172a",
    card: "#ffffff",
    primary: "#3b82f6",
    border: "#e2e8f0",
    sidebarBg: "#F1F5F9",
    sidebarText: "#0f172a",
  },
  {
    slug: "cream",
    name: "Cream",
    category: "clean",
    description: "Warm creamy beige tones",
    isDark: false,
    background: "#FDFBF7",
    foreground: "#292524",
    card: "#ffffff",
    primary: "#d97706",
    border: "#e5e5e5",
    sidebarBg: "#F5F0E8",
    sidebarText: "#292524",
  },
  {
    slug: "stone",
    name: "Stone",
    category: "clean",
    description: "Natural stone gray palette",
    isDark: false,
    background: "#FAFAF9",
    foreground: "#1c1917",
    card: "#ffffff",
    primary: "#78716c",
    border: "#d6d3d1",
    sidebarBg: "#F5F5F4",
    sidebarText: "#1c1917",
  },

  // Clean Dark Themes
  {
    slug: "dracula",
    name: "Dracula",
    category: "dark-sidebar",
    description: "Classic Dracula purple theme",
    isDark: true,
    background: "#282A36",
    foreground: "#F8F8F2",
    card: "#44475A",
    primary: "#BD93F9",
    border: "#6272A4",
    sidebarBg: "#21222C",
    sidebarText: "#F8F8F2",
  },
  {
    slug: "dimmed",
    name: "GitHub Dimmed",
    category: "dark-sidebar",
    description: "GitHub dark theme",
    isDark: true,
    background: "#22272E",
    foreground: "#ADBAC7",
    card: "#2D333B",
    primary: "#539BF5",
    border: "#444C56",
    sidebarBg: "#1C2128",
    sidebarText: "#ADBAC7",
  },

  // Tinted Themes
  {
    slug: "rose-light",
    name: "Rose Light",
    category: "tinted",
    description: "Warm rose tinted light",
    isDark: false,
    background: "#FFF1F2",
    foreground: "#1f0923",
    card: "#ffffff",
    primary: "#e11d48",
    border: "#fecdd3",
    sidebarBg: "#FFE4E6",
    sidebarText: "#1f0923",
  },
  {
    slug: "emerald-light",
    name: "Emerald Light",
    category: "tinted",
    description: "Fresh green tinted light",
    isDark: false,
    background: "#F0FDF4",
    foreground: "#052e16",
    card: "#ffffff",
    primary: "#059669",
    border: "#bbf7d0",
    sidebarBg: "#DCFCE7",
    sidebarText: "#052e16",
  },
  {
    slug: "sky-light",
    name: "Sky Light",
    category: "tinted",
    description: "Calm blue tinted light",
    isDark: false,
    background: "#F0F9FF",
    foreground: "#0c1929",
    card: "#ffffff",
    primary: "#0284c7",
    border: "#bae6fd",
    sidebarBg: "#E0F2FE",
    sidebarText: "#0c1929",
  },
  {
    slug: "violet-light",
    name: "Violet Light",
    category: "tinted",
    description: "Rich purple tinted light",
    isDark: false,
    background: "#FAF5FF",
    foreground: "#2e1065",
    card: "#ffffff",
    primary: "#7c3aed",
    border: "#ddd6fe",
    sidebarBg: "#F3E8FF",
    sidebarText: "#2e1065",
  },
  {
    slug: "orange-light",
    name: "Sunset Light",
    category: "tinted",
    description: "Warm orange tinted light",
    isDark: false,
    background: "#FFF7ED",
    foreground: "#431407",
    card: "#ffffff",
    primary: "#ea580c",
    border: "#fed7aa",
    sidebarBg: "#FFEDD5",
    sidebarText: "#431407",
  },
  {
    slug: "cyan-light",
    name: "Ocean Light",
    category: "tinted",
    description: "Cool cyan tinted light",
    isDark: false,
    background: "#ECFEFF",
    foreground: "#083344",
    card: "#ffffff",
    primary: "#0891b2",
    border: "#a5f3fc",
    sidebarBg: "#CFFAFE",
    sidebarText: "#083344",
  },

  // Famous Themes
  {
    slug: "nord",
    name: "Nord",
    category: "famous",
    description: "Arctic north-bluish colors",
    isDark: true,
    background: "#2E3440",
    foreground: "#ECEFF4",
    card: "#3B4252",
    primary: "#88C0D0",
    border: "#4C566A",
    sidebarBg: "#242933",
    sidebarText: "#ECEFF4",
  },
  {
    slug: "gruvbox",
    name: "Gruvbox",
    category: "famous",
    description: "Retro groove color scheme",
    isDark: true,
    background: "#282828",
    foreground: "#ebdbb2",
    card: "#3c3836",
    primary: "#fabd2f",
    border: "#504945",
    sidebarBg: "#1D2021",
    sidebarText: "#ebdbb2",
  },
  {
    slug: "monokai",
    name: "Monokai",
    category: "famous",
    description: "Saturated monokai feel",
    isDark: true,
    background: "#272822",
    foreground: "#F8F8F2",
    card: "#3E3D32",
    primary: "#F92672",
    border: "#49483E",
    sidebarBg: "#1E1F1C",
    sidebarText: "#F8F8F2",
  },
  {
    slug: "one-dark",
    name: "One Dark",
    category: "famous",
    description: "Atom One Dark inspired",
    isDark: true,
    background: "#282c34",
    foreground: "#abb2bf",
    card: "#21252B",
    primary: "#61afef",
    border: "#3e4451",
    sidebarBg: "#21212B",
    sidebarText: "#abb2bf",
  },
  {
    slug: "solarized-light",
    name: "Solarized Light",
    category: "famous",
    description: "Soleated light precision",
    isDark: false,
    background: "#FDF6E3",
    foreground: "#073642",
    card: "#EEE8D5",
    primary: "#268BD2",
    border: "#DDD6C1",
    sidebarBg: "#F5EFDC",
    sidebarText: "#073642",
  },
  {
    slug: "solarized-dark",
    name: "Solarized Dark",
    category: "famous",
    description: "Soleated dark precision",
    isDark: true,
    background: "#002B36",
    foreground: "#93A1A1",
    card: "#073642",
    primary: "#268BD2",
    border: "#0A5061",
    sidebarBg: "#001A21",
    sidebarText: "#93A1A1",
  },
  {
    slug: "github-light",
    name: "GitHub Light",
    category: "famous",
    description: "GitHub official light",
    isDark: false,
    background: "#FFFFFF",
    foreground: "#1F2328",
    card: "#ffffff",
    primary: "#0969da",
    border: "#d0d7de",
    sidebarBg: "#F6F8FA",
    sidebarText: "#1F2328",
  },
  {
    slug: "github-dark",
    name: "GitHub Dark",
    category: "famous",
    description: "GitHub official dark",
    isDark: true,
    background: "#0D1117",
    foreground: "#C9D1D9",
    card: "#161B22",
    primary: "#58A6FF",
    border: "#30363D",
    sidebarBg: "#010409",
    sidebarText: "#C9D1D9",
  },

  // Bold Themes
  {
    slug: "midnight",
    name: "Midnight",
    category: "bold",
    description: "Deep midnight blue",
    isDark: true,
    background: "#0B0E14",
    foreground: "#E6E8EB",
    card: "#151922",
    primary: "#6366f1",
    border: "#2A2F3A",
    sidebarBg: "#06080C",
    sidebarText: "#E6E8EB",
  },
  {
    slug: "forest",
    name: "Forest",
    category: "bold",
    description: "Deep forest green",
    isDark: true,
    background: "#0D1117",
    foreground: "#E6EDF3",
    card: "#161B22",
    primary: "#238636",
    border: "#30363D",
    sidebarBg: "#0D1117",
    sidebarText: "#E6EDF3",
  },
  {
    slug: "ocean",
    name: "Ocean",
    category: "bold",
    description: "Deep ocean blue",
    isDark: true,
    background: "#0A1929",
    foreground: "#E6EFFF",
    card: "#132F4C",
    primary: "#5090D3",
    border: "#1E4976",
    sidebarBg: "#061325",
    sidebarText: "#E6EFFF",
  },
  {
    slug: "crimson",
    name: "Crimson",
    category: "bold",
    description: "Bold crimson red",
    isDark: true,
    background: "#1A0A0A",
    foreground: "#F5E6E6",
    card: "#2D1515",
    primary: "#F85149",
    border: "#4A2020",
    sidebarBg: "#0D0505",
    sidebarText: "#F5E6E6",
  },
  {
    slug: "cobalt",
    name: "Cobalt",
    category: "bold",
    description: "Bold cobalt blue",
    isDark: true,
    background: "#001A33",
    foreground: "#E6F0FF",
    card: "#0D2847",
    primary: "#3B82F6",
    border: "#003366",
    sidebarBg: "#000D1A",
    sidebarText: "#E6F0FF",
  },

  // Specialty Themes
  {
    slug: "halloween",
    name: "Halloween",
    category: "specialty",
    description: "Spooky orange and purple",
    isDark: false,
    background: "#FFEDD5",
    foreground: "#431407",
    card: "#ffffff",
    primary: "#a85507",
    border: "#fed7aa",
    sidebarBg: "#FFEDD5",
    sidebarText: "#431407",
  },
  {
    slug: "christmas",
    name: "Christmas",
    category: "specialty",
    description: "Festive red and green",
    isDark: false,
    background: "#F0FDF4",
    foreground: "#14532d",
    card: "#ffffff",
    primary: "#16a34a",
    border: "#bbf7d0",
    sidebarBg: "#DCFCE7",
    sidebarText: "#14532d",
  },
  {
    slug: "valentine",
    name: "Valentine",
    category: "specialty",
    description: "Romantic pink tones",
    isDark: false,
    background: "#FFF1F2",
    foreground: "#881337",
    card: "#ffffff",
    primary: "#db2777",
    border: "#fbcfe8",
    sidebarBg: "#FFE4E6",
    sidebarText: "#881337",
  },
  {
    slug: "spring",
    name: "Spring",
    category: "specialty",
    description: "Fresh spring green",
    isDark: false,
    background: "#F0FDF4",
    foreground: "#14532d",
    card: "#ffffff",
    primary: "#22c55e",
    border: "#bbf7d0",
    sidebarBg: "#DCFCE7",
    sidebarText: "#14532d",
  },
  {
    slug: "summer",
    name: "Summer",
    category: "specialty",
    description: "Bright sunny yellow",
    isDark: false,
    background: "#FEFCE8",
    foreground: "#713f12",
    card: "#ffffff",
    primary: "#eab308",
    border: "#fef08a",
    sidebarBg: "#FEF9C3",
    sidebarText: "#713f12",
  },
  {
    slug: "autumn",
    name: "Autumn",
    category: "specialty",
    description: "Warm autumn orange",
    isDark: false,
    background: "#FFF7ED",
    foreground: "#431407",
    card: "#ffffff",
    primary: "#c2410c",
    border: "#fed7aa",
    sidebarBg: "#FFEDD5",
    sidebarText: "#431407",
  },
  {
    slug: "retro",
    name: "Retro",
    category: "specialty",
    description: "Retro beige computing",
    isDark: false,
    background: "#F5F5DC",
    foreground: "#2D2D2D",
    card: "#FFFAF0",
    primary: "#D2691E",
    border: "#D2B48C",
    sidebarBg: "#F0EAD6",
    sidebarText: "#2D2D2D",
  },
  {
    slug: "matrix",
    name: "Matrix",
    category: "specialty",
    description: "Classic green terminal",
    isDark: true,
    background: "#000000",
    foreground: "#00FF00",
    card: "#0D0D0D",
    primary: "#00FF00",
    border: "#003300",
    sidebarBg: "#000000",
    sidebarText: "#00FF00",
  },
  {
    slug: "terminal",
    name: "Terminal",
    category: "specialty",
    description: "Classic terminal amber",
    isDark: true,
    background: "#0C0C0C",
    foreground: "#FFB000",
    card: "#1A1A1A",
    primary: "#FFB000",
    border: "#333333",
    sidebarBg: "#080808",
    sidebarText: "#FFB000",
  },
  {
    slug: "nord-light",
    name: "Nord Light",
    category: "famous",
    description: "Nord light variant",
    isDark: false,
    background: "#ECEFF4",
    foreground: "#2E3440",
    card: "#ffffff",
    primary: "#88C0D0",
    border: "#D8DEE9",
    sidebarBg: "#E5E9F0",
    sidebarText: "#2E3440",
  },
];

// Accent overrides (matching current themes.css)
const ACCENT_OVERRIDES: Record<
  string,
  Record<
    string,
    {
      primary: string;
      "primary-foreground": string;
      ring: string;
      "chart-1": string;
      "chart-5": string;
    }
  >
> = {
  blue: {
    light: {
      primary: "#2563eb",
      "primary-foreground": "#ffffff",
      ring: "#2563eb",
      "chart-1": "#2563eb",
      "chart-5": "#3b82f6",
    },
    dark: {
      primary: "#60a5fa",
      "primary-foreground": "#1e3a5f",
      ring: "#60a5fa",
      "chart-1": "#60a5fa",
      "chart-5": "#93c5fd",
    },
  },
  green: {
    light: {
      primary: "#16a34a",
      "primary-foreground": "#ffffff",
      ring: "#16a34a",
      "chart-1": "#16a34a",
      "chart-5": "#22c55e",
    },
    dark: {
      primary: "#4ade80",
      "primary-foreground": "#14532d",
      ring: "#4ade80",
      "chart-1": "#4ade80",
      "chart-5": "#86efac",
    },
  },
  orange: {
    light: {
      primary: "#ea580c",
      "primary-foreground": "#ffffff",
      ring: "#ea580c",
      "chart-1": "#ea580c",
      "chart-5": "#f97316",
    },
    dark: {
      primary: "#fb923c",
      "primary-foreground": "#431407",
      ring: "#fb923c",
      "chart-1": "#fb923c",
      "chart-5": "#fdba74",
    },
  },
  rose: {
    light: {
      primary: "#e11d48",
      "primary-foreground": "#ffffff",
      ring: "#e11d48",
      "chart-1": "#e11d48",
      "chart-5": "#f43f5e",
    },
    dark: {
      primary: "#fb7185",
      "primary-foreground": "#4c0519",
      ring: "#fb7185",
      "chart-1": "#fb7185",
      "chart-5": "#fda4af",
    },
  },
  violet: {
    light: {
      primary: "#7c3aed",
      "primary-foreground": "#ffffff",
      ring: "#7c3aed",
      "chart-1": "#7c3aed",
      "chart-5": "#8b5cf6",
    },
    dark: {
      primary: "#a78bfa",
      "primary-foreground": "#2e1065",
      ring: "#a78bfa",
      "chart-1": "#a78bfa",
      "chart-5": "#c4b5fd",
    },
  },
  amber: {
    light: {
      primary: "#d97706",
      "primary-foreground": "#ffffff",
      ring: "#d97706",
      "chart-1": "#d97706",
      "chart-5": "#f59e0b",
    },
    dark: {
      primary: "#fbbf24",
      "primary-foreground": "#451a03",
      ring: "#fbbf24",
      "chart-1": "#fbbf24",
      "chart-5": "#fcd34d",
    },
  },
  slate: {
    light: {
      primary: "#475569",
      "primary-foreground": "#ffffff",
      ring: "#475569",
      "chart-1": "#475569",
      "chart-5": "#64748b",
    },
    dark: {
      primary: "#94a3b8",
      "primary-foreground": "#0f172a",
      ring: "#94a3b8",
      "chart-1": "#94a3b8",
      "chart-5": "#cbd5e1",
    },
  },
};

function generateThemeColors(theme: ThemeDefinition): Record<string, string> {
  const isDark = theme.isDark;
  const mode = isDark ? "dark" : "light";

  const colors: Record<string, string> = {
    background: theme.background,
    foreground: theme.foreground,
    card: theme.card,
    "card-foreground": theme.foreground,
    border: theme.border,
    input: theme.border,
    muted: isDark ? "#1e293b" : "#f8f9fb",
    "muted-foreground": mixColors(theme.foreground, theme.background, 0.5),
    primary: theme.primary,
    "primary-foreground":
      getContrastRatio("#ffffff", theme.primary) >= 4.5 ? "#ffffff" : "#000000",
    secondary: isDark ? "#1e293b" : "#f1f5f9",
    "secondary-foreground": theme.foreground,
    ring: theme.primary,
    accent: lighten(theme.primary, 0.85),
    "accent-foreground": darken(theme.primary, 0.6),
    success: isDark ? "#34d399" : "#10b981",
    "success-light": isDark ? "#064e3b" : "#ecfdf5",
    destructive: isDark ? "#dc2626" : "#ef4444",
    "destructive-foreground": "#ffffff",
    "sidebar-bg": theme.sidebarBg,
    "sidebar-surface": isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
    "sidebar-surface-hover": isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.05)",
    "sidebar-surface-active": `color-mix(in srgb, var(--primary) 8%, transparent)`,
    "sidebar-border": isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)",
    "sidebar-text-primary": theme.sidebarText,
    "sidebar-text-secondary": isDark
      ? "rgba(255,255,255,0.7)"
      : "rgba(0,0,0,0.7)",
    "sidebar-text-muted": isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
    "surface-0": theme.background,
    "surface-1": theme.card,
    "surface-2": isDark ? "#3a3c58" : "#ffffff",
    "surface-3": isDark ? "#42446a" : "#ffffff",
    "shadow-xs": "0 1px 2px rgba(0,0,0,0.05)",
    "shadow-sm": "0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    "shadow-md": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
    "shadow-lg": "0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
    "shadow-glow": `0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent), 0 4px 16px color-mix(in srgb, var(--primary) 6%, transparent)`,
    "widget-hover-border": `color-mix(in srgb, var(--primary) 20%, transparent)`,
    "chart-1": theme.primary,
    "chart-2": "#10b981",
    "chart-3": "#f97316",
    "chart-4": "#f59e0b",
    "chart-5": "#8b5cf6",
    "chip-overdue": isDark ? "#f87171" : "#db2828",
    "chip-due-soon": isDark ? "#fb923c" : "#f2711c",
    "chip-completed": isDark ? "#4ade80" : "#21ba45",
    "status-red-bg": isDark ? "rgba(220, 38, 38, 0.12)" : "#fef2f2",
    "status-red-border": isDark ? "rgba(220, 38, 38, 0.3)" : "#fecaca",
    "status-red-text": isDark ? "#fca5a5" : "#b91c1c",
    "status-green-bg": isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
    "status-green-border": isDark ? "rgba(34, 197, 94, 0.3)" : "#bbf7d0",
    "status-green-text": isDark ? "#86efac" : "#15803d",
    "status-blue-bg": isDark ? "rgba(59, 130, 246, 0.12)" : "#eff6ff",
    "status-blue-border": isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe",
    "status-blue-text": isDark ? "#93c5fd" : "#1d4ed8",
    "status-amber-bg": isDark ? "rgba(245, 158, 11, 0.12)" : "#fffbeb",
    "status-amber-border": isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
    "status-amber-text": isDark ? "#fcd34d" : "#92400e",
  };

  return colors;
}

function generatePreview(theme: ThemeDefinition): Record<string, string> {
  return {
    sidebar_color: theme.sidebarBg,
    background_color: theme.background,
    card_color: theme.card,
    primary_color: theme.primary,
    sidebar_is_dark:
      (
        parseInt(theme.sidebarBg.slice(1, 3), 16) * 0.299 +
        parseInt(theme.sidebarBg.slice(3, 5), 16) * 0.587 +
        parseInt(theme.sidebarBg.slice(5, 7), 16) * 0.114
      ).toString() < 128
        ? "true"
        : "false",
  };
}

function generatePersonality(theme: ThemeDefinition): Record<string, string> {
  const sidebarStyle =
    (
      parseInt(theme.sidebarBg.slice(1, 3), 16) * 0.299 +
      parseInt(theme.sidebarBg.slice(3, 5), 16) * 0.587 +
      parseInt(theme.sidebarBg.slice(5, 7), 16) * 0.114
    ).toString() < 128
      ? "dark"
      : "light";
  return {
    sidebar_style: sidebarStyle,
    card_style: "raised",
    border_radius: "medium",
    background_pattern: "none",
  };
}

// Validate WCAG contrast
function validateContrast(colors: Record<string, string>): boolean {
  const fgBg = getContrastRatio(colors.foreground, colors.background);
  const primaryFg = getContrastRatio(
    colors["primary-foreground"],
    colors.primary,
  );
  const cardFg = getContrastRatio(colors["card-foreground"], colors.card);

  if (fgBg < 4.5) {
    console.error(
      `❌ Contrast FAIL: foreground/background = ${fgBg.toFixed(2)}:1 (need 4.5:1)`,
    );
    return false;
  }
  if (primaryFg < 4.5) {
    console.error(
      `❌ Contrast FAIL: primary-foreground/primary = ${primaryFg.toFixed(2)}:1 (need 4.5:1)`,
    );
    return false;
  }
  if (cardFg < 4.5) {
    console.error(
      `❌ Contrast FAIL: card-foreground/card = ${cardFg.toFixed(2)}:1 (need 4.5:1)`,
    );
    return false;
  }
  return true;
}

// Generate SQL
function generateSQL(): string {
  let sql = `-- Migration 2: Theme seed data\n`;
  sql += `-- Generated by scripts/generate-theme-sql.ts\n`;
  sql += `-- Total themes: ${themeDefinitions.length}\n\n`;
  sql += `INSERT INTO themes (slug, name, category, description, is_dark, sort_order, is_active, colors, personality, preview, primeng_ramp) VALUES\n`;

  const values: string[] = [];

  for (let i = 0; i < themeDefinitions.length; i++) {
    const theme = themeDefinitions[i];
    const colors = generateThemeColors(theme);
    const personality = generatePersonality(theme);
    const preview = generatePreview(theme);
    const primengRamp = generatePrimengRamp(theme.primary);

    // Validate contrast
    if (!validateContrast(colors)) {
      console.error(`❌ Theme ${theme.slug} failed WCAG contrast validation`);
      process.exit(1);
    }

    const value = `    ('${theme.slug}', '${theme.name}', '${theme.category}', '${theme.description.replace(/'/g, "''")}', ${theme.isDark}, ${i}, true, '${JSON.stringify(colors).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(personality).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(preview).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(primengRamp).replace(/'/g, "''")}'::jsonb)`;
    values.push(value);
  }

  sql += values.join(",\n");
  sql += `\nON CONFLICT (slug) DO NOTHING;\n`;

  return sql;
}

// Run
const sql = generateSQL();
console.log(sql);
console.error(
  `✅ Generated ${themeDefinitions.length} themes with WCAG contrast validation`,
);
