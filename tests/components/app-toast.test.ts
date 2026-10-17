import { afterEach, expect, spyOn, test } from "bun:test";
import "#components/app-toast";
import { AppToast } from "#components/app-toast";

afterEach(() => {
	document.body.innerHTML = "";
});

const mount = async () => {
	const el = document.createElement("app-toast");
	document.body.append(el);
	await el.updateComplete;
	return el;
};

const $ = (el: AppToast, selector: string) =>
	el.shadowRoot!.querySelector<HTMLElement>(selector);

/** Replaces `setTimeout`/`clearTimeout` with spies that record calls instead of scheduling. */
const fakeTimers = () => {
	const delays: number[] = [];
	const cleared: unknown[] = [];
	const handlers = new Map<number, () => void>();
	let nextId = 0;
	const timeout = spyOn(globalThis, "setTimeout").mockImplementation(((
		handler: () => void,
		delay?: number,
	) => {
		delays.push(delay ?? 0);
		const id = ++nextId;
		handlers.set(id, handler);
		return id as unknown as ReturnType<typeof setTimeout>;
	}) as unknown as typeof setTimeout);
	const clear = spyOn(globalThis, "clearTimeout").mockImplementation(((
		handle?: ReturnType<typeof setTimeout>,
	) => {
		cleared.push(handle);
	}) as unknown as typeof clearTimeout);
	return {
		delays,
		cleared,
		/** Runs the most recently scheduled timer's callback, as if it had fired. */
		fire: (): void => handlers.get(nextId)?.(),
		restore: () => {
			timeout.mockRestore();
			clear.mockRestore();
		},
	};
};

/** Flattens a Lit `styles` array (which may nest `uiStyles` and other arrays) to one string. */
const flatten = (styles: unknown): string =>
	[styles]
		.flat(Number.POSITIVE_INFINITY)
		.map((style) => (style as { cssText: string }).cssText)
		.join("\n");

test("show renders the message and the action", async () => {
	const el = await mount();
	expect($(el, '[role="status"]')).toBeNull();
	el.show("Added 3 restaurants", { action: "Undo" });
	await el.updateComplete;
	expect($(el, '[role="status"]')?.textContent).toContain(
		"Added 3 restaurants",
	);
	expect($(el, 'button[data-action="toast-action"]')?.textContent?.trim()).toBe(
		"Undo",
	);
});

test("show with no action renders no button", async () => {
	const el = await mount();
	el.show("Undone.");
	await el.updateComplete;
	expect($(el, '[role="status"]')?.textContent?.trim()).toBe("Undone.");
	expect($(el, 'button[data-action="toast-action"]')).toBeNull();
});

test("the action runs onAction and hides", async () => {
	const el = await mount();
	let called = false;
	el.show("Added 3 restaurants", {
		action: "Undo",
		onAction: () => {
			called = true;
		},
	});
	await el.updateComplete;
	$(el, 'button[data-action="toast-action"]')!.click();
	await el.updateComplete;
	expect(called).toBe(true);
	expect($(el, '[role="status"]')).toBeNull();
});

test("it hides after the duration", async () => {
	const timers = fakeTimers();
	try {
		const el = await mount();
		el.show("Added 3 restaurants", { action: "Undo" });
		await el.updateComplete;
		expect(timers.delays).toEqual([6000]);
		timers.fire();
		await el.updateComplete;
		expect($(el, '[role="status"]')).toBeNull();
	} finally {
		timers.restore();
	}
});

test("a custom duration is used instead of the default", async () => {
	const timers = fakeTimers();
	try {
		const el = await mount();
		el.show("Undone.", { duration: 3000 });
		await el.updateComplete;
		expect(timers.delays).toEqual([3000]);
	} finally {
		timers.restore();
	}
});

test("hover and focus pause the timer, and restart it on leave", async () => {
	const timers = fakeTimers();
	try {
		const el = await mount();
		el.show("Added 3 restaurants", { action: "Undo" });
		await el.updateComplete;
		const status = $(el, '[role="status"]')!;

		status.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
		expect(timers.cleared).toHaveLength(1);
		status.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
		expect(timers.delays).toEqual([6000, 6000]);

		status.dispatchEvent(
			new FocusEvent("focusin", { bubbles: true, composed: true }),
		);
		expect(timers.cleared).toHaveLength(2);
		status.dispatchEvent(
			new FocusEvent("focusout", { bubbles: true, composed: true }),
		);
		expect(timers.delays).toEqual([6000, 6000, 6000]);
	} finally {
		timers.restore();
	}
});

test("show again replaces the message and restarts the timer", async () => {
	const timers = fakeTimers();
	try {
		const el = await mount();
		el.show("Added 3 restaurants", { action: "Undo" });
		await el.updateComplete;
		el.show("Undone.", { duration: 3000 });
		await el.updateComplete;
		expect($(el, '[role="status"]')?.textContent?.trim()).toBe("Undone.");
		expect($(el, 'button[data-action="toast-action"]')).toBeNull();
		expect(timers.delays).toEqual([6000, 3000]);
		expect(timers.cleared).toHaveLength(1);
	} finally {
		timers.restore();
	}
});

test("hide clears the timer and removes the message", async () => {
	const timers = fakeTimers();
	try {
		const el = await mount();
		el.show("Added 3 restaurants", { action: "Undo" });
		await el.updateComplete;
		el.hide();
		await el.updateComplete;
		expect($(el, '[role="status"]')).toBeNull();
		expect(timers.cleared).toHaveLength(1);
	} finally {
		timers.restore();
	}
});

test("the action button keeps the 44px tap target, not a shrunk link", () => {
	const css = flatten(AppToast.styles);
	const rule = css.match(
		/button\[data-action="toast-action"\]\s*\{([^}]*)\}/,
	)?.[1];
	expect(rule).toContain("min-height: var(--tap)");
	expect(rule).not.toContain("min-height: 0");
});
