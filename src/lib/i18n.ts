import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Lang = "en" | "th";
export const LANGS: readonly Lang[] = ["en", "th"];

export const LANG_KEY = "whattoeat:lang";
export const LANG_EVENT = "whattoeat:lang-changed";

export const en = {
	"app.title": "What to Eat",
	"nav.label": "Main",
	"nav.home": "Home",
	"nav.restaurants": "Restaurants",
	"nav.settings": "Settings",
	"lang.label": "Language",
	"theme.label": "Theme",
	"theme.auto": "Auto",
	"theme.light": "Light",
	"theme.dark": "Dark",
	"picker.button": "What should I eat?",
	"picker.again": "Pick again",
	"picker.empty": "No restaurants yet.",
	"picker.addLink": "Add some restaurants",
	"field.name": "Name",
	"field.tags": "Tags",
	"field.tagsHint": "Comma-separated, e.g. thai, noodle",
	"field.location": "Location or map link",
	"field.notes": "Notes",
	"manager.title": "Restaurants",
	"manager.add": "Add",
	"manager.save": "Save",
	"manager.cancel": "Cancel",
	"manager.edit": "Edit",
	"manager.delete": "Delete",
	"manager.confirmDelete": "Confirm delete",
	"manager.empty": "No restaurants yet. Add your first one above.",
	"manager.nameRequired": "Name is required.",
	"manager.nameTaken": "A restaurant with this name already exists.",
	"settings.title": "Settings",
	"settings.count": "Restaurants saved: {count}",
	"settings.exportTitle": "Export",
	"settings.export": "Download JSON",
	"settings.copy": "Copy JSON",
	"settings.copied": "Copied {count} restaurants to the clipboard.",
	"settings.copyFailed": "Could not copy. Select the text below and copy it.",
	"settings.importTitle": "Import",
	"settings.importFile": "Choose a JSON file",
	"settings.pasteLabel": "Or paste JSON",
	"settings.pasteCheck": "Check",
	"settings.importFound": "{count} restaurants found.",
	"settings.replace": "Replace all",
	"settings.merge": "Merge",
	"settings.cancel": "Cancel",
	"settings.imported": "Import complete. {count} restaurants saved.",
	"import.error.json": "The data is not valid JSON.",
	"import.error.format": "The data is not a What to Eat export.",
	"import.error.version": "This export version is not supported.",
	"import.error.entries": "The data contains invalid restaurant data.",
	"import.error.read": "The file could not be read. Choose it again.",
	"storage.warning":
		"Your browser is not saving changes. They will be lost when you leave this page.",
} as const;

export type MessageKey = keyof typeof en;

