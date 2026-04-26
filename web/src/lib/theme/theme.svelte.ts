import { browser } from "$app/environment";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  themes,
  type ThemeId,
} from "./themes";

function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" && themes.some((t) => t.id === value)
  );
}

function readInitial(): ThemeId {
  if (!browser) return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

class ThemeStore {
  current = $state<ThemeId>(DEFAULT_THEME);

  constructor() {
    if (browser) {
      this.current = readInitial();
      this.#sync(this.current);
    }
  }

  set(id: ThemeId) {
    this.current = id;
    if (browser) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, id);
      } catch {
        // ignore
      }
      this.#sync(id);
    }
  }

  #sync(id: ThemeId) {
    document.documentElement.dataset.theme = id;
  }
}

export const theme = new ThemeStore();
