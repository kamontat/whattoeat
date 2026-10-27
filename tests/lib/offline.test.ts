import { expect, test } from "bun:test";
import { registerServiceWorker } from "#lib/offline";

const fakeNavigator = () => {
	const calls: [string, RegistrationOptions | undefined][] = [];
	return {
		calls,
		navigator: {
			serviceWorker: {
				register: async (url: string, options?: RegistrationOptions) => {
					calls.push([url, options]);
					return {} as ServiceWorkerRegistration;
				},
			},
		},
	};
};

test("registers /sw.js for the whole site in a built page", () => {
	const { calls, navigator } = fakeNavigator();
	expect(registerServiceWorker(navigator, true)).toBe(true);
	expect(calls).toEqual([["/sw.js", { scope: "/" }]]);
});

test("does nothing on the dev server, which has no sw.js", () => {
	const { calls, navigator } = fakeNavigator();
	expect(registerServiceWorker(navigator, false)).toBe(false);
	expect(calls).toEqual([]);
});

test("does nothing in a browser without service workers", () => {
	expect(registerServiceWorker({}, true)).toBe(false);
});

test("swallows a failed registration", async () => {
	const navigator = {
		serviceWorker: {
			register: () => Promise.reject(new Error("blocked")),
		},
	};
	expect(registerServiceWorker(navigator, true)).toBe(true);
	await Bun.sleep(0);
});
