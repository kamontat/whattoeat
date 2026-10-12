import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
	// Never fetch external scripts (such as gtm.js); report them as loaded instead of erroring.
	settings: { handleDisabledFileLoadingAsSuccess: true },
});
