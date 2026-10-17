import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Lang = "en" | "th";
export const LANGS: readonly Lang[] = ["en", "th"];

export const LANG_KEY = "whattoeat:lang";
export const LANG_EVENT = "whattoeat:lang-changed";

export const en = {
	"app.title": "What to Eat",
	"nav.label": "Main",
	"nav.skip": "Skip to content",
	"nav.preview": "Preview",
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
	"picker.presetsLink": "Start with a neighbourhood",
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
	"group.kind": "Type",
	"group.cuisine": "Cuisine",
	"group.area": "Area",
	"group.tags": "Tags",
	"kind.food": "Food",
	"kind.drinks": "Drinks",
	"kind.dessert": "Dessert",
	"filter.clear": "Clear",
	"filter.done": "Done",
	"filter.noMatch": "No restaurant matches this filter.",
	"filter.clearAll": "Clear all",
	"filter.want": "Want",
	"filter.skip": "Skip",
	"filter.wantValue": "Want {tag}",
	"filter.skipValue": "Skip {tag}",
	"filter.selectedCount": "{count} selected",
	"filter.find": "Find in {group}",
	"filter.selected": "Selected",
	"filter.mostUsed": "Most used",
	"filter.allValues": "All, A–Z",
	"filter.showAll": "Show all {count}",
	"filter.matches.one": "1 match",
	"filter.matches.other": "{count} matches",
	"filter.noValue": "Nothing matches “{query}”.",
	"filter.show.one": "Show 1 restaurant",
	"filter.show.other": "Show {count} restaurants",
	"field.name": "Name",
	"field.tags": "Tags",
	"field.tagsHint": "Press Enter or comma to add, e.g. thai, noodle",
	"tagInput.remove": "Remove {tag}",
	"field.link": "Link: map, website or social page",
	"field.cuisineHint": "Press Enter or comma to add, e.g. thai, japanese",
	"field.areaHint": "Short area names to filter by, e.g. siam, ari",
	"field.groupHint": "Press Enter or comma to add",
	"field.notes": "Notes",
	"manager.title": "Restaurants",
	"manager.add": "Add",
	"manager.addLabel": "Add restaurant",
	"manager.save": "Save",
	"manager.cancel": "Cancel",
	"manager.delete": "Delete",
	"manager.confirmDelete": "Confirm delete",
	"manager.empty": "No restaurants yet. Add your first one.",
	"manager.nameRequired": "Name is required.",
	"manager.linkInvalid": "Enter a link that starts with https:// or http://.",
	"manager.openLink": "Open {name}'s link",
	"manager.addTitle": "New restaurant",
	"manager.editTitle": "Edit {name}",
	"manager.saved": "Saved {name}",
	"manager.deleted": "Deleted {name}",
	"manager.deletePrompt": "Delete {name}? This cannot be undone.",
	"search.open": "Search restaurants",
	"search.placeholder": "Search by name",
	"search.clear": "Clear search",
	"search.cancel": "Cancel",
	"search.count": "{shown} of {total} restaurants",
	"search.noMatch": 'No restaurants match "{query}".',
	"search.add": 'Add "{query}"',
	"tags.title": "Tags",
	"tags.pickerLabel": "Groups",
	"tags.count.one": "1 restaurant",
	"tags.count.other": "{count} restaurants",
	"tags.noValues": "No values yet.",
	"tags.save": "Save",
	"tags.cancel": "Cancel",
	"tags.delete": "Delete",
	"tags.deleteGroupPrompt.one":
		"Delete the group {group}? Its values on 1 restaurant become plain tags.",
	"tags.deleteGroupPrompt.other":
		"Delete the group {group}? Its values on {count} restaurants become plain tags.",
	"tags.confirmDelete": "Confirm delete",
	"tags.firstGroup": "Already the first group",
	"tags.lastGroup": "Already the last group",
	"tags.valueSub": "{group} · {count}",
	"tags.nameRequired": "Name is required.",
	"tags.nameTaken": "A group with this name already exists.",
	"tags.empty": "No restaurants yet.",
	"tags.emptyLink": "Add some restaurants",
	"tags.mergePrompt.one":
		"{to} already exists. Merge {from} into {to} on 1 restaurant?",
	"tags.mergePrompt.other":
		"{to} already exists. Merge {from} into {to} on {count} restaurants?",
	"tags.confirmMerge": "Merge",
	"tags.deleteValuePrompt.one": "Remove {value} from 1 restaurant?",
	"tags.deleteValuePrompt.other": "Remove {value} from {count} restaurants?",
	"tags.valueRequired": "Value is required.",
	"tags.valueComma": "A value cannot contain a comma.",
	"tags.name": "Name",
	"tags.group": "Group",
	"tags.newGroup": "New group",
	"tags.addGroup": "Add group",
	"tags.position": "Position",
	"tags.orderHint": "Order saves right away",
	"tags.deleteGroup": "Delete group",
	"tags.up": "Up",
	"tags.down": "Down",
	"tags.summary": "{values} · {count}",
	"tags.values.one": "1 value",
	"tags.values.other": "{count} values",
	"tags.summaryTags": "{values} · not used by the home filter",
	"tags.editGroup": "Edit {group}",
	"tags.groupSub": "Custom group · {values} · {count}",
	"tags.searchOpen": "Search tags",
	"tags.searchPlaceholder": "Search groups and values",
	"tags.searchCount": "{shown} of {total} tags",
	"tags.noMatch": 'No tags match "{query}".',
	"tags.added": "Added {group}",
	"tags.saved": "Saved {name}",
	"tags.removed": "Removed {value}",
	"presets.title": "Neighbourhoods",
	"presets.back": "Settings",
	"presets.loading": "Loading…",
	"presets.loadError":
		"The neighbourhood list could not be loaded. Check your connection and try again.",
	"presets.retry": "Try again",
	"presets.search": "Search area or mall",
	"presets.hidden": "{count} selected, not shown",
	"presets.clearSearch": "Clear",
	"presets.noMatch": "No neighbourhood matches “{query}”.",
	"presets.badge.added": "Added",
	"presets.badge.update": "Update",
	"presets.badge.inList": "In your list",
	"presets.rowSub": "{count} · {places}",
	"presets.morePlaces": "+{count}",
	"presets.mode.label": "When adding",
	"presets.mode.add": "Add to my list",
	"presets.mode.replace": "Replace my list",
	"presets.areas.one": "1 area",
	"presets.areas.other": "{n} areas",
	"presets.restaurants.one": "1 restaurant",
	"presets.restaurants.other": "{n} restaurants",
	"presets.add": "Add {areas} · {count}",
	"presets.replace": "Replace with {count}",
	"presets.goPicker": "Go to picker",
	"presets.replaceWarning": "Your {count} saved restaurants will be removed.",
	"presets.replacePrompt":
		"Replace your {saved} restaurants with {count} from {names}? Your history and groups stay.",
	"presets.replaceConfirm": "Replace",
	"presets.added": "Added {count} restaurants",
	"presets.replaced": "Replaced with {count} restaurants",
	"presets.nothingNew":
		"Nothing new to add. These restaurants are already in your list.",
	"presets.undo": "Undo",
	"presets.undone": "Undone.",
	"presets.sessionOnly": "Added for this session only",
	"presets.replacedSessionOnly": "Replaced for this session only",
	"presets.filesError":
		"The selected neighbourhoods could not be loaded. Nothing was changed. Try again.",
	"settings.title": "Settings",
	"settings.appearance": "Appearance",
	"settings.about": "About",
	"settings.organiseTitle": "Organise",
	"settings.tagsSub": "Groups and their values",
	"settings.count": "Restaurants saved: {count}",
	"settings.exportTitle": "Export",
	"settings.export": "Download JSON",
	"settings.copy": "Copy JSON",
	"settings.copied": "Copied {count} restaurants to the clipboard.",
	"settings.copyFailed": "Could not copy. Select the text below and copy it.",
	"settings.importTitle": "Import",
	"settings.importFile": "Choose a JSON file",
	"settings.pasteLabel": "Paste JSON",
	"settings.pasteFailed": "Could not read the clipboard. Paste the JSON below.",
	"settings.pasteCheck": "Check",
	"settings.importFound": "{count} restaurants found.",
	"settings.replace": "Replace all",
	"settings.merge": "Merge",
	"settings.cancel": "Cancel",
	"settings.imported": "Import complete. {count} restaurants saved.",
	"settings.presets": "Neighbourhood presets",
	"settings.presetsAdded": "{added} of {total} added",
	"settings.resetTitle": "Reset",
	"settings.clearHistory": "Clear history",
	"settings.clearOlder": "Older than {range}",
	"settings.clearAll": "All visits",
	"settings.visitCount.one": "1 visit",
	"settings.visitCount.other": "{count} visits",
	"settings.cleared.one": "Deleted 1 visit.",
	"settings.cleared.other": "Deleted {count} visits.",
	"settings.clearRestaurants": "Delete restaurants",
	"settings.clearRestaurantsPrompt":
		"Delete all {count} restaurants? Your history, groups and settings are kept. This cannot be undone.",
	"settings.clearRestaurantsConfirm": "Delete restaurants",
	"settings.clearedRestaurants.one": "Deleted 1 restaurant.",
	"settings.clearedRestaurants.other": "Deleted {count} restaurants.",
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
	"footer.env": "Environment",
} as const;

