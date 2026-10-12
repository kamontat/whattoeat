import { afterEach, expect, test } from "bun:test";
import { loadGtm } from "#lib/gtm";

type GtmWindow = Window & { dataLayer?: unknown[] };

const gtmScripts = () =>
	document.querySelectorAll(
		'script[src^="https://www.googletagmanager.com/gtm.js"]',
	);

afterEach(() => {
	document.head.innerHTML = "";
	delete (window as GtmWindow).dataLayer;
});

test("injects the container script for a valid id", () => {
	expect(loadGtm("GTM-ABC1234", document)).toBe(true);
	const scripts = gtmScripts();
	expect(scripts).toHaveLength(1);
	expect(scripts[0]?.getAttribute("src")).toBe(
		"https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234",
	);
	expect(scripts[0]?.hasAttribute("async")).toBe(true);
});

test("pushes the gtm.start event to dataLayer", () => {
	loadGtm("GTM-ABC1234", document);
	const [event] = (window as GtmWindow).dataLayer ?? [];
	expect(event).toMatchObject({ event: "gtm.js" });
	expect(typeof (event as { "gtm.start": unknown })["gtm.start"]).toBe(
		"number",
	);
});

test("keeps entries already in dataLayer", () => {
	(window as GtmWindow).dataLayer = [{ consent: "default" }];
	loadGtm("GTM-ABC1234", document);
	expect((window as GtmWindow).dataLayer?.[0]).toEqual({ consent: "default" });
	expect((window as GtmWindow).dataLayer).toHaveLength(2);
});

test.each([undefined, "", "UA-12345-1", "GTM-abc", 'GTM-1"><script>'])(
	"does nothing for id %p",
	(id) => {
		expect(loadGtm(id, document)).toBe(false);
		expect(gtmScripts()).toHaveLength(0);
		expect((window as GtmWindow).dataLayer).toBeUndefined();
	},
);

test("does not inject twice", () => {
	loadGtm("GTM-ABC1234", document);
	expect(loadGtm("GTM-ABC1234", document)).toBe(false);
	expect(gtmScripts()).toHaveLength(1);
});
