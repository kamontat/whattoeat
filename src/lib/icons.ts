import { html, type SVGTemplateResult, svg, type TemplateResult } from "lit";

/** 24px stroke shapes, drawn for `stroke-width="2"` with round caps. */
const SHAPES = {
	dice: svg`<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>`,
	bowl: svg`<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7.5c0-1.5 1-2 1-3.5M12 7.5c0-1.5 1-2 1-3.5M16 7.5c0-1.5 1-2 1-3.5"/>`,
	clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
	sliders: svg`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
	x: svg`<path d="M6 6l12 12M18 6L6 18"/>`,
	check: svg`<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
	funnel: svg`<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>`,
	pin: svg`<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>`,
	chevron: svg`<path d="M9 6l6 6-6 6"/>`,
	back: svg`<path d="M15 6l-6 6 6 6"/>`,
	plus: svg`<path d="M12 5v14M5 12h14"/>`,
	edit: svg`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`,
	download: svg`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
	copy: svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>`,
	upload: svg`<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>`,
	tag: svg`<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>`,
	trash: svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,
	move: svg`<path d="M5 12h14M13 6l6 6-6 6"/>`,
	dots: svg`<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>`,
	up: svg`<path d="M12 19V5M6 11l6-6 6 6"/>`,
	down: svg`<path d="M12 5v14M6 13l6 6 6-6"/>`,
	code: svg`<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>`,
	list: svg`<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>`,
	search: svg`<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type IconName = keyof typeof SHAPES;

export const ICON_NAMES = Object.keys(SHAPES) as readonly IconName[];

/** A decorative icon: always pair it with visible text or give its control an accessible name. */
export const icon = (name: IconName, size = 24): TemplateResult =>
	html`<svg
		class="icon"
		width=${size}
		height=${size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>${SHAPES[name]}</svg>`;

/** The site mark from favicon.svg, in the theme's primary colours. */
export const logo = (size = 34): TemplateResult =>
	html`<svg class="logo" width=${size} height=${size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
		<circle cx="32" cy="32" r="30" fill="var(--color-primary)" />
		<g fill="none" stroke="var(--color-primary-text)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="32" cy="32" r="17" />
			<path d="M14 14v12a4 4 0 0 0 4 4v20M18 14v10M22 14v12a4 4 0 0 1-4 4" />
			<path d="M48 50V14c-4 2-6 8-6 16h6" />
		</g>
	</svg>`;
