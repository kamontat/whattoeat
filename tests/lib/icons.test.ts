import { expect, test } from "bun:test";
import { render } from "lit";
import { ICON_NAMES, icon, logo } from "#lib/icons";

const mount = (template: unknown): SVGElement => {
	const host = document.createElement("div");
	render(template, host);
	return host.querySelector("svg")!;
};

test.each([...ICON_NAMES])(
	"%s is a hidden 24px stroke icon with a shape",
	(name) => {
		const svg = mount(icon(name));
		expect(svg.getAttribute("aria-hidden")).toBe("true");
		expect(svg.getAttribute("focusable")).toBe("false");
		expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
		expect(svg.getAttribute("width")).toBe("24");
		expect(svg.getAttribute("stroke")).toBe("currentColor");
		expect(svg.querySelector("path, circle, rect")).not.toBeNull();
	},
);

test("icon names its shape in data-icon", () => {
	expect(mount(icon("globe")).getAttribute("data-icon")).toBe("globe");
});

test("icon takes a size", () => {
	expect(mount(icon("x", 18)).getAttribute("height")).toBe("18");
});

test("the logo is hidden and drawn in the primary colours", () => {
	const svg = mount(logo());
	expect(svg.getAttribute("aria-hidden")).toBe("true");
	expect(svg.querySelector("circle")?.getAttribute("fill")).toBe(
		"var(--color-primary)",
	);
});
