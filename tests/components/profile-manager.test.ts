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
	type Profile,
	profileCounts,
	profileKey,
	switchProfile,
} from "#lib/profiles";

type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};

const setWidth = (width: number): void => {
	(window as unknown as HappyWindow).happyDOM.setViewport({
		width,
		height: 900,
	});
	window.dispatchEvent(new Event("resize"));
};

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	setLang("en");
});

afterEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
	sessionStorage.clear();
	setLang("en");
	setWidth(1024);
});

const $ = (el: ProfileManager, selector: string) =>
	el.shadowRoot!.querySelector<HTMLElement>(selector);

const $$ = (el: ProfileManager, selector: string): HTMLElement[] => [
	...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];

/** A profile's row button: the part that switches to it. */
const row = (el: ProfileManager, profile: Profile) =>
	$(el, `.item[data-profile="${profile.id}"]`);

/** One of a row's icon buttons: `rename`, `copy` or `delete`. */
const rowAction = (action: string, profile: Profile): string =>
	`button[data-action="${action}"][data-profile="${profile.id}"]`;

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

const phone = async (): Promise<ProfileManager> => {
	setWidth(390);
	return mount();
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

	expect($$(el, ".item[data-profile]").length).toBe(2);

	const personalRow = row(el, personal)!;
	expect(personalRow.localName).toBe("button");
	expect(personalRow.querySelector(".lead.avatar")?.textContent?.trim()).toBe(
		"P",
	);
	expect(personalRow.querySelector("b")?.textContent?.trim()).toBe("Personal");
	expect(personalRow.querySelector("small")?.textContent?.trim()).toBe(
		"2 restaurants · 0 history entries",
	);
	expect(personalRow.getAttribute("aria-current")).toBeNull();
	expect(personalRow.querySelector(".trail")).toBeNull();

	const familyRow = row(el, family)!;
	expect(familyRow.querySelector(".lead")?.textContent?.trim()).toBe("F");
	expect(familyRow.querySelector("small")?.textContent?.trim()).toBe(
		"3 restaurants · 0 history entries",
	);
	expect(familyRow.getAttribute("aria-current")).toBe("true");
	expect(familyRow.querySelector(".trail")).not.toBeNull();
});

test("a row's subtitle counts restaurants and history, joined by a middle dot", async () => {
	const personal = loadProfiles()[0]!;
	localStorage.setItem(profileKey("restaurants", personal.id), "[{}]");
	localStorage.setItem(profileKey("history", personal.id), "[{},{}]");
	const el = await mount();
	const sub = () =>
		row(el, personal)?.querySelector("small")?.textContent?.trim();
	expect(sub()).toBe("1 restaurant · 2 history entries");

	setLang("th");
	await el.updateComplete;
	expect(sub()).toBe("1 ร้าน · ประวัติ 2 รายการ");
});

test("each row has icon-only rename, copy and delete buttons named for that profile", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	const el = await mount();

	for (const profile of [personal, family]) {
		for (const [action, label] of [
			["rename", `Rename ${profile.name}`],
			["copy", `Copy ${profile.name}`],
			["delete", `Delete ${profile.name}`],
		] as const) {
			const button = $(el, rowAction(action, profile))!;
			expect(button).not.toBeNull();
			expect(button.getAttribute("aria-label")).toBe(label);
			expect(button.getAttribute("title")).toBe(label);
			expect(button.querySelector("svg")).not.toBeNull();
			expect(button.textContent?.trim()).toBe("");
		}
	}
	// The old row of New / Rename / Delete under the list is gone.
	expect($(el, ".group + .actions")).toBeNull();
	expect($$(el, '[data-action="rename"]:not([data-profile])')).toEqual([]);
});

test("the row labels follow the language", async () => {
	setLang("th");
	const personal = loadProfiles()[0]!;
	const el = await mount();
	expect($(el, rowAction("rename", personal))?.getAttribute("aria-label")).toBe(
		`เปลี่ยนชื่อ ${personal.name}`,
	);
	expect($(el, rowAction("copy", personal))?.getAttribute("aria-label")).toBe(
		`คัดลอก ${personal.name}`,
	);
	expect($(el, rowAction("delete", personal))?.getAttribute("aria-label")).toBe(
		`ลบ ${personal.name}`,
	);
});