export type MessageKey = keyof typeof en;

export const th: Record<MessageKey, string> = {
	"app.title": "กินอะไรดี",
	"nav.label": "เมนูหลัก",
	"nav.skip": "ข้ามไปยังเนื้อหา",
	"nav.preview": "พรีวิว",
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
	"picker.presetsLink": "เริ่มจากย่านร้านอาหาร",
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
	"group.kind": "ประเภท",
	"group.cuisine": "สัญชาติอาหาร",
	"group.area": "ย่าน",
	"group.tags": "แท็ก",
	"kind.food": "อาหาร",
	"kind.drinks": "เครื่องดื่ม",
	"kind.dessert": "ของหวาน",
	"filter.clear": "ล้าง",
	"filter.done": "เสร็จ",
	"filter.noMatch": "ไม่มีร้านที่ตรงกับตัวกรองนี้",
	"filter.clearAll": "ล้างทั้งหมด",
	"filter.want": "เอา",
	"filter.skip": "ไม่เอา",
	"filter.wantValue": "เอา {tag}",
	"filter.skipValue": "ไม่เอา {tag}",
	"filter.selectedCount": "เลือก {count} รายการ",
	"filter.find": "ค้นหาใน{group}",
	"filter.selected": "ที่เลือกไว้",
	"filter.mostUsed": "ใช้บ่อย",
	"filter.allValues": "ทั้งหมด เรียงตามชื่อ",
	"filter.showAll": "ดูทั้งหมด {count} รายการ",
	"filter.matches.one": "พบ 1 รายการ",
	"filter.matches.other": "พบ {count} รายการ",
	"filter.noValue": "ไม่พบ “{query}”",
	"filter.show.one": "ดู 1 ร้าน",
	"filter.show.other": "ดู {count} ร้าน",
	"field.name": "ชื่อร้าน",
	"field.tags": "แท็ก",
	"field.tagsHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ก๋วยเตี๋ยว",
	"tagInput.remove": "ลบ {tag}",
	"field.link": "ลิงก์: แผนที่ เว็บไซต์ หรือโซเชียล",
	"field.cuisineHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม เช่น ไทย, ญี่ปุ่น",
	"field.areaHint": "ชื่อย่านสั้น ๆ สำหรับกรอง เช่น สยาม, อารีย์",
	"field.groupHint": "กด Enter หรือจุลภาคเพื่อเพิ่ม",
	"field.notes": "บันทึก",
	"manager.title": "ร้านอาหาร",
	"manager.add": "เพิ่ม",
	"manager.addLabel": "เพิ่มร้าน",
	"manager.save": "บันทึก",
	"manager.cancel": "ยกเลิก",
	"manager.delete": "ลบ",
	"manager.confirmDelete": "ยืนยันการลบ",
	"manager.empty": "ยังไม่มีร้านอาหาร เพิ่มร้านแรกได้เลย",
	"manager.nameRequired": "กรุณาใส่ชื่อร้าน",
	"manager.linkInvalid": "กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://",
	"manager.openLink": "เปิดลิงก์ของ {name}",
	"manager.addTitle": "ร้านใหม่",
	"manager.editTitle": "แก้ไข {name}",
	"manager.saved": "บันทึก {name} แล้ว",
	"manager.deleted": "ลบ {name} แล้ว",
	"manager.deletePrompt": "ลบ {name} ใช่ไหม? ย้อนกลับไม่ได้",
	"search.open": "ค้นหาร้านอาหาร",
	"search.placeholder": "ค้นหาด้วยชื่อ",
	"search.clear": "ล้างการค้นหา",
	"search.cancel": "ยกเลิก",
	"search.count": "{shown} จาก {total} ร้าน",
	"search.noMatch": "ไม่มีร้านที่ตรงกับ “{query}”",
	"search.add": "เพิ่ม “{query}”",
	"tags.title": "แท็ก",
	"tags.pickerLabel": "กลุ่ม",
	"tags.count.one": "1 ร้าน",
	"tags.count.other": "{count} ร้าน",
	"tags.noValues": "ยังไม่มีค่า",
	"tags.save": "บันทึก",
	"tags.cancel": "ยกเลิก",
	"tags.delete": "ลบ",
	"tags.deleteGroupPrompt.one":
		"ลบกลุ่ม {group} หรือไม่ ค่าในร้าน 1 ร้านจะกลายเป็นแท็กทั่วไป",
	"tags.deleteGroupPrompt.other":
		"ลบกลุ่ม {group} หรือไม่ ค่าในร้าน {count} ร้านจะกลายเป็นแท็กทั่วไป",
	"tags.confirmDelete": "ยืนยันการลบ",
	"tags.firstGroup": "อยู่บนสุดแล้ว",
	"tags.lastGroup": "อยู่ล่างสุดแล้ว",
	"tags.valueSub": "{group} · {count}",
	"tags.nameRequired": "กรุณาใส่ชื่อ",
	"tags.nameTaken": "มีกลุ่มชื่อนี้อยู่แล้ว",
	"tags.empty": "ยังไม่มีร้านอาหาร",
	"tags.emptyLink": "เพิ่มร้านอาหาร",
	"tags.mergePrompt.one": "มี {to} อยู่แล้ว รวม {from} เข้ากับ {to} ใน 1 ร้านหรือไม่",
	"tags.mergePrompt.other":
		"มี {to} อยู่แล้ว รวม {from} เข้ากับ {to} ใน {count} ร้านหรือไม่",
	"tags.confirmMerge": "รวม",
	"tags.deleteValuePrompt.one": "ลบ {value} ออกจาก 1 ร้านหรือไม่",
	"tags.deleteValuePrompt.other": "ลบ {value} ออกจาก {count} ร้านหรือไม่",
	"tags.valueRequired": "กรุณาใส่ค่า",
	"tags.valueComma": "ค่าต้องไม่มีจุลภาค",
	"tags.name": "ชื่อ",
	"tags.group": "กลุ่ม",
	"tags.newGroup": "กลุ่มใหม่",
	"tags.addGroup": "เพิ่มกลุ่ม",
	"tags.position": "ลำดับ",
	"tags.orderHint": "ลำดับบันทึกทันที",
	"tags.deleteGroup": "ลบกลุ่ม",
	"tags.up": "ขึ้น",
	"tags.down": "ลง",
	"tags.summary": "{values} · {count}",
	"tags.values.one": "1 ค่า",
	"tags.values.other": "{count} ค่า",
	"tags.summaryTags": "{values} · ไม่ใช้กรองหน้าแรก",
	"tags.editGroup": "แก้ไข {group}",
	"tags.groupSub": "กลุ่มที่สร้างเอง · {values} · {count}",
	"tags.searchOpen": "ค้นหาแท็ก",
	"tags.searchPlaceholder": "ค้นหากลุ่มและค่า",
	"tags.searchCount": "{shown} จาก {total} แท็ก",
	"tags.noMatch": "ไม่มีแท็กที่ตรงกับ “{query}”",
	"tags.added": "เพิ่ม {group} แล้ว",
	"tags.saved": "บันทึก {name} แล้ว",
	"tags.removed": "ลบ {value} แล้ว",
	"presets.title": "ย่านร้านอาหาร",
	"presets.back": "ตั้งค่า",
	"presets.loading": "กำลังโหลด…",
	"presets.loadError": "ไม่สามารถโหลดรายการย่านได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
	"presets.retry": "ลองใหม่",
	"presets.search": "ค้นหาย่านหรือห้าง",
	"presets.hidden": "เลือกไว้ {count} รายการ ไม่แสดงอยู่",
	"presets.clearSearch": "ล้าง",
	"presets.noMatch": "ไม่พบย่านที่ตรงกับ “{query}”",
	"presets.badge.added": "เพิ่มแล้ว",
	"presets.badge.update": "มีอัปเดต",
	"presets.badge.inList": "อยู่ในรายการของคุณ",
	"presets.rowSub": "{count} ร้าน · {places}",
	"presets.morePlaces": "+{count}",
	"presets.mode.label": "เมื่อเพิ่ม",
	"presets.mode.add": "เพิ่มในรายการ",
	"presets.mode.replace": "แทนที่รายการ",
	"presets.areas.one": "1 ย่าน",
	"presets.areas.other": "{n} ย่าน",
	"presets.restaurants.one": "1 ร้าน",
	"presets.restaurants.other": "{n} ร้าน",
	"presets.add": "เพิ่ม {areas} · {count}",
	"presets.replace": "แทนที่ด้วย {count}",
	"presets.goPicker": "ไปสุ่มร้าน",
	"presets.replaceWarning": "ร้านที่บันทึกไว้ {count} ร้านจะถูกลบ",
	"presets.replacePrompt":
		"แทนที่ร้านของคุณ {saved} ร้านด้วย {count} ร้านจาก {names} ใช่ไหม ประวัติและกลุ่มจะยังอยู่",
	"presets.replaceConfirm": "แทนที่",
	"presets.added": "เพิ่มแล้ว {count} ร้าน",
	"presets.replaced": "แทนที่ด้วย {count} ร้านแล้ว",
	"presets.nothingNew": "ไม่มีร้านใหม่ให้เพิ่ม ร้านเหล่านี้อยู่ในรายการของคุณแล้ว",
	"presets.undo": "เลิกทำ",
	"presets.undone": "เลิกทำแล้ว",
	"presets.sessionOnly": "เพิ่มไว้เฉพาะครั้งนี้เท่านั้น",
	"presets.replacedSessionOnly": "แทนที่ไว้เฉพาะครั้งนี้เท่านั้น",
	"presets.filesError": "ไม่สามารถโหลดย่านที่เลือกได้ ไม่มีการเปลี่ยนแปลงใด ๆ กรุณาลองใหม่",
	"settings.title": "ตั้งค่า",
	"settings.appearance": "การแสดงผล",
	"settings.about": "เกี่ยวกับ",
	"settings.organiseTitle": "จัดระเบียบ",
	"settings.tagsSub": "กลุ่มและค่าในแต่ละกลุ่ม",
	"settings.count": "ร้านอาหารที่บันทึกไว้: {count}",
	"settings.exportTitle": "ส่งออก",
	"settings.export": "ดาวน์โหลด JSON",
	"settings.copy": "คัดลอก JSON",
	"settings.copied": "คัดลอกร้านอาหาร {count} ร้านแล้ว",
	"settings.copyFailed": "คัดลอกไม่ได้ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกเอง",
	"settings.importTitle": "นำเข้า",
	"settings.importFile": "เลือกไฟล์ JSON",
	"settings.pasteLabel": "วาง JSON",
	"settings.pasteFailed": "อ่านคลิปบอร์ดไม่ได้ กรุณาวาง JSON ด้านล่าง",
	"settings.pasteCheck": "ตรวจสอบ",
	"settings.importFound": "พบร้านอาหาร {count} ร้าน",
	"settings.replace": "แทนที่ทั้งหมด",
	"settings.merge": "รวมรายการ",
	"settings.cancel": "ยกเลิก",
	"settings.imported": "นำเข้าสำเร็จ มีร้านอาหาร {count} ร้าน",
	"settings.presets": "ชุดร้านตามย่าน",
	"settings.presetsAdded": "เพิ่มแล้ว {added} จาก {total}",
	"settings.resetTitle": "รีเซ็ต",
	"settings.clearHistory": "ล้างประวัติ",
	"settings.clearOlder": "เก่ากว่า {range}",
	"settings.clearAll": "ประวัติทั้งหมด",
	"settings.visitCount.one": "1 รายการ",
	"settings.visitCount.other": "{count} รายการ",
	"settings.cleared.one": "ลบประวัติ 1 รายการแล้ว",
	"settings.cleared.other": "ลบประวัติ {count} รายการแล้ว",
	"settings.clearRestaurants": "ลบร้านอาหาร",
	"settings.clearRestaurantsPrompt":
		"ลบร้านอาหารทั้งหมด {count} ร้านหรือไม่ ประวัติ กลุ่ม และการตั้งค่าจะยังอยู่ การลบนี้ย้อนกลับไม่ได้",
	"settings.clearRestaurantsConfirm": "ลบร้านอาหาร",
	"settings.clearedRestaurants.one": "ลบร้านอาหาร 1 ร้านแล้ว",
	"settings.clearedRestaurants.other": "ลบร้านอาหาร {count} ร้านแล้ว",
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
	"footer.env": "สภาพแวดล้อม",
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
