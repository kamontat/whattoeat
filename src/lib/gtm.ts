type GtmWindow = Window & { dataLayer?: unknown[] };

const GTM_ID = /^GTM-[A-Z0-9]+$/;
const GTM_ORIGIN = "https://www.googletagmanager.com";

/**
 * Load the Google Tag Manager container `id` into `doc`, the script half of Google's
 * install snippet. Returns `false`, touching nothing, for a missing or malformed id and
 * when the container script is already on the page.
 */
export const loadGtm = (id: string | undefined, doc: Document): boolean => {
	if (id === undefined || !GTM_ID.test(id)) return false;
	if (doc.querySelector(`script[src^="${GTM_ORIGIN}/gtm.js"]`)) return false;

	const win = doc.defaultView as GtmWindow | null;
	if (win) {
		win.dataLayer = win.dataLayer ?? [];
		win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
	}

	const script = doc.createElement("script");
	script.async = true;
	script.src = `${GTM_ORIGIN}/gtm.js?id=${id}`;
	doc.head.append(script);
	return true;
};

/**
 * The container id baked in by `bun-server build`, which inlines `BUN_PUBLIC_*` variables
 * written as property access. The dev server inlines nothing and has no `process`, so the
 * read throws there and GTM stays off.
 */
const readGtmId = (): string | undefined => {
	try {
		return process.env.BUN_PUBLIC_GTM_ID;
	} catch {
		return undefined;
	}
};

loadGtm(readGtmId(), document);
