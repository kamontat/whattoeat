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
	"nav.history": "History",
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
	"picker.count.one": "1 restaurant",
	"picker.count.other": "{count} restaurants",
	"picker.countFiltered": "{count} of {total} restaurants match",
	"picker.visit": "Eat here",
	"picker.visited": "✓ Going here · {time}",
	"history.title": "History",
	"history.statsTitle": "Stats",
	"history.total.one": "1 visit in total",
	"history.total.other": "{count} visits in total",
	"history.colRestaurant": "Restaurant",
	"history.colTimes": "Times",
	"history.colLast": "Last time",
	"history.deleted": "(deleted)",
	"history.listTitle": "Visits",
	"history.delete": "Delete",
	"history.confirmDelete": "Delete this visit",
	"history.cancel": "Cancel",
	"history.empty": "No visits yet.",
	"history.emptyLink": "Pick a restaurant",
	"history.clearTitle": "Clear history",
	"history.clearOlder": "Older than {range}",
	"history.clearAll": "All",
	"history.range.week": "1 week",
	"history.range.month": "1 month",
	"history.range.year": "1 year",
	"history.clearPrompt.one":
		"Delete 1 visit older than {range}? This cannot be undone.",
	"history.clearPrompt.other":
		"Delete {count} visits older than {range}? This cannot be undone.",
	"history.clearAllPrompt.one": "Delete the only visit? This cannot be undone.",
	"history.clearAllPrompt.other":
		"Delete all {count} visits? This cannot be undone.",
	"history.clearConfirm": "Delete visits",
	"filter.title": "Filter",
	"filter.hint": "Tap once to include, twice to exclude, again to clear.",
	"filter.state.off": "not used",
	"filter.state.include": "included",
	"filter.state.exclude": "excluded",
	"filter.tagState": "{group}: {tag}, {state}",
	"filter.active": "Filter active: {tags}",
	"group.kind": "Type",
	"group.cuisine": "Cuisine",
	"group.area": "Area",
	"group.tags": "Tags",
	"kind.food": "Food",
	"kind.drinks": "Drinks",
	"kind.dessert": "Dessert",
	"filter.clear": "Clear",
	"filter.noMatch": "No restaurant matches this filter.",
	"field.name": "Name",
	"field.tags": "Tags",
	"field.tagsHint": "Press Enter or comma to add, e.g. thai, noodle",
	"tagInput.remove": "Remove {tag}",
	"field.location": "Location or map link",
	"field.cuisineHint": "Country or style, e.g. thai, japanese",
	"field.areaHint": "Short area name to filter by, e.g. siam",
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
	"settings.resetTitle": "Reset",
	"settings.reset": "Delete all data",
	"settings.resetPrompt":
		"Delete all {count} restaurants, your history and settings saved in this browser? This cannot be undone.",
	"settings.resetConfirm": "Delete everything",
	"settings.resetDone": "All saved data was deleted.",
	"import.error.json": "The data is not valid JSON.",
	"import.error.format": "The data is not a What to Eat export.",
	"import.error.version": "This export version is not supported.",
	"import.error.entries": "The data contains invalid restaurant data.",
	"import.error.read": "The file could not be read. Choose it again.",
	"storage.warning":
		"Your browser is not saving changes. They will be lost when you leave this page.",
	"storage.skipped.one":
		"1 saved restaurant could not be read and was skipped. It will be removed the next time the list changes.",
	"storage.skipped.other":
		"{count} saved restaurants could not be read and were skipped. They will be removed the next time the list changes.",
	"footer.source": "Source on GitHub",
	"footer.changelog": "Changelog",
	"footer.dev": "Development build",
	"footer.built": "Built",
} as const;

export type MessageKey = keyof typeof en;

