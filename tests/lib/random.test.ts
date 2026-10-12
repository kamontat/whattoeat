import { expect, test } from "bun:test";
import { pickRandom } from "#lib/random";
import type { Restaurant } from "#lib/restaurant";

const make = (id: string): Restaurant => ({
	id,
	name: id,
	tags: [],
	location: "",
	notes: "",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
});

test("returns undefined for an empty list", () => {
	expect(pickRandom([])).toBeUndefined();
});

test("returns the only item even when it was the previous pick", () => {
	expect(pickRandom([make("a")], "a")?.id).toBe("a");
});

test("uses rng to choose the index", () => {
	const list = [make("a"), make("b"), make("c")];
	expect(pickRandom(list, undefined, () => 0)?.id).toBe("a");
	expect(pickRandom(list, undefined, () => 0.5)?.id).toBe("b");
	expect(pickRandom(list, undefined, () => 0.99)?.id).toBe("c");
});

test("never returns the previous pick when the list has 2+ items", () => {
	const list = [make("a"), make("b"), make("c")];
	for (const value of [0, 0.34, 0.67, 0.99]) {
		expect(pickRandom(list, "b", () => value)?.id).not.toBe("b");
	}
});

test("with two items always switches", () => {
	const list = [make("a"), make("b")];
	expect(pickRandom(list, "a", () => 0.99)?.id).toBe("b");
	expect(pickRandom(list, "b", () => 0)?.id).toBe("a");
});
