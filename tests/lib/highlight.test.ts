import { afterEach, expect, test } from "bun:test";
import { render } from "lit";
import { highlight } from "#lib/highlight";

const renderInto = (name: string, ranges: Parameters<typeof highlight>[1]) => {
	const div = document.createElement("div");
	render(highlight(name, ranges), div);
	return div;
};

afterEach(() => {
	document.body.innerHTML = "";
});

test("no ranges returns the plain name", () => {
	expect(highlight("thai", [])).toBe("thai");
	const div = renderInto("thai", []);
	expect(div.textContent).toBe("thai");
	expect(div.querySelectorAll("mark")).toHaveLength(0);
});

test("two ranges produce two <mark> parts with the text between kept", () => {
	const div = renderInto("Siam Jam", [
		{ start: 0, end: 4 },
		{ start: 5, end: 8 },
	]);
	const marks = [...div.querySelectorAll("mark")];
	expect(marks.map((mark) => mark.textContent)).toEqual(["Siam", "Jam"]);
	// The space between the two matched words survives as its own text node, not swallowed
	// by lit's template markers, so the row's full name still reads correctly.
	expect(div.textContent).toBe("Siam Jam");
});
