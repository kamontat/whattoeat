import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-footer";
import type { Environment } from "#lib/build-info";
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

const BUILT = new Date("2026-10-13T08:30:00Z");

const mount = async ({
	environment = "production",
	sha = environment === "production" || environment === "preview"
		? SHA
		: undefined,
	built = environment === "development" ? undefined : BUILT,
	pr,
}: {
	environment?: Environment;
	sha?: string;
	built?: Date;
	pr?: { number: number; branch?: string };
} = {}) => {
	const el = document.createElement("app-footer");
	el.environment = environment;
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
	const el = await mount();
	const commit = link(el, "commit");
	expect(commit?.getAttribute("href")).toBe(
		`https://github.com/kamontat/whattoeat/commit/${SHA}`,
	);
	expect(commit?.textContent?.trim()).toBe("0123456");
});

const text = (node: Element | null | undefined) =>
	node?.textContent?.replace(/\s+/g, " ").trim();

test("points the source of a preview build at its pull request", async () => {
	const el = await mount({
		environment: "preview",
		pr: { number: 34, branch: "worktree-foo" },
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
	const el = await mount({ environment: "preview", pr: { number: 34 } });
	expect(text(link(el, "source")?.querySelector("small"))).toBe("#34");
});

test("shows no pull request for a production build", async () => {
	const el = await mount();
	expect(link(el, "source")?.querySelector("small")).toBeNull();
});

const env = (el: HTMLElement) =>
	el.shadowRoot!.querySelector('[data-row="env"]');

test("names the production environment", async () => {
	const el = await mount();
	expect(env(el)?.querySelector("b")?.textContent).toBe("Environment");
	expect(text(env(el)?.querySelector(".trail"))).toBe("production");
});

test("names the preview environment", async () => {
	const el = await mount({ environment: "preview", pr: { number: 34 } });
	expect(text(env(el)?.querySelector(".trail"))).toBe("preview");
});

test("names the local and development environments", async () => {
	for (const environment of ["local", "development"] as const) {
		const el = await mount({ environment });
		expect(text(env(el)?.querySelector(".trail"))).toBe(environment);
		el.remove();
	}
});

test("shows no pull request outside a preview, even when one was inlined", async () => {
	const el = await mount({ environment: "production", pr: { number: 34 } });
	expect(link(el, "source")?.getAttribute("href")).toBe(
		"https://github.com/kamontat/whattoeat",
	);
	expect(link(el, "source")?.querySelector("small")).toBeNull();
});

test("shows the build date in a time element", async () => {
	const el = await mount();
	const time = el.shadowRoot!.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-13T08:30:00.000Z");
	expect(time?.textContent).toContain("2026");
	expect(el.shadowRoot!.textContent).toContain("Built");
});

test("lays the build date out like the environment, title left and value right", async () => {
	const el = await mount();
	const row = el.shadowRoot!.querySelector('[data-row="built"]');
	expect(row?.querySelector(".grow b")?.textContent).toBe("Built");
	expect(row?.querySelector(".trail time")).not.toBeNull();
});

test("shows the time zone of the build time", async () => {
	const saved = process.env.TZ;
	process.env.TZ = "Asia/Bangkok";
	try {
		// The separator between date and time varies with the ICU version ("at" or ",").
		const el = await mount();
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

const rows = (el: HTMLElement) =>
	[...el.shadowRoot!.querySelectorAll(".group > .item")].map(
		(row) =>
			row.getAttribute("data-link") ??
			row.getAttribute("data-row") ??
			row.tagName,
	);

test("shows source, environment and build date for a local build", async () => {
	const el = await mount({ environment: "local" });
	expect(rows(el)).toEqual(["env", "built", "source"]);
});

test("shows only source and environment on the development server", async () => {
	const el = await mount({ environment: "development" });
	expect(rows(el)).toEqual(["env", "source"]);
	expect(el.shadowRoot!.querySelector("time")).toBeNull();
});

test("follows the language", async () => {
	const el = await mount();
	setLang("th");
	await el.updateComplete;
	expect(link(el, "source")?.textContent?.trim()).toBe("ซอร์สโค้ดบน GitHub");
	expect(link(el, "changelog")?.textContent?.trim()).toBe("บันทึกการเปลี่ยนแปลง");
	expect(el.shadowRoot!.textContent).toContain("สร้างเมื่อ");
	expect(env(el)?.querySelector("b")?.textContent).toBe("สภาพแวดล้อม");
});

test("lays the links out as list rows", async () => {
	for (const environment of ["production", "preview"] as const) {
		const el = await mount({ environment });
		expect(rows(el)).toEqual(["env", "built", "commit", "source", "changelog"]);
		el.remove();
	}
});
