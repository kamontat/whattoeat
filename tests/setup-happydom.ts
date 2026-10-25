import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
	// Never fetch external scripts (such as gtm.js); report them as loaded instead of erroring.
	settings: { handleDisabledFileLoadingAsSuccess: true },
});

// `#lib/i18n` sets `document.documentElement.lang` as soon as it loads, so it (and anything that
// imports it, including `#lib/profiles`) can only be imported after `document` exists above.
const { forgetProfilesMemory } = await import("#lib/profiles");

// A test that mocks localStorage to simulate a blocked write can leave `profiles.ts` stuck in its
// in-memory fallback, which would otherwise leak into every later test across every file.
afterEach(() => {
	forgetProfilesMemory();
});
