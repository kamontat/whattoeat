import { afterEach, beforeEach, expect, test } from "bun:test";
import "#components/app-toast";
import "#components/profile-manager";
import type { AppToast } from "#components/app-toast";
import type { ProfileManager } from "#components/profile-manager";
import { setLang } from "#lib/i18n";
import {
	activeProfile,
	createProfile,
	loadProfiles,
	profileCounts,
	profileKey,
	switchProfile,
} from "#lib/profiles";

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
	sessionStorage.clear();
});

const $ = (el: ProfileManager, selector: string) =>
	el.shadowRoot!.querySelector<HTMLElement>(selector);

const $$ = (el: ProfileManager, selector: string): HTMLElement[] => [
	...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];

test("the page stacks its parts with the same gap as the other settings pages", () => {
	const css = [
		(customElements.get("profile-manager") as unknown as { styles: unknown })
			.styles,
	]
		.flat(2)
		.map((style) => (style as { cssText: string }).cssText)
		.join("");
	expect(css).toMatch(
		/:host\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*1rem/,
	);
});

const mount = async (): Promise<ProfileManager> => {
	const el = document.createElement("profile-manager");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

/** The component's own toast: these tests mount no page-level `<app-toast>`. */
const toastOf = (el: ProfileManager): AppToast =>
	$(el, "app-toast") as unknown as AppToast;

const toastText = async (el: ProfileManager): Promise<string | undefined> => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await toastOf(el).updateComplete;
	return toastOf(el)
		.shadowRoot?.querySelector(".toast span")
		?.textContent?.trim();
};

const typeName = async (el: ProfileManager, name: string): Promise<void> => {
	const input = $(el, "#profile-name") as HTMLInputElement;
	input.value = name;
	input.dispatchEvent(new Event("input"));
	await el.updateComplete;
};

const click = async (el: ProfileManager, selector: string): Promise<void> => {
	($(el, selector) as HTMLButtonElement).click();
	await el.updateComplete;
};

test("lists every profile with its count and marks the active one", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	localStorage.setItem(
		profileKey("restaurants", personal.id),
		JSON.stringify([{}, {}]),
	);
	localStorage.setItem(
		profileKey("restaurants", family.id),
		JSON.stringify([{}, {}, {}]),
	);
	// Family is active (createProfile switches); check both rows.
	const el = await mount();

	const rows = $$(el, "[data-profile]");
	expect(rows.length).toBe(2);

	const personalRow = $(el, `[data-profile="${personal.id}"]`)!;
	expect(personalRow.querySelector(".lead")?.textContent?.trim()).toBe("P");
	expect(personalRow.querySelector("b")?.textContent?.trim()).toBe("Personal");
	expect(personalRow.querySelector("small")?.textContent?.trim()).toBe(
		"2 restaurants",
	);
	expect(personalRow.getAttribute("aria-current")).toBeNull();
	expect(personalRow.querySelector(".trail")).toBeNull();

	const familyRow = $(el, `[data-profile="${family.id}"]`)!;
	expect(familyRow.querySelector(".lead")?.textContent?.trim()).toBe("F");
	expect(familyRow.querySelector("small")?.textContent?.trim()).toBe(
		"3 restaurants",
	);
	expect(familyRow.getAttribute("aria-current")).toBe("true");
	expect(familyRow.querySelector(".trail")).not.toBeNull();
});

test("tapping a profile switches to it and says so", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	switchProfile(personal.id);
	const el = await mount();

	await click(el, `[data-profile="${family.id}"]`);

	expect(activeProfile().name).toBe("Family");
	expect(await toastText(el)).toBe("Switched to Family");
	expect(
		$(el, `[data-profile="${family.id}"]`)?.getAttribute("aria-current"),
	).toBe("true");
	expect(
		$(el, `[data-profile="${personal.id}"]`)?.getAttribute("aria-current"),
	).toBeNull();
});

test("New creates an empty profile and switches to it", async () => {
	const el = await mount();

	await click(el, '[data-action="new"]');
	expect($(el, "#profile-name")).not.toBeNull();
	await typeName(el, "Couple");
	await click(el, '[data-action="save"]');

	const created = loadProfiles().find((profile) => profile.name === "Couple");
	expect(created).toBeDefined();
	expect(activeProfile().id).toBe(created!.id);
	expect(profileCounts(created!.id)).toEqual({ restaurants: 0, history: 0 });
	expect(await toastText(el)).toBe("Created Couple");
	// Back to the list: the form is gone, the actions show again.
	expect($(el, "#profile-name")).toBeNull();
	expect($(el, '[data-action="new"]')).not.toBeNull();
});