test("tapping a profile switches to it and says so", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	switchProfile(personal.id);
	const el = await mount();

	row(el, family)!.click();
	await el.updateComplete;

	expect(activeProfile().name).toBe("Family");
	expect(await toastText(el)).toBe("Switched to Family");
	expect(row(el, family)?.getAttribute("aria-current")).toBe("true");
	expect(row(el, personal)?.getAttribute("aria-current")).toBeNull();
});

test("wide: the add button sits beside the title and opens the form in a side panel", async () => {
	const el = await mount();
	const add = $(el, ".head .head-actions button.primary.add")!;
	expect(add).not.toBeNull();
	expect(add.getAttribute("aria-label")).toBe("New profile");
	expect(add.getAttribute("title")).toBe("New profile");
	expect(add.getAttribute("aria-expanded")).toBe("false");
	expect(add.getAttribute("aria-controls")).toBe("edit-panel");
	expect($(el, ".pinned")).toBeNull();
	expect($(el, "app-sheet")).toBeNull();
	expect($(el, "#edit-panel")).toBeNull();
	expect($(el, ".head h1.page-title")?.textContent?.trim()).toBe("Profiles");

	await click(el, "button.add");

	const panel = $(el, "section#edit-panel.card.edit-panel")!;
	expect(panel).not.toBeNull();
	expect(
		panel.querySelector(".panel-head #form-title")?.textContent?.trim(),
	).toBe("New profile");
	expect(panel.querySelector("#profile-name")).not.toBeNull();
	expect(add.getAttribute("aria-expanded")).toBe("true");
	expect($(el, ".layout")?.classList.contains("wide")).toBe(true);
	expect(el.shadowRoot!.activeElement?.id).toBe("profile-name");

	// The panel's close button cancels and gives focus back to the add button.
	await click(el, '[data-action="close-panel"]');
	expect($(el, "#edit-panel")).toBeNull();
	expect(loadProfiles()).toHaveLength(1);
	await el.updateComplete;
	expect(el.shadowRoot!.activeElement).toBe(add);
});

test("wide: the add button again closes an open new-profile panel", async () => {
	const el = await mount();
	await click(el, "button.add");
	expect($(el, "#edit-panel")).not.toBeNull();
	await click(el, "button.add");
	expect($(el, "#edit-panel")).toBeNull();
});

test("phone: the add button is pinned at the bottom and opens the form in a sheet", async () => {
	const el = await phone();
	const add = $(el, ".pinned button.primary.add")!;
	expect(add).not.toBeNull();
	expect(add.getAttribute("aria-label")).toBe("New profile");
	expect(add.getAttribute("aria-expanded")).toBeNull();
	expect($(el, ".head-actions button.add")).toBeNull();
	const sheet = $(el, "app-sheet.form-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(false);

	await click(el, ".pinned button.add");

	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("New profile");
	expect(sheet.querySelector("#profile-name")).not.toBeNull();
	expect($(el, "#edit-panel")).toBeNull();
});

test("phone: closing the sheet cancels the form", async () => {
	const el = await phone();
	await click(el, ".pinned button.add");
	await typeName(el, "Discard me");
	const sheet = $(el, "app-sheet.form-sheet")!;
	sheet.dispatchEvent(
		new CustomEvent("sheet-close", { bubbles: true, composed: true }),
	);
	await el.updateComplete;
	expect(sheet.hasAttribute("open")).toBe(false);
	expect(loadProfiles()).toHaveLength(1);
});

test("phone: New saves from the sheet and closes it", async () => {
	const el = await phone();
	await click(el, ".pinned button.add");
	await typeName(el, "Couple");
	await click(el, '[data-action="save"]');
	expect(activeProfile().name).toBe("Couple");
	expect($(el, "app-sheet.form-sheet")?.hasAttribute("open")).toBe(false);
	expect(await toastText(el)).toBe("Created Couple");
});

test("New creates an empty profile and switches to it", async () => {
	const el = await mount();

	await click(el, "button.add");
	expect($(el, ".hint")?.textContent?.trim()).toBe(
		"Starts empty: no restaurants, default tags, no history.",
	);
	await typeName(el, "Couple");
	await click(el, '[data-action="save"]');

	const created = loadProfiles().find((profile) => profile.name === "Couple");
	expect(created).toBeDefined();
	expect(activeProfile().id).toBe(created!.id);
	expect(profileCounts(created!.id)).toEqual({ restaurants: 0, history: 0 });
	expect(await toastText(el)).toBe("Created Couple");
	expect($(el, "#profile-name")).toBeNull();
	expect($(el, "#edit-panel")).toBeNull();
});

test("New shows the name error inline and saves nothing", async () => {
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, "button.add");
	await click(el, '[data-action="save"]');
	expect($(el, ".error")?.textContent?.trim()).toBe("Give it a name.");
	expect(loadProfiles().length).toBe(before);

	await typeName(el, "Personal");
	await click(el, '[data-action="save"]');
	expect($(el, ".error")?.textContent?.trim()).toBe(
		"Another profile has that name.",
	);
	expect(loadProfiles().length).toBe(before);
	expect($(el, "#edit-panel")).not.toBeNull();
});