export const th: Record<MessageKey, string> = {
	"app.title": "กินอะไรดี",
	"nav.label": "เมนูหลัก",
	"nav.home": "หน้าแรก",
	"nav.restaurants": "ร้านอาหาร",
	"nav.history": "ประวัติ",
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
	"picker.count.one": "1 ร้าน",
	"picker.count.other": "{count} ร้าน",
	"picker.countFiltered": "{count} จาก {total} ร้านที่ตรงกัน",
	"picker.visit": "กินร้านนี้",
	"picker.visited": "✓ เลือกแล้วเวลา {time}",
	"history.title": "ประวัติ",
	"history.statsTitle": "สถิติ",
	"history.total.one": "เลือกไปแล้ว 1 ครั้ง",
	"history.total.other": "เลือกไปแล้ว {count} ครั้ง",
	"history.colRestaurant": "ร้าน",
	"history.colTimes": "จำนวนครั้ง",
	"history.colLast": "ครั้งล่าสุด",
	"history.deleted": "(ลบแล้ว)",
	"history.listTitle": "รายการที่เลือก",
	"history.delete": "ลบ",
	"history.confirmDelete": "ลบรายการนี้",
	"history.cancel": "ยกเลิก",
	"history.empty": "ยังไม่มีประวัติ",
	"history.emptyLink": "สุ่มร้านอาหาร",
	"history.clearTitle": "ล้างประวัติ",
	"history.clearOlder": "เก่ากว่า {range}",
	"history.clearAll": "ทั้งหมด",
	"history.range.week": "1 สัปดาห์",
	"history.range.month": "1 เดือน",
	"history.range.year": "1 ปี",
	"history.clearPrompt.one":
		"ลบประวัติ 1 รายการที่เก่ากว่า {range}หรือไม่ การลบนี้ย้อนกลับไม่ได้",
	"history.clearPrompt.other":
		"ลบประวัติ {count} รายการที่เก่ากว่า {range}หรือไม่ การลบนี้ย้อนกลับไม่ได้",
	"history.clearAllPrompt.one": "ลบประวัติทั้งหมด 1 รายการหรือไม่ การลบนี้ย้อนกลับไม่ได้",
	"history.clearAllPrompt.other":
		"ลบประวัติทั้งหมด {count} รายการหรือไม่ การลบนี้ย้อนกลับไม่ได้",
	"history.clearConfirm": "ลบประวัติ",
	"filter.title": "ตัวกรอง",
	"filter.hint": "แตะหนึ่งครั้งเพื่อเลือก สองครั้งเพื่อไม่เอา อีกครั้งเพื่อยกเลิก",
	"filter.state.off": "ไม่ใช้",
	"filter.state.include": "เลือก",
	"filter.state.exclude": "ไม่เอา",
	"filter.tagState": "{group}: {tag}, {state}",
	"filter.active": "กำลังกรอง: {tags}",
	"group.kind": "ประเภท",
	"group.cuisine": "สัญชาติอาหาร",
	"group.area": "ย่าน",
	"group.tags": "แท็ก",
	"kind.food": "อาหาร",
	"kind.drinks": "เครื่องดื่ม",
	"kind.dessert": "ของหวาน",
	"filter.clear": "ล้าง",
	"filter.noMatch": "ไม่มีร้านที่ตรงกับตัวกรองนี้",
	"field.name": "ชื่อร้าน",
	"field.tags": "แท็ก",
	"field.tagsHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ก๋วยเตี๋ยว",
	"tagInput.remove": "ลบ {tag}",
	"field.location": "ที่ตั้งหรือลิงก์แผนที่",
	"field.cuisineHint": "ประเทศหรือสไตล์ เช่น ไทย, ญี่ปุ่น",
	"field.areaHint": "ชื่อย่านสั้น ๆ สำหรับกรอง เช่น สยาม",
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
	"settings.resetTitle": "รีเซ็ต",
	"settings.reset": "ลบข้อมูลทั้งหมด",
	"settings.resetPrompt":
		"ลบร้านอาหาร {count} ร้าน ประวัติ และการตั้งค่าทั้งหมดที่บันทึกไว้ในเบราว์เซอร์นี้หรือไม่ การลบนี้ย้อนกลับไม่ได้",
	"settings.resetConfirm": "ลบทั้งหมด",
	"settings.resetDone": "ลบข้อมูลที่บันทึกไว้ทั้งหมดแล้ว",
	"import.error.json": "ข้อมูลนี้ไม่ใช่ JSON ที่ถูกต้อง",
	"import.error.format": "ข้อมูลนี้ไม่ใช่ข้อมูลส่งออกของ กินอะไรดี",
	"import.error.version": "ไม่รองรับข้อมูลส่งออกเวอร์ชันนี้",
	"import.error.entries": "ข้อมูลมีร้านอาหารที่ไม่ถูกต้อง",
	"import.error.read": "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์อีกครั้ง",
	"storage.warning": "เบราว์เซอร์ไม่ได้บันทึกข้อมูล การเปลี่ยนแปลงจะหายไปเมื่อออกจากหน้านี้",
	"storage.skipped.one":
		"อ่านร้านอาหารที่บันทึกไว้ 1 ร้านไม่ได้จึงข้ามไป ร้านนี้จะถูกลบเมื่อรายการเปลี่ยนครั้งถัดไป",
	"storage.skipped.other":
		"อ่านร้านอาหารที่บันทึกไว้ {count} ร้านไม่ได้จึงข้ามไป ร้านเหล่านี้จะถูกลบเมื่อรายการเปลี่ยนครั้งถัดไป",
	"footer.source": "ซอร์สโค้ดบน GitHub",
	"footer.changelog": "บันทึกการเปลี่ยนแปลง",
	"footer.dev": "รุ่นพัฒนา",
	"footer.built": "สร้างเมื่อ",
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