test("New shows the name error inline and saves nothing", async () => {
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, '[data-action="new"]');
	await click(el, '[data-action="save"]');
	expect($(el, ".error")?.textContent?.trim()).toBe("Give it a name.");
	expect(loadProfiles().length).toBe(before);

	await typeName(el, "Personal");
	await click(el, '[data-action="save"]');
	expect($(el, ".error")?.textContent?.trim()).toBe(
		"Another profile has that name.",
	);
	expect(loadProfiles().length).toBe(before);
});

test("Rename renames the active profile", async () => {
	const personal = loadProfiles()[0]!;
	const el = await mount();

	await click(el, '[data-action="rename"]');
	expect(($(el, "#profile-name") as HTMLInputElement).value).toBe("Personal");
	await typeName(el, "Me");
	await click(el, '[data-action="save"]');

	expect(activeProfile().name).toBe("Me");
	expect(
		loadProfiles().find((profile) => profile.id === personal.id)?.name,
	).toBe("Me");
	expect($(el, `[data-profile="${personal.id}"] b`)?.textContent?.trim()).toBe(
		"Me",
	);
});

test("Delete asks once, then deletes and switches to the first remaining", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	localStorage.setItem(
		profileKey("restaurants", family.id),
		JSON.stringify([{}, {}, {}]),
	);
	localStorage.setItem(
		profileKey("history", family.id),
		JSON.stringify([{}, {}]),
	);
	const el = await mount();

	await click(el, '[data-action="delete"]');
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"Delete Family? This removes its 3 restaurants and 2 history entries. You'll switch to Personal.",
	);
	// Nothing happened yet.
	expect(
		loadProfiles().find((profile) => profile.id === family.id),
	).toBeDefined();

	await click(el, '[data-action="delete-confirm"]');

	expect(
		loadProfiles().find((profile) => profile.id === family.id),
	).toBeUndefined();
	expect(activeProfile().id).toBe(personal.id);
	expect(await toastText(el)).toBe("Deleted Family.");
});

test("the delete prompt reads correctly for one restaurant and one history entry", async () => {
	const family = createProfile("Family");
	localStorage.setItem(
		profileKey("restaurants", family.id),
		JSON.stringify([{}]),
	);
	localStorage.setItem(profileKey("history", family.id), JSON.stringify([{}]));
	const el = await mount();

	await click(el, '[data-action="delete"]');
	expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
		"Delete Family? This removes its 1 restaurant and 1 history entry. You'll switch to Personal.",
	);

	setLang("th");
	try {
		await el.updateComplete;
		expect($(el, '[role="alert"]')?.textContent?.trim()).toBe(
			"ลบ Family? 1 ร้านและประวัติ 1 รายการจะหายไป แล้วจะเปลี่ยนไปใช้ Personal",
		);
	} finally {
		setLang("en");
	}
});

test("Delete is disabled with one profile", async () => {
	const el = await mount();
	expect(($(el, '[data-action="delete"]') as HTMLButtonElement).disabled).toBe(
		true,
	);
});

test("Cancel on the New form discards the typed name and returns to the actions", async () => {
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, '[data-action="new"]');
	await typeName(el, "Discard me");
	await click(el, '[data-action="cancel"]');

	expect($(el, "#profile-name")).toBeNull();
	expect(loadProfiles().length).toBe(before);
});

test("Cancel on the Delete confirm leaves the profile in place", async () => {
	createProfile("Family");
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, '[data-action="delete"]');
	await click(el, '[data-action="delete-cancel"]');

	expect($(el, '[role="alert"]')).toBeNull();
	expect(loadProfiles().length).toBe(before);
	expect($(el, '[data-action="delete"]')).not.toBeNull();
});

test("a back link points to the base plus settings", async () => {
	const el = document.createElement("profile-manager");
	el.base = "../../";
	document.body.append(el);
	await el.updateComplete;
	const back = $(el, "a.back") as HTMLAnchorElement;
	expect(back.getAttribute("href")).toBe("../../settings");
	expect(back.textContent?.trim()).toBe("Settings");
});