test("Cancel on the form discards the typed name and closes it", async () => {
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, "button.add");
	await typeName(el, "Discard me");
	await click(el, '[data-action="cancel"]');

	expect($(el, "#profile-name")).toBeNull();
	expect(loadProfiles().length).toBe(before);
});

test("Rename renames the active profile", async () => {
	const personal = loadProfiles()[0]!;
	const el = await mount();

	await click(el, rowAction("rename", personal));
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Rename Personal");
	expect(($(el, "#profile-name") as HTMLInputElement).value).toBe("Personal");
	expect($(el, ".hint")).toBeNull();
	await typeName(el, "Me");
	await click(el, '[data-action="save"]');

	expect(activeProfile().name).toBe("Me");
	expect(row(el, personal)?.querySelector("b")?.textContent?.trim()).toBe("Me");
	expect($(el, "#edit-panel")).toBeNull();
});

test("Rename on another profile renames that one without switching", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	switchProfile(personal.id);
	const el = await mount();

	await click(el, rowAction("rename", family));
	expect($(el, "#form-title")?.textContent?.trim()).toBe("Rename Family");
	expect(($(el, "#profile-name") as HTMLInputElement).value).toBe("Family");
	// Its own name is not a clash, another profile's is.
	await typeName(el, "personal");
	await click(el, '[data-action="save"]');
	expect($(el, ".error")?.textContent?.trim()).toBe(
		"Another profile has that name.",
	);
	await typeName(el, "Kids");
	await click(el, '[data-action="save"]');

	expect(loadProfiles().map((profile) => profile.name)).toEqual([
		"Personal",
		"Kids",
	]);
	expect(activeProfile().id).toBe(personal.id);
});

test("phone: Rename opens the sheet titled for that profile", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	switchProfile(personal.id);
	const el = await phone();

	await click(el, rowAction("rename", family));
	const sheet = $(el, "app-sheet.form-sheet")!;
	expect(sheet.hasAttribute("open")).toBe(true);
	expect(sheet.getAttribute("heading")).toBe("Rename Family");
});

test("Copy adds a copy after the list, keeps the active profile and says so", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	localStorage.setItem(
		profileKey("restaurants", family.id),
		JSON.stringify([{}, {}, {}]),
	);
	switchProfile(personal.id);
	const el = await mount();

	await click(el, rowAction("copy", family));

	const list = loadProfiles();
	expect(list.map((profile) => profile.name)).toEqual([
		"Personal",
		"Family",
		"Family - 1",
	]);
	const copy = list[2]!;
	expect(row(el, copy)?.querySelector("small")?.textContent?.trim()).toBe(
		"3 restaurants · 0 history entries",
	);
	expect(activeProfile().id).toBe(personal.id);
	expect(row(el, personal)?.getAttribute("aria-current")).toBe("true");
	expect(await toastText(el)).toBe("Copied Family to Family - 1");
});

