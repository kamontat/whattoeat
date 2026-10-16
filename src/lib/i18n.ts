import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Lang = "en" | "th";
export const LANGS: readonly Lang[] = ["en", "th"];

export const LANG_KEY = "whattoeat:lang";
export const LANG_EVENT = "whattoeat:lang-changed";

export const en = {
	"app.title": "What to Eat",
	"nav.label": "Main",
	"nav.skip": "Skip to content",
	"nav.home": "Home",
	"nav.restaurants": "Restaurants",
	"nav.tags": "Tags",
	"nav.history": "History",
	"nav.settings": "Settings",
	"sheet.close": "Close",
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
	"picker.announce.one": "Picked {a}",
	"picker.announce.two": "Picked {a} and {b}",
	"history.title": "History",
	"history.statsTitle": "Stats",
	"history.total.one": "1 visit in total",
	"history.total.other": "{count} visits in total",
	"history.colRestaurant": "Restaurant",
	"history.colTimes": "Times",
	"history.colLast": "Last time",
	"history.deleted": "(deleted)",
	"history.listTitle": "Visits",
	"history.today": "Today",
	"history.yesterday": "Yesterday",
	"history.delete": "Delete",
	"history.deleteVisit": "Delete visit to {name} at {time}",
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
	"filter.openCount": "Filter · {count} on",
	"filter.done": "Done",
	"filter.hide": "Hide",
	"filter.hideLabel": "Hide filter",
	"filter.noMatch": "No restaurant matches this filter.",
	"field.name": "Name",
	"field.tags": "Tags",
	"field.tagsHint": "Press Enter or comma to add, e.g. thai, noodle",
	"tagInput.remove": "Remove {tag}",
	"field.location": "Location or map link",
	"field.cuisineHint": "Press Enter or comma to add, e.g. thai, japanese",
	"field.areaHint": "Short area names to filter by, e.g. siam, ari",
	"field.groupHint": "Press Enter or comma to add",
	"field.notes": "Notes",
	"manager.title": "Restaurants",
	"manager.add": "Add",
	"manager.save": "Save",
	"manager.cancel": "Cancel",
	"manager.delete": "Delete",
	"manager.confirmDelete": "Confirm delete",
	"manager.empty": "No restaurants yet. Add your first one.",
	"manager.nameRequired": "Name is required.",
	"manager.nameTaken": "A restaurant with this name already exists.",
	"manager.addTitle": "New restaurant",
	"manager.editTitle": "Edit {name}",
	"manager.saved": "Saved {name}",
	"manager.deleted": "Deleted {name}",
	"manager.deletePrompt": "Delete {name}? This cannot be undone.",
	"tags.title": "Tags",
	"tags.intro":
		"Groups sort your restaurants for the home filter. Plain tags are shown but not filtered.",
	"tags.count.one": "1 restaurant",
	"tags.count.other": "{count} restaurants",
	"tags.noValues": "No values yet.",
	"tags.rename": "Rename",
	"tags.save": "Save",
	"tags.cancel": "Cancel",
	"tags.moveUp": "Move {group} up",
	"tags.moveDown": "Move {group} down",
	"tags.delete": "Delete",
	"tags.deleteGroupPrompt.one":
		"Delete the group {group}? Its values on 1 restaurant become plain tags.",
	"tags.deleteGroupPrompt.other":
		"Delete the group {group}? Its values on {count} restaurants become plain tags.",
	"tags.confirmDelete": "Confirm delete",
	"tags.renameGroupLabel": "Rename {group}",
	"tags.deleteGroupLabel": "Delete {group}",
	"tags.groupOptions": "{group} options",
	"tags.firstGroup": "Already the first group",
	"tags.lastGroup": "Already the last group",
	"tags.anotherGroup": "Another group",
	"tags.valueSub": "{group} · {count}",
	"tags.pickHint": "Choose a value to rename, move or delete it.",
	"tags.addTitle": "Add a group",
	"tags.addLabel": "Group name",
	"tags.add": "Add",
	"tags.nameRequired": "Name is required.",
	"tags.nameTaken": "A group with this name already exists.",
	"tags.empty": "No restaurants yet.",
	"tags.emptyLink": "Add some restaurants",
	"tags.move": "Move to…",
	"tags.moveLabel": "Move {value} to",
	"tags.renameLabel": "New name for {value}",
	"tags.mergePrompt.one":
		"{to} already exists. Merge {from} into {to} on 1 restaurant?",
	"tags.mergePrompt.other":
		"{to} already exists. Merge {from} into {to} on {count} restaurants?",
	"tags.confirmMerge": "Merge",
	"tags.confirmMove": "Move",
	"tags.deleteValuePrompt.one": "Remove {value} from 1 restaurant?",
	"tags.deleteValuePrompt.other": "Remove {value} from {count} restaurants?",
	"tags.valueRequired": "Value is required.",
	"tags.valueComma": "A value cannot contain a comma.",
	"tags.renameValueLabel": "Rename {value}",
	"tags.moveValueLabel": "Move to… another group: {value}",
	"tags.deleteValueLabel": "Delete {value}",
	"settings.title": "Settings",
	"settings.appearance": "Appearance",
	"settings.about": "About",
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
	"nav.skip": "ข้ามไปยังเนื้อหา",
	"nav.home": "หน้าแรก",
	"nav.restaurants": "ร้านอาหาร",
	"nav.tags": "แท็ก",
	"nav.history": "ประวัติ",
	"nav.settings": "ตั้งค่า",
	"sheet.close": "ปิด",
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
	"picker.announce.one": "สุ่มได้ {a}",
	"picker.announce.two": "สุ่มได้ {a} และ {b}",
	"history.title": "ประวัติ",
	"history.statsTitle": "สถิติ",
	"history.total.one": "เลือกไปแล้ว 1 ครั้ง",
	"history.total.other": "เลือกไปแล้ว {count} ครั้ง",
	"history.colRestaurant": "ร้าน",
	"history.colTimes": "จำนวนครั้ง",
	"history.colLast": "ครั้งล่าสุด",
	"history.deleted": "(ลบแล้ว)",
	"history.listTitle": "รายการที่เลือก",
	"history.today": "วันนี้",
	"history.yesterday": "เมื่อวาน",
	"history.delete": "ลบ",
	"history.deleteVisit": "ลบการไป {name} เวลา {time}",
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
	"filter.openCount": "ตัวกรอง · {count} รายการ",
	"filter.done": "เสร็จ",
	"filter.hide": "ซ่อน",
	"filter.hideLabel": "ซ่อนตัวกรอง",
	"filter.noMatch": "ไม่มีร้านที่ตรงกับตัวกรองนี้",
	"field.name": "ชื่อร้าน",
	"field.tags": "แท็ก",
	"field.tagsHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ก๋วยเตี๋ยว",
	"tagInput.remove": "ลบ {tag}",
	"field.location": "ที่ตั้งหรือลิงก์แผนที่",
	"field.cuisineHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ญี่ปุ่น",
	"field.areaHint": "ชื่อย่านสั้น ๆ สำหรับกรอง เช่น สยาม, อารีย์",
	"field.groupHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม",
	"field.notes": "บันทึก",
	"manager.title": "ร้านอาหาร",
	"manager.add": "เพิ่ม",
	"manager.save": "บันทึก",
	"manager.cancel": "ยกเลิก",
	"manager.delete": "ลบ",
	"manager.confirmDelete": "ยืนยันการลบ",
	"manager.empty": "ยังไม่มีร้านอาหาร เพิ่มร้านแรกได้เลย",
	"manager.nameRequired": "กรุณาใส่ชื่อร้าน",
	"manager.nameTaken": "มีร้านชื่อนี้อยู่แล้ว",
	"manager.addTitle": "ร้านใหม่",
	"manager.editTitle": "แก้ไข {name}",
	"manager.saved": "บันทึก {name} แล้ว",
	"manager.deleted": "ลบ {name} แล้ว",
	"manager.deletePrompt": "ลบ {name} ใช่ไหม? ย้อนกลับไม่ได้",
	"tags.title": "แท็ก",
	"tags.intro": "กลุ่มช่วยจัดร้านสำหรับตัวกรองหน้าแรก แท็กทั่วไปจะแสดงแต่ไม่ใช้กรอง",
	"tags.count.one": "1 ร้าน",
	"tags.count.other": "{count} ร้าน",
	"tags.noValues": "ยังไม่มีค่า",
	"tags.rename": "เปลี่ยนชื่อ",
	"tags.save": "บันทึก",
	"tags.cancel": "ยกเลิก",
	"tags.moveUp": "เลื่อน {group} ขึ้น",
	"tags.moveDown": "เลื่อน {group} ลง",
	"tags.delete": "ลบ",
	"tags.deleteGroupPrompt.one":
		"ลบกลุ่ม {group} หรือไม่ ค่าในร้าน 1 ร้านจะกลายเป็นแท็กทั่วไป",
	"tags.deleteGroupPrompt.other":
		"ลบกลุ่ม {group} หรือไม่ ค่าในร้าน {count} ร้านจะกลายเป็นแท็กทั่วไป",
	"tags.confirmDelete": "ยืนยันการลบ",
	"tags.renameGroupLabel": "เปลี่ยนชื่อ {group}",
	"tags.deleteGroupLabel": "ลบ {group}",
	"tags.groupOptions": "ตัวเลือกของ {group}",
	"tags.firstGroup": "อยู่บนสุดแล้ว",
	"tags.lastGroup": "อยู่ล่างสุดแล้ว",
	"tags.anotherGroup": "ไปกลุ่มอื่น",
	"tags.valueSub": "{group} · {count}",
	"tags.pickHint": "เลือกค่าเพื่อเปลี่ยนชื่อ ย้าย หรือลบ",
	"tags.addTitle": "เพิ่มกลุ่ม",
	"tags.addLabel": "ชื่อกลุ่ม",
	"tags.add": "เพิ่ม",
	"tags.nameRequired": "กรุณาใส่ชื่อ",
	"tags.nameTaken": "มีกลุ่มชื่อนี้อยู่แล้ว",
	"tags.empty": "ยังไม่มีร้านอาหาร",
	"tags.emptyLink": "เพิ่มร้านอาหาร",
	"tags.move": "ย้ายไป…",
	"tags.moveLabel": "ย้าย {value} ไปที่",
	"tags.renameLabel": "ชื่อใหม่ของ {value}",
	"tags.mergePrompt.one": "มี {to} อยู่แล้ว รวม {from} เข้ากับ {to} ใน 1 ร้านหรือไม่",
	"tags.mergePrompt.other":
		"มี {to} อยู่แล้ว รวม {from} เข้ากับ {to} ใน {count} ร้านหรือไม่",
	"tags.confirmMerge": "รวม",
	"tags.confirmMove": "ย้าย",
	"tags.deleteValuePrompt.one": "ลบ {value} ออกจาก 1 ร้านหรือไม่",
	"tags.deleteValuePrompt.other": "ลบ {value} ออกจาก {count} ร้านหรือไม่",
	"tags.valueRequired": "กรุณาใส่ค่า",
	"tags.valueComma": "ค่าต้องไม่มีจุลภาค",
	"tags.renameValueLabel": "เปลี่ยนชื่อ {value}",
	"tags.moveValueLabel": "ย้ายไป… กลุ่มอื่น: {value}",
	"tags.deleteValueLabel": "ลบ {value}",
	"settings.title": "ตั้งค่า",
	"settings.appearance": "การแสดงผล",
	"settings.about": "เกี่ยวกับ",
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
