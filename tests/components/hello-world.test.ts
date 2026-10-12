import { afterEach, expect, test } from "bun:test";
import "#components/hello-world";

afterEach(() => {
	document.body.innerHTML = "";
});

test("renders default greeting", async () => {
	const el = document.createElement("hello-world");
	document.body.append(el);
	await el.updateComplete;
	expect(el.shadowRoot?.querySelector("h1")?.textContent).toBe("Hello, World!");
});

test("renders custom name", async () => {
	const el = document.createElement("hello-world");
	el.name = "Bun";
	document.body.append(el);
	await el.updateComplete;
	expect(el.shadowRoot?.querySelector("h1")?.textContent).toBe("Hello, Bun!");
});