test("Copy that cannot be saved shows the storage warning and adds nothing", async () => {
	const personal = loadProfiles()[0]!;
	localStorage.setItem(profileKey("restaurants", personal.id), "[{}]");
	const el = await mount();

	const setItem = localStorage.setItem;
	const define = (value: Storage["setItem"]): void => {
		Object.defineProperty(localStorage, "setItem", {
			value,
			configurable: true,
			writable: true,
		});
	};
	define((key: string, value: string) => {
		if (
			key.endsWith(":restaurants") &&
			key !== profileKey("restaurants", personal.id)
		)
			throw new Error("full");
		setItem.call(localStorage, key, value);
	});
	try {
		await click(el, rowAction("copy", personal));
	} finally {
		define(setItem);
	}

	expect(loadProfiles()).toHaveLength(1);
	expect($$(el, ".item[data-profile]")).toHaveLength(1);
	expect(await toastText(el)).toBe(
		"Your browser is not saving changes. They will be lost when you leave this page.",
	);
});

test("Delete swaps that row's icons for Delete and Cancel, with no prompt text", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	switchProfile(personal.id);
	const el = await mount();

	await click(el, rowAction("delete", family));

	const familyLine = row(el, family)!.closest(".profile")!;
	const confirm = familyLine.querySelector<HTMLButtonElement>(
		'.row-actions [data-action="delete-confirm"]',
	)!;
	const cancel = familyLine.querySelector<HTMLButtonElement>(
		'.row-actions [data-action="delete-cancel"]',
	)!;
	expect(confirm.textContent?.trim()).toBe("Delete");
	expect(confirm.getAttribute("aria-label")).toBe("Delete Family");
	expect(cancel.textContent?.trim()).toBe("Cancel");
	// The two buttons stand in for that row's icons only, and nothing else is shown.
	expect(familyLine.querySelector('[data-action="rename"]')).toBeNull();
	expect($(el, rowAction("delete", personal))).not.toBeNull();
	expect($(el, ".confirm")).toBeNull();
	expect($(el, "[role='alert']")).toBeNull();
	expect(el.shadowRoot!.activeElement).toBe(confirm);
	expect(loadProfiles()).toHaveLength(2);

	await click(el, '[data-action="delete-confirm"]');

	expect(loadProfiles()).toEqual([personal]);
	expect(activeProfile().id).toBe(personal.id);
	expect(await toastText(el)).toBe("Deleted Family.");
	expect($(el, '[data-action="delete-confirm"]')).toBeNull();
});

test("deleting the active profile switches to the first remaining one", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	const el = await mount();

	await click(el, rowAction("delete", family));
	await click(el, '[data-action="delete-confirm"]');

	expect(loadProfiles()).toEqual([personal]);
	expect(activeProfile().id).toBe(personal.id);
	expect(row(el, personal)?.getAttribute("aria-current")).toBe("true");
	expect(await toastText(el)).toBe("Deleted Family.");
});

test("Delete buttons are disabled with one profile", async () => {
	const personal = loadProfiles()[0]!;
	const el = await mount();
	expect(
		($(el, rowAction("delete", personal)) as HTMLButtonElement).disabled,
	).toBe(true);
	expect(
		($(el, rowAction("copy", personal)) as HTMLButtonElement).disabled,
	).toBe(false);
});

test("Cancel on the Delete confirm leaves the profile in place and refocuses its delete button", async () => {
	const family = createProfile("Family");
	const el = await mount();
	const before = loadProfiles().length;

	await click(el, rowAction("delete", family));
	await click(el, '[data-action="delete-cancel"]');
	await el.updateComplete;

	expect($(el, '[data-action="delete-confirm"]')).toBeNull();
	expect(loadProfiles().length).toBe(before);
	expect(el.shadowRoot!.activeElement).toBe($(el, rowAction("delete", family)));
});

test("after a delete, focus goes to the next row", async () => {
	const personal = loadProfiles()[0]!;
	const family = createProfile("Family");
	const couple = createProfile("Couple");
	switchProfile(personal.id);
	const el = await mount();

	await click(el, rowAction("delete", family));
	await click(el, '[data-action="delete-confirm"]');
	await el.updateComplete;

	expect(el.shadowRoot!.activeElement).toBe(row(el, couple));
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
