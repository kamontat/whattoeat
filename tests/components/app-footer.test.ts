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

const mount = async (sha?: string, built?: Date) => {
	const el = document.createElement("app-footer");
	el.sha = sha;
	el.built = built;
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

test("shows the build date in a time element", async () => {
	const el = await mount(SHA, new Date("2026-10-13T08:30:00Z"));
	const time = el.shadowRoot!.querySelector("time");
	expect(time?.getAttribute("datetime")).toBe("2026-10-13T08:30:00.000Z");
	expect(time?.textContent).toContain("2026");
	expect(el.shadowRoot!.textContent).toContain("Built");
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
