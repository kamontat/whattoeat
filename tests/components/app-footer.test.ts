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

test("links a preview build to its pull request, naming branch and sha", async () => {
	const el = await mount(SHA, undefined, {
		number: 34,
		branch: "worktree-foo",
	});
	const pull = link(el, "pull");
	expect(pull?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat/pull/34",
	);
	expect(pull?.textContent?.replace(/\s+/g, " ").trim()).toBe(
		"#34 - worktree-foo (0123456)",
	);
	expect(link(el, "commit")).toBeNull();
});

test("leaves the branch out of a pull request row without one", async () => {
	const el = await mount(SHA, undefined, { number: 34 });
	expect(link(el, "pull")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
		"#34 (0123456)",
	);
});

test("shows no pull request for a production build", async () => {
	const el = await mount(SHA);
	expect(link(el, "pull")).toBeNull();
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
});

test("lays the links out as list rows", async () => {
	const el = await mount(SHA, new Date("2026-10-15T08:00:00Z"));
	const rows = [...el.shadowRoot!.querySelectorAll(".group > .item")];
	expect(
		rows.map((row) => row.getAttribute("data-link") ?? row.tagName),
	).toEqual(["source", "changelog", "commit", "DIV"]);
});

test("puts the pull request where the commit goes", async () => {
	const el = await mount(SHA, new Date("2026-10-15T08:00:00Z"), {
		number: 34,
		branch: "worktree-foo",
	});
	const rows = [...el.shadowRoot!.querySelectorAll(".group > .item")];
	expect(
		rows.map((row) => row.getAttribute("data-link") ?? row.tagName),
	).toEqual(["source", "changelog", "pull", "DIV"]);
});
