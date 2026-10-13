import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Theme = "auto" | "light" | "dark";
export const THEMES: readonly Theme[] = ["auto", "light", "dark"];

export const THEME_KEY = "whattoeat:theme";
export const THEME_EVENT = "whattoeat:theme-changed";

const isTheme = (value: unknown): value is Theme =>
	value === "auto" || value === "light" || value === "dark";

/** Stored choice, else "auto" (follow the system setting). */
export const detectTheme = (): Theme => {
	try {
		const stored = localStorage.getItem(THEME_KEY);
		if (isTheme(stored)) return stored;
	} catch {
		// Storage blocked: fall back to the system setting.
	}
	return "auto";
};

let current: Theme | undefined;

/** `data-theme` on `<html>` picks the palette in global.css; none means follow the system. */
const mark = (theme: Theme): void => {
	if (theme === "auto") document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", theme);
};

export const getTheme = (): Theme => {
	if (current === undefined) {
		current = detectTheme();
		mark(current);
	}
	return current;
};

const apply = (theme: Theme): void => {
	current = theme;
	mark(theme);
	window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
};

export const setTheme = (theme: Theme): void => {
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
	apply(theme);
};

/** Mark the page with the stored theme as soon as this module loads, before the first paint where possible. */
export const initTheme = (): void => {
	current = detectTheme();
	mark(current);
};

initTheme();

// Follow a theme change made in another tab (`null` key is `localStorage.clear()`).
window.addEventListener("storage", (event: StorageEvent) => {
	if (event.key !== THEME_KEY && event.key !== null) return;
	const next = detectTheme();
	if (next !== current) apply(next);
});

/** Re-render the host component whenever the theme changes. */
export class ThemeController implements ReactiveController {
	private readonly host: ReactiveControllerHost;

	private readonly onChange = (): void => {
		this.host.requestUpdate();
	};

	constructor(host: ReactiveControllerHost) {
		this.host = host;
		host.addController(this);
	}

	hostConnected(): void {
		window.addEventListener(THEME_EVENT, this.onChange);
	}

	hostDisconnected(): void {
		window.removeEventListener(THEME_EVENT, this.onChange);
	}
}