export const th: Record<MessageKey, string> = {
	"app.title": "กินอะไรดี",
	"nav.label": "เมนูหลัก",
	"nav.home": "หน้าแรก",
	"nav.restaurants": "ร้านอาหาร",
	"nav.settings": "ตั้งค่า",
	"lang.label": "ภาษา",
	"theme.label": "ธีม",
	"theme.auto": "อัตโนมัติ",
	"theme.light": "สว่าง",
	"theme.dark": "มืด",
	"picker.button": "กินอะไรดี?",
	"picker.again": "สุ่มใหม่",
	"picker.empty": "ยังไม่มีร้านอาหาร",
	"picker.addLink": "เพิ่มร้านอาหาร",
	"field.name": "ชื่อร้าน",
	"field.tags": "แท็ก",
	"field.tagsHint": "คั่นด้วยจุลภาค เช่น ไทย, ก๋วยเตี๋ยว",
	"field.location": "ที่ตั้งหรือลิงก์แผนที่",
	"field.notes": "บันทึก",
	"manager.title": "ร้านอาหาร",
	"manager.add": "เพิ่ม",
	"manager.save": "บันทึก",
	"manager.cancel": "ยกเลิก",
	"manager.edit": "แก้ไข",
	"manager.delete": "ลบ",
	"manager.confirmDelete": "ยืนยันการลบ",
	"manager.empty": "ยังไม่มีร้านอาหาร เพิ่มร้านแรกด้านบนได้เลย",
	"manager.nameRequired": "กรุณาใส่ชื่อร้าน",
	"manager.nameTaken": "มีร้านชื่อนี้อยู่แล้ว",
	"settings.title": "ตั้งค่า",
	"settings.count": "ร้านอาหารที่บันทึกไว้: {count}",
	"settings.exportTitle": "ส่งออก",
	"settings.export": "ดาวน์โหลด JSON",
	"settings.copy": "คัดลอก JSON",
	"settings.copied": "คัดลอกร้านอาหาร {count} ร้านแล้ว",
	"settings.copyFailed": "คัดลอกไม่ได้ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกเอง",
	"settings.importTitle": "นำเข้า",
	"settings.importFile": "เลือกไฟล์ JSON",
	"settings.pasteLabel": "หรือวาง JSON",
	"settings.pasteCheck": "ตรวจสอบ",
	"settings.importFound": "พบร้านอาหาร {count} ร้าน",
	"settings.replace": "แทนที่ทั้งหมด",
	"settings.merge": "รวมรายการ",
	"settings.cancel": "ยกเลิก",
	"settings.imported": "นำเข้าสำเร็จ มีร้านอาหาร {count} ร้าน",
	"import.error.json": "ข้อมูลนี้ไม่ใช่ JSON ที่ถูกต้อง",
	"import.error.format": "ข้อมูลนี้ไม่ใช่ข้อมูลส่งออกของ กินอะไรดี",
	"import.error.version": "ไม่รองรับข้อมูลส่งออกเวอร์ชันนี้",
	"import.error.entries": "ข้อมูลมีร้านอาหารที่ไม่ถูกต้อง",
	"import.error.read": "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์อีกครั้ง",
	"storage.warning": "เบราว์เซอร์ไม่ได้บันทึกข้อมูล การเปลี่ยนแปลงจะหายไปเมื่อออกจากหน้านี้",
};

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, th };

const isLang = (value: unknown): value is Lang =>
	value === "en" || value === "th";

/** Stored choice first, then Thai for a Thai browser, else English. */
export const detectLang = (): Lang => {
	try {
		const stored = localStorage.getItem(LANG_KEY);
		if (isLang(stored)) return stored;
	} catch {
		// Storage blocked: fall through to browser detection.
	}
	return navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
};

let current: Lang | undefined;

export const getLang = (): Lang => {
	if (current === undefined) {
		current = detectLang();
		document.documentElement.lang = current;
	}
	return current;
};

const apply = (lang: Lang): void => {
	current = lang;
	document.documentElement.lang = lang;
	window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
};

export const setLang = (lang: Lang): void => {
	try {
		localStorage.setItem(LANG_KEY, lang);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
	apply(lang);
};

/** Put the detected language on `<html lang>` as soon as this module loads, before any component renders. */
export const initLang = (): void => {
	document.documentElement.lang = getLang();
};

initLang();

// Follow a language change made in another tab (`null` key is `localStorage.clear()`).
window.addEventListener("storage", (event: StorageEvent) => {
	if (event.key !== LANG_KEY && event.key !== null) return;
	const next = detectLang();
	if (next !== current) apply(next);
});

export const t = (
	key: MessageKey,
	params: Record<string, string | number> = {},
): string =>
	dictionaries[getLang()][key].replace(/\{(\w+)\}/g, (match, name: string) =>
		String(params[name] ?? match),
	);

/** Re-render the host component whenever the language changes. */
export class LangController implements ReactiveController {
	private readonly host: ReactiveControllerHost;

	private readonly onChange = (): void => {
		this.host.requestUpdate();
	};

	constructor(host: ReactiveControllerHost) {
		this.host = host;
		host.addController(this);
	}

	hostConnected(): void {
		window.addEventListener(LANG_EVENT, this.onChange);
	}

	hostDisconnected(): void {
		window.removeEventListener(LANG_EVENT, this.onChange);
	}
}
