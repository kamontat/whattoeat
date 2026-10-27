import { readBuildInfo } from "#lib/build-info";

type WorkerNavigator = {
	serviceWorker?: Pick<ServiceWorkerContainer, "register">;
};

/**
 * Register `/sw.js`, which `bun run build` writes, so the app opens without a connection.
 * Returns `false`, touching nothing, when `enabled` is false or the browser has no service
 * workers. A failed registration only means the app needs the network, so it is swallowed.
 */
export const registerServiceWorker = (
	navigator: WorkerNavigator,
	enabled: boolean,
): boolean => {
	if (!enabled || navigator.serviceWorker === undefined) return false;
	navigator.serviceWorker
		.register("/sw.js", { scope: "/" })
		.catch(() => undefined);
	return true;
};

// The dev server bakes in no build time and serves no sw.js, so only a built page registers.
registerServiceWorker(navigator, readBuildInfo().date !== undefined);
