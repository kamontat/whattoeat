import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-footer";
import { setLang } from "#lib/i18n";

const SHA = "0123456789abcdef0123456789abcdef01234567";

beforeEach(() => {
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	setLang("en");
	localStorage.clear();
});

const mount = async (
	sha?: string,
	built?: Date,
	pr?: { number: number; branch?: string },
) => {
	const el = document.createElement("app-footer");
	el.sha = sha;
	el.built = built;
	el.pr = pr?.number;
	el.branch = pr?.branch;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const link = (el: HTMLElement, name: string) =>
	el.shadowRoot!.querySelector<HTMLAnchorElement>(`a[data-link="${name}"]`);

test("links the source on GitHub and the changelog", async () => {
	const el = await mount();
	expect(link(el, "source")?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat",
	);
	expect(link(el, "source")?.textContent?.trim()).toBe("Source on GitHub");
	expect(link(el, "changelog")?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat/blob/main/CHANGELOG.md",
	);
	expect(link(el, "changelog")?.textContent?.trim()).toBe("Changelog");
});

test("links the commit by its short sha", async () => {
	const el = await mount(SHA);
	const commit = link(el, "commit");
	expect(commit?.getAttribute("href")).toBe(
		`https://github.com/kamontat/whattoeat/commit/${SHA}`,
	);
	expect(commit?.textContent?.trim()).toBe("0123456");
});

const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();

test("points the source of a preview build at its pull request", async () => {
	const el = await mount(SHA, undefined, {
		number: 34,
		branch: "worktree-foo",
	});
	const source = link(el, "source");
	expect(source?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat/pull/34",
	);
	expect(source?.querySelector("b")?.textContent).toBe("Source on GitHub");
	expect(text(source?.querySelector("small"))).toBe("#34 - worktree-foo");
	expect(text(link(el, "commit"))).toBe("0123456");
});

test("leaves the branch out of the pull request without one", async () => {
	const el = await mount(SHA, undefined, { number: 34 });
	expect(text(link(el, "source")?.querySelector("small"))).toBe("#34");
});

test("shows no pull request for a production build", async () => {
	const el = await mount(SHA);
	expect(link(el, "source")?.querySelector("small")).toBeNull();
});

const env = (el: HTMLElement) =>
	el.shadowRoot!.querySelector('[data-row="env"]');

test("names the production environment", async () => {
	const el = await mount(SHA);
	expect(env(el)?.querySelector("b")?.textContent).toBe("Environment");
	expect(text(env(el)?.querySelector(".trail"))).toBe("production");
});

test("names the preview environment", async () => {
	const el = await mount(SHA, undefined, { number: 34 });
	expect(text(env(el)?.querySelector(".trail"))).toBe("preview");
});

test("shows no environment for a development build", async () => {
	const el = await mount();
	expect(env(el)).toBeNull();
});

test("shows the build date in a time element", async () => {
	const el = await mount(SHA, new Date("2026-10-13T08:30:00Z"));
	const time = el.shadowRoot!.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-13T08:30:00.000Z");
	expect(time?.textContent).toContain("2026");
	expect(el.shadowRoot!.textContent).toContain("Built");
});

test("shows the time zone of the build time", async () => {
	const saved = process.env.TZ;
	process.env.TZ = "Asia/Bangkok";
	try {
		// The separator between date and time varies with the ICU version ("at" or ",").
		const el = await mount(SHA, new Date("2026-10-13T08:30:00Z"));
		const time = () => el.shadowRoot!.querySelector("time")?.textContent;
		expect(time()).toStartWith("Oct 13, 2026");
		expect(time()).toEndWith("3:30 PM GMT+7");
		setLang("th");
		await el.updateComplete;
		expect(time()).toStartWith("13 ต.ค. 2569");
		expect(time()).toEndWith("15:30 GMT+7");
	} finally {
		if (saved === undefined) delete process.env.TZ;
		else process.env.TZ = saved;
	}
});

test("says development build when nothing was inlined", async () => {
	const el = await mount();
	expect(link(el, "commit")).toBeNull();
	expect(el.shadowRoot!.querySelector("time")).toBeNull();
	expect(el.shadowRoot!.textContent).toContain("Development build");
});

test("follows the language", async () => {
	const el = await mount(SHA, new Date("2026-10-13T08:30:00Z"));
	setLang("th");
	await el.updateComplete;
	expect(link(el, "source")?.textContent?.trim()).toBe("ซอร์สโค้ดบน GitHub");
	expect(link(el, "changelog")?.textContent?.trim()).toBe("บันทึกการเปลี่ยนแปลง");
	expect(el.shadowRoot!.textContent).toContain("สร้างเมื่อ");
	expect(env(el)?.querySelector("b")?.textContent).toBe("สภาพแวดล้อม");
});

test("lays the links out as list rows", async () => {
	const el = await mount(SHA, new Date("2026-10-15T08:00:00Z"));
	const rows = [...el.shadowRoot!.querySelectorAll(".group > .item")];
	expect(
		rows.map(
			(row) =>
				row.getAttribute("data-link") ??
				row.getAttribute("data-row") ??
				row.tagName,
		),
	).toEqual(["source", "changelog", "commit", "env", "DIV"]);
});
