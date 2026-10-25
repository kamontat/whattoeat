import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAddedPreset, mergeAddedPresets } from "#lib/preset-record";
import * as presets from "#lib/presets";

const source = (name: string): string =>
	readFileSync(join(import.meta.dir, "../../src/lib", name), "utf8");

test("the applied-preset record is a leaf module, so transfer and presets do not import each other", () => {
	expect(source("preset-record.ts")).not.toMatch(/^import /m);
	expect(source("transfer.ts")).not.toContain('from "#lib/presets"');
});

test("presets re-exports the record helpers for existing importers", () => {
	expect(presets.isAddedPreset).toBe(isAddedPreset);
	expect(presets.mergeAddedPresets).toBe(mergeAddedPresets);
});

test("isAddedPreset and mergeAddedPresets", () => {
	const a = { id: "a", updatedAt: "2026-01-01", ids: ["1"] };
	const b = { id: "b", updatedAt: "2026-01-02", ids: [] };
	expect(isAddedPreset(a)).toBe(true);
	expect(isAddedPreset({ ...a, id: "" })).toBe(false);
	expect(isAddedPreset({ ...a, ids: [1] })).toBe(false);
	expect(mergeAddedPresets([a], [{ ...a, ids: [] }, b])).toEqual([a, b]);
});
