export type ThemeId = "terminal" | "editorial" | "swiss" | "aurora";

export type Theme = {
  id: ThemeId;
  label: string;
  blurb: string;
  glyph: string;
  accent: string;
  font: string;
};

export const themes: readonly Theme[] = [
  {
    id: "terminal",
    label: "Terminal",
    blurb: "brutalist DEC console",
    glyph: "T",
    accent: "oklch(0.88 0.22 130)",
    font: "'JetBrains Mono Variable', ui-monospace, monospace",
  },
  {
    id: "editorial",
    label: "Editorial",
    blurb: "paper, ink, drop caps",
    glyph: "E",
    accent: "oklch(0.62 0.13 70)",
    font: "'Fraunces Variable', serif",
  },
  {
    id: "swiss",
    label: "Swiss",
    blurb: "12-col grid, single red",
    glyph: "S",
    accent: "oklch(0.55 0.22 27)",
    font: "'Geist Variable', sans-serif",
  },
  {
    id: "aurora",
    label: "Aurora",
    blurb: "dark glass, gradient mesh",
    glyph: "A",
    accent: "oklch(0.78 0.16 320)",
    font: "'Instrument Serif', serif",
  },
] as const;

export const DEFAULT_THEME: ThemeId = "terminal";
export const THEME_STORAGE_KEY = "oomami:theme";
