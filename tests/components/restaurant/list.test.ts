import { afterEach, beforeEach, expect, test } from "bun:test";
import { html, render } from "lit";
import { renderRow, sortByName } from "#components/restaurant/list";
import { setLang } from "#lib/i18n";
import type { Restaurant } from "#lib/restaurant";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
});

const make = (id: string, name: string): Restaurant => ({
	id,
	name,
	location: "",
	notes: "",
	kinds: [],
	tags: [],
	groups: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
});

test("sortByName sorts by name without changing the given list", () => {
	const list = [make("1", "pho"), make("2", "Bun"), make("3", "curry")];
	expect(sortByName(list).map((item) => item.name)).toEqual([
		"Bun",
		"curry",
		"pho",
	]);
	expect(list[0]?.name).toBe("pho");
});

test("renderRow marks the matched parts, flags the current row and reports a click", () => {
	const clicked: string[] = [];
	const host = document.createElement("ul");
	document.body.append(host);
	render(
		html`${renderRow(make("1", "Ramen Bar"), [{ start: 0, end: 3 }], true, (item) => clicked.push(item.id))}`,
		host,
	);
	const button = host.querySelector<HTMLButtonElement>(
		"li[data-id='1'] button",
	);
	expect(button?.getAttribute("aria-current")).toBe("true");
	expect(host.querySelector(".name mark")?.textContent).toBe("Ram");
	expect(host.querySelector(".name")?.textContent).toBe("Ramen Bar");
	button?.click();
	expect(clicked).toEqual(["1"]);
});
