import type { MessageKey } from "#lib/i18n";

/**
 * A restaurant list bundled with the site under `presets/`, one per neighbourhood. `count` is
 * shown before the file is fetched; a test keeps it equal to the file's length.
 */
export type Preset = { id: string; name: MessageKey; count: number };

export const PRESETS: readonly Preset[] = [
	{ id: "ladprao", name: "preset.ladprao", count: 144 },
	{ id: "ratchayothin", name: "preset.ratchayothin", count: 55 },
];

/** Relative to the page, like every other link on the site. */
export const presetUrl = (id: string): string => `presets/${id}.json`;
